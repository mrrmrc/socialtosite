<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/keys.php';

$platform = $_GET['platform'] ?? '';

if ($platform === 'facebook' || $platform === 'instagram') {
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

    // Generiamo uno state che contenga sia il token anti-CSRF che l'user_id
    $csrf = bin2hex(random_bytes(16));
    $state_data = json_encode(['csrf' => $csrf, 'user_id' => $user_id]);
    $state = base64_encode($state_data);
    
    // In un'app reale, salveremmo lo stato in sessione
    session_start();
    $_SESSION['oauth_state'] = $csrf;

    // Costruiamo l'URL di redirect verso Meta
    // Nota: L'URI di redirect deve essere registrato esattamente così nelle impostazioni di Facebook Login
    $redirect_uri = BASE_URL . '/api/auth/oauth_callback.php';
    
    // Scopes (permessi) richiesti. 
    // Per Instagram Graph API serve: instagram_basic, pages_show_list, ecc.
    // Per i post Facebook: user_posts, user_photos, user_videos
    $scopes = ['email', 'public_profile', 'user_posts', 'user_photos', 'user_videos']; 
    
    $auth_url = "https://www.facebook.com/v17.0/dialog/oauth?" . http_build_query([
        'client_id' => FB_APP_ID,
        'redirect_uri' => $redirect_uri,
        'state' => $state,
        'scope' => implode(',', $scopes)
    ]);

    // Reindirizziamo l'utente alla pagina di login di Meta
    header("Location: " . $auth_url);
    exit;
} else {
    echo "Piattaforma non supportata.";
    exit;
}
