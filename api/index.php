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
if (in_array($action, ['login', 'register', 'site-public', 'debug-site', 'migrate'])) {
    if ($action === 'migrate') {
        try {
            DB::execute('ALTER TABLE social_sources ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date');
        } catch (Throwable $e) {}
        try {
            DB::execute('ALTER TABLE social_connections ADD COLUMN auto_publish TINYINT DEFAULT 1 AFTER since_date');
        } catch (Throwable $e) {}
        json(['ok' => true, 'msg' => 'Migration applied']);
    }
    require __DIR__ . '/routes/auth.php';
    exit;
}

// Tutti gli altri endpoint richiedono JWT
$me = JWT::require();
$userId = $me['id'];
$isAdmin = ($me['role'] ?? 'user') === 'admin';

function requireAdmin(bool $isAdmin): void {
    if (!$isAdmin) jsonError('Permessi amministratore richiesti', 403);
}

function uniqueUserSlug(string $source): string {
    $slug = slugify($source);
    if (!$slug) $slug = 'utente';
    $base = $slug;
    $i = 1;
    while (DB::fetch('SELECT id FROM users WHERE slug=?', [$slug])) {
        $slug = $base . '-' . $i++;
    }
    return $slug;
}

function detectSocialPlatform(string $url): string {
    $u = strtolower($url);
    if (str_contains($u, 'youtube.com') || str_contains($u, 'youtu.be')) return 'youtube';
    if (str_contains($u, 'tiktok.com')) return 'tiktok';
    if (str_contains($u, 'instagram.com')) return 'instagram';
    if (str_contains($u, 'facebook.com') || str_contains($u, 'fb.com')) return 'facebook';
    return '';
}

function validSiteThemes(): array {
    return ['classic', 'journal', 'authority', 'portfolio', 'magazine', 'minimal', 'studio', 'local', 'academy', 'timeline', 'bottega'];
}

if ($action === 'admin-users' && $method === 'GET') {
    requireAdmin($isAdmin);
    $users = DB::fetchAll(
        'SELECT u.id, u.email, u.name, u.slug, u.role, u.plan, u.created_at,
                s.title AS site_title, s.last_sync, s.role_mission, s.content_strategy,
                COUNT(DISTINCT sc.id) AS connections_count,
                COUNT(DISTINCT p.id) AS posts_count
         FROM users u
         LEFT JOIN sites s ON s.user_id = u.id
         LEFT JOIN social_connections sc ON sc.user_id = u.id AND sc.active = 1
         LEFT JOIN posts p ON p.user_id = u.id AND p.published = 1
         GROUP BY u.id
         ORDER BY u.created_at DESC'
    );
    json(['users' => $users]);
}

if ($action === 'admin-create-user' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $email = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    $name = trim($b['name'] ?? '');
    $role = ($b['role'] ?? 'user') === 'admin' ? 'admin' : 'user';

    if (!$email || !$password) jsonError('Email e password richiesti');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Email non valida');
    if (strlen($password) < 8) jsonError('Password minimo 8 caratteri');
    if (DB::fetch('SELECT id FROM users WHERE email=?', [$email])) jsonError('Email gia registrata', 409);

    $slug = uniqueUserSlug($name ?: explode('@', $email)[0]);
    $userId = DB::insert(
        'INSERT INTO users (email, password, name, slug, role) VALUES (?,?,?,?,?)',
        [$email, password_hash($password, PASSWORD_BCRYPT), $name, $slug, $role]
    );
    DB::execute('INSERT INTO sites (user_id, title) VALUES (?,?)', [$userId, $name ?: $email]);
    json(['ok' => true, 'user' => ['id' => $userId, 'email' => $email, 'name' => $name, 'slug' => $slug, 'role' => $role]], 201);
}

