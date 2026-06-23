<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$userId = 1; // Assuming user 1
try {
    $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
    $posts = DB::fetchAll(
        'SELECT id, user_id, platform, platform_post_id, SUBSTR(raw_content, 1, 500) as raw_content, generated_title, generated_excerpt, tags, media_url, media_type, source_url, published_at, seo_score, slug, published FROM posts WHERE user_id=? ORDER BY published_at DESC LIMIT 300',
        [$userId]
    );
    $connections = DB::fetchAll(
        'SELECT platform, handle, active, since_date FROM social_connections WHERE user_id=?', [$userId]
    );
    $sources = DB::fetchAll(
        'SELECT id, platform, label, url, topic_summary, active, since_date FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
        [$userId]
    );
    foreach ($posts as &$p) {
        $decoded = json_decode($p['tags'] ?? '[]', true);
        if (!is_array($decoded)) {
            $decoded = is_string($p['tags']) ? explode(',', $p['tags']) : [];
        }
        $p['tags'] = array_filter(array_map('trim', $decoded));
    }
    
    $out = ['site' => $site, 'posts' => $posts, 'connections' => $connections, 'sources' => $sources];
    echo json_encode($out, JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString();
}
