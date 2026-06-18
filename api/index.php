<?php
// api/index.php — Router principale

// ── Gestione errori: restituisci SEMPRE JSON (mai 500 con corpo vuoto) ───────
ini_set('display_errors', '0');
$__emitErr = function (int $code, string $msg): void {
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
};
set_exception_handler(function (Throwable $e) use ($__emitErr) {
    $__emitErr(500, 'Eccezione: ' . $e->getMessage());
});
register_shutdown_function(function () use ($__emitErr) {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        $__emitErr(500, 'Errore fatale: ' . $e['message']);
    }
});
if (!file_exists(__DIR__ . '/../config/config.php')) {
    $__emitErr(500, 'config/config.php mancante sul server: copia config.example.php in config.php e compila i dati del database.');
}

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';
if (file_exists(__DIR__ . '/../config/keys.php')) require_once __DIR__ . '/../config/keys.php';
require_once __DIR__ . '/middleware/jwt.php';
require_once __DIR__ . '/middleware/response.php';
require_once __DIR__ . '/services/sync.php';
require_once __DIR__ . '/services/ingest.php';

cors();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ── Auth endpoints (no JWT) ───────────────────────────────────────────────
if (in_array($action, ['login', 'register'])) {
    require __DIR__ . '/routes/auth.php';
    exit;
}

// Tutti gli altri endpoint richiedono JWT
$me = JWT::require();
$userId = $me['id'];

// ── GET social/auth-url?platform=xxx ─────────────────────────────────────
if ($action === 'social-auth-url' && $method === 'GET') {
    $platform = $_GET['platform'] ?? '';
    $state    = base64_encode(json_encode(['userId' => $userId, 'platform' => $platform]));
    $urls = [
        'instagram' => 'https://www.facebook.com/v18.0/dialog/oauth?' . http_build_query([
            'client_id'     => META_APP_ID,
            'redirect_uri'  => META_REDIRECT_URI,
            'scope'         => 'instagram_basic,instagram_content_publish,pages_show_list',
            'response_type' => 'code', 'state' => $state,
        ]),
        'facebook' => 'https://www.facebook.com/v18.0/dialog/oauth?' . http_build_query([
            'client_id'     => META_APP_ID,
            'redirect_uri'  => str_replace('instagram', 'facebook', META_REDIRECT_URI),
            'scope'         => 'pages_read_engagement,pages_show_list',
            'response_type' => 'code', 'state' => $state,
        ]),
        'tiktok' => 'https://www.tiktok.com/v2/auth/authorize/?' . http_build_query([
            'client_key'    => TIKTOK_CLIENT_KEY,
            'redirect_uri'  => TIKTOK_REDIRECT_URI,
            'scope'         => 'user.info.basic,video.list',
            'response_type' => 'code', 'state' => $state,
        ]),
        'youtube' => 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id'     => GOOGLE_CLIENT_ID,
            'redirect_uri'  => GOOGLE_REDIRECT_URI,
            'scope'         => 'https://www.googleapis.com/auth/youtube.readonly',
            'response_type' => 'code',
            'access_type'   => 'offline',
            'state'         => $state,
        ]),
    ];
    if (!isset($urls[$platform])) jsonError('Piattaforma non supportata');
    json(['url' => $urls[$platform]]);
}

// ── GET social/connections ────────────────────────────────────────────────
if ($action === 'social-connections' && $method === 'GET') {
    $conns = DB::fetchAll(
        'SELECT platform, handle, connected_at, active FROM social_connections WHERE user_id=?',
        [$userId]
    );
    json($conns);
}

// ── DELETE social/connection?platform=xxx ─────────────────────────────────
if ($action === 'social-disconnect' && $method === 'POST') {
    $b = body();
    DB::execute('UPDATE social_connections SET active=0 WHERE user_id=? AND platform=?',
        [$userId, $b['platform'] ?? '']);
    json(['ok' => true]);
}

// ── POST sync ─────────────────────────────────────────────────────────────
if ($action === 'sync' && $method === 'POST') {
    $results = Sync::syncUser($userId);
    json(['ok' => true, 'results' => $results]);
}

// ── GET site ──────────────────────────────────────────────────────────────
if ($action === 'site' && $method === 'GET') {
    $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
    $posts = DB::fetchAll(
        'SELECT * FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 50',
        [$userId]
    );
    $connections = DB::fetchAll(
        'SELECT platform, handle, active FROM social_connections WHERE user_id=?', [$userId]
    );
    foreach ($posts as &$p) {
        $p['tags'] = json_decode($p['tags'] ?? '[]', true);
    }
    json(['site' => $site, 'posts' => $posts, 'connections' => $connections]);
}

// ── DELETE post ───────────────────────────────────────────────────────────
if ($action === 'hide-post' && $method === 'POST') {
    $b = body();
    DB::execute('UPDATE posts SET published=0 WHERE id=? AND user_id=?', [$b['id'] ?? 0, $userId]);
    json(['ok' => true]);
}

// ── PATCH site settings ───────────────────────────────────────────────────
if ($action === 'site-update' && $method === 'POST') {
    $b = body();
    DB::execute('UPDATE sites SET title=COALESCE(?,title), bio=COALESCE(?,bio) WHERE user_id=?',
        [$b['title'] ?? null, $b['bio'] ?? null, $userId]);
    json(['ok' => true]);
}

// ── AGENTE 1: POST ingest-url  { url } ────────────────────────────────────
if ($action === 'ingest-url' && $method === 'POST') {
    $b   = body();
    $res = Ingest::url($userId, $b['url'] ?? '');
    json($res);
}

// ── AGENTE 2: POST harmonize  { id } ──────────────────────────────────────
if ($action === 'harmonize' && $method === 'POST') {
    $b   = body();
    $res = Ingest::harmonize($userId, (int) ($b['id'] ?? 0));
    json($res);
}

// ── GET drafts: bozze importate non ancora armonizzate ────────────────────
if ($action === 'drafts' && $method === 'GET') {
    $drafts = DB::fetchAll(
        'SELECT id, platform, media_url, transcript, published_at
           FROM posts WHERE user_id=? AND published=0 ORDER BY id DESC LIMIT 50',
        [$userId]
    );
    json($drafts);
}

jsonError('Endpoint non trovato', 404);
