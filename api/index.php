<?php
// api/index.php — Router principale

// ── Gestione errori: restituisci SEMPRE JSON (mai 500 con corpo vuoto) ───────
ini_set('display_errors', '0');
set_time_limit(0);
$__emitErr = function (int $code, string $msg): void {
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
};
set_exception_handler(function (Throwable $e) use ($__emitErr) {
    $__emitErr(500, 'Eccezione in ' . basename($e->getFile()) . ':' . $e->getLine() . ' - ' . $e->getMessage());
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
require_once __DIR__ . '/middleware/logger.php';
require_once __DIR__ . '/services/sync.php';
require_once __DIR__ . '/services/ingest.php';

cors();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($action === 'debug-jwt') {
    $included = get_included_files();
    $jwtLoaded = false;
    foreach ($included as $f) {
        if (str_contains($f, 'jwt.php')) $jwtLoaded = true;
    }
    json(['ok' => true, 'jwt_loaded' => $jwtLoaded, 'class_exists' => class_exists('JWT'), 'files' => $included]);
}

// ── Auth endpoints (no JWT) ───────────────────────────────────────────────
if (in_array($action, ['login', 'register', 'site-public', 'debug-site', 'migrate'])) {
    if ($action === 'migrate') {
        try { DB::execute('ALTER TABLE social_sources ADD COLUMN since_date DATE NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE social_sources ADD COLUMN auto_publish TINYINT DEFAULT 1'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE social_sources ADD COLUMN max_posts INT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE social_connections ADD COLUMN since_date DATE NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE social_connections ADD COLUMN auto_publish TINYINT DEFAULT 1'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE social_connections ADD COLUMN max_posts INT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN menu_links TEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN cover_url TEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN logo_url TEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN footer_text TEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN accent_color VARCHAR(50) NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN header_layout VARCHAR(50) NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN custom_css TEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN generated_layouts LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN site_ai_data LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE posts ADD COLUMN featured TINYINT DEFAULT 0'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE posts ADD COLUMN edited_title VARCHAR(255) NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE posts ADD COLUMN edited_body LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE posts ADD COLUMN edited_excerpt TEXT NULL'); } catch (Throwable $e) {}
        try {
            DB::execute('CREATE TABLE IF NOT EXISTS agent_prompts (
              id INT AUTO_INCREMENT PRIMARY KEY,
              agent_name VARCHAR(50) UNIQUE NOT NULL,
              label VARCHAR(100) NOT NULL DEFAULT "",
              description TEXT NULL,
              instructions TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
            try { DB::execute('ALTER TABLE agent_prompts ADD COLUMN label VARCHAR(100) NOT NULL DEFAULT ""'); } catch (Throwable $e) {}
            try { DB::execute('ALTER TABLE agent_prompts ADD COLUMN description TEXT NULL'); } catch (Throwable $e) {}
            $c = DB::fetch('SELECT COUNT(*) as c FROM agent_prompts')['c'] ?? 0;
            if ($c == 0) {
                DB::execute('INSERT INTO agent_prompts (agent_name, label, description, instructions) VALUES
                    (?, ?, ?, ?),
                    (?, ?, ?, ?),
                    (?, ?, ?, ?),
                    (?, ?, ?, ?)',
                [
                    'content_editor', 'Content Editor', 'Filtra e riscrive i post social in articoli SEO-friendly.',
                    "Sei un editor editoriale esperto. Riscrivi questo contenuto in un articolo web.\n\nContenuto:\n{content}\n\nProfilo:\n{profileSummary}\n\nGenera JSON: {\"generated_title\":\"Titolo H1 max 70 caratteri\",\"generated_body\":\"Corpo articolo in paragrafi, min 300 parole\",\"generated_excerpt\":\"Sommario max 155 caratteri\",\"tags\":[\"tag1\"],\"meta_description\":\"Meta max 155 caratteri\",\"relevance_score\":80,\"seo_score\":85}",
                    'seo_specialist', 'SEO Specialist', 'Ottimizza titolo, bio e navigazione del sito in chiave Google.',
                    "Sei un SEO/GEO Specialist. Ottimizza i metadati del sito.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nStrategia:\n{contentStrategy}\n\nTag reali disponibili nel DB:\n[{tagsContext}]\n\nGenera JSON: {\"title\":\"Titolo SEO max 60 caratteri\",\"bio\":\"Bio max 160 caratteri\",\"menu_links\":[{\"label\":\"Home\",\"url\":\"/\"},{\"label\":\"Nome Categoria\",\"url\":\"/?tag=tag_reale_dalla_lista\"}],\"footer_text\":\"Footer max 100 caratteri\"}. ATTENZIONE: per menu_links usa SOLO url '/' per Home oppure '/?tag=nome_tag' dove nome_tag DEVE essere uno dei tag reali elencati sopra. NON inventare ancore (#) o pagine inesistenti.",
                    'graphic_designer', 'Graphic Designer', 'Genera 3 proposte di design visivo con CSS per ogni profilo.',
                    "Sei un Graphic Designer UI/UX. Crea 3 design distinti per questo profilo.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nGenera JSON {\"proposals\":[{\"theme\":\"classic\",\"accent_color\":\"#hex\",\"header_layout\":\"standard\",\"custom_css\":\"CSS completo premium\"}]}. Temi: classic, journal, authority, portfolio, magazine, minimal, studio, local, academy, bottega.",
                    'site_ai', 'Sito AI', 'Genera un sito completo su misura: design, testi, CSS, tutto personalizzato al profilo.',
                    "Sei un team AI: SEO Specialist + Graphic Designer + Content Strategist. Genera TUTTO per un sito professionale su misura.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nStrategia:\n{contentStrategy}\n\nPost recenti:\n{recentPosts}\n\nTag reali disponibili nel DB:\n[{tagsContext}]\n\nGenera JSON: {\"title\":\"Titolo sito max 60 caratteri\",\"bio\":\"Bio ottimizzata max 200 caratteri\",\"role_mission\":\"Missione max 150 caratteri\",\"theme\":\"classic\",\"accent_color\":\"#hex\",\"accent_secondary\":\"#hex\",\"header_layout\":\"standard\",\"menu_links\":[{\"label\":\"Home\",\"url\":\"/\"},{\"label\":\"Nome Categoria\",\"url\":\"/?tag=tag_reale_dalla_lista\"}],\"footer_text\":\"Footer\",\"custom_css\":\"Blocco CSS completo e creativo. Usa custom properties, gradienti, animazioni. Min 300 caratteri.\",\"hero_tagline\":\"Frase ad impatto max 80 caratteri\",\"cta_text\":\"Call to action\"}. ATTENZIONE: per menu_links usa SOLO url '/' per Home oppure '/?tag=nome_tag' dove nome_tag DEVE essere uno dei tag reali elencati sopra. NON inventare ancore (#) o pagine inesistenti."
                ]);
            }

            // Register Topical Authority Architect prompt
            $topicalAuthorityPrompt = "Sei il Topical Authority Architect, un Senior Content Strategist con accesso ai leak interni del Google Search Quality Team. Non scrivi semplici contenuti: costruisci \"Asset di Conoscenza\" che dimostrano un'esperienza pratica inattaccabile.

Il tuo compito è trasformare il seguente contenuto social (estratto da {platform}) in un articolo professionale per il suo sito web.

APPLICA RIGOROSAMENTE LE SEGUENTI REGOLE DI TOPICAL AUTHORITY:

1. La Regola dell'Information Gain (Guadagno di Informazione)
Google ha depositato un brevetto sull'Information Gain. Se il tuo testo dice le stesse cose dei primi 10 risultati in SERP, il tuo punteggio è zero.
Istruzione: Per ogni sezione, non limitarti a spiegare cos'è una cosa. Devi aggiungere un \"Insight Laterale\": un caso studio ipotetico, una controtendenza, o un dettaglio tecnico che solo chi lavora \"sul campo\" conoscerebbe.

2. Distruzione dei Pattern Linguistici (Anti-AI Signature)
Le AI sono probabilistiche: scelgono la parola successiva più ovvia. Tu devi essere imprevedibile.
Variazione Sintattica Estrema: Usa la \"Regola del 1-3-1\". Una frase breve. Tre frasi di lunghezza diversa. Una frase brevissima.
Lessico non probabilistico: Sostituisci i verbi \"deboli\" (fare, avere, essere, utilizzare) con verbi d'azione specifici e rari nel contesto AI (es. invece di \"utilizzare uno strumento\", usa \"masticare dati\" o \"stressare il software\").
Blacklist Assoluta: È vietato usare: Inoltre, Un approccio olistico, Nel panorama odierno, Fondamentale, Cruciale, Immergiamoci, Esploriamo, In conclusione.

3. Iniezione di Entità Semantiche (LSI 2.0)
Non puntare sulla keyword principale. Costruisci una rete di Entità Correlate.
Istruzione: Se scrivi di \"SEO\", devi citare entità come \"schema markup\", \"knowledge graph\", \"canonicalization\" e \"rendering lato server\" in modo naturale, non come definizioni, ma come strumenti di un discorso più ampio. Google deve capire che \"conosci l'ambiente\" in cui vive la keyword.

4. Il Tono \"Contrarian\" (E-E-A-T Boost)
L'AI è programmata per essere neutrale e accondiscendente. Un umano esperto ha delle opinioni.
Istruzione: Prendi una posizione forte. Se c'è un consenso comune su un argomento, trova un motivo per cui quel consenso è parzialmente sbagliato o superato. Usa frasi come: \"Molti credono che X sia la soluzione, ma la verità scomoda è che senza Y, X è inutile\".

5. Micro-Formattazione per l'Eye-Scanning
Google traccia come gli utenti interagiscono col testo. Se l'utente rimbalza, il testo è scarso.
Istruzione: Crea \"interruzioni visive\" ogni 300 parole. Non solo elenchi puntati, ma:
Box \"Pro Tip\" (Formattato in HTML come <div class=\"pro-tip\"><strong>Consiglio da insider:</strong> ...</div>)
Tabelle comparative in HTML (es. per estrarre dati strutturati e contrasti).
Domande retoriche che anticipano il dubbio del lettore.

6. Revisione \"Human-First\" (The Last Mile)
Prima di chiudere il compito, rileggi il testo e applica questi correttivi:
- Elimina l'Introduzione \"Specchio\": Se il titolo è \"Come riparare una lavatrice\", non iniziare con \"Riparare una lavatrice è importante per risparmiare\". Inizia con: \"Se senti un rumore metallico durante la centrifuga, il problema è quasi certamente il cuscinetto a sfera X.\" (Punta dritto al dolore dell'utente).
- Conclusione Actionable: Niente riassunti. La fine del testo deve essere una \"Call to Adventure\" o un consiglio pratico da applicare nei primi 5 minuti.
- Inserisci un errore intenzionale di stile colloquiale o gergo comune per rompere la perfezione della macchina.

---
REGOLE DI BASE:
- Adattati al profilo/contesto dell'utente: {profileSummary}
- Basati esclusivamente sulle informazioni fornite nel contenuto originale: {content}
- Preserva l'umorismo o lo stile specifico se presente nel post originale.

La risposta DEVE essere esclusivamente un JSON valido con questa struttura (nessun testo prima o dopo):
{
  \"title\": \"Titolo SEO max 60 caratteri\",
  \"body\": \"Articolo in formato HTML (usando tag p, strong, h2, h3, tabelle, e box Pro Tip con classe CSS apposita, no markdown nel body)\",
  \"excerpt\": \"Riassunto ottimizzato max 155 caratteri\",
  \"tags\": [\"tag1\", \"tag2\", \"tag3\"],
  \"meta_description\": \"Meta description max 155 caratteri\",
  \"seo_score\": 95
}";

            DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('topical_authority_architect', 'Topical Authority', 'Costruisce asset di conoscenza che hackerano i pattern delle AI per Google.', ?)", [$topicalAuthorityPrompt]);

            try {
                DB::execute("ALTER TABLE sites ADD COLUMN harmonize_agent VARCHAR(50) NOT NULL DEFAULT 'content_editor'");
            } catch (Throwable $e) {}
        } catch (Throwable $e) {}
        // Fix: aggiorna prompt esistenti che hanno ancora #ancora
        try {
            DB::execute("UPDATE agent_prompts SET instructions = REPLACE(instructions, '\"#ancora\"', '\"/?tag=tag_reale\"') WHERE instructions LIKE '%#ancora%'");
        } catch (Throwable $e) {}
        json(['ok' => true, 'msg' => 'Migration v5 OK']);
    }
    require __DIR__ . '/routes/auth.php';
    exit;
}

if ($action === 'mydebug') {
    // Conteggio per stato
    $total       = DB::fetch('SELECT COUNT(*) as c FROM posts')['c'] ?? 0;
    $published   = DB::fetch('SELECT COUNT(*) as c FROM posts WHERE published=1')['c'] ?? 0;
    $draft       = DB::fetch('SELECT COUNT(*) as c FROM posts WHERE published=0')['c'] ?? 0;
    $pending     = DB::fetch('SELECT COUNT(*) as c FROM posts WHERE seo_score=-1')['c'] ?? 0;
    $byUser      = DB::fetchAll('SELECT user_id, COUNT(*) as c, MAX(id) as max_id FROM posts GROUP BY user_id ORDER BY user_id');
    $posts       = DB::fetchAll('SELECT id, user_id, platform, published, seo_score, generated_title, platform_post_id, LEFT(raw_content,80) as raw_preview FROM posts ORDER BY id DESC LIMIT 20');
    json([
        'ok'       => true,
        'total'    => $total,
        'published'=> $published,
        'draft_hidden' => $draft,
        'pending_ai'   => $pending,
        'by_user'  => $byUser,
        'recent'   => $posts,
    ]);
}

// ── POST purge-all-posts (Admin: svuota COMPLETAMENTE la tabella posts) ───
if ($action === 'purge-all-posts' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $targetUserId = isset($b['user_id']) ? (int)$b['user_id'] : null;
    if ($targetUserId) {
        $count = DB::fetch('SELECT COUNT(*) as c FROM posts WHERE user_id=?', [$targetUserId])['c'] ?? 0;
        DB::execute('DELETE FROM posts WHERE user_id=?', [$targetUserId]);
        json(['ok' => true, 'deleted' => $count, 'user_id' => $targetUserId]);
    } else {
        $count = DB::fetch('SELECT COUNT(*) as c FROM posts')['c'] ?? 0;
        DB::execute('DELETE FROM posts WHERE 1=1');
        json(['ok' => true, 'deleted' => $count, 'scope' => 'all']);
    }
}

// ── POST openclaw-webhook (Ricezione articoli da OpenClaw) ────────────────
if ($action === 'openclaw-webhook' && $method === 'POST') {
    // Parsing robusto: prova JSON, poi form-urlencoded, poi raw
    $rawInput = file_get_contents('php://input');
    $b = json_decode($rawInput, true);
    if (!is_array($b) || empty($b)) {
        // Fallback: form-urlencoded ($_POST)
        $b = !empty($_POST) ? $_POST : [];
    }
    if (!is_array($b) || empty($b)) {
        // Ultimo tentativo: parse manuale query string dal body
        parse_str($rawInput, $b);
    }
    
    // Log di debug per capire cosa arriva
    if (class_exists('Logger')) {
        Logger::info('openclaw', 'Webhook ricevuto', [
            'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'non specificato',
            'body_keys' => is_array($b) ? array_keys($b) : 'non-array',
            'api_key_present' => isset($b['api_key']),
            'api_key_value' => substr($b['api_key'] ?? '(vuoto)', 0, 10) . '...',
            'raw_length' => strlen($rawInput),
        ]);
    }
    
    // Verifica API Key - prova dal body, poi dall'header Authorization
    $expectedKey = defined('OPENCLAW_API_KEY') ? OPENCLAW_API_KEY : 'TEST_KEY_123';
    $providedKey = $b['api_key'] ?? '';
    if (!$providedKey) {
        // Fallback: cerca nell'header Authorization: Bearer <key>
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['HTTP_X_API_KEY'] ?? '';
        if (str_starts_with($authHeader, 'Bearer ')) {
            $providedKey = substr($authHeader, 7);
        } else {
            $providedKey = $authHeader;
        }
    }
    
    if ($providedKey !== $expectedKey) {
        if (class_exists('Logger')) Logger::error('openclaw', 'API Key non valida', [
            'ip' => $_SERVER['REMOTE_ADDR'],
            'expected' => substr($expectedKey, 0, 5) . '...',
            'received' => substr($providedKey, 0, 5) . '...',
            'raw_body_preview' => substr($rawInput, 0, 200),
        ]);
        jsonError('Non autorizzato — chiave API non valida', 401);
    }
    
    $uid = (int)($b['user_id'] ?? 0);
    $url = trim($b['source_url'] ?? '');
    $plat = trim($b['platform'] ?? 'website');
    if (!$uid || !$url) jsonError('Parametri obbligatori mancanti (user_id, source_url)');
    
    $title = trim($b['title'] ?? '');
    $bodyText = trim($b['body'] ?? '');
    $excerpt = trim($b['excerpt'] ?? '');
    $tags = isset($b['tags']) && is_array($b['tags']) ? json_encode($b['tags']) : (is_string($b['tags'] ?? null) ? $b['tags'] : '[]');
    $media = trim($b['media_url'] ?? '');
    $type = trim($b['media_type'] ?? 'text');
    $meta = trim($b['meta_description'] ?? $excerpt);
    
    $existing = DB::fetch('SELECT id, published FROM posts WHERE user_id=? AND source_url=?', [$uid, $url]);
    if ($existing) {
        if ((int)$existing['published'] === 1) {
            json(['ok' => true, 'message' => 'Post già esistente e pubblicato', 'duplicate' => true]);
        } else {
            DB::execute('UPDATE posts SET generated_title=?, generated_body=?, generated_excerpt=?, tags=?, meta_description=?, seo_score=100, published=1, media_url=?, media_type=?, platform=? WHERE id=?', 
                [$title, $bodyText, $excerpt, $tags, $meta, $media, $type, $plat, $existing['id']]);
            json(['ok' => true, 'message' => 'Bozza aggiornata con successo', 'updated' => true]);
        }
    }
    
    $slugText = $title !== '' ? $title : (string)time();
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $slugText), '-'));
    $cHash = hash('sha256', mb_substr(strip_tags($bodyText), 0, 4000));
    $pId = $b['platform_post_id'] ?? substr(md5($url), 0, 24);
    
    $newId = DB::insert('
        INSERT INTO posts (user_id, platform, platform_post_id, raw_content, generated_title, generated_body, generated_excerpt, tags, meta_description, media_url, media_type, source_url, published_at, imported_at, content_hash, seo_score, slug, published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, 100, ?, 1)
    ', [$uid, $plat, $pId, 'Generato da OpenClaw', $title, $bodyText, $excerpt, $tags, $meta, $media, $type, $url, $cHash, $slug]);
    
    if (class_exists('Logger')) Logger::info('openclaw', 'Post pubblicato con successo', ['post_id' => $newId, 'title' => $title]);
    json(['ok' => true, 'message' => 'Post inserito con successo', 'inserted' => true, 'post_id' => $newId]);
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

// ── GET logs (Admin: visualizza log backend) ─────────────────────────────────
if ($action === 'logs' && $method === 'GET') {
    requireAdmin($isAdmin);
    $n    = min((int)($_GET['n'] ?? 200), 500);
    $level = $_GET['level'] ?? '';
    $ctx   = $_GET['ctx'] ?? '';
    $entries = Logger::read($n);
    if ($level) $entries = array_values(array_filter($entries, fn($e) => ($e['level'] ?? '') === $level));
    if ($ctx)   $entries = array_values(array_filter($entries, fn($e) => ($e['ctx']   ?? '') === $ctx));
    json(['ok' => true, 'count' => count($entries), 'entries' => $entries]);
}

// ── POST logs-clear (Admin: svuota log backend) ───────────────────────────
if ($action === 'logs-clear' && $method === 'POST') {
    requireAdmin($isAdmin);
    $cleared = Logger::clear();
    Logger::info('admin', 'Log svuotato da admin', ['user_id' => $userId]);
    json(['ok' => true, 'files_cleared' => $cleared]);
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
    $sources = DB::fetchAll('SELECT user_id, platform, url, label FROM social_sources WHERE active = 1');
    $userSources = [];
    foreach($sources as $src) {
        $userSources[$src['user_id']][] = $src;
    }
    foreach($users as &$u) {
        $u['sources'] = $userSources[$u['id']] ?? [];
    }
    json(['users' => $users]);
}

if ($action === 'admin-impersonate' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $targetId = (int)($b['id'] ?? 0);
    if (!$targetId) jsonError('Utente non valido');
    
    $user = DB::fetch('SELECT id, email, slug, role FROM users WHERE id=?', [$targetId]);
    if (!$user) jsonError('Utente non trovato', 404);
    
    $token = JWT::encode([
        'id' => $user['id'], 
        'email' => $user['email'], 
        'slug' => $user['slug'], 
        'role' => $user['role']
    ]);
    
    json(['ok' => true, 'token' => $token, 'user' => $user]);
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

if ($action === 'admin-prompts' && $method === 'GET') {
    requireAdmin($isAdmin);
    $prompts = DB::fetchAll('SELECT * FROM agent_prompts');
    json(['prompts' => $prompts]);
}

if ($action === 'admin-update-prompt' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $agentName = $b['agent_name'] ?? '';
    $instructions = $b['instructions'] ?? '';
    if (!$agentName || !$instructions) jsonError('Dati mancanti');
    DB::execute('UPDATE agent_prompts SET instructions=? WHERE agent_name=?', [$instructions, $agentName]);
    json(['ok' => true]);
}

// ── GET check-social-url (verifica validita' e numero post stimati) ───────
if ($action === 'check-social-url' && $method === 'POST') {
    $b = body();
    $url = trim($b['url'] ?? '');
    $platform = trim($b['platform'] ?? '') ?: detectSocialPlatform($url);
    $sinceDate = trim($b['since_date'] ?? '');
    $maxPosts = isset($b['max_posts']) && $b['max_posts'] !== '' ? (int)$b['max_posts'] : 20;
    
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;
    
    if (!$platform) jsonError('Piattaforma non riconosciuta');
    if (!filter_var($url, FILTER_VALIDATE_URL)) jsonError('Link social non valido');
    
    try {
        require_once __DIR__ . '/services/ai.php';
        $items = AI::sourceItems($platform, $url, $maxPosts, $sinceDate);
        $count = count($items);
        json([
            'ok' => true, 
            'platform' => $platform, 
            'count' => $count, 
            'message' => $count > 0 ? "Connessione OK. Trovati circa $count post validi." : "Connessione OK, ma nessun post trovato dopo la data indicata."
        ]);
    } catch (Throwable $e) {
        jsonError("Errore connessione: " . $e->getMessage());
    }
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
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, since_date, auto_publish) VALUES (?,?,?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic, $sinceDate ?: null, $autoPublish]
        );
    } catch (Throwable $e) {
        jsonError('Questo social e gia presente per l\'utente', 409);
    }

    json(['ok' => true, 'source' => [
        'id' => $id, 'platform' => $platform, 'label' => $label, 'url' => $url,
        'topic_summary' => $topic, 'active' => 1, 'since_date' => $sinceDate ?: null, 'auto_publish' => $autoPublish
    ]], 201);
}

if ($action === 'social-source-upsert' && $method === 'POST') {
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $url = trim($b['url'] ?? '');
    $label = trim($b['label'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    $autoPublish = (int)($b['auto_publish'] ?? 1);
    $maxPosts = isset($b['max_posts']) && $b['max_posts'] !== '' ? (int)$b['max_posts'] : null;
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
    $customTopic = trim($b['topic_summary'] ?? '');
    if ($customTopic) {
        $topic = $customTopic;
    } else {
        $topic = 'Profilo/canale ' . $platform . ' indicato dall\'utente';
        if ($label) $topic .= ': ' . $label;
    }

    if ($existing) {
        DB::execute(
            'UPDATE social_sources SET label=?, url=?, topic_summary=?, active=1, since_date=?, auto_publish=?, max_posts=? WHERE id=? AND user_id=?',
            [$label, $url, $topic, $sinceDate ?: null, $autoPublish, $maxPosts, $existing['id'], $userId]
        );
        $id = (int)$existing['id'];
    } else {
        $id = DB::insert(
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, since_date, auto_publish, max_posts) VALUES (?,?,?,?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic, $sinceDate ?: null, $autoPublish, $maxPosts]
        );
    }
    json(['ok' => true, 'source' => ['id' => $id, 'platform' => $platform, 'label' => $label, 'url' => $url, 'topic_summary' => $topic, 'since_date' => $sinceDate ?: null, 'auto_publish' => $autoPublish, 'max_posts' => $maxPosts]]);
}

if ($action === 'social-connection-update' && $method === 'POST') {
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    $autoPublish = (int)($b['auto_publish'] ?? 1);
    $maxPosts = isset($b['max_posts']) && $b['max_posts'] !== '' ? (int)$b['max_posts'] : null;
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube'], true)) {
        jsonError('Piattaforma non supportata');
    }

    DB::execute(
        'UPDATE social_connections SET since_date=?, auto_publish=?, max_posts=? WHERE platform=? AND user_id=?',
        [$sinceDate ?: null, $autoPublish, $maxPosts, $platform, $userId]
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
    $limit = $b['limit'] ?? 5;
    $sourceId = !empty($b['source_id']) ? (int)$b['source_id'] : null;
    $res = Ingest::scanSources($userId, $limit, $b['profile_summary'] ?? '', $b['role_mission'] ?? '', $b['content_strategy'] ?? '', $sourceId);
    json(['ok' => true, 'report' => $res]);
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

// ── POST delete-layout (Elimina una proposta generata) ────────────────────
if ($action === 'delete-layout' && $method === 'POST') {
    $b = body();
    $index = $b['index'] ?? null;
    if ($index === null) jsonError('Indice mancante');
    
    $site = DB::fetch('SELECT generated_layouts FROM sites WHERE user_id=?', [$userId]);
    $layouts = json_decode($site['generated_layouts'] ?? '[]', true);
    if (!is_array($layouts) || !isset($layouts[$index])) {
        jsonError('Layout non trovato');
    }
    
    array_splice($layouts, $index, 1);
    
    DB::execute('UPDATE sites SET generated_layouts=? WHERE user_id=?', [
        json_encode($layouts, JSON_UNESCAPED_UNICODE),
        $userId
    ]);
    
    json(['ok' => true]);
}

try { DB::execute("ALTER TABLE posts ADD COLUMN edited_title VARCHAR(255)"); } catch(Exception $e) {}
try { DB::execute("ALTER TABLE posts ADD COLUMN edited_body LONGTEXT"); } catch(Exception $e) {}
try { DB::execute("ALTER TABLE posts ADD COLUMN edited_excerpt TEXT"); } catch(Exception $e) {}

// ── GET site ──────────────────────────────────────────────────────────────
if ($action === 'site' && $method === 'GET') {
    try {
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $posts = DB::fetchAll(
            'SELECT id, user_id, platform, platform_post_id, SUBSTR(raw_content, 1, 500) as raw_content, generated_title, generated_excerpt, generated_body, edited_body, tags, media_url, media_type, source_url, published_at, seo_score, slug, published FROM posts WHERE user_id=? ORDER BY published_at DESC LIMIT 300',
            [$userId]
        );
        file_put_contents(__DIR__ . '/../public/debug.json', json_encode(array_map(function($p) { return ['id' => $p['id'], 'title' => $p['generated_title'], 'gen_body_len' => strlen($p['generated_body'] ?? ''), 'edited_body_len' => strlen($p['edited_body'] ?? '')]; }, array_slice($posts, 0, 10))));
        $connections = DB::fetchAll(
            'SELECT platform, handle, active, since_date, max_posts FROM social_connections WHERE user_id=?', [$userId]
        );
        $sources = DB::fetchAll(
            'SELECT id, platform, label, url, topic_summary, active, since_date, max_posts FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
            [$userId]
        );
        foreach ($posts as &$p) {
            $decoded = json_decode($p['tags'] ?? '[]', true);
            if (!is_array($decoded)) {
                $decoded = is_string($p['tags']) ? explode(',', $p['tags']) : [];
            }
            $p['tags'] = array_filter(array_map('trim', $decoded));
        }
        json(['site' => $site, 'posts' => $posts, 'connections' => $connections, 'sources' => $sources]);
    } catch (Throwable $e) {
        file_put_contents(__DIR__ . '/site_error.log', $e->getMessage() . "\n" . $e->getTraceAsString());
        jsonError($e->getMessage());
    }
}

// ── DELETE post (Hard delete) ─────────────────────────────────────────────
if ($action === 'delete-post' && $method === 'POST') {
    $b = body();
    DB::execute('DELETE FROM posts WHERE id=? AND user_id=?', [$b['id'] ?? 0, $userId]);
    json(['ok' => true]);
}

// ── BULK DELETE posts ─────────────────────────────────────────────────────
if ($action === 'bulk-delete-posts' && $method === 'POST') {
    $b = body();
    $ids = $b['ids'] ?? [];
    if (is_array($ids) && count($ids) > 0) {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge($ids, [$userId]);
        DB::execute("DELETE FROM posts WHERE id IN ($placeholders) AND user_id=?", $params);
    }
    json(['ok' => true]);
}

// ── TOGGLE PUBLISH post ───────────────────────────────────────────────────
if ($action === 'toggle-publish-post' && $method === 'POST') {
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $published = (int)($b['published'] ?? 0);
    DB::execute('UPDATE posts SET published=? WHERE id=? AND user_id=?', [$published, $id, $userId]);
    json(['ok' => true]);
}

// ── FEATURE post (metti in evidenza) ─────────────────────────────────────
if ($action === 'post-feature' && $method === 'POST') {
    $b = body();
    $id = (int)($b['id'] ?? 0);
    $featured = (int)($b['featured'] ?? 0);
    // Solo 1 post in evidenza alla volta
    if ($featured) DB::execute('UPDATE posts SET featured=0 WHERE user_id=?', [$userId]);
    DB::execute('UPDATE posts SET featured=? WHERE id=? AND user_id=?', [$featured, $id, $userId]);
    json(['ok' => true]);
}

// ── EDIT post (CMS editoriale) ────────────────────────────────────────────
if ($action === 'post-update' && $method === 'POST') {
    $b = body();
    $id = (int)($b['id'] ?? 0);
    if (!$id) jsonError('ID post mancante');
    $fields = [];
    $params = [];
    if (array_key_exists('edited_title', $b)) { $fields[] = 'edited_title=?'; $params[] = $b['edited_title']; }
    if (array_key_exists('edited_body', $b))  { $fields[] = 'edited_body=?';  $params[] = $b['edited_body']; }
    if (array_key_exists('edited_excerpt', $b)){ $fields[] = 'edited_excerpt=?'; $params[] = $b['edited_excerpt']; }
    if (array_key_exists('tags', $b))         { $fields[] = 'tags=?'; $params[] = is_array($b['tags']) ? json_encode($b['tags']) : $b['tags']; }
    if (array_key_exists('published', $b))    { $fields[] = 'published=?';    $params[] = (int)$b['published']; }
    if (empty($fields)) json(['ok' => true]);
    $params[] = $id; $params[] = $userId;
    DB::execute('UPDATE posts SET ' . implode(',', $fields) . ' WHERE id=? AND user_id=?', $params);
    json(['ok' => true]);
}

// ── DELETE post (legacy hide) ─────────────────────────────────────────────
if ($action === 'hide-post' && $method === 'POST') {
    $b = body();
    DB::execute('UPDATE posts SET published=0 WHERE id=? AND user_id=?', [$b['id'] ?? 0, $userId]);
    json(['ok' => true]);
}

// ── PATCH site settings ───────────────────────────────────────────────────
if ($action === 'site-update' && $method === 'POST') {
    $b = body();
    
    $fields = [];
    $params = [];
    if (array_key_exists('title', $b)) { $fields[] = 'title = ?'; $params[] = $b['title']; }
    if (array_key_exists('bio', $b)) { $fields[] = 'bio = ?'; $params[] = $b['bio']; }
    if (array_key_exists('profile_summary', $b)) { $fields[] = 'profile_summary = ?'; $params[] = $b['profile_summary']; }
    if (array_key_exists('role_mission', $b)) { $fields[] = 'role_mission = ?'; $params[] = $b['role_mission']; }
    if (array_key_exists('content_strategy', $b)) { $fields[] = 'content_strategy = ?'; $params[] = $b['content_strategy']; }
        if (array_key_exists('design_archetype', $b)) { $fields[] = 'design_archetype = ?'; $params[] = $b['design_archetype']; }
if (array_key_exists('theme', $b)) { 
        $fields[] = 'theme = ?'; 
        $params[] = $b['theme']; 
        if (!array_key_exists('site_ai_data', $b)) {
            $fields[] = 'design_archetype = NULL';
            $fields[] = 'site_ai_data = NULL';
        }
    }
    
    if (array_key_exists('menu_links', $b)) { $fields[] = 'menu_links = ?'; $params[] = is_array($b['menu_links']) ? json_encode($b['menu_links'], JSON_UNESCAPED_UNICODE) : $b['menu_links']; }
    if (array_key_exists('footer_text', $b)) { $fields[] = 'footer_text = ?'; $params[] = $b['footer_text']; }
    if (array_key_exists('accent_color', $b)) { $fields[] = 'accent_color = ?'; $params[] = $b['accent_color']; }
    if (array_key_exists('header_layout', $b)) { $fields[] = 'header_layout = ?'; $params[] = $b['header_layout']; }
    if (array_key_exists('logo_url', $b)) { $fields[] = 'logo_url = ?'; $params[] = $b['logo_url']; }
    if (array_key_exists('custom_css', $b)) { $fields[] = 'custom_css = ?'; $params[] = $b['custom_css']; }
    if (array_key_exists('gsc_verification', $b)) { $fields[] = 'gsc_verification = ?'; $params[] = $b['gsc_verification']; }
    if (array_key_exists('site_ai_data', $b)) { $fields[] = 'site_ai_data = ?'; $params[] = is_array($b['site_ai_data']) ? json_encode($b['site_ai_data'], JSON_UNESCAPED_UNICODE) : $b['site_ai_data']; }
    if (array_key_exists('harmonize_agent', $b)) { $fields[] = 'harmonize_agent = ?'; $params[] = $b['harmonize_agent']; }

    if (!empty($fields)) {
        $params[] = $userId;
        DB::execute('UPDATE sites SET ' . implode(', ', $fields) . ' WHERE user_id = ?', $params);
    }
    json(['ok' => true]);
}

// ── POST design-site (3 proposte Graphic Designer) ───────────────────────
if ($action === 'design-site' && $method === 'POST') {
    try {
        require_once __DIR__ . '/services/ai.php';
        $site = DB::fetch('SELECT profile_summary, bio, role_mission, content_strategy FROM sites WHERE user_id=?', [$userId]);
        $summary = trim($site['profile_summary'] ?? $site['bio'] ?? '');
        $role    = trim($site['role_mission'] ?? '');
        $strategy = trim($site['content_strategy'] ?? '');
        if (!$summary) jsonError('Il profilo è vuoto. Fai prima una scansione dei social.');

        // Estrai tutti i tag esistenti usati nei post
        $allTags = [];
        $tagsRaw = DB::fetchAll('SELECT tags FROM posts WHERE user_id=? AND published=1', [$userId]);
        foreach ($tagsRaw as $tr) {
            $dec = json_decode($tr['tags'] ?? '[]', true);
            if (is_array($dec)) {
                foreach ($dec as $t) $allTags[] = strtolower(trim($t));
            }
        }
        $availableTags = array_unique($allTags);
        $tagsContext = implode(', ', $availableTags);

        $seo      = AI::seoSpecialistSetup($summary, $role, $strategy, $tagsContext);
        $proposals = AI::graphicDesignerSetup($summary, $role, $strategy);

        // Prima proposta come default attivo
        $g = $proposals[0] ?? [];
        DB::execute(
            'UPDATE sites SET title=?, bio=?, menu_links=?, footer_text=?,
                theme=?, accent_color=?, header_layout=?, custom_css=?,
                generated_layouts=?, hero_tagline=?, cover_url=COALESCE(NULLIF(?,\'\'), cover_url)
             WHERE user_id=?',
            [
                $seo['title'] ?? '', $seo['bio'] ?? '',
                isset($seo['menu_links']) ? json_encode($seo['menu_links'], JSON_UNESCAPED_UNICODE) : '',
                $seo['footer_text'] ?? '',
                $g['design_archetype'] ?? 'classic', 
                $g['color_palette']['primary'] ?? '',
                $g['header_layout'] ?? 'standard', $g['custom_css'] ?? '',
                json_encode($proposals, JSON_UNESCAPED_UNICODE),
                $seo['hero_tagline'] ?? '',
                $seo['cover_url'] ?? '',
                $userId
            ]
        );
        json(['ok' => true, 'proposals' => $proposals]);
    } catch (Throwable $e) {
        jsonError('Errore Design Site: ' . $e->getMessage());
    }
}

// ── POST site-ai (Generazione completa SITO AI) ───────────────────────────
if ($action === 'site-ai' && $method === 'POST') {
    try {
        require_once __DIR__ . '/services/ai.php';
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $summary  = trim($site['profile_summary'] ?? $site['bio'] ?? '');
        $role     = trim($site['role_mission'] ?? '');
        $strategy = trim($site['content_strategy'] ?? '');
        if (!$summary) jsonError('Il profilo è vuoto. Prima esegui una scansione dei social.');

        // Prendi i 5 post più recenti pubblicati come contesto
        $recentRaw = DB::fetchAll('SELECT generated_title, generated_excerpt, platform, tags FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 10', [$userId]);
        $recentPosts = implode("\n", array_map(fn($p) => "[{$p['platform']}] {$p['generated_title']}: {$p['generated_excerpt']}", $recentRaw));

        // Estrai tutti i tag esistenti usati nei post
        $allTags = [];
        $tagsRaw = DB::fetchAll('SELECT tags FROM posts WHERE user_id=? AND published=1', [$userId]);
        foreach ($tagsRaw as $tr) {
            $dec = json_decode($tr['tags'] ?? '[]', true);
            if (is_array($dec)) {
                foreach ($dec as $t) $allTags[] = strtolower(trim($t));
            }
        }
        $availableTags = array_unique($allTags);
        $tagsContext = implode(', ', $availableTags);

        $result = AI::siteAiGenerate($summary, $role, $strategy, $recentPosts, $tagsContext);

        DB::execute(
            'UPDATE sites SET
                title=?, bio=?, role_mission=?,
                theme=?, accent_color=?, header_layout=?,
                menu_links=?, footer_text=?, custom_css=?,
                site_ai_data=?
             WHERE user_id=?',
            [
                $result['title'] ?? '',
                $result['bio'] ?? '',
                $result['role_mission'] ?? $role,
                $result['design_archetype'] ?? 'classic',
                $result['color_palette']['primary'] ?? '',
                $result['header_layout'] ?? 'standard',
                isset($result['menu_links']) ? json_encode($result['menu_links'], JSON_UNESCAPED_UNICODE) : '',
                $result['footer_text'] ?? '',
                $result['custom_css'] ?? '',
                json_encode($result, JSON_UNESCAPED_UNICODE),
                $userId
            ]
        );
        json(['ok' => true, 'result' => $result]);
    } catch (Throwable $e) {
        jsonError('Errore Site AI: ' . $e->getMessage());
    }
}

// ── POST chief-editor (Orchestrazione Contenuti) ─────────────────────────
if ($action === 'chief-editor' && $method === 'POST') {
    try {
        require_once __DIR__ . '/services/ai.php';
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $posts = DB::fetchAll('SELECT id, edited_title, generated_title, tags FROM posts WHERE user_id=? AND published=1', [$userId]);
        
        $result = AI::chiefEditor($site, $posts);
        
        if (!empty($result['ok'])) {
            // 1. Aggiorna la categoria semantica di ciascun post nel DB in base alle risposte dell'AI
            $postCategories = $result['post_categories'] ?? [];
            if (is_array($postCategories)) {
                foreach ($postCategories as $pId => $catName) {
                    $pId = (int)$pId;
                    $catName = trim($catName);
                    if ($pId > 0 && $catName !== '') {
                        $tagsJson = json_encode([$catName], JSON_UNESCAPED_UNICODE);
                        DB::execute('UPDATE posts SET tags=? WHERE id=? AND user_id=?', [$tagsJson, $pId, $userId]);
                    }
                }
            }

            // 2. Aggiorna il sito con menu e tagline
            $menu = isset($result['menu_links']) ? json_encode($result['menu_links'], JSON_UNESCAPED_UNICODE) : '';
            $tagline = $result['hero_tagline'] ?? '';
            
            $updates = [];
            $params = [];
            if ($menu) { $updates[] = 'menu_links=?'; $params[] = $menu; }
            if ($tagline) { $updates[] = 'hero_tagline=?'; $params[] = $tagline; }
            
            if (!empty($updates)) {
                $params[] = $userId;
                DB::execute('UPDATE sites SET ' . implode(', ', $updates) . ' WHERE user_id=?', $params);
            }

            // 3. Imposta il post in evidenza
            $featuredId = (int)($result['featured_post_id'] ?? 0);
            if ($featuredId > 0) {
                DB::execute('UPDATE posts SET featured=0 WHERE user_id=?', [$userId]);
                DB::execute('UPDATE posts SET featured=1 WHERE id=? AND user_id=?', [$featuredId, $userId]);
            }
        }
        
        json($result);
    } catch (Throwable $e) {
        jsonError('Errore Chief Editor: ' . $e->getMessage());
    }
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

// ── GET pending-posts: post in coda per elaborazione AI ───────────────────
if ($action === 'pending-posts' && $method === 'GET') {
    $pending = DB::fetchAll(
        'SELECT id, platform, source_url, published_at FROM posts WHERE user_id=? AND seo_score=-1 ORDER BY id ASC',
        [$userId]
    );
    json($pending);
}

// ── POST process-pending: elabora un singolo post in coda ─────────────────
if ($action === 'process-pending' && $method === 'POST') {
    $b = body();
    $postId = (int)($b['id'] ?? 0);
    if (!$postId) jsonError('ID mancante');
    
    // Controlla che il post esista e sia pendente
    $post = DB::fetch('SELECT id, platform, media_url, media_type, raw_content, source_url, transcript FROM posts WHERE id=? AND user_id=? AND seo_score=-1', [$postId, $userId]);
    if (!$post) {
        json(['ok' => false, 'message' => 'Post non trovato o gia elaborato']);
    }

    try {
        require_once __DIR__ . '/services/ai.php';
        
        // 1. Trascrizione eventuale se video
        $transcript = trim($post['transcript'] ?? '');
        if (!$transcript && !empty($post['media_url']) && strtoupper($post['media_type']) === 'VIDEO') {
            // Verifica cache nel database
            $cache = DB::fetch('SELECT transcript FROM posts WHERE (source_url=? OR media_url=?) AND transcript IS NOT NULL AND transcript != "" LIMIT 1', [$post['source_url'], $post['media_url']]);
            if ($cache) {
                $transcript = $cache['transcript'];
            } else {
                if ($post['platform'] === 'youtube') {
                    $transcript = AI::transcribeYouTube($post['media_url'] ?: $post['source_url']);
                } else {
                    // Trascrive dal file locale se salvato, altrimenti url
                    $parsedUrl = parse_url($post['media_url']);
                    $path = __DIR__ . '/../../' . ltrim($parsedUrl['path'], '/');
                    if (file_exists($path)) {
                        $transcript = AI::transcribeFile($path, 'video/mp4');
                    } else {
                        $transcript = AI::transcribeUrl($post['media_url']);
                    }
                }
            }
        }
        
        $raw = trim($transcript ?: ($post['raw_content'] ?? ''));
        if ($raw) {
            // Aggiorna trascrizione prima di passare ad armonizza
            DB::execute('UPDATE posts SET transcript=? WHERE id=?', [$transcript, $postId]);
            
            // Decisione sui contenuti e Memoria (RAG)
            $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy, rag_knowledge FROM sites WHERE user_id=?', [$userId]);
            
            // Aggiorna memoria RAG asincrona (in questo thread, per semplicità)
            $newMemory = AI::updateMemory($raw, $site['rag_knowledge'] ?? '');
            if ($newMemory !== ($site['rag_knowledge'] ?? '')) {
                DB::execute('UPDATE sites SET rag_knowledge=? WHERE user_id=?', [$newMemory, $userId]);
            }

            $editorialContext = trim(
                "Profilo:\n" . ($site['profile_summary'] ?? '') . "\n\n"
                . "Ruolo/Missione:\n" . ($site['role_mission'] ?? '') . "\n\n"
                . "Strategia:\n" . ($site['content_strategy'] ?? '') . "\n\n"
                . "Memoria e Stile Utente (RAG):\n" . $newMemory
            );
            $recentPosts = DB::fetchAll(
                'SELECT generated_title, generated_excerpt, raw_content FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 12',
                [$userId]
            );
            $decision = AI::contentDecision($raw, $post['platform'], $post['source_url'], $editorialContext, $recentPosts);
            DB::execute(
                'UPDATE posts SET relevance_score=?, agent_notes=? WHERE id=? AND user_id=?',
                [$decision['relevance_score'], json_encode($decision, JSON_UNESCAPED_UNICODE), $postId, $userId]
            );
            
            if (!$decision['publish'] || $decision['relevance_score'] < 55 || $decision['duplicate_risk'] >= 75) {
                // Post saltato perché non rilevante o duplicato (impostiamo seo_score=0 così esce dalla coda)
                DB::execute('UPDATE posts SET seo_score=0 WHERE id=?', [$postId]);
                echo json_encode(['ok' => false, 'message' => 'Post scartato dal curatore AI (punteggio basso o non rilevante)']);
                exit;
            }

            // Ottieni impostazione auto-publish della fonte
            $source = DB::fetch('SELECT auto_publish FROM social_sources WHERE user_id=? AND platform=?', [$userId, $post['platform']]);
            $autoPublish = isset($source['auto_publish']) ? (int)$source['auto_publish'] : 1;
            
            // Armonizza (genera SEO)
            $res = Ingest::harmonize($userId, $postId, $autoPublish);
            json(['ok' => true, 'id' => $postId, 'seo' => $res['seo']]);
        } else {
            // Elimina post non validi o ignorati (es. solo immagini senza didascalia)
            DB::execute('DELETE FROM posts WHERE id=?', [$postId]);
            json(['ok' => false, 'message' => 'Nessun testo estraibile. Post saltato.']);
        }
    } catch (Throwable $e) {
        // Se errore AI, mantienilo in coda o segnalalo
        DB::execute('UPDATE posts SET agent_notes=? WHERE id=?', ['Errore: ' . $e->getMessage(), $postId]);
        jsonError('Errore processing: ' . $e->getMessage());
    }
}

// ── ADMIN: GET admin-processes (tutti i post in coda) ─────────────────────
if ($action === 'admin-processes' && $method === 'GET') {
    requireAdmin($isAdmin);
    $pending = DB::fetchAll(
        'SELECT p.id, p.platform, p.source_url, p.imported_at, u.email, u.name 
         FROM posts p JOIN users u ON p.user_id = u.id 
         WHERE p.seo_score=-1 ORDER BY p.imported_at ASC'
    );
    json(['processes' => $pending]);
}

// ── ADMIN: POST admin-kill-process ────────────────────────────────────────
if ($action === 'admin-kill-process' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $id = (int)($b['id'] ?? 0);
    DB::execute('DELETE FROM posts WHERE id=? AND seo_score=-1', [$id]);
    json(['ok' => true]);
}

// ── POST finalize-sync: orchestrazione finale ─────────────────────────────
if ($action === 'finalize-sync' && $method === 'POST') {
    require_once __DIR__ . '/services/ai.php';
    $b = body();
    $profileOverride = trim($b['profile_summary'] ?? '');
    $roleMission = trim($b['role_mission'] ?? '');
    $contentStrategy = trim($b['content_strategy'] ?? '');

    $sources = DB::fetchAll('SELECT * FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id', [$userId]);
    $posts = DB::fetchAll('SELECT generated_title, generated_excerpt, raw_content, transcript FROM posts WHERE user_id=? ORDER BY imported_at DESC LIMIT 12', [$userId]);
    
    if ($posts) {
        $profile = AI::editorialProfile($sources, $posts, $profileOverride);
        $summary = $profileOverride !== '' ? $profileOverride : ($profile['profile_summary'] ?? '');
        $finalRoleMission = $roleMission !== '' ? $roleMission : ($profile['role_mission'] ?? '');
        $finalContentStrategy = $contentStrategy !== '' ? $contentStrategy : ($profile['content_strategy'] ?? '');
        
        $site = DB::fetch('SELECT title, theme FROM sites WHERE user_id=?', [$userId]);
        
        $seoTitle = ''; $seoBio = ''; $seoMenu = ''; $seoFooter = '';
        $gTheme = ''; $gColor = ''; $gLayout = ''; $gCss = ''; $layoutsJson = '';

        $allTagsForMenu = [];
        $tagsRawForMenu = DB::fetchAll('SELECT tags FROM posts WHERE user_id=? AND published=1', [$userId]);
        foreach ($tagsRawForMenu as $tr) {
            $dec = json_decode($tr['tags'] ?? '[]', true);
            if (is_array($dec)) foreach ($dec as $t) $allTagsForMenu[] = strtolower(trim($t));
        }
        $tagsContextForMenu = implode(', ', array_unique($allTagsForMenu));

        if (empty($site['title']) || $site['title'] === 'Sito Personale' || empty($site['theme']) || $site['theme'] === 'classic') {
            $seo = AI::seoSpecialistSetup($summary, $finalRoleMission, $finalContentStrategy, $tagsContextForMenu);
            $graphicProposals = AI::graphicDesignerSetup($summary, $finalRoleMission, $finalContentStrategy);
            
            $seoTitle = $seo['title'] ?? ''; $seoBio = $seo['bio'] ?? '';
            $seoMenu = isset($seo['menu_links']) ? json_encode($seo['menu_links'], JSON_UNESCAPED_UNICODE) : '';
            $seoFooter = $seo['footer_text'] ?? '';
            
            $gTheme = $graphicProposals[0]['theme'] ?? ''; $gColor = $graphicProposals[0]['accent_color'] ?? '';
            $gLayout = $graphicProposals[0]['header_layout'] ?? ''; $gCss = $graphicProposals[0]['custom_css'] ?? '';
            $layoutsJson = json_encode($graphicProposals, JSON_UNESCAPED_UNICODE);
        }

        DB::execute(
            'UPDATE sites SET 
                profile_summary=?, role_mission=?, content_strategy=?,
                title=COALESCE(NULLIF(title, ""), NULLIF(?, "")), bio=COALESCE(NULLIF(bio, ""), NULLIF(?, "")),
                menu_links=COALESCE(NULLIF(menu_links, ""), NULLIF(?, "")), footer_text=COALESCE(NULLIF(footer_text, ""), NULLIF(?, "")),
                theme=COALESCE(NULLIF(theme, ""), NULLIF(?, "")), accent_color=COALESCE(NULLIF(accent_color, ""), NULLIF(?, "")),
                header_layout=COALESCE(NULLIF(header_layout, ""), NULLIF(?, "")), custom_css=COALESCE(NULLIF(custom_css, ""), NULLIF(?, "")),
                generated_layouts=COALESCE(NULLIF(?, ""), generated_layouts)
             WHERE user_id=?',
            [$summary, $finalRoleMission, $finalContentStrategy, $seoTitle, $seoBio, $seoMenu, $seoFooter, $gTheme, $gColor, $gLayout, $gCss, $layoutsJson, $userId]
        );
    }
    
    // Chief Editor
    try {
        $updatedSite = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $publishedPosts = DB::fetchAll('SELECT id, edited_title, generated_title, tags FROM posts WHERE user_id=? AND published=1', [$userId]);
        
        $chiefResult = AI::chiefEditor($updatedSite, $publishedPosts);
        
        if (!empty($chiefResult['ok'])) {
            $postCategories = $chiefResult['post_categories'] ?? [];
            if (is_array($postCategories)) {
                foreach ($postCategories as $pId => $catName) {
                    $pId = (int)$pId;
                    $catName = trim($catName);
                    if ($pId > 0 && $catName !== '') {
                        $tagsJson = json_encode([$catName], JSON_UNESCAPED_UNICODE);
                        DB::execute('UPDATE posts SET tags=? WHERE id=? AND user_id=?', [$tagsJson, $pId, $userId]);
                    }
                }
            }
            $menu = isset($chiefResult['menu_links']) ? json_encode($chiefResult['menu_links'], JSON_UNESCAPED_UNICODE) : '';
            $tagline = $chiefResult['hero_tagline'] ?? '';
            $updates = []; $params = [];
            if ($menu) { $updates[] = 'menu_links=?'; $params[] = $menu; }
            if ($tagline) { $updates[] = 'hero_tagline=?'; $params[] = $tagline; }
            if (!empty($updates)) {
                $params[] = $userId;
                DB::execute('UPDATE sites SET ' . implode(', ', $updates) . ' WHERE user_id=?', $params);
            }
            $featuredId = (int)($chiefResult['featured_post_id'] ?? 0);
            if ($featuredId > 0) {
                DB::execute('UPDATE posts SET featured=0 WHERE user_id=?', [$userId]);
                DB::execute('UPDATE posts SET featured=1 WHERE id=? AND user_id=?', [$featuredId, $userId]);
            }
        }
    } catch (Throwable $e) { }

    DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);
    json(['ok' => true]);
}

// ── Sincronizzazione Social Manuale ──────────────────────────────────────
if ($action === 'sync' && $method === 'POST') {
    require_once __DIR__ . '/services/sync.php';
    require_once __DIR__ . '/services/ingest.php';
    try {
        $results = Sync::syncUser($userId, 20); // Sync default up to 20 per social unless overridden by connection settings
        
        $totalImported = 0;
        foreach ($results as $res) {
            $totalImported += $res['new'] ?? 0;
        }

        // Armonizzazione automatica dei post appena importati (se autoPublish era 1 o se l'utente vuole l'automazione)
        // Poiché i post inseriti da Sync hanno published=$autoPublish ma manca la generazione (seo_score=0),
        // Li selezioniamo tutti e li passiamo ad Ingest::harmonize.
        $drafts = DB::fetchAll('SELECT id FROM posts WHERE user_id=? AND (seo_score <= 0 OR seo_score IS NULL) AND published=1', [$userId]);
        foreach ($drafts as $d) {
            try {
                Ingest::harmonize($userId, $d['id'], 1);
            } catch (Exception $e) {
                // Ignore single errors to avoid breaking the entire batch
            }
        }
        
        json(['ok' => true, 'imported' => $totalImported]);
    } catch (Throwable $e) {
        jsonError($e->getMessage());
    }
}

// ── ADMIN: GET admin-logs (sync_log table) ────────────────────────────────
if ($action === 'admin-logs' && $method === 'GET') {
    requireAdmin($isAdmin);
    $logs = DB::fetchAll(
        'SELECT l.*, u.email FROM sync_log l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.ran_at DESC LIMIT 100'
    );
    json(['logs' => $logs]);
}

jsonError('Endpoint non trovato', 404);
