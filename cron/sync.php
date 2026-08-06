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

register_shutdown_function(function (): void {
    if (file_exists(__DIR__ . '/../config/gcp-credentials.json')) {
        echo "[" . date('Y-m-d H:i:s') . "] Aggiornamento Google Search Console...\n";
        require __DIR__ . '/../api/cron/fetch_seo.php';
    } else {
        echo "[" . date('Y-m-d H:i:s') . "] Search Console non configurata: metriche Google non aggiornate.\n";
    }
});

echo "[" . date('Y-m-d H:i:s') . "] Avvio sync automatico...\n";

$users = DB::fetchAll('
    SELECT DISTINCT user_id FROM social_connections WHERE active=1
    UNION
    SELECT DISTINCT user_id FROM social_sources WHERE active=1
');

foreach ($users as $row) {
    $userId = $row['user_id'];
    echo "  Utente $userId...";
    try {
        $results = Sync::syncUser($userId);
        $new = array_sum(array_column($results, 'new'));
        echo " OK ($new nuovi contenuti)\n";

        // Elaborazione in background (coda AI)
        $pending = DB::fetchAll('SELECT id FROM posts WHERE user_id=? AND seo_score=-1 ORDER BY id ASC', [$userId]);
        if (count($pending) > 0) {
            echo "  Coda AI: trovati " . count($pending) . " post da elaborare...\n";
            require_once __DIR__ . '/../api/services/ai.php';
            require_once __DIR__ . '/../api/services/ingest.php';
            foreach ($pending as $idx => $p) {
                echo "    [" . ($idx+1) . "/" . count($pending) . "] Elaborazione post #{$p['id']}... ";
                $postId = $p['id'];
                try {
                    $post = DB::fetch('SELECT media_url, media_type, raw_content, source_url, platform, transcript FROM posts WHERE id=?', [$postId]);
                    if (!$post) continue;
                    
                    $transcript = trim($post['transcript'] ?? '');
                    if (!$transcript && !empty($post['media_url']) && strtoupper($post['media_type']) === 'VIDEO') {
                        $cache = DB::fetch('SELECT transcript FROM posts WHERE (source_url=? OR media_url=?) AND transcript IS NOT NULL AND transcript != "" LIMIT 1', [$post['source_url'], $post['media_url']]);
                        if ($cache) {
                            $transcript = $cache['transcript'];
                        } else {
                            if ($post['platform'] === 'youtube') {
                                $transcript = AI::transcribeYouTube($post['media_url'] ?: $post['source_url']);
                            } else {
                                $parsedUrl = parse_url($post['media_url']);
                                $path = __DIR__ . '/../' . ltrim($parsedUrl['path'], '/');
                                if (file_exists($path)) {
                                    $transcript = AI::transcribeFile($path, 'video/mp4');
                                } else {
                                    $transcript = AI::transcribeUrl($post['media_url']);
                                }
                            }
                        }
                    }
                    
                    $raw = trim($transcript ?: ($post['raw_content'] ?? ''));
                    if ($raw) {
                        DB::execute('UPDATE posts SET transcript=? WHERE id=?', [$transcript, $postId]);
                        Ingest::harmonize($userId, $postId);
                        echo "OK\n";
                    } else {
                        DB::execute('DELETE FROM posts WHERE id=?', [$postId]);
                        echo "Saltato (nessun testo)\n";
                    }
                } catch (Throwable $e) {
                    echo "Errore: " . $e->getMessage() . "\n";
                    DB::execute('UPDATE posts SET agent_notes=? WHERE id=?', ['Errore: ' . $e->getMessage(), $postId]);
                }
            }
        }
    } catch (Exception $e) {
        echo " ERRORE: {$e->getMessage()}\n";
    }
}

echo "[" . date('Y-m-d H:i:s') . "] Sync completato — " . count($users) . " utenti\n";
