<?php

ini_set('display_errors', '0');
set_time_limit(0);
ob_start();

function failJson(Throwable $error): void {
    $reference = bin2hex(random_bytes(5));
    error_log("[RAW-IMPORT $reference] " . $error->getMessage());
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Errore interno. Riferimento: ' . $reference], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler('failJson');

if (!file_exists(__DIR__ . '/../config/config.php')) {
    throw new RuntimeException('Configurazione del server mancante.');
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/middleware/jwt.php';
require_once __DIR__ . '/middleware/response.php';
require_once __DIR__ . '/services/raw_import.php';

cors();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($action === 'login' && $method === 'POST') {
    require __DIR__ . '/routes/auth.php';
    exit;
}

$identity = JWT::require();
$userId = (int)($identity['id'] ?? 0);
$user = DB::fetch('SELECT id, email, name, slug, role, plan, token_version FROM users WHERE id=?', [$userId]);
if (!$user || (int)($identity['tv'] ?? 0) !== (int)($user['token_version'] ?? 0)) {
    jsonError('Sessione non valida', 401);
}

RawImport::ensureSchema();

if ($action === 'me' && $method === 'GET') json(['user' => $user]);
if ($action === 'dashboard' && $method === 'GET') json(RawImport::dashboard($userId));

if ($action === 'sources' && $method === 'POST') {
    $payload = body();
    try {
        $source = RawImport::addSource($userId, (string)($payload['url'] ?? ''), (string)($payload['label'] ?? ''), isset($payload['since_date']) ? (string)$payload['since_date'] : null);
        json(['source' => $source], 201);
    } catch (InvalidArgumentException $e) {
        jsonError($e->getMessage(), 422);
    }
}

if ($action === 'source-period' && $method === 'POST') {
    $payload = body();
    try {
        json(['source' => RawImport::updateSourcePeriod($userId, (int)($payload['source_id'] ?? 0), isset($payload['since_date']) ? (string)$payload['since_date'] : null)]);
    } catch (InvalidArgumentException $e) {
        jsonError($e->getMessage(), 422);
    }
}

if ($action === 'potential-post' && $method === 'POST') {
    $payload = body();
    try {
        json(['content' => RawImport::updatePotentialPost($userId, (int)($payload['content_id'] ?? 0), (string)($payload['title'] ?? ''), (string)($payload['body'] ?? ''), isset($payload['image_url']) ? (string)$payload['image_url'] : null)]);
    } catch (InvalidArgumentException $e) {
        jsonError($e->getMessage(), 422);
    }
}

if ($action === 'import-start' && $method === 'POST') {
    $payload = body();
    json(['run' => RawImport::createRun($userId, (int)($payload['source_id'] ?? 0))], 201);
}

if ($action === 'import-execute' && $method === 'POST') {
    $payload = body();
    json(['run' => RawImport::execute($userId, (int)($payload['run_id'] ?? 0), (int)($payload['limit'] ?? 0))]);
}

if ($action === 'import-status' && $method === 'GET') {
    json(['run' => RawImport::runStatus($userId, (int)($_GET['run_id'] ?? 0))]);
}

if ($action === 'profile-refresh' && $method === 'POST') {
    json(['profile' => ProfileAnalyzer::analyze($userId), 'questions' => ProfileAnalyzer::questions($userId)]);
}

if ($action === 'profile-answer' && $method === 'POST') {
    $payload = body();
    try {
        $profile = ProfileAnalyzer::answer($userId, (int)($payload['question_id'] ?? 0), (string)($payload['answer'] ?? ''));
        json(['profile' => $profile, 'questions' => ProfileAnalyzer::questions($userId)]);
    } catch (InvalidArgumentException $e) {
        jsonError($e->getMessage(), 422);
    }
}

jsonError('Endpoint non trovato', 404);
