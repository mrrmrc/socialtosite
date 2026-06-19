<?php
// api/routes/auth.php
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/jwt.php';
require_once __DIR__ . '/../middleware/response.php';

cors();
$method = $_SERVER['REQUEST_METHOD'];
$path   = $_GET['action'] ?? '';

// POST /api/auth.php?action=register
if ($method === 'POST' && $path === 'register') {
    $b = body();
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    $name     = trim($b['name'] ?? '');

    if (!$email || !$password) jsonError('Email e password richiesti');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email non valida');
    if (strlen($password) < 8) jsonError('Password minimo 8 caratteri');

    if (DB::fetch('SELECT id FROM users WHERE email=?', [$email])) {
        jsonError('Email già registrata', 409);
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $slug = preg_replace('/[^a-z0-9]/', '', strtolower(explode('@', $email)[0]));
    // Rende slug unico
    $base = $slug; $i = 1;
    while (DB::fetch('SELECT id FROM users WHERE slug=?', [$slug])) {
        $slug = $base . $i++;
    }

    $hasUsers = DB::fetch('SELECT id FROM users LIMIT 1');
    $role = $hasUsers ? 'user' : 'admin';

    $userId = DB::insert(
        'INSERT INTO users (email, password, name, slug, role) VALUES (?,?,?,?,?)',
        [$email, $hash, $name, $slug, $role]
    );
    DB::execute('INSERT INTO sites (user_id, title) VALUES (?,?)', [$userId, $name ?: $email]);

    $token = JWT::encode(['id' => $userId, 'email' => $email, 'slug' => $slug, 'role' => $role]);
    json(['token' => $token, 'user' => ['id' => $userId, 'email' => $email, 'name' => $name, 'slug' => $slug, 'role' => $role]]);
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
