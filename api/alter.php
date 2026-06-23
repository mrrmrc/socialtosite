<?php
require_once __DIR__ . '/../config/db.php';
try {
    DB::execute('ALTER TABLE sites ADD COLUMN site_ai_data LONGTEXT');
    echo "Column site_ai_data added successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
