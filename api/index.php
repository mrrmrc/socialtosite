<?php
// api/index.php — Router principale

// ── Gestione errori: restituisci SEMPRE JSON (mai 500 con corpo vuoto) ───────
ini_set('display_errors', '0');
set_time_limit(0);
ob_start();
$__emitErr = function (int $code, string $msg): void {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
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
require_once __DIR__ . '/services/editorial_engine.php';
require_once __DIR__ . '/services/visibility.php';
require_once __DIR__ . '/services/seo_foundation.php';
require_once __DIR__ . '/services/reachability.php';

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

function ensureSiteSchemaUpgrades(): void {
    static $done = false;
    if ($done) return;
    $done = true;

    $definitions = [
        'cover_url'=>'TEXT NULL', 'logo_url'=>'TEXT NULL', 'footer_text'=>'TEXT NULL',
        'accent_color'=>'VARCHAR(50) NULL', 'accent_secondary'=>'VARCHAR(50) NULL',
        'header_layout'=>'VARCHAR(50) NULL', 'custom_css'=>'TEXT NULL', 'hero_tagline'=>'TEXT NULL',
        'cta_text'=>'TEXT NULL', 'generated_layouts'=>'LONGTEXT NULL', 'site_ai_data'=>'LONGTEXT NULL',
        'design_archetype'=>'VARCHAR(100) NULL', 'editorial_dna'=>'LONGTEXT NULL',
        'editorial_memory'=>'LONGTEXT NULL', 'editorial_engine_state'=>'LONGTEXT NULL',
        'editorial_settings'=>'LONGTEXT NULL', 'editorial_last_run'=>'DATETIME NULL',
        'site_understanding'=>'LONGTEXT NULL', 'site_understanding_corrections'=>'LONGTEXT NULL',
        'seo_foundation'=>'LONGTEXT NULL', 'seo_foundation_hash'=>'CHAR(64) NULL',
        'seo_foundation_updated_at'=>'DATETIME NULL', 'reachability_profile'=>'LONGTEXT NULL',
        'reachability_updated_at'=>'DATETIME NULL', 'account_type'=>"VARCHAR(50) DEFAULT 'business'",
        'harmonize_agent'=>"VARCHAR(50) NOT NULL DEFAULT 'content_editor'",
        'living_space_mode'=>"VARCHAR(30) NOT NULL DEFAULT 'pulse'",
        'living_space_mode_updated_at'=>'DATETIME NULL',
    ];
    $existing = [];
    try {
        foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) $existing[$column['Field']] = true;
    } catch (Throwable $e) { return; }
    foreach ($definitions as $column => $definition) {
        if (isset($existing[$column])) continue;
        try { DB::execute("ALTER TABLE sites ADD COLUMN `$column` $definition"); } catch (Throwable $e) {}
    }
}

function ensurePostMediaSchema(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $definitions = [
        'media_display_width'=>'TINYINT UNSIGNED NULL',
        'media_alignment'=>"VARCHAR(20) NOT NULL DEFAULT 'center'",
        'noindex'=>'TINYINT NOT NULL DEFAULT 0',
    ];
    $existing = [];
    try { foreach (DB::fetchAll('SHOW COLUMNS FROM posts') as $column) $existing[$column['Field']] = true; } catch (Throwable $e) { return; }
    foreach ($definitions as $column => $definition) {
        if (isset($existing[$column])) continue;
        try { DB::execute("ALTER TABLE posts ADD COLUMN `$column` $definition"); } catch (Throwable $e) {}
    }
}

function ensureSocialSyncSchema(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    foreach (['social_sources', 'social_connections'] as $table) {
        try {
            $columns = [];
            foreach (DB::fetchAll("SHOW COLUMNS FROM `$table`") as $column) $columns[$column['Field']] = true;
            if (!isset($columns['auto_sync'])) DB::execute("ALTER TABLE `$table` ADD COLUMN auto_sync TINYINT NOT NULL DEFAULT 1");
        } catch (Throwable $e) {}
    }
}

function decodeJsonObject($value): array {
    if (is_array($value)) return $value;
    if (!is_string($value) || trim($value) === '') return [];
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : [];
}

function mergeUnderstanding($generated, $corrections): array {
    $merged = array_replace_recursive(decodeJsonObject($generated), decodeJsonObject($corrections));
    $declared = is_array($merged['declared_strategy'] ?? null) ? $merged['declared_strategy'] : [];

    // I dati dichiarati dal cliente prevalgono sulle deduzioni ricavate dai social.
    if (trim((string)($declared['activity_type'] ?? '')) !== '') {
        $merged['vertical_label'] = trim((string)$declared['activity_type']);
    }
    if (trim((string)($declared['offer_summary'] ?? '')) !== '') {
        $merged['business_model'] = trim((string)$declared['offer_summary']);
    }
    if (trim((string)($declared['primary_audience'] ?? '')) !== '') {
        $audiences = [trim((string)$declared['primary_audience'])];
        if (trim((string)($declared['secondary_audience'] ?? '')) !== '') $audiences[] = trim((string)$declared['secondary_audience']);
        $merged['audience'] = implode(' Pubblico secondario: ', $audiences);
    }
    $services = array_values(array_filter(array_map('trim', (array)($declared['priority_services'] ?? []))));
    if ($services) {
        $existingPillars = array_values(array_filter((array)($merged['editorial_direction']['content_pillars'] ?? [])));
        $merged['editorial_direction']['content_pillars'] = array_values(array_unique(array_merge($services, $existingPillars)));
    }
    return $merged;
}

function normalizeSiteAiResult(array $result): array {
    if (empty($result['design_archetype']) && !empty($result['theme'])) {
        $result['design_archetype'] = $result['theme'];
    }
    if (empty($result['theme']) && !empty($result['design_archetype'])) {
        $result['theme'] = $result['design_archetype'];
    }

    if (!isset($result['color_palette']) || !is_array($result['color_palette'])) {
        $result['color_palette'] = [];
    }
    if (empty($result['color_palette']['primary']) && !empty($result['accent_color'])) {
        $result['color_palette']['primary'] = $result['accent_color'];
    }
    if (empty($result['accent_color']) && !empty($result['color_palette']['primary'])) {
        $result['accent_color'] = $result['color_palette']['primary'];
    }
    if (empty($result['accent_secondary']) && !empty($result['color_palette']['secondary'])) {
        $result['accent_secondary'] = $result['color_palette']['secondary'];
    }

    if (!isset($result['menu_links']) || !is_array($result['menu_links'])) {
        $result['menu_links'] = [];
    }
    if (empty($result['header_layout'])) {
        $result['header_layout'] = 'standard';
    }
    if (!isset($result['custom_css']) || !is_string($result['custom_css'])) {
        $result['custom_css'] = '';
    }

    return $result;
}

// ── Auth endpoints (no JWT) ───────────────────────────────────────────────
if ($action === 'track' && $method === 'POST') {
    $payload = body();
    $ok = VisibilityAnalytics::recordEvent(is_array($payload) ? $payload : []);
    if (!$ok) jsonError('Evento non valido', 422);
    json(['ok' => true]);
}

