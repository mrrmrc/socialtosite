<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/keys.php';

$platform = $_GET['platform'] ?? '';

if ($platform === 'facebook' || $platform === 'instagram') {
    // Generiamo uno state casuale per prevenire CSRF
    $state = bin2hex(random_bytes(16));
    
    // In un'app reale, salveremmo lo stato in sessione
    session_start();
    $_SESSION['oauth_state'] = $state;

    // Costruiamo l'URL di redirect verso Meta
    // Nota: L'URI di redirect deve essere registrato esattamente così nelle impostazioni di Facebook Login
    $redirect_uri = BASE_URL . '/api/auth/oauth_callback.php';
    
    // Scopes (permessi) richiesti. 
    // Per Instagram Graph API serve: instagram_basic, pages_show_list, ecc.
    // Per i post Facebook: user_posts
    $scopes = ['email', 'public_profile', 'user_posts']; 
    
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
