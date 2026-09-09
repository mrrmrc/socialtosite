<?php
require_once __DIR__ . '/../../config/db.php';

$email = 'admin@socialtosite.com';
$password = 'password123';
$hash = password_hash($password, PASSWORD_DEFAULT);

$admin = DB::fetch("SELECT id FROM users WHERE email=? OR slug=?", [$email, 'admin']);
if ($admin) {
    DB::execute("UPDATE users SET password=?, role='admin' WHERE id=?", [$hash, $admin['id']]);
    echo "Admin password reset to: $password";
} else {
    DB::insert('INSERT INTO users (email,password,name,slug,role,plan) VALUES (?,?,?,?,?,?)', [
        $email, $hash, 'Amministratore', 'admin', 'admin', 'agency'
    ]);
    echo "Admin created. Email: $email, Password: $password";
}
