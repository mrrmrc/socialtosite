<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/keys.php';

$platform = $_GET['platform'] ?? '';

if (in_array($platform, ['facebook', 'instagram', 'instagram_personal', 'instagram_login'], true)) {
    http_response_code(410);
    echo "Facebook e Instagram non usano piu' Meta Graph API. Torna all'applicazione e incolla il link pubblico del profilo: i contenuti saranno acquisiti dai provider configurati.";
    exit;
}

if ($platform === 'youtube' || $platform === 'tiktok') {
    // JWT Decoder
    require_once __DIR__ . '/../middleware/jwt.php';
    $token = $_GET['token'] ?? '';
    $user_id = 0;
    if ($token) {
        try {
            $decoded = JWT::decode($token);
            if (isset($decoded['id'])) $user_id = (int)$decoded['id'];
        } catch (Exception $e) {}
    }

    // Generiamo uno state che contenga sia il token anti-CSRF che l'user_id e la piattaforma
    $csrf = bin2hex(random_bytes(16));
    $state_data = json_encode(['csrf' => $csrf, 'user_id' => $user_id, 'platform' => $platform]);
    $state = base64_encode($state_data);
    
    session_start();
    $_SESSION['oauth_state'] = $csrf;

    $redirect_uri = BASE_URL . '/api/auth/oauth_callback.php';
    
    if ($platform === 'youtube') {
        $auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id'     => GOOGLE_CLIENT_ID,
            'redirect_uri'  => GOOGLE_REDIRECT_URI,
            'scope'         => 'https://www.googleapis.com/auth/youtube.readonly',
            'response_type' => 'code',
            'access_type'   => 'offline',
            'state'         => $state,
        ]);
    } elseif ($platform === 'tiktok') {
        $auth_url = 'https://www.tiktok.com/v2/auth/authorize/?' . http_build_query([
            'client_key'    => TIKTOK_CLIENT_KEY,
            'redirect_uri'  => TIKTOK_REDIRECT_URI,
            'scope'         => 'user.info.basic,video.list',
            'response_type' => 'code',
            'state'         => $state,
        ]);
    }

    // Reindirizziamo l'utente alla pagina di login
    header("Location: " . $auth_url);
    exit;
} else {
    echo "Piattaforma non supportata.";
    exit;
}
