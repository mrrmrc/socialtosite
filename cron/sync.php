<?php
// cron/sync.php — Esegui via cron job del tuo hosting ogni 6 ore
// Configura nel pannello hosting:
// 0 */6 * * * php /path/to/socialtosite/cron/sync.php

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../api/services/sync.php';
require_once __DIR__ . '/../api/middleware/response.php';

// Sicurezza: esegui solo da CLI
if (php_sapi_name() !== 'cli' && ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') {
    http_response_code(403); exit('Accesso negato');
}

echo "[" . date('Y-m-d H:i:s') . "] Avvio sync automatico...\n";

$users = DB::fetchAll(
    'SELECT DISTINCT user_id FROM social_connections WHERE active=1'
);

foreach ($users as $row) {
    $userId = $row['user_id'];
    echo "  Utente $userId...";
    try {
        $results = Sync::syncUser($userId);
        $new = array_sum(array_column($results, 'new'));
        echo " OK ($new nuovi contenuti)\n";
    } catch (Exception $e) {
        echo " ERRORE: {$e->getMessage()}\n";
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Sync completato — " . count($users) . " utenti\n";
