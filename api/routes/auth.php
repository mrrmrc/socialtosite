<?php
// api/routes/auth.php
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/jwt.php';
require_once __DIR__ . '/../middleware/response.php';

cors();
$method = $_SERVER['REQUEST_METHOD'];
$path   = $_GET['action'] ?? '';

// Registrazioni pubbliche temporaneamente disabilitate.
// Il controllo vive nel backend per impedire chiamate dirette all'endpoint.
if ($path === 'register') {
    jsonError('Le registrazioni sono temporaneamente disabilitate', 403);
}

// POST /api/auth.php?action=login
if ($method === 'POST' && $path === 'login') {
    $b = body();
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';

    $user = DB::fetch('SELECT * FROM users WHERE email=?', [$email]);
    if (!$user || !password_verify($password, $user['password'])) {
        jsonError('Credenziali non valide', 401);
    }

    $role = $user['role'] ?? 'user';
    $token = JWT::encode(['id' => $user['id'], 'email' => $user['email'], 'slug' => $user['slug'], 'role' => $role]);
    json(['token' => $token, 'user' => [
        'id' => $user['id'], 'email' => $user['email'],
        'name' => $user['name'], 'slug' => $user['slug'], 'role' => $role
    ]]);
}

jsonError('Endpoint non trovato', 404);