if (in_array($action, ['login', 'register', 'site-public', 'debug-site', 'migrate'])) {
    if ($action === 'migrate') {
        VisibilityAnalytics::ensureSchema();
        SeoFoundation::ensureSchema();
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
        try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_dna LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_memory LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_engine_state LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_settings LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_last_run DATETIME NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN site_understanding LONGTEXT NULL'); } catch (Throwable $e) {}
        try { DB::execute('ALTER TABLE sites ADD COLUMN site_understanding_corrections LONGTEXT NULL'); } catch (Throwable $e) {}
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

            $chiefEditorPrompt = "Sei il CAPOREDATTORE di un sito web personale/brand. Analizza tutti i post pubblicati e orchestra i contenuti per creare un'esperienza editoriale coerente.\n\n"
                . "Profilo:\n{profileSummary}\n\n"
                . "Ruolo:\n{roleMission}\n\n"
                . "Post attuali (JSON id, title, tags):\n{postsContext}\n\n"
                . "Istruzioni:\n"
                . "1. Individua 3-4 macro-categorie tematiche reali e armoniche analizzando il significato semantico dei titoli e dei tag presenti.\n"
                . "2. Per ciascuno dei post forniti nel JSON, assegna a quale di queste 3-4 macro-categorie appartiene.\n"
                . "3. Genera menu_links usando queste categorie. Includi sempre Home con url '/'.\n"
                . "4. Scegli l'ID del post migliore e piu rappresentativo da mettere in evidenza (featured_post_id).\n"
                . "5. Genera una hero_tagline max 80 caratteri che riassuma l'identita editoriale attuale.\n\n"
                . "Rispondi SOLO con JSON valido:\n"
                . '{"categories":["Categoria1","Categoria2"],"post_categories":{"POST_ID_1":"Categoria1"},"menu_links":[{"label":"Home","url":"/"},{"label":"Categoria1","url":"/?tag=categoria1"}],"featured_post_id":123,"hero_tagline":"Tagline d\'impatto"}';
            DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('chief_editor', 'Chief Editor', 'Orchestra categorie, menu, contenuto featured e tagline editoriale.', ?)", [$chiefEditorPrompt]);

            $editorialEnginePrompt = "Sei un Editorial Orchestrator senior per un sito web iper-indicizzabile che assorbe contenuti dai social.\n"
                . "Obiettivo assoluto: trasformare tanti contenuti social in un impianto editoriale coerente, continuo, indicizzabile e utile a Google.\n"
                . "Non devi riscrivere i post. Devi progettare il motore editoriale del sito.\n\n"
                . "DATI SITO\n"
                . "Titolo attuale: {siteTitle}\n"
                . "Profilo sintetico: {profileSummary}\n"
                . "Ruolo/Missione: {roleMission}\n"
                . "Strategia contenuti: {contentStrategy}\n"
                . "Brand voice profile: {brandVoiceProfile}\n"
                . "RAG knowledge: {ragKnowledge}\n\n"
                . "SORGENTI SOCIAL ATTIVE\n- {sourcesContext}\n\n"
                . "POST PUBBLICATI RECENTI (JSON line)\n{postsContext}\n\n"
                . "DNA ESISTENTE\n{existingDna}\n\n"
                . "MEMORIA EDITORIALE ESISTENTE\n{existingMemory}\n\n"
                . "SETTINGS MOTORE\n{engineSettings}\n\n"
                . "Restituisci SOLO JSON valido con questa struttura:\n"
                . "{"
                . "\"editorial_dna\":{"
                . "\"site_objective\":\"stringa breve\","
                . "\"audience\":\"stringa breve\","
                . "\"positioning\":\"stringa breve\","
                . "\"tone_rules\":[\"regola1\",\"regola2\",\"regola3\"],"
                . "\"content_pillars\":[\"pillar1\",\"pillar2\",\"pillar3\",\"pillar4\"],"
                . "\"topic_clusters\":[\"cluster1\",\"cluster2\",\"cluster3\",\"cluster4\"],"
                . "\"seo_entities\":[\"entity1\",\"entity2\",\"entity3\",\"entity4\",\"entity5\"],"
                . "\"continuity_rules\":[\"regola1\",\"regola2\",\"regola3\"],"
                . "\"indexing_priorities\":[\"priorita1\",\"priorita2\",\"priorita3\"]"
                . "},"
                . "\"editorial_memory\":{"
                . "\"covered_topics\":[\"tema1\",\"tema2\",\"tema3\"],"
                . "\"content_gaps\":[\"gap1\",\"gap2\",\"gap3\"],"
                . "\"internal_link_hubs\":[\"hub1\",\"hub2\",\"hub3\"],"
                . "\"cornerstone_pages\":[\"pagina1\",\"pagina2\",\"pagina3\"]"
                . "},"
                . "\"editorial_state\":{"
                . "\"featured_post_id\":123,"
                . "\"continuity_summary\":\"2-4 frasi\","
                . "\"next_actions\":[\"azione1\",\"azione2\",\"azione3\",\"azione4\"],"
                . "\"next_topics\":[\"topic1\",\"topic2\",\"topic3\",\"topic4\",\"topic5\"],"
                . "\"seo_risks\":[\"rischio1\",\"rischio2\"],"
                . "\"status\":\"healthy|needs_more_depth|needs_cornerstones\""
                . "}"
                . "}\n\n"
                . "Regole:\n"
                . "- Ragiona come direttore editoriale SEO, non come copywriter.\n"
                . "- Identifica ripetizioni, buchi tematici, contenuti stagionali e possibili pagine pilastro.\n"
                . "- Le next_actions devono essere operative e orientate all'indicizzazione.\n"
                . "- featured_post_id deve essere uno degli ID reali sopra.\n";
            DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('editorial_engine', 'Editorial Engine', 'Analizza corpus, cluster, gap, priorita SEO e prossime mosse editoriali.', ?)", [$editorialEnginePrompt]);

            try {
                DB::execute("ALTER TABLE sites ADD COLUMN harmonize_agent VARCHAR(50) NOT NULL DEFAULT 'content_editor'");
            } catch (Throwable $e) {}
            try {
                DB::execute("ALTER TABLE sites ADD COLUMN account_type VARCHAR(50) DEFAULT 'business'");
            } catch (Throwable $e) {}
            try {
                DB::execute("ALTER TABLE sites ADD COLUMN brand_voice_profile LONGTEXT NULL");
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
$userId = (int)($me['id'] ?? 0);
$dbMe = DB::fetch('SELECT id, email, name, slug, role FROM users WHERE id=?', [$userId]);
if ($dbMe) {
    $me = array_merge($me, [
        'id' => (int)$dbMe['id'],
        'email' => $dbMe['email'],
        'name' => $dbMe['name'],
        'slug' => $dbMe['slug'],
        'role' => $dbMe['role'] ?? ($me['role'] ?? 'user'),
    ]);
}
$isAdmin = ($me['role'] ?? 'user') === 'admin';

function requireAdmin(bool $isAdmin): void {
    if (!$isAdmin) jsonError('Permessi amministratore richiesti', 403);
}

// Logo del brand: usato solo quando i canali social non restituiscono una foto profilo valida
// o quando l'utente vuole sostituire quella recuperata automaticamente.
if ($action === 'site-logo-upload' && $method === 'POST') {
    ensureSiteSchemaUpgrades();
    $b = body();
    $dataUrl = trim((string)($b['data_url'] ?? ''));
    if (!preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$~', $dataUrl, $matches)) {
        jsonError('Formato logo non valido. Usa JPG, PNG o WebP.', 422);
    }
    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);
    if ($binary === false || strlen($binary) < 32) jsonError('Il file del logo è vuoto o danneggiato.', 422);
    if (strlen($binary) > 3 * 1024 * 1024) jsonError('Il logo deve pesare meno di 3 MB.', 413);

    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary) ?: '';
    $extension = match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        default => '',
    };
    if ($extension === '') jsonError('Il contenuto del file non è un’immagine supportata.', 422);

    $directory = __DIR__ . '/../public/media';
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) jsonError('Impossibile preparare la cartella del logo.', 500);
    $filename = 'brand_logo_' . $userId . '_' . date('YmdHis') . '.' . $extension;
    $path = $directory . '/' . $filename;
    if (@file_put_contents($path, $binary, LOCK_EX) === false) jsonError('Impossibile salvare il logo.', 500);

    $logoUrl = '/public/media/' . $filename;
    DB::execute('UPDATE sites SET logo_url=? WHERE user_id=?', [$logoUrl, $userId]);
    json(['ok' => true, 'logo_url' => $logoUrl]);
}

