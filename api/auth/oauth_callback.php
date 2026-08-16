<?php
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/keys.php';
require_once __DIR__ . '/../../config/db.php'; // Assumendo che il file db.php esponga $pdo o simile

session_start();

$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? null;
$error = $_GET['error'] ?? null;

// Gestione errori da parte di Meta (es. l'utente ha rifiutato i permessi)
if ($error) {
    echo "Errore durante l'autenticazione: " . htmlspecialchars($_GET['error_description'] ?? $error);
    exit;
}

    $state_data = json_decode(base64_decode($state), true);
    $csrf = $state_data['csrf'] ?? '';
    $user_id = (int)($state_data['user_id'] ?? 1); // Fallback a 1 se manca

    // Verifica CSRF
    if (!$csrf || $csrf !== ($_SESSION['oauth_state'] ?? '')) {
        // In produzione potresti voler loggare questo evento
        // echo "Stato non valido (CSRF detection).";
        // exit;
    }

    $platform = $state_data['platform'] ?? 'facebook';

    $userPlan = DB::fetch('SELECT plan FROM users WHERE id=?', [$user_id])['plan'] ?? 'base';
    if (strtolower($userPlan) === 'base') {
        $activeConnectionsCount = (int) (DB::fetch('SELECT COUNT(*) as c FROM social_connections WHERE user_id=? AND active=1', [$user_id])['c'] ?? 0);
        if ($activeConnectionsCount >= 2) {
             echo "<h1>Limite del piano raggiunto</h1><p>Il tuo piano Base consente massimo 2 canali collegati.</p>";
             echo "<script>setTimeout(() => { window.location.href = '/'; }, 4000);</script>";
             exit;
        }
    }
    
if ($code) {
    $redirect_uri = BASE_URL . '/api/auth/oauth_callback.php';

    if ($platform === 'instagram_login') {
        // --- INSTAGRAM API WITH INSTAGRAM LOGIN ---
        $token_url = "https://api.instagram.com/oauth/access_token";
        $post_fields = http_build_query([
            'client_id' => IG_LOGIN_APP_ID,
            'client_secret' => IG_LOGIN_APP_SECRET,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $redirect_uri,
            'code' => $code
        ]);
        
        $ch = curl_init($token_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
        $response = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($response, true);

        if (isset($data['access_token'])) {
            $access_token = $data['access_token'];
            $platform_uid = $data['user_id'];
            
            // Long lived token exchange
            $ll_url = "https://graph.instagram.com/access_token?" . http_build_query([
                'grant_type' => 'ig_exchange_token',
                'client_secret' => IG_LOGIN_APP_SECRET,
                'access_token' => $access_token
            ]);
            $ll_response = @file_get_contents($ll_url);
            if ($ll_response) {
                $ll_data = json_decode($ll_response, true);
                if (isset($ll_data['access_token'])) $access_token = $ll_data['access_token'];
            }
            
            // User details
            $me_url = "https://graph.instagram.com/v20.0/me?fields=id,username&access_token=" . $access_token;
            $me_response = @file_get_contents($me_url);
            $me_data = json_decode($me_response, true);
            $handle = $me_data['username'] ?? 'Utente IG';

            try {
                DB::execute("
                    INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, connected_at, active)
                    VALUES (?, 'instagram_login', ?, ?, ?, NOW(), 1)
                    ON DUPLICATE KEY UPDATE 
                    access_token = VALUES(access_token), handle = VALUES(handle), active = 1, connected_at = NOW()
                ", [$user_id, $platform_uid, $handle, $access_token]);
                
                echo "<h1>Autenticazione Instagram completata!</h1>";
                echo "<script>setTimeout(() => { window.location.href = '/'; }, 3000);</script>";
            } catch (Throwable $e) { echo "Errore DB: " . $e->getMessage(); }
        } else {
            echo "Errore token IG: " . print_r($data, true);
        }
    } else {
        // --- FACEBOOK / IG AZIENDALE ---
        $token_url = "https://graph.facebook.com/v17.0/oauth/access_token?" . http_build_query([
            'client_id' => FB_APP_ID,
            'client_secret' => FB_APP_SECRET,
            'redirect_uri' => $redirect_uri,
            'code' => $code
        ]);

        $response = @file_get_contents($token_url);
        $data = json_decode($response, true);

        if (isset($data['access_token'])) {
            $access_token = $data['access_token'];
            
            $long_lived_url = "https://graph.facebook.com/v17.0/oauth/access_token?" . http_build_query([
                'grant_type' => 'fb_exchange_token',
                'client_id' => FB_APP_ID,
                'client_secret' => FB_APP_SECRET,
                'fb_exchange_token' => $access_token
            ]);
            $ll_response = @file_get_contents($long_lived_url);
            if ($ll_response) {
                $ll_data = json_decode($ll_response, true);
                if (isset($ll_data['access_token'])) $access_token = $ll_data['access_token'];
            }

            $me_url = "https://graph.facebook.com/v17.0/me?fields=id,name&access_token=" . $access_token;
            $me_response = @file_get_contents($me_url);
            $me_data = json_decode($me_response, true);
            
            if (isset($me_data['id'])) {
                $platform_uid = $me_data['id'];
                $handle = $me_data['name'] ?? '';
                
                try {
                    DB::execute("
                        INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, connected_at, active)
                        VALUES (?, 'facebook', ?, ?, ?, NOW(), 1)
                        ON DUPLICATE KEY UPDATE 
                        access_token = VALUES(access_token), handle = VALUES(handle), active = 1, connected_at = NOW()
                    ", [$user_id, $platform_uid, $handle, $access_token]);
                    
                    echo "<h1>Autenticazione FB completata!</h1>";
                    echo "<script>setTimeout(() => { window.location.href = '/'; }, 3000);</script>";
                } catch (Throwable $e) { echo "Errore DB: " . $e->getMessage(); }
            } else { echo "Errore ID utente Meta."; }
        } else { echo "Errore token FB: " . print_r($data, true); }
    }
} else {
    echo "Nessun codice di autorizzazione ricevuto.";
}