if ($action === 'admin-update-user' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $targetId = (int)($b['id'] ?? 0);
    if (!$targetId) jsonError('Utente non valido');

    $target = DB::fetch('SELECT * FROM users WHERE id=?', [$targetId]);
    if (!$target) jsonError('Utente non trovato', 404);

    $name = array_key_exists('name', $b) ? trim($b['name']) : $target['name'];
    $plan = array_key_exists('plan', $b) ? trim($b['plan']) : $target['plan'];
    $role = array_key_exists('role', $b) ? $b['role'] : ($target['role'] ?? 'user');
    $role = $role === 'admin' ? 'admin' : 'user';

    DB::execute('UPDATE users SET name=?, plan=?, role=? WHERE id=?', [$name, $plan, $role, $targetId]);
    if (isset($b['password']) && strlen($b['password']) >= 8) {
        DB::execute('UPDATE users SET password=? WHERE id=?', [password_hash($b['password'], PASSWORD_BCRYPT), $targetId]);
    }
    
    if (array_key_exists('role_mission', $b) || array_key_exists('content_strategy', $b)) {
        DB::execute('UPDATE sites SET role_mission=COALESCE(?,role_mission), content_strategy=COALESCE(?,content_strategy) WHERE user_id=?',
            [$b['role_mission'] ?? null, $b['content_strategy'] ?? null, $targetId]);
    }
    
    json(['ok' => true]);
}

if ($action === 'admin-delete-user' && $method === 'POST') {
    $b = body();
    $targetId = (int)($b['id'] ?? 0);
    if (!$targetId) jsonError('Utente non valido');
    if ($targetId === (int)$userId) jsonError('Non puoi eliminare il tuo account amministratore');

    DB::execute('DELETE FROM users WHERE id=?', [$targetId]);
    json(['ok' => true]);
}

if ($action === 'social-sources' && $method === 'GET') {
    $sources = DB::fetchAll(
        'SELECT id, platform, label, url, topic_summary, active, created_at
           FROM social_sources
          WHERE user_id=? AND active=1
          ORDER BY platform, id DESC',
        [$userId]
    );
    json($sources);
}

if ($action === 'social-source-create' && $method === 'POST') {
    $b = body();
    $url = trim($b['url'] ?? '');
    $label = trim($b['label'] ?? '');
    $platform = trim($b['platform'] ?? '') ?: detectSocialPlatform($url);

    if (!filter_var($url, FILTER_VALIDATE_URL)) jsonError('Link social non valido');
    if (!$platform) jsonError('Piattaforma non riconosciuta');
    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube'], true)) {
        jsonError('Piattaforma non supportata');
    }

    $sinceDate = trim($b['since_date'] ?? '');
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    $topic = 'Profilo/canale ' . $platform . ' indicato dall\'utente';
    if ($label) $topic .= ': ' . $label;

    try {
        $id = DB::insert(
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, since_date) VALUES (?,?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic, $sinceDate ?: null]
        );
    } catch (Throwable $e) {
        jsonError('Questo social e gia presente per l\'utente', 409);
    }

    json(['ok' => true, 'source' => [
        'id' => $id, 'platform' => $platform, 'label' => $label, 'url' => $url,
        'topic_summary' => $topic, 'active' => 1, 'since_date' => $sinceDate ?: null
    ]], 201);
}

if ($action === 'social-source-upsert' && $method === 'POST') {
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $url = trim($b['url'] ?? '');
    $label = trim($b['label'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube'], true)) {
        jsonError('Piattaforma non supportata');
    }
    if ($url === '') {
        DB::execute('UPDATE social_sources SET active=0 WHERE user_id=? AND platform=?', [$userId, $platform]);
        json(['ok' => true]);
    }
    if (!filter_var($url, FILTER_VALIDATE_URL)) jsonError('Link social non valido');

    $existing = DB::fetch('SELECT id FROM social_sources WHERE user_id=? AND platform=? LIMIT 1', [$userId, $platform]);
    $topic = 'Profilo/canale ' . $platform . ' indicato dall\'utente';
    if ($label) $topic .= ': ' . $label;

    if ($existing) {
        DB::execute(
            'UPDATE social_sources SET label=?, url=?, topic_summary=?, active=1, since_date=? WHERE id=? AND user_id=?',
            [$label, $url, $topic, $sinceDate ?: null, $existing['id'], $userId]
        );
        $id = (int)$existing['id'];
    } else {
        $id = DB::insert(
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, since_date) VALUES (?,?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic, $sinceDate ?: null]
        );
    }
    json(['ok' => true, 'source' => ['id' => $id, 'platform' => $platform, 'label' => $label, 'url' => $url, 'topic_summary' => $topic, 'since_date' => $sinceDate ?: null]]);
}

