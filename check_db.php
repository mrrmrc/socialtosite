<?php
require_once 'config/db.php';
$cols = DB::fetchAll("SHOW COLUMNS FROM sites");
echo json_encode($cols);
