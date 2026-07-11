<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/keys.php';

$platform = $_GET['platform'] ?? '';

if ($platform === 'facebook' || $platform === 'instagram' || $platform === 'instagram_personal' || $platform === 'instagram_login' || $platform === 'youtube' || $platform === 'tiktok') {
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
    
    if ($platform === 'instagram_login') {
        $auth_url = "https://www.instagram.com/oauth/authorize?" . http_build_query([
            'client_id' => IG_LOGIN_APP_ID,
            'redirect_uri' => $redirect_uri,
            'scope' => 'instagram_business_basic',
            'response_type' => 'code',
            'state' => $state,
            'enable_fb_login' => 'false'
        ]);
    } elseif ($platform === 'youtube') {
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
    } else {
        $scopes = ['email', 'public_profile', 'user_posts', 'user_photos', 'user_videos']; 
        $auth_url = "https://www.facebook.com/v18.0/dialog/oauth?" . http_build_query([
            'client_id' => FB_APP_ID,
            'redirect_uri' => $redirect_uri,
            'state' => $state,
            'scope' => implode(',', $scopes)
        ]);
    }

    // Reindirizziamo l'utente alla pagina di login
    header("Location: " . $auth_url);
    exit;
} else {
    echo "Piattaforma non supportata.";
    exit;
}
