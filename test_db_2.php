<?php
require_once __DIR__ . '/config/db.php';
$posts = DB::fetchAll('SELECT id, user_id, platform, seo_score, published FROM posts ORDER BY id DESC LIMIT 20');
echo "Total posts in DB: " . count($posts) . "\n";
foreach ($posts as $p) {
    echo "ID: {$p['id']}, Platform: {$p['platform']}, SEO: {$p['seo_score']}, Published: {$p['published']}\n";
}
