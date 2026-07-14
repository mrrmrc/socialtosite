<?php
require_once 'config/db.php';
$posts = DB::fetchAll('SELECT platform, source_url FROM posts GROUP BY platform, source_url');
echo json_encode($posts);
