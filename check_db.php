<?php
require_once __DIR__ . '/config/db.php';
$posts = DB::fetchAll('SELECT id, platform, platform_post_id, published, seo_score, processing_status, created_at FROM posts ORDER BY created_at DESC LIMIT 10');
$logs = DB::fetchAll('SELECT provider, action, created_at FROM api_usage_logs ORDER BY created_at DESC LIMIT 5');
echo "POSTS:\n";
print_r($posts);
echo "\nLOGS:\n";
print_r($logs);