if ($action === 'post-media-upload' && $method === 'POST') {
    ensurePostMediaSchema();
    $b = body();
    $postId = (int)($b['post_id'] ?? 0);
    $dataUrl = trim((string)($b['data_url'] ?? ''));
    if (!$postId || !DB::fetch('SELECT id FROM posts WHERE id=? AND user_id=?', [$postId, $userId])) jsonError('Articolo non valido', 404);
    if (!preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$~', $dataUrl, $matches)) jsonError('Formato immagine non valido. Usa JPG, PNG o WebP.', 422);
    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);
    if ($binary === false || strlen($binary) < 32) jsonError('Immagine vuota o danneggiata', 422);
    if (strlen($binary) > 8 * 1024 * 1024) jsonError('L’immagine deve pesare meno di 8 MB', 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary) ?: '';
    $extension = match ($mime) { 'image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp', default=>'' };
    if ($extension === '') jsonError('Il file caricato non è un’immagine supportata', 422);
    $directory = __DIR__ . '/../public/media';
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) jsonError('Impossibile preparare la cartella media', 500);
    $filename = 'article_' . $userId . '_' . $postId . '_' . date('YmdHis') . '.' . $extension;
    if (@file_put_contents($directory . '/' . $filename, $binary, LOCK_EX) === false) jsonError('Impossibile salvare l’immagine', 500);
    $mediaUrl = '/public/media/' . $filename;
    json(['ok'=>true, 'media_url'=>$mediaUrl, 'media_type'=>'IMAGE']);
}

if ($action === 'me' && $method === 'GET') {
    json([
        'ok' => true,
        'user' => [
            'id' => (int)($me['id'] ?? 0),
            'email' => $me['email'] ?? '',
            'name' => $me['name'] ?? '',
            'slug' => $me['slug'] ?? '',
            'role' => $me['role'] ?? 'user',
        ],
    ]);
}

// Ogni utente autenticato puo cambiare la propria password, confermando prima
// quella attuale.
if ($action === 'password-change' && $method === 'POST') {
    $b = body();
    $currentPassword = (string)($b['current_password'] ?? '');
    $newPassword = (string)($b['new_password'] ?? '');

    if ($currentPassword === '' || $newPassword === '') {
        jsonError('Inserisci la password attuale e quella nuova', 422);
    }
    if (strlen($newPassword) < 8) {
        jsonError('La nuova password deve contenere almeno 8 caratteri', 422);
    }
    if (strlen($newPassword) > 72) {
        jsonError('La nuova password non puo superare 72 caratteri', 422);
    }

    $account = DB::fetch('SELECT password FROM users WHERE id=?', [$userId]);
    if (!$account || !password_verify($currentPassword, (string)$account['password'])) {
        jsonError('La password attuale non e corretta', 403);
    }
    if (password_verify($newPassword, (string)$account['password'])) {
        jsonError('La nuova password deve essere diversa da quella attuale', 422);
    }

    DB::execute(
        'UPDATE users SET password=? WHERE id=?',
        [password_hash($newPassword, PASSWORD_BCRYPT), $userId]
    );
    json(['ok' => true, 'message' => 'Password aggiornata con successo']);
}

// Ogni proprietario sceglie come i visitatori entrano nel proprio Spazio Vivo.
// L'anteprima e la lettura non cambiano nulla; solo il POST conferma la scelta.
if ($action === 'spazio-vivo-modes' && $method === 'GET') {
    ensureSiteSchemaUpgrades();
    $modeSite = DB::fetch(
        'SELECT title, bio, profile_summary, logo_url, cover_url, accent_color, living_space_mode, living_space_mode_updated_at
           FROM sites WHERE user_id=? LIMIT 1',
        [$userId]
    ) ?: [];
    $modePosts = DB::fetchAll(
        'SELECT id, platform, generated_title, generated_excerpt, tags, media_url, media_type, source_url, published_at, slug
           FROM posts
          WHERE user_id=? AND published=1
          ORDER BY published_at DESC, id DESC
          LIMIT 40',
        [$userId]
    );
    foreach ($modePosts as &$modePost) {
        $decodedTags = json_decode($modePost['tags'] ?? '[]', true);
        if (!is_array($decodedTags)) $decodedTags = [];
        $modePost['tags'] = array_values(array_filter(array_map('trim', $decodedTags)));
    }
    unset($modePost);
    json([
        'ok' => true,
        'profile' => [
            'name' => ($modeSite['title'] ?? '') ?: ($me['name'] ?? 'Il tuo Spazio Vivo'),
            'slug' => $me['slug'] ?? '',
            'bio' => ($modeSite['profile_summary'] ?? '') ?: ($modeSite['bio'] ?? ''),
            'logo_url' => $modeSite['logo_url'] ?? '',
            'cover_url' => $modeSite['cover_url'] ?? '',
            'accent_color' => $modeSite['accent_color'] ?? '#8C6BFF',
            'living_space_mode' => $modeSite['living_space_mode'] ?? 'pulse',
            'living_space_mode_updated_at' => $modeSite['living_space_mode_updated_at'] ?? null,
        ],
        'posts' => $modePosts,
    ]);
}

