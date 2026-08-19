<?php
// api/auth/callback.php — OAuth callback per tutti i social
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/response.php';
require_once __DIR__ . '/../middleware/crypto.php';

$platform = $_GET['platform'] ?? '';
$code     = $_GET['code']     ?? '';
$state    = $_GET['state']    ?? '';
$error    = $_GET['error']    ?? '';

if (in_array($platform, ['facebook', 'instagram', 'instagram_login'], true)) {
    http_response_code(410);
    exit('Facebook e Instagram non usano piu\' OAuth/Graph API. Aggiungi il link pubblico del profilo nell\'applicazione.');
}

if ($error) {
    header('Location: ' . BASE_URL . '/?error=oauth_denied&platform=' . $platform);
    exit;
}

function curlPost(string $url, array $data, array $headers = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($data),
        CURLOPT_HTTPHEADER     => array_merge(['Accept: application/json'], $headers),
        CURLOPT_TIMEOUT        => 30,
    ]);
    $res = curl_exec($ch); curl_close($ch);
    return json_decode($res, true) ?? [];
}

function curlGet(string $url, array $params = [], string $token = ''): array {
    if ($params) $url .= '?' . http_build_query($params);
    $ch = curl_init($url);
    $headers = ['Accept: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 15]);
    $res = curl_exec($ch); curl_close($ch);
    return json_decode($res, true) ?? [];
}

try {
    // Recupera userId dallo state
    $stateData = json_decode(base64_decode($state), true);
    $userId    = $stateData['userId'] ?? null;
    if (!$userId) throw new Exception('State non valido');

    $accessToken = $refreshToken = $expiresAt = $handle = $platformUid = '';

    $userPlan = DB::fetch('SELECT plan FROM users WHERE id=?', [$userId])['plan'] ?? 'base';
    if (strtolower($userPlan) === 'base') {
        $activeConnectionsCount = (int) (DB::fetch('SELECT COUNT(*) as c FROM social_connections WHERE user_id=? AND active=1', [$userId])['c'] ?? 0);
        if ($activeConnectionsCount >= 2) {
             header('Location: ' . BASE_URL . '/?error=oauth_denied&reason=plan_limit_reached');
             exit;
        }
    }

    switch ($platform) {

        case 'tiktok':
            $ch = curl_init('https://open.tiktokapis.com/v2/oauth/token/');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query([
                    'client_key'    => TIKTOK_CLIENT_KEY,
                    'client_secret' => TIKTOK_CLIENT_SECRET,
                    'code'          => $code,
                    'grant_type'    => 'authorization_code',
                    'redirect_uri'  => TIKTOK_REDIRECT_URI,
                ]),
                CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
                CURLOPT_TIMEOUT    => 30,
            ]);
            $tokens      = json_decode(curl_exec($ch), true) ?? []; curl_close($ch);
            $accessToken = $tokens['access_token'] ?? '';
            $refreshToken= $tokens['refresh_token'] ?? '';
            $profile     = curlGet('https://open.tiktokapis.com/v2/user/info/',
                ['fields' => 'open_id,display_name'], $accessToken);
            $handle      = $profile['data']['user']['display_name'] ?? '';
            $platformUid = $profile['data']['user']['open_id']      ?? '';
            break;

        case 'youtube':
            $tokens = curlPost('https://oauth2.googleapis.com/token', [
                'client_id'     => GOOGLE_CLIENT_ID,
                'client_secret' => GOOGLE_CLIENT_SECRET,
                'redirect_uri'  => GOOGLE_REDIRECT_URI,
                'code'          => $code,
                'grant_type'    => 'authorization_code',
            ]);
            $accessToken  = $tokens['access_token']  ?? '';
            $refreshToken = $tokens['refresh_token']  ?? '';
            $expiresAt    = $tokens['expires_in']
                ? date('Y-m-d H:i:s', time() + $tokens['expires_in']) : '';
            $profile     = curlGet('https://www.googleapis.com/oauth2/v2/userinfo', [], $accessToken);
            $handle      = $profile['name'] ?? '';
            $platformUid = $profile['id']   ?? '';
            break;

        default:
            throw new Exception('Piattaforma non supportata');
    }

    if (!$accessToken) throw new Exception('Token non ricevuto');

    DB::execute('
        INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, refresh_token, expires_at)
        VALUES (?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          access_token=VALUES(access_token), refresh_token=VALUES(refresh_token),
          handle=VALUES(handle), platform_uid=VALUES(platform_uid), active=1
    ', [$userId, $platform, $platformUid, $handle,
        Crypto::encrypt($accessToken),
        $refreshToken ? Crypto::encrypt($refreshToken) : null,
        $expiresAt ?: null]);

    header('Location: ' . BASE_URL . '/?connected=' . $platform);

} catch (Exception $e) {
    error_log('[OAuth] ' . $e->getMessage());
    header('Location: ' . BASE_URL . '/?error=oauth_failed&platform=' . $platform);
}
exit;
