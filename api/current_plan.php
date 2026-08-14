<?php
ini_set('display_errors', '0');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/middleware/jwt.php';
require_once __DIR__ . '/middleware/response.php';

cors();
$me = JWT::require();
$userId = (int)($me['id'] ?? 0);
if (!$userId) jsonError('Sessione non valida', 401);

$user = DB::fetch('SELECT id, email, name, slug, role, plan FROM users WHERE id=?', [$userId]);
if (!$user) jsonError('Utente non trovato', 404);

$raw = strtolower(trim((string)($user['plan'] ?? 'base')));
$plan = $raw === 'agency' ? 'agency' : (($raw === 'professional' || $raw === 'pro') ? 'professional' : 'base');

if ($raw !== $plan) {
    try { DB::execute('UPDATE users SET plan=? WHERE id=?', [$plan, $userId]); } catch (Throwable $e) {}
}

json(['user' => [
    'id' => (int)$user['id'],
    'email' => $user['email'],
    'name' => $user['name'],
    'slug' => $user['slug'],
    'role' => $user['role'] ?? 'user',
    'plan' => $plan,
]]);
