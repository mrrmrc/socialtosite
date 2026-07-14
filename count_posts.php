<?php
require_once 'config/db.php';
echo json_encode(DB::fetchAll('SELECT user_id, count(*) as c FROM posts GROUP BY user_id'));
