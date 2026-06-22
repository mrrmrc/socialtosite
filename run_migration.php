<?php
require 'api/config/db.php';
try {
    DB::execute('ALTER TABLE social_sources ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date');
    DB::execute('ALTER TABLE social_connections ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date');
    echo "OK";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
