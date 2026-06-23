<?php
require_once __DIR__ . '/../config/db.php';
try {
    $stmt = DB::query("DESCRIBE sites");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $colNames = array_column($columns, 'Field');
    echo implode(", ", $colNames);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
