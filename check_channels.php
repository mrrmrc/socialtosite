<?php
require_once 'config/db.php';
$sources = DB::fetchAll('SELECT * FROM social_sources');
$connections = DB::fetchAll('SELECT * FROM social_connections');
echo json_encode(['sources' => $sources, 'connections' => $connections]);
