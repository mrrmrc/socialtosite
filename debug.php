<?php
require 'api/config/db.php';
try {
    $posts = DB::fetchAll('SELECT id, user_id, platform, SUBSTR(raw_content, 1, 100) as c, published_at FROM posts ORDER BY id DESC LIMIT 10');
    echo json_encode(["status" => "ok", "count" => count($posts), "posts" => $posts], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
