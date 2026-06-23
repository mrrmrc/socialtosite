<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';

echo "Test DB connection:\n";
try {
    $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy FROM sites LIMIT 1');
    print_r($site);
} catch (Exception $e) {
    echo "DB Error: " . $e->getMessage() . "\n";
}
