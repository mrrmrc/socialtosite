<?php
// api/routes/auth.php
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/jwt.php';
require_once __DIR__ . '/../middleware/response.php';
require_once __DIR__ . '/../middleware/ratelimit.php';

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

    $ip = LoginGuard::clientIp();
    $retryAfter = LoginGuard::retryAfter($email, $ip);
    if ($retryAfter > 0) {
        header('Retry-After: ' . $retryAfter);
        $minuti = (int)ceil($retryAfter / 60);
        jsonError("Troppi tentativi di accesso. Riprova fra $minuti " . ($minuti === 1 ? 'minuto' : 'minuti') . '.', 429);
    }

    $user = DB::fetch('SELECT * FROM users WHERE email=?', [$email]);
    if (!$user || !password_verify($password, $user['password'])) {
        LoginGuard::record($email, $ip, false);
        jsonError('Credenziali non valide', 401);
    }
    LoginGuard::record($email, $ip, true);

    $role = $user['role'] ?? 'user';
    // token_version viaggia nel token: incrementarla sulla riga utente invalida
    // all'istante tutte le sessioni già aperte (unica leva se un token è rubato).
    $token = JWT::encode([
        'id'    => $user['id'],
        'email' => $user['email'],
        'slug'  => $user['slug'],
        'role'  => $role,
        'tv'    => (int)($user['token_version'] ?? 0),
    ]);
    json(['token' => $token, 'user' => [
        'id' => $user['id'], 'email' => $user['email'],
        'name' => $user['name'], 'slug' => $user['slug'], 'role' => $role
    ]]);
}

jsonError('Endpoint non trovato', 404);
