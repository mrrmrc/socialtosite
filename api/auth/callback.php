<?php

ini_set('display_errors', '0');
require_once __DIR__ . '/../services/social_oauth.php';

function oauthRedirect(array $query, string $returnTo = '/dashboard'): never {
    if (!preg_match('~^/(?:connect|dashboard)(?:/|$)~', $returnTo)) $returnTo = '/dashboard';
    header('Location: ' . app_base_url() . $returnTo . '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986));
    exit;
}

function oauthError(string $platform, Throwable|string $error, string $returnTo = '/dashboard'): never {
    $message = $error instanceof Throwable ? $error->getMessage() : $error;
    error_log('[OAuth ' . $platform . '] ' . $message);
    oauthRedirect(['oauth' => 'error', 'platform' => $platform, 'message' => mb_substr($message, 0, 240)], $returnTo);
}

$platform = strtolower(trim((string)($_GET['platform'] ?? $_POST['platform'] ?? '')));
$returnTo = '/dashboard';
if (!in_array($platform, SocialOAuth::supportedPlatforms(), true)) oauthError($platform ?: 'unknown', 'Piattaforma OAuth non supportata');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $platform === 'facebook') {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $csrf = (string)($_POST['csrf'] ?? '');
        $pending = $_SESSION['facebook_page_selection'] ?? null;
        if (!is_array($pending) || !hash_equals((string)($pending['csrf'] ?? ''), $csrf) || ($pending['expires'] ?? 0) < time()) {
            throw new RuntimeException('Selezione della Pagina scaduta. Ripeti il collegamento.');
        }
        $pageId = (string)($_POST['page_id'] ?? '');
        $selected = null;
        foreach (($pending['choices'] ?? []) as $choice) {
            if (hash_equals((string)($choice['platform_uid'] ?? ''), $pageId)) { $selected = $choice; break; }
        }
        if (!$selected) throw new RuntimeException('Pagina Facebook non valida');
        if (!empty($selected['token_encrypted'])) {
            $selected['access_token'] = Crypto::decrypt((string)$selected['access_token']);
            unset($selected['token_encrypted']);
        }
        SocialOAuth::saveConnection((int)$pending['user_id'], 'facebook', $selected);
        unset($_SESSION['facebook_page_selection']);
        oauthRedirect(['oauth' => 'connected', 'platform' => 'facebook'], (string)($pending['return_to'] ?? '/dashboard'));
    }

    $providerError = trim((string)($_GET['error_description'] ?? $_GET['error_message'] ?? $_GET['error'] ?? ''));
    $state = (string)($_GET['state'] ?? '');
    if ($providerError !== '') {
        if ($state !== '') {
            try { $returnTo = (string)SocialOAuth::consumeState($state, $platform)['return_to']; } catch (Throwable $ignored) {}
        }
        oauthError($platform, 'Autorizzazione non completata: ' . $providerError, $returnTo);
    }
    $code = (string)($_GET['code'] ?? '');
    if ($state === '' || $code === '') throw new RuntimeException('Callback OAuth incompleto');

    $stateData = SocialOAuth::consumeState($state, $platform);
    $userId = (int)$stateData['user_id'];
    $returnTo = (string)$stateData['return_to'];
    $result = SocialOAuth::exchange($platform, $code);
    if (!empty($result['connection'])) {
        SocialOAuth::saveConnection($userId, $platform, $result['connection']);
        oauthRedirect(['oauth' => 'connected', 'platform' => $platform], $returnTo);
    }

    $choices = $result['choices'] ?? [];
    if ($platform !== 'facebook' || !$choices) throw new RuntimeException('Il provider non ha restituito account collegabili');
    if (count($choices) === 1) {
        SocialOAuth::saveConnection($userId, 'facebook', $choices[0]);
        oauthRedirect(['oauth' => 'connected', 'platform' => 'facebook'], $returnTo);
    }

    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $csrf = bin2hex(random_bytes(24));
    foreach ($choices as &$choice) {
        $choice['access_token'] = Crypto::encrypt((string)$choice['access_token']);
        $choice['token_encrypted'] = true;
    }
    unset($choice);
    $_SESSION['facebook_page_selection'] = ['user_id' => $userId, 'return_to' => $returnTo, 'choices' => $choices, 'csrf' => $csrf, 'expires' => time() + 600];
    header('Content-Type: text/html; charset=utf-8');
    header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    echo '<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    echo '<title>Scegli la Pagina Facebook</title><style>body{font:16px system-ui;background:#f6f7fb;color:#172033;margin:0;padding:40px}main{max-width:620px;margin:auto;background:white;padding:28px;border-radius:18px;box-shadow:0 12px 40px #16213a18}button{display:block;width:100%;text-align:left;padding:16px;margin:10px 0;border:1px solid #d8ddea;border-radius:12px;background:#fff;font-weight:700;cursor:pointer}button:hover{border-color:#2563eb;background:#eff6ff}</style><main>';
    echo '<h1>Scegli la Pagina Facebook</h1><p>SocialToSite importerà contenuti soltanto dalla Pagina selezionata.</p>';
    foreach ($choices as $choice) {
        echo '<form method="post"><input type="hidden" name="platform" value="facebook"><input type="hidden" name="csrf" value="' . htmlspecialchars($csrf, ENT_QUOTES) . '"><input type="hidden" name="page_id" value="' . htmlspecialchars((string)$choice['platform_uid'], ENT_QUOTES) . '"><button type="submit">' . htmlspecialchars((string)$choice['handle'], ENT_QUOTES) . '</button></form>';
    }
    echo '</main></html>';
} catch (Throwable $e) {
    oauthError($platform, $e, $returnTo);
}