if ($action === 'social-connection-update' && $method === 'POST') {
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube'], true)) {
        jsonError('Piattaforma non supportata');
    }

    DB::execute(
        'UPDATE social_connections SET since_date=? WHERE user_id=? AND platform=?',
        [$sinceDate ?: null, $userId, $platform]
    );
    json(['ok' => true]);
}

if ($action === 'social-source-delete' && $method === 'POST') {
    $b = body();
    DB::execute(
        'UPDATE social_sources SET active=0 WHERE id=? AND user_id=?',
        [(int)($b['id'] ?? 0), $userId]
    );
    json(['ok' => true]);
}

if ($action === 'scan-sources' && $method === 'POST') {
    $b = body();
    $limit = max(1, min(10, (int)($b['limit'] ?? 5)));
    $profileSummary = trim($b['profile_summary'] ?? '');
    $roleMission = trim($b['role_mission'] ?? '');
    $contentStrategy = trim($b['content_strategy'] ?? '');
    $report = Ingest::scanSources($userId, $limit, $profileSummary, $roleMission, $contentStrategy);
    json(['ok' => true, 'report' => $report]);
}

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

// ── GET debug-site ──────────────────────────────────────────────────────────
if ($action === 'debug-site' && $method === 'GET') {
    $posts = DB::fetchAll('SELECT id, user_id, platform, SUBSTR(raw_content, 1, 100) as raw_content, generated_title, published_at FROM posts ORDER BY id DESC LIMIT 10');
    json(['count' => count($posts), 'posts' => $posts]);
}

// ── POST sync ─────────────────────────────────────────────────────────────
if ($action === 'sync' && $method === 'POST') {
    $b = body();
    $maxPosts = isset($b['limit']) ? (int)$b['limit'] : 20;
    $sinceDate = !empty($b['since_date']) ? $b['since_date'] : null;
    $results = Sync::syncUser($userId, $maxPosts, $sinceDate);
    json(['ok' => true, 'results' => $results]);
}

// ── GET site ──────────────────────────────────────────────────────────────
if ($action === 'site' && $method === 'GET') {
    try {
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $posts = DB::fetchAll(
            'SELECT id, user_id, platform, platform_post_id, SUBSTR(raw_content, 1, 500) as raw_content, generated_title, generated_excerpt, tags, media_url, media_type, source_url, published_at, seo_score, slug, published FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 300',
            [$userId]
        );
        $connections = DB::fetchAll(
            'SELECT platform, handle, active, since_date FROM social_connections WHERE user_id=?', [$userId]
        );
        $sources = DB::fetchAll(
            'SELECT id, platform, label, url, topic_summary, active, since_date FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
            [$userId]
        );
        foreach ($posts as &$p) {
            $p['tags'] = json_decode($p['tags'] ?? '[]', true);
        }
        json(['site' => $site, 'posts' => $posts, 'connections' => $connections, 'sources' => $sources]);
    } catch (Throwable $e) {
        file_put_contents(__DIR__ . '/site_error.log', $e->getMessage() . "\n" . $e->getTraceAsString());
        jsonError($e->getMessage());
    }
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
    $theme = $b['theme'] ?? null;
    if ($theme !== null && !in_array($theme, validSiteThemes(), true)) {
        jsonError('Layout non valido');
    }
    DB::execute(
        'UPDATE sites SET title=COALESCE(?,title), bio=COALESCE(?,bio), profile_summary=COALESCE(?,profile_summary), role_mission=COALESCE(?,role_mission), content_strategy=COALESCE(?,content_strategy), theme=COALESCE(?,theme) WHERE user_id=?',
        [$b['title'] ?? null, $b['bio'] ?? null, $b['profile_summary'] ?? null, $b['role_mission'] ?? null, $b['content_strategy'] ?? null, $theme, $userId]
    );
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
        'SELECT id, platform, media_url, source_url, transcript, published_at
           FROM posts WHERE user_id=? AND published=0 ORDER BY id DESC LIMIT 50',
        [$userId]
    );
    json($drafts);
}

jsonError('Endpoint non trovato', 404);
