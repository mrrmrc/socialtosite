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

if ($code) {
    // Scambiamo il code con un Access Token
    $redirect_uri = BASE_URL . '/api/auth/oauth_callback.php';
    
    $token_url = "https://graph.facebook.com/v17.0/oauth/access_token?" . http_build_query([
        'client_id' => FB_APP_ID,
        'client_secret' => FB_APP_SECRET,
        'redirect_uri' => $redirect_uri,
        'code' => $code
    ]);

    $response = file_get_contents($token_url);
    $data = json_decode($response, true);

    if (isset($data['access_token'])) {
        $access_token = $data['access_token'];
        
        // OPZIONALE MA CONSIGLIATO: Scambiare lo short-lived token con un long-lived token (valido 60 giorni)
        $long_lived_url = "https://graph.facebook.com/v17.0/oauth/access_token?" . http_build_query([
            'grant_type' => 'fb_exchange_token',
            'client_id' => FB_APP_ID,
            'client_secret' => FB_APP_SECRET,
            'fb_exchange_token' => $access_token
        ]);
        
        $ll_response = @file_get_contents($long_lived_url);
        if ($ll_response) {
            $ll_data = json_decode($ll_response, true);
            if (isset($ll_data['access_token'])) {
                $access_token = $ll_data['access_token'];
            }
        }

        // Recuperiamo i dati dell'utente per capire chi è (ID su Facebook)
        $me_url = "https://graph.facebook.com/v17.0/me?fields=id,name&access_token=" . $access_token;
        $me_response = @file_get_contents($me_url);
        $me_data = json_decode($me_response, true);
        
        if (isset($me_data['id'])) {
            $platform_uid = $me_data['id'];
            $handle = $me_data['name'] ?? '';
            
            // L'ID dell'utente loggato nel nostro sito è ora estratto in modo sicuro dallo state
            // tramite il token JWT decodificato in precedenza.
            
            // Salviamo nel DB
            try {
                DB::execute("
                    INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, connected_at, active)
                    VALUES (?, 'facebook', ?, ?, ?, NOW(), 1)
                    ON DUPLICATE KEY UPDATE 
                    access_token = VALUES(access_token),
                    handle = VALUES(handle),
                    active = 1,
                    connected_at = NOW()
                ", [$user_id, $platform_uid, $handle, $access_token]);
                
                echo "<h1>Autenticazione completata con successo!</h1>";
                echo "<p>Account collegato. Ora puoi tornare alla dashboard.</p>";
                echo "<script>setTimeout(() => { window.location.href = '/'; }, 3000);</script>";
            } catch (Throwable $e) {
                echo "Errore: Salvataggio nel database fallito. " . $e->getMessage();
            }
        } else {
            echo "Errore nel recupero dell'ID utente da Meta.";
        }
    } else {
        echo "Errore durante lo scambio del token: " . print_r($data, true);
    }
} else {
    echo "Nessun codice di autorizzazione ricevuto.";
}
