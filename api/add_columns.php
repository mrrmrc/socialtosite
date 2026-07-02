<?php
require_once __DIR__ . '/config.php';
try {
    DB::execute('ALTER TABLE posts ADD COLUMN edited_title VARCHAR(255)');
    DB::execute('ALTER TABLE posts ADD COLUMN edited_body LONGTEXT');
    DB::execute('ALTER TABLE posts ADD COLUMN edited_excerpt TEXT');
    echo "Columns added.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
