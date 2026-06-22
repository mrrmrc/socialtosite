<?php
require_once __DIR__ . '/../config/db.php';
$users = DB::fetchAll('SELECT id, name, slug FROM users');
$out = [];
foreach ($users as $u) {
    $posts = DB::fetch('SELECT COUNT(*) as c FROM posts WHERE user_id=?', [$u['id']]);
    $conns = DB::fetch('SELECT COUNT(*) as c FROM social_connections WHERE user_id=?', [$u['id']]);
    $sources = DB::fetch('SELECT COUNT(*) as c FROM social_sources WHERE user_id=?', [$u['id']]);
    $out[] = [
        'id' => $u['id'],
        'slug' => $u['slug'],
        'posts' => $posts['c'],
        'conns' => $conns['c'],
        'sources' => $sources['c'],
    ];
}
echo json_encode($out, JSON_PRETTY_PRINT);