if ($action === 'spazio-vivo-mode' && $method === 'POST') {
    ensureSiteSchemaUpgrades();
    $allowedModes = ['pulse', 'stories', 'constellation', 'timeline', 'compass', 'mixer', 'cinema', 'answers', 'atlas', 'adaptive'];
    $selectedMode = strtolower(trim((string)(body()['mode'] ?? '')));
    if (!in_array($selectedMode, $allowedModes, true)) jsonError('Modalità Spazio Vivo non valida', 422);
    DB::execute(
        'UPDATE sites SET living_space_mode=?, living_space_mode_updated_at=NOW() WHERE user_id=?',
        [$selectedMode, $userId]
    );
    $savedMode = DB::fetch('SELECT living_space_mode, living_space_mode_updated_at FROM sites WHERE user_id=? LIMIT 1', [$userId]);
    if (($savedMode['living_space_mode'] ?? '') !== $selectedMode) jsonError('La modalità non è stata salvata. Riprova.', 500);
    json(['ok' => true, 'mode' => $savedMode['living_space_mode'], 'updated_at' => $savedMode['living_space_mode_updated_at']]);
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

if ($action === 'admin-editorial-room' && $method === 'GET') {
    requireAdmin($isAdmin);
    ensureSiteSchemaUpgrades();
    ensurePostMediaSchema();
    $targetId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    if ($targetId <= 0) jsonError('Utente non valido', 422);

    $user = DB::fetch(
        'SELECT u.id, u.email, u.name, u.slug, u.role,
                s.title AS site_title, s.bio, s.profile_summary, s.role_mission, s.content_strategy,
                s.brand_voice_profile, s.harmonize_agent, s.account_type,
                s.editorial_dna, s.editorial_memory, s.editorial_engine_state, s.editorial_settings, s.editorial_last_run,
                s.site_understanding, s.menu_links, s.hero_tagline, s.site_ai_data
         FROM users u
         LEFT JOIN sites s ON s.user_id = u.id
         WHERE u.id = ?',
        [$targetId]
    );
    if (!$user) jsonError('Utente non trovato', 404);

    $sources = DB::fetchAll(
        'SELECT id, platform, label, url, topic_summary, since_date, auto_publish, max_posts
         FROM social_sources
         WHERE user_id = ? AND active = 1
         ORDER BY id ASC',
        [$targetId]
    );

    $posts = DB::fetchAll(
        'SELECT id, generated_title, edited_title, generated_excerpt, tags, seo_score, published_at, noindex
         FROM posts
         WHERE user_id = ? AND published = 1
         ORDER BY published_at DESC, id DESC
         LIMIT 12',
        [$targetId]
    );

    json([
        'user' => $user,
        'sources' => $sources,
        'posts' => $posts,
    ]);
}

if ($action === 'admin-post-noindex' && $method === 'POST') {
    requireAdmin($isAdmin);
    ensurePostMediaSchema();
    $b = body();
    $postId = (int)($b['id'] ?? 0);
    $targetUserId = (int)($b['user_id'] ?? 0);
    if ($postId <= 0 || $targetUserId <= 0) jsonError('Articolo o utente non valido', 422);
    $post = DB::fetch('SELECT id FROM posts WHERE id=? AND user_id=?', [$postId, $targetUserId]);
    if (!$post) jsonError('Articolo non trovato', 404);
    $noindex = !empty($b['noindex']) ? 1 : 0;
    DB::execute('UPDATE posts SET noindex=? WHERE id=? AND user_id=?', [$noindex, $postId, $targetUserId]);
    json(['ok' => true, 'id' => $postId, 'noindex' => $noindex]);
}

if ($action === 'admin-seo' && $method === 'GET') {
    requireAdmin($isAdmin);
    VisibilityAnalytics::ensureSchema();
    $users = DB::fetchAll('
        SELECT u.id, u.email, u.slug, u.created_at, s.title, s.last_sync
        FROM users u
        LEFT JOIN sites s ON s.user_id = u.id
        ORDER BY u.created_at DESC
    ');
    $stats = [];
    foreach ($users as $row) {
        $summary = VisibilityAnalytics::userSummary((int)$row['id']);
        $stats[] = array_merge($row, $summary, [
            'top_queries' => VisibilityAnalytics::topQueries((int)$row['id'], 5),
            'top_pages' => VisibilityAnalytics::topPages((int)$row['id'], 5),
        ]);
    }
    usort($stats, fn($a, $b) => ($b['impressions'] <=> $a['impressions']) ?: strcmp((string)$b['created_at'], (string)$a['created_at']));
    json(['stats' => $stats]);
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
    if (array_key_exists('password', $b) && $b['password'] !== '') {
        if (strlen((string)$b['password']) < 8) jsonError('La nuova password deve contenere almeno 8 caratteri', 422);
        if (strlen((string)$b['password']) > 72) jsonError('La nuova password non puo superare 72 caratteri', 422);
        DB::execute('UPDATE users SET password=? WHERE id=?', [password_hash((string)$b['password'], PASSWORD_BCRYPT), $targetId]);
    }
    
    if (array_key_exists('role_mission', $b) || array_key_exists('content_strategy', $b)) {
        DB::execute('UPDATE sites SET role_mission=COALESCE(?,role_mission), content_strategy=COALESCE(?,content_strategy) WHERE user_id=?',
            [$b['role_mission'] ?? null, $b['content_strategy'] ?? null, $targetId]);
    }
    
    json(['ok' => true]);
}

// L'amministratore puo assegnare una nuova password a qualsiasi account senza
// dover conoscere quella precedente.
if ($action === 'admin-password-reset' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $targetId = (int)($b['id'] ?? 0);
    $newPassword = (string)($b['new_password'] ?? '');

    if ($targetId <= 0) jsonError('Utente non valido', 422);
    if (strlen($newPassword) < 8) jsonError('La nuova password deve contenere almeno 8 caratteri', 422);
    if (strlen($newPassword) > 72) jsonError('La nuova password non puo superare 72 caratteri', 422);
    if (!DB::fetch('SELECT id FROM users WHERE id=?', [$targetId])) jsonError('Utente non trovato', 404);

    DB::execute(
        'UPDATE users SET password=? WHERE id=?',
        [password_hash($newPassword, PASSWORD_BCRYPT), $targetId]
    );
    json(['ok' => true, 'message' => 'Password utente aggiornata con successo']);
}

if ($action === 'admin-delete-user' && $method === 'POST') {
    requireAdmin($isAdmin);
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

// Laboratorio privato: dieci modi di fruire lo Spazio Vivo usando soltanto
// il patrimonio reale di San Germano. Nessuna variante modifica il sito live.
if ($action === 'admin-spazio-vivo-lab' && $method === 'GET') {
    requireAdmin($isAdmin);
    $labUser = DB::fetch('SELECT id, name, slug FROM users WHERE slug=? LIMIT 1', ['sangermano']);
    if (!$labUser) jsonError('Profilo sangermano non trovato', 404);

    $labSite = DB::fetch(
        'SELECT title, bio, profile_summary, logo_url, cover_url, accent_color, site_understanding
           FROM sites WHERE user_id=? LIMIT 1',
        [$labUser['id']]
    ) ?: [];
    $labPosts = DB::fetchAll(
        'SELECT id, platform, generated_title, generated_excerpt, tags, media_url, media_type, source_url, published_at, slug
           FROM posts
          WHERE user_id=? AND published=1
          ORDER BY published_at DESC, id DESC
          LIMIT 40',
        [$labUser['id']]
    );
    foreach ($labPosts as &$labPost) {
        $decodedTags = json_decode($labPost['tags'] ?? '[]', true);
        if (!is_array($decodedTags)) $decodedTags = [];
        $labPost['tags'] = array_values(array_filter(array_map('trim', $decodedTags)));
    }
    unset($labPost);
    $labSources = DB::fetchAll(
        'SELECT platform, label, url FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id',
        [$labUser['id']]
    );

    json([
        'ok' => true,
        'profile' => [
            'name' => ($labSite['title'] ?? '') ?: ($labUser['name'] ?: 'Agriturismo San Germano'),
            'slug' => $labUser['slug'],
            'bio' => $labSite['profile_summary'] ?: ($labSite['bio'] ?? ''),
            'logo_url' => $labSite['logo_url'] ?? '',
            'cover_url' => $labSite['cover_url'] ?? '',
            'accent_color' => $labSite['accent_color'] ?? '#8C6BFF',
        ],
        'posts' => $labPosts,
        'sources' => $labSources,
        'generated_at' => date(DATE_ATOM),
    ]);
}

if ($action === 'admin-editorial-engine' && $method === 'GET') {
    requireAdmin($isAdmin);
    json(['ok' => true, 'engine' => EditorialEngine::getState($userId)]);
}

if ($action === 'admin-editorial-engine-save' && $method === 'POST') {
    requireAdmin($isAdmin);
    $b = body();
    $settings = EditorialEngine::saveSettings($userId, [
        'enabled' => !empty($b['enabled']),
        'auto_run' => !empty($b['auto_run']),
        'min_posts' => max(3, (int)($b['min_posts'] ?? 8)),
        'strict_indexing_mode' => !empty($b['strict_indexing_mode']),
    ]);
    json(['ok' => true, 'settings' => $settings]);
}

if ($action === 'admin-editorial-engine-run' && $method === 'POST') {
    requireAdmin($isAdmin);
    json(['ok' => true, 'result' => EditorialEngine::run($userId)]);
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
    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube', 'website'], true)) {
        jsonError('Piattaforma non supportata: ' . $platform);
    }

    $sinceDate = trim($b['since_date'] ?? '');
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    $topic = 'Profilo/canale ' . $platform . ' indicato dall\'utente';
    if ($label) $topic .= ': ' . $label;

    try {
        $id = DB::insert(
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary) VALUES (?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic]
        );
    } catch (Throwable $e) {
        jsonError('Questo social e gia presente per l\'utente', 409);
    }

    json(['ok' => true, 'source' => [
        'id' => $id, 'platform' => $platform, 'label' => $label, 'url' => $url,
        'topic_summary' => $topic, 'active' => 1
    ]], 201);
}

if ($action === 'social-source-upsert' && $method === 'POST') {
    ensureSocialSyncSchema();
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $url = trim($b['url'] ?? '');
    $label = trim($b['label'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    $autoPublish = (int)($b['auto_publish'] ?? 1);
    $autoSync = !array_key_exists('auto_sync', $b) || !empty($b['auto_sync']) ? 1 : 0;
    $maxPosts = isset($b['max_posts']) && $b['max_posts'] !== '' ? (int)$b['max_posts'] : null;
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;

    if (!in_array($platform, ['instagram', 'facebook', 'tiktok', 'youtube', 'website'], true)) {
        jsonError('Piattaforma non supportata: ' . $platform);
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
            'UPDATE social_sources
                SET label=?,
                    url=?,
                    topic_summary=?,
                    since_date=?,
                    auto_publish=?,
                    auto_sync=?,
                    max_posts=?,
                    active=1
              WHERE id=? AND user_id=?',
            [$label, $url, $topic, $sinceDate, $autoPublish, $autoSync, $maxPosts, $existing['id'], $userId]
        );
        $id = (int)$existing['id'];
    } else {
        $id = DB::insert(
            'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, since_date, auto_publish, auto_sync, max_posts) VALUES (?,?,?,?,?,?,?,?,?)',
            [$userId, $platform, $label, $url, $topic, $sinceDate, $autoPublish, $autoSync, $maxPosts]
        );
    }

    $response = ['ok' => true, 'source' => [
        'id' => $id,
        'platform' => $platform,
        'label' => $label,
        'url' => $url,
        'topic_summary' => $topic,
        'since_date' => $sinceDate,
        'auto_publish' => $autoPublish,
        'auto_sync' => $autoSync,
        'max_posts' => $maxPosts,
    ]];
    if (!array_key_exists('scan_now', $b) || !empty($b['scan_now'])) {
        require_once __DIR__ . '/services/ingest.php';
        $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy FROM sites WHERE user_id=?', [$userId]);
        $response['scan_report'] = Ingest::scanSources(
            $userId,
            isset($maxPosts) && $maxPosts ? $maxPosts : 5,
            $site['profile_summary'] ?? '',
            $site['role_mission'] ?? '',
            $site['content_strategy'] ?? '',
            $id
        );
    }
    json($response);
}

if ($action === 'social-connection-update' && $method === 'POST') {
    ensureSocialSyncSchema();
    $b = body();
    $platform = trim($b['platform'] ?? '');
    $sinceDate = trim($b['since_date'] ?? '');
    $autoPublish = (int)($b['auto_publish'] ?? 1);
    $autoSync = !array_key_exists('auto_sync', $b) || !empty($b['auto_sync']) ? 1 : 0;
    $maxPosts = isset($b['max_posts']) && $b['max_posts'] !== '' ? (int)$b['max_posts'] : null;
    if ($sinceDate && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $sinceDate)) $sinceDate = null;
    
    if (!in_array($platform, ['instagram', 'instagram_login', 'facebook', 'tiktok', 'youtube'], true)) {
        jsonError('Piattaforma non supportata');
    }

    DB::execute(
        'UPDATE social_connections
            SET since_date=?,
                auto_publish=?,
                auto_sync=?,
                max_posts=?
          WHERE user_id=? AND platform=?',
        [$sinceDate, $autoPublish, $autoSync, $maxPosts, $userId, $platform]
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

if ($action === 'social-disconnect' && $method === 'POST') {
    $b = body();
    DB::execute(
        'UPDATE social_connections SET active=0 WHERE platform=? AND user_id=?',
        [trim($b['platform'] ?? ''), $userId]
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
if ($action === 'repair-media' && $method === 'POST') {
    $b = body();
    $limit = isset($b['limit']) ? (int)$b['limit'] : 50;
    $report = Sync::repairMediaLibrary($userId, max(20, $limit));
    json(['ok' => true, 'report' => $report]);
}

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

$postColumns = [];
try { foreach (DB::fetchAll('SHOW COLUMNS FROM posts') as $column) $postColumns[$column['Field']] = true; } catch (Throwable $e) {}
foreach (['edited_title'=>'VARCHAR(255) NULL','edited_body'=>'LONGTEXT NULL','edited_excerpt'=>'TEXT NULL'] as $column => $definition) {
    if (isset($postColumns[$column])) continue;
    try { DB::execute("ALTER TABLE posts ADD COLUMN `$column` $definition"); } catch (Throwable $e) {}
}

// ── GET site ──────────────────────────────────────────────────────────────
if ($action === 'site' && $method === 'GET') {
    try {
        ensurePostMediaSchema();
        ensureSocialSyncSchema();
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        if ($site) {
            $mergedUnderstanding = mergeUnderstanding(
                $site['site_understanding'] ?? null,
                $site['site_understanding_corrections'] ?? null
            );
            $site['site_understanding'] = !empty($mergedUnderstanding) ? $mergedUnderstanding : null;
        }
        $posts = DB::fetchAll(
            'SELECT id, user_id, platform, platform_post_id, SUBSTR(raw_content, 1, 500) as raw_content, generated_title, generated_excerpt, generated_body, edited_body, edited_title, edited_excerpt, tags, media_url, media_type, media_display_width, media_alignment, noindex, source_url, published_at, seo_score, slug, published
               FROM posts
              WHERE user_id=?
                AND seo_score >= 0
              ORDER BY published_at DESC
              LIMIT 300',
            [$userId]
        );
        file_put_contents(__DIR__ . '/../public/debug.json', json_encode(array_map(function($p) { return ['id' => $p['id'], 'title' => $p['generated_title'], 'gen_body_len' => strlen($p['generated_body'] ?? ''), 'edited_body_len' => strlen($p['edited_body'] ?? '')]; }, array_slice($posts, 0, 10))));
        $connections = DB::fetchAll(
            'SELECT platform, handle, active, since_date, auto_publish, auto_sync, max_posts FROM social_connections WHERE user_id=?', [$userId]
        );
        $sources = DB::fetchAll(
            'SELECT id, platform, label, url, topic_summary, active, since_date, auto_publish, auto_sync, max_posts FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
            [$userId]
        );
        foreach ($posts as &$p) {
            $decoded = json_decode($p['tags'] ?? '[]', true);
            if (!is_array($decoded)) {
                $decoded = is_string($p['tags']) ? explode(',', $p['tags']) : [];
            }
            $p['tags'] = array_filter(array_map('trim', $decoded));
        }
        VisibilityAnalytics::ensureSchema();
        $visibility = VisibilityAnalytics::userSummary($userId);
        // Sono dati del proprietario del profilo: servono a spiegare cosa sta
        // funzionando e a costruire suggerimenti SEO basati su evidenze reali.
        $visibility['top_queries'] = VisibilityAnalytics::topQueries($userId, 6);
        $visibility['top_pages'] = VisibilityAnalytics::topPages($userId, 6);
        $reachability = ReachabilityNetwork::summary($userId, $site, $sources, $posts, $visibility);
        json(['site' => $site, 'posts' => $posts, 'connections' => $connections, 'sources' => $sources, 'visibility' => $visibility, 'reachability' => $reachability]);
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
    ensurePostMediaSchema();
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
    if (array_key_exists('noindex', $b))      { $fields[] = 'noindex=?';      $params[] = !empty($b['noindex']) ? 1 : 0; }
    if (array_key_exists('media_url', $b)) {
        $mediaUrl = trim((string)$b['media_url']);
        if ($mediaUrl !== '' && !filter_var($mediaUrl, FILTER_VALIDATE_URL) && !str_starts_with($mediaUrl, '/public/media/')) jsonError('Indirizzo immagine non valido', 422);
        $mediaType = strtoupper(trim((string)($b['media_type'] ?? 'IMAGE')));
        if (!in_array($mediaType, ['IMAGE', 'VIDEO'], true)) $mediaType = 'IMAGE';
        $fields[] = 'media_url=?'; $params[] = $mediaUrl;
        $fields[] = 'media_type=?'; $params[] = $mediaUrl === '' ? '' : $mediaType;
    }
    if (array_key_exists('media_display_width', $b)) { $fields[] = 'media_display_width=?'; $params[] = max(30, min(100, (int)$b['media_display_width'])); }
    if (array_key_exists('media_alignment', $b)) {
        $alignment = strtolower(trim((string)$b['media_alignment']));
        if (!in_array($alignment, ['left', 'center', 'right'], true)) $alignment = 'center';
        $fields[] = 'media_alignment=?'; $params[] = $alignment;
    }
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
    ensureSiteSchemaUpgrades();
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
    if (array_key_exists('accent_secondary', $b)) { $fields[] = 'accent_secondary = ?'; $params[] = $b['accent_secondary']; }
    if (array_key_exists('header_layout', $b)) { $fields[] = 'header_layout = ?'; $params[] = $b['header_layout']; }
    if (array_key_exists('logo_url', $b)) { $fields[] = 'logo_url = ?'; $params[] = $b['logo_url']; }
    if (array_key_exists('cover_url', $b)) { $fields[] = 'cover_url = ?'; $params[] = $b['cover_url']; }
    if (array_key_exists('hero_tagline', $b)) { $fields[] = 'hero_tagline = ?'; $params[] = $b['hero_tagline']; }
    if (array_key_exists('cta_text', $b)) { $fields[] = 'cta_text = ?'; $params[] = $b['cta_text']; }
    if (array_key_exists('custom_css', $b)) { $fields[] = 'custom_css = ?'; $params[] = $b['custom_css']; }
    if (array_key_exists('gsc_verification', $b)) { $fields[] = 'gsc_verification = ?'; $params[] = $b['gsc_verification']; }
    if (array_key_exists('site_ai_data', $b)) { $fields[] = 'site_ai_data = ?'; $params[] = is_array($b['site_ai_data']) ? json_encode($b['site_ai_data'], JSON_UNESCAPED_UNICODE) : $b['site_ai_data']; }
    if (array_key_exists('site_understanding', $b)) {
        $encodedUnderstanding = is_array($b['site_understanding']) ? json_encode($b['site_understanding'], JSON_UNESCAPED_UNICODE) : $b['site_understanding'];
        $fields[] = 'site_understanding = ?';
        $params[] = $encodedUnderstanding;
        $fields[] = 'site_understanding_corrections = ?';
        $params[] = $encodedUnderstanding;
    }
    if (array_key_exists('site_understanding_corrections', $b)) {
        $existingRow = DB::fetch('SELECT site_understanding, site_understanding_corrections FROM sites WHERE user_id=?', [$userId]);
        $mergedCorrections = array_replace_recursive(
            decodeJsonObject($existingRow['site_understanding_corrections'] ?? null),
            decodeJsonObject($b['site_understanding_corrections'])
        );
        $fields[] = 'site_understanding_corrections = ?';
        $params[] = json_encode($mergedCorrections, JSON_UNESCAPED_UNICODE);
        $fields[] = 'site_understanding = ?';
        $params[] = json_encode(mergeUnderstanding($existingRow['site_understanding'] ?? null, $mergedCorrections), JSON_UNESCAPED_UNICODE);
    }
    if (array_key_exists('harmonize_agent', $b)) { $fields[] = 'harmonize_agent = ?'; $params[] = $b['harmonize_agent']; }
    if (array_key_exists('account_type', $b)) { $fields[] = 'account_type = ?'; $params[] = $b['account_type']; }

    if (!empty($fields)) {
        $params[] = $userId;
        DB::execute('UPDATE sites SET ' . implode(', ', $fields) . ' WHERE user_id = ?', $params);
    }
    if (array_key_exists('site_understanding', $b) || array_key_exists('site_understanding_corrections', $b) || array_key_exists('profile_summary', $b) || array_key_exists('role_mission', $b) || array_key_exists('content_strategy', $b)) {
        try { SeoFoundation::rebuild($userId, true, false); } catch (Throwable $e) {}
    }
    json(['ok' => true]);
}

if ($action === 'refresh-understanding' && $method === 'POST') {
    ensureSiteSchemaUpgrades();
    require_once __DIR__ . '/services/ai.php';
    $site = DB::fetch('SELECT profile_summary, bio, role_mission, content_strategy, site_understanding_corrections FROM sites WHERE user_id=?', [$userId]);
    $sources = DB::fetchAll('SELECT platform, label, url FROM social_sources WHERE user_id=? AND active=1 ORDER BY id ASC', [$userId]);
    $posts = DB::fetchAll('SELECT generated_title, generated_excerpt, raw_content, transcript FROM posts WHERE user_id=? ORDER BY id DESC LIMIT 20', [$userId]);
    $summary = trim((string)($site['profile_summary'] ?? $site['bio'] ?? ''));
    $role = trim((string)($site['role_mission'] ?? ''));
    $strategy = trim((string)($site['content_strategy'] ?? ''));
    $understanding = mergeUnderstanding(
        AI::siteUnderstanding($sources, $posts, $summary, $role, $strategy),
        $site['site_understanding_corrections'] ?? null
    );
    DB::execute('UPDATE sites SET site_understanding=? WHERE user_id=?', [json_encode($understanding, JSON_UNESCAPED_UNICODE), $userId]);
    $foundation = SeoFoundation::rebuild($userId, true);
    json(['ok' => true, 'understanding' => $understanding, 'seo_foundation' => $foundation]);
}

if ($action === 'rebuild-seo-foundation' && $method === 'POST') {
    json(['ok' => true, 'seo_foundation' => SeoFoundation::rebuild($userId, true)]);
}

if ($action === 'reachability-update' && $method === 'POST') {
    $profile = ReachabilityNetwork::update($userId, body());
    json(['ok' => true, 'profile' => $profile]);
}

// ── POST design-site (3 proposte Graphic Designer) ───────────────────────
if ($action === 'design-site' && $method === 'POST') {
    try {
        ensureSiteSchemaUpgrades();
        require_once __DIR__ . '/services/ai.php';
        $site = DB::fetch('SELECT profile_summary, bio, role_mission, content_strategy, title, footer_text FROM sites WHERE user_id=?', [$userId]);
        $summary = trim($site['profile_summary'] ?? $site['bio'] ?? '');
        $role    = trim($site['role_mission'] ?? '');
        $strategy = trim($site['content_strategy'] ?? '');
        $sourceDetails = DB::fetchAll('SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id', [$userId]);
        $sourcesContext = implode("\n", array_map(
            fn($s) => '[' . ($s['platform'] ?? 'source') . '] ' . trim(($s['label'] ?: $s['url']) . (!empty($s['topic_summary']) ? ' — ' . $s['topic_summary'] : '')),
            $sourceDetails
        ));
        if ($sourcesContext !== '') $summary = trim($summary . "\n\nDettagli sorgenti social:\n" . $sourcesContext);
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
        $proposals = AI::graphicDesignerSetupWithUnderstanding($summary, $role, $strategy, $site['site_understanding'] ?? null);

        // Prima proposta come default attivo
        $g = $proposals[0] ?? [];
        DB::execute(
            'UPDATE sites SET title=?, bio=?, menu_links=?, footer_text=?,
                theme=?, accent_color=?, header_layout=?, custom_css=?,
                generated_layouts=?, hero_tagline=?, cover_url=COALESCE(NULLIF(?,\'\'), cover_url)
             WHERE user_id=?',
            [
                $site['title'] ?? ($seo['title'] ?? ''), $seo['bio'] ?? '',
                isset($seo['menu_links']) ? json_encode($seo['menu_links'], JSON_UNESCAPED_UNICODE) : '',
                $site['footer_text'] ?? ($seo['footer_text'] ?? ''),
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
        ensureSiteSchemaUpgrades();
        require_once __DIR__ . '/services/ai.php';
        $site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        $summary  = trim($site['profile_summary'] ?? $site['bio'] ?? '');
        $role     = trim($site['role_mission'] ?? '');
        $strategy = trim($site['content_strategy'] ?? '');
        $sourceDetails = DB::fetchAll('SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id', [$userId]);
        $sourcesContext = implode("\n", array_map(
            fn($s) => '[' . ($s['platform'] ?? 'source') . '] ' . trim(($s['label'] ?: $s['url']) . (!empty($s['topic_summary']) ? ' — ' . $s['topic_summary'] : '')),
            $sourceDetails
        ));
        if ($sourcesContext !== '') $summary = trim($summary . "\n\nDettagli sorgenti social:\n" . $sourcesContext);
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

        $result = normalizeSiteAiResult(AI::siteAiGenerateWithUnderstanding($summary, $role, $strategy, $recentPosts, $tagsContext, $site['site_understanding'] ?? null));

        DB::execute(
            'UPDATE sites SET
                title=?, bio=?, role_mission=?,
                theme=?, design_archetype=?, accent_color=?, accent_secondary=?, header_layout=?,
                menu_links=?, footer_text=?, custom_css=?, hero_tagline=?, cta_text=?,
                cover_url=COALESCE(NULLIF(?, \'\'), cover_url), site_ai_data=?
             WHERE user_id=?',
            [
                $site['title'] ?? ($result['title'] ?? ''),
                $result['bio'] ?? '',
                $result['role_mission'] ?? $role,
                $result['theme'] ?? 'classic',
                $result['design_archetype'] ?? ($result['theme'] ?? 'classic'),
                $result['accent_color'] ?? '',
                $result['accent_secondary'] ?? '',
                $result['header_layout'] ?? 'standard',
                isset($result['menu_links']) ? json_encode($result['menu_links'], JSON_UNESCAPED_UNICODE) : '',
                $site['footer_text'] ?? ($result['footer_text'] ?? ''),
                $result['custom_css'] ?? '',
                $result['hero_tagline'] ?? '',
                $result['cta_text'] ?? '',
                $result['cover_url'] ?? '',
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

// Trasforma un suggerimento editoriale in una bozza, senza pubblicarla.
if ($action === 'create-idea-draft' && $method === 'POST') {
    $b = body();
    $ideaTitle = trim((string)($b['title'] ?? ''));
    $ideaReason = trim((string)($b['reason'] ?? ''));
    $ideaType = trim((string)($b['type'] ?? 'Idea editoriale'));
    $ideaSource = trim((string)($b['source'] ?? 'Analisi editoriale'));
    $ideaPriority = trim((string)($b['priority'] ?? 'Consigliata'));
    if ($ideaTitle === '') jsonError('Titolo idea mancante', 422);
    $ideaTitleLength = function_exists('mb_strlen') ? mb_strlen($ideaTitle, 'UTF-8') : strlen($ideaTitle);
    if ($ideaTitleLength > 240) jsonError('Titolo idea troppo lungo', 422);

    $brief = "IDEA EDITORIALE SCELTA DALL'UTENTE\n"
        . "Tipo: {$ideaType}\n"
        . "Titolo/obiettivo: {$ideaTitle}\n"
        . ($ideaReason !== '' ? "Motivazione: {$ideaReason}\n" : '')
        . "Prepara un articolo utile e concreto coerente con la comprensione confermata dell'attivita. "
        . "Non inventare prezzi, servizi, luoghi, date o risultati non presenti nel contesto. "
        . "Il risultato deve essere una bozza revisionabile e non va pubblicato automaticamente.";
    $platformPostId = 'idea_' . bin2hex(random_bytes(10));
    $contentHash = hash('sha256', $userId . '|' . $platformPostId . '|' . $brief);
    $safeTitle = htmlspecialchars($ideaTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeReason = htmlspecialchars($ideaReason !== '' ? $ideaReason : 'Sviluppare questo tema con informazioni utili, concrete e verificabili.', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeType = htmlspecialchars($ideaType, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeSource = htmlspecialchars($ideaSource, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safePriority = htmlspecialchars($ideaPriority, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $draftExcerpt = $ideaReason !== '' ? $ideaReason : 'Prima bozza editoriale da completare e personalizzare prima della pubblicazione.';
    $draftBody = '<p><strong>Bozza iniziale pronta per la revisione.</strong></p>'
        . '<h2>Obiettivo del contenuto</h2><p>' . $safeReason . '</p>'
        . '<h2>Il punto di partenza</h2><p>Questo contenuto nasce da <strong>' . $safeSource . '</strong> ed è classificato come <strong>' . $safePriority . '</strong>. Deve rispondere con chiarezza al tema “' . $safeTitle . '” usando esempi e informazioni realmente disponibili.</p>'
        . '<h2>Scaletta da sviluppare</h2><ul><li>Aprire con il bisogno o la domanda concreta del pubblico.</li><li>Spiegare il tema con un linguaggio semplice e specifico.</li><li>Aggiungere prove, esempi o dettagli riconducibili all’attività.</li><li>Concludere con un prossimo passo chiaro, senza promesse non verificabili.</li></ul>'
        . '<h2>Nota editoriale</h2><p>Tipologia: ' . $safeType . '. La versione AI completa viene elaborata in background; puoi già modificare questa struttura.</p>';
    $draftSlug = slugify($ideaTitle . '-' . substr($platformPostId, -6));
    $metaDescription = function_exists('mb_substr') ? mb_substr($draftExcerpt, 0, 155, 'UTF-8') : substr($draftExcerpt, 0, 155);
    $postId = DB::insert(
        'INSERT INTO posts (user_id, platform, platform_post_id, raw_content, generated_title, generated_body, generated_excerpt, tags, meta_description, slug, published_at, imported_at, content_hash, seo_score, published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, 10, 0)',
        [$userId, 'editorial_idea', $platformPostId, $brief, $ideaTitle, $draftBody, $draftExcerpt, json_encode([$ideaType], JSON_UNESCAPED_UNICODE), $metaDescription, $draftSlug, $contentHash]
    );

    $response = [
        'ok' => true,
        'post_id' => (int)$postId,
        'status' => 'draft',
        'ai_status' => function_exists('fastcgi_finish_request') ? 'processing' : 'scaffold',
        'draft' => [
            'id' => (int)$postId,
            'title' => $ideaTitle,
            'body' => $draftBody,
            'excerpt' => $draftExcerpt,
            'tags' => $ideaType,
        ],
    ];

    // Rispondi subito: la bozza esiste già ed è modificabile. Su PHP-FPM la
    // riscrittura AI continua dopo che il browser ha ricevuto la risposta.
    while (ob_get_level() > 0) ob_end_clean();
    http_response_code(201);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
        ignore_user_abort(true);
        try {
            Ingest::harmonize($userId, (int)$postId, 0);
        } catch (Throwable $e) {
            DB::execute('UPDATE posts SET agent_notes=? WHERE id=? AND user_id=?', ['Bozza salvata; completamento AI non riuscito: ' . $e->getMessage(), $postId, $userId]);
        }
    }
    exit;
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
        
        // 1. Analisi Media (Trascrizione se Video, OCR/Descrittore se Immagine)
        $transcript = trim($post['transcript'] ?? '');
        if (!$transcript && !empty($post['media_url'])) {
            if (strtoupper($post['media_type']) === 'VIDEO') {
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
                            $transcript = AI::transcribeFile($post['media_url'], 'video/mp4');
                        }
                    }
                }
            } elseif (strtoupper($post['media_type']) === 'IMAGE' || strtoupper($post['media_type']) === 'PHOTO') {
                // Analisi Immagine (OCR + Descrizione via Gemini)
                $parsedUrl = parse_url($post['media_url']);
                $path = __DIR__ . '/../../' . ltrim($parsedUrl['path'], '/');
                $imageSrc = file_exists($path) ? $path : $post['media_url'];
                $transcript = AI::analyzeImage($imageSrc);
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
                echo json_encode([
                    'ok' => true,
                    'status' => 'skipped',
                    'published' => false,
                    'message' => 'Post scartato dal curatore AI (punteggio basso o non rilevante)'
                ]);
                exit;
            }

            // Ottieni impostazione auto-publish della fonte
            $source = DB::fetch('SELECT auto_publish FROM social_sources WHERE user_id=? AND platform=?', [$userId, $post['platform']]);
            $autoPublish = isset($source['auto_publish']) ? (int)$source['auto_publish'] : 1;
            
            // Armonizza (genera SEO)
            $res = Ingest::harmonize($userId, $postId, $autoPublish);
            json([
                'ok' => true,
                'status' => $autoPublish ? 'published' : 'draft',
                'published' => (bool)$autoPublish,
                'id' => $postId,
                'seo' => $res['seo']
            ]);
        } else {
            // Elimina post non validi o ignorati (es. solo immagini senza didascalia)
            DB::execute('DELETE FROM posts WHERE id=?', [$postId]);
            json([
                'ok' => true,
                'status' => 'deleted',
                'published' => false,
                'message' => 'Nessun testo estraibile. Post saltato.'
            ]);
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
    ensureSiteSchemaUpgrades();
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
        $site = DB::fetch('SELECT title, theme, site_understanding_corrections FROM sites WHERE user_id=?', [$userId]);
        $understanding = mergeUnderstanding(
            AI::siteUnderstanding($sources, $posts, $summary, $finalRoleMission, $finalContentStrategy),
            $site['site_understanding_corrections'] ?? null
        );
        
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
                generated_layouts=COALESCE(NULLIF(?, ""), generated_layouts),
                site_understanding=?
             WHERE user_id=?',
            [$summary, $finalRoleMission, $finalContentStrategy, $seoTitle, $seoBio, $seoMenu, $seoFooter, $gTheme, $gColor, $gLayout, $gCss, $layoutsJson, json_encode($understanding, JSON_UNESCAPED_UNICODE), $userId]
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

    try {
        $engineState = EditorialEngine::getState($userId);
        if (!empty($engineState['settings']['enabled']) && !empty($engineState['settings']['auto_run'])) {
            EditorialEngine::run($userId);
        }
    } catch (Throwable $e) { }

    try { SeoFoundation::rebuild($userId); } catch (Throwable $e) { }

    DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);
    json(['ok' => true]);
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
