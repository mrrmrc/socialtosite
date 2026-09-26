<?php
require_once __DIR__ . '/../config/db.php';
try {
    DB::execute("ALTER TABLE sites ADD COLUMN declared_strategy longtext DEFAULT NULL");
    echo "Migration OK";
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage();
}
