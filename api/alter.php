<?php
require_once __DIR__ . '/../config/db.php';
try {
    DB::execute('ALTER TABLE sites ADD COLUMN generated_layouts LONGTEXT');
    echo "Column generated_layouts added.\n";
} catch (Exception $e) {
    echo "Error generated_layouts: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN site_ai_data LONGTEXT');
    echo "Column site_ai_data added.\n";
} catch (Exception $e) {
    echo "Error site_ai_data: " . $e->getMessage() . "\n";
}
