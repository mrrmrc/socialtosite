<?php
require_once __DIR__ . '/../config/db.php';
$sql = file_get_contents(__DIR__ . '/../db/schema.sql');
$pdo = DB::getConnection();
try {
    $pdo->exec($sql);
    $pwd = password_hash('admin123', PASSWORD_BCRYPT);
    $pdo->exec("INSERT IGNORE INTO users (email, password, name, role) VALUES ('admin@admin.com', '$pwd', 'Admin', 'admin')");
    echo "<h1>Database Inizializzato con Successo!</h1>";
    echo "<p>Email: <b>admin@admin.com</b></p>";
    echo "<p>Password: <b>admin123</b></p>";
    echo "<p>Ora vai su <a href='/'>Home</a> e fai il login.</p>";
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}
