<?php
require_once __DIR__ . '/api/index.php'; // Include the whole context to get DB instance
// Wait, api/index.php might execute routing. Let's include DB directly.

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/db.php';

try {
    DB::execute("ALTER TABLE sites ADD COLUMN account_type VARCHAR(50) DEFAULT 'business'");
    echo "Column added successfully.\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Column already exists.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
