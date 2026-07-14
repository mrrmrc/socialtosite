<?php
require_once 'config/db.php';
echo json_encode(['sources' => DB::fetchAll('SELECT * FROM social_sources'), 'connections' => DB::fetchAll('SELECT * FROM social_connections')]);
