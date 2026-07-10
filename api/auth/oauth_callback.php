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

// Verifica CSRF
if (!$state || $state !== ($_SESSION['oauth_state'] ?? '')) {
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
            
            // TODO: Qui dovremmo avere l'ID dell'utente loggato nel nostro sito.
            // Per ora simuliamo che sia l'utente con ID 1 per i test.
            $user_id = 1; 
            
            // Salviamo nel DB
            global $pdo;
            if ($pdo) {
                $stmt = $pdo->prepare("
                    INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, connected_at)
                    VALUES (:user_id, 'facebook', :platform_uid, :handle, :access_token, NOW())
                    ON DUPLICATE KEY UPDATE 
                    access_token = :access_token_update,
                    handle = :handle_update,
                    connected_at = NOW()
                ");
                $stmt->execute([
                    ':user_id' => $user_id,
                    ':platform_uid' => $platform_uid,
                    ':handle' => $handle,
                    ':access_token' => $access_token,
                    ':access_token_update' => $access_token,
                    ':handle_update' => $handle
                ]);
                
                echo "<h1>Autenticazione completata con successo!</h1>";
                echo "<p>Account collegato. Ora puoi chiudere questa finestra.</p>";
                // In un'app reale: header("Location: /dashboard?success=1");
            } else {
                echo "Errore: Connessione al database mancante.";
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
