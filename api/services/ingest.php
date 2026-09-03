<?php
// api/services/ingest.php — Ingestione unificata da siti web e URL pubblici.
// Ricava il testo e salva
// il contenuto come BOZZA (published=0). L'armonizzazione è il passo 2.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/visibility.php';
require_once __DIR__ . '/website_source.php';
require_once __DIR__ . '/refetcher.php';
require_once __DIR__ . '/../middleware/response.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) require_once __DIR__ . '/../middleware/logger.php';

class Ingest {
    public static function ensureProcessingSchema(): void {
        static $done = false;
        if ($done) return;
        $done = true;

        $definitions = [
            'processing_status' => "VARCHAR(20) NOT NULL DEFAULT 'pending'",
            'processing_started_at' => 'DATETIME NULL',
            'processing_attempts' => 'INT NOT NULL DEFAULT 0',
            'processing_error' => 'TEXT NULL',
        ];
        $existing = [];
        try { foreach (DB::fetchAll('SHOW COLUMNS FROM posts') as $column) $existing[$column['Field']] = true; } catch (Throwable $e) { return; }
        foreach ($definitions as $column => $definition) {
            if (isset($existing[$column])) continue;
            try { DB::execute("ALTER TABLE posts ADD COLUMN `$column` $definition"); } catch (Throwable $e) {}
        }
        try {
            DB::execute("UPDATE posts SET processing_status=CASE WHEN seo_score=-1 THEN 'pending' ELSE 'done' END WHERE processing_status='' OR processing_status IS NULL OR (seo_score>=0 AND processing_status='pending')");
        } catch (Throwable $e) {}
        try {
            // Le vecchie versioni convertivano ogni errore AI in una copia del
            // post con titolo troncato: seo_score=1 nel recupero della coda,
            // seo_score=40 nel fallback JSON. Rimettiamo in coda soltanto i
            // contenuti riconoscibili e mai corretti manualmente.
            DB::execute(
                "UPDATE posts
                    SET generated_title=NULL, generated_body=NULL, generated_excerpt=NULL,
                        tags='[]', meta_description=NULL, seo_score=-1, published=0,
                        processing_status='pending', processing_started_at=NULL, processing_error=NULL,
                        agent_notes='Rimesso in coda: vecchio fallback editoriale da rigenerare'
                  WHERE COALESCE(edited_title, '')='' AND COALESCE(edited_body, '')='' AND COALESCE(edited_excerpt, '')=''
                    AND (
                        (published=0 AND seo_score=1 AND agent_notes LIKE 'Recuperato dopo errore AI:%')
                        OR
                        (seo_score=40 AND COALESCE(generated_body, '')<>'' AND (
                            TRIM(generated_body)=TRIM(COALESCE(raw_content, ''))
                            OR TRIM(generated_body)=TRIM(COALESCE(transcript, ''))
                        ))
                    )"
            );
        } catch (Throwable $e) {}
    }

    /**
     * Mantiene il motore editoriale compatibile con installazioni il cui
     * schema `sites` non e' ancora stato aggiornato. Le colonne opzionali
     * vengono create quando possibile e selezionate soltanto se esistono.
     */
    private static function siteEditorialContext(int $userId): array {
        $defaults = [
            'profile_summary' => null,
            'bio' => null,
            'role_mission' => null,
            'content_strategy' => null,
            'rag_knowledge' => null,
            'harmonize_agent' => 'content_editor',
            'account_type' => 'business',
            'brand_voice_profile' => null,
            'site_understanding' => null,
            'user_agent_prompt' => null,
        ];
        $definitions = [
            'harmonize_agent' => "VARCHAR(50) NOT NULL DEFAULT 'content_editor'",
            'account_type' => "VARCHAR(50) DEFAULT 'business'",
            'brand_voice_profile' => 'LONGTEXT NULL',
            'site_understanding' => 'LONGTEXT NULL',
            'user_agent_prompt' => 'LONGTEXT NULL',
        ];

        $existing = [];
        try {
            foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) {
                $existing[(string)$column['Field']] = true;
            }
        } catch (Throwable $e) {
            return $defaults;
        }

        foreach ($definitions as $column => $definition) {
            if (isset($existing[$column])) continue;
            try {
                DB::execute("ALTER TABLE sites ADD COLUMN `$column` $definition");
                $existing[$column] = true;
            } catch (Throwable $e) {
                // Un deploy con permessi DDL limitati deve poter elaborare i
                // post usando comunque tutti i campi gia' disponibili.
            }
        }

        $selectable = array_values(array_filter(
            array_keys($defaults),
            static fn(string $column): bool => isset($existing[$column])
        ));
        if (!$selectable) return $defaults;

        $selectList = implode(', ', array_map(
            static fn(string $column): string => "`$column`",
            $selectable
        ));
        $site = DB::fetch("SELECT $selectList FROM sites WHERE user_id=?", [$userId]);
        return array_merge($defaults, is_array($site) ? $site : []);
    }

    private static function cleanSiteIdentityCandidate(string $value): string {
        $value = trim(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $value = preg_replace('/\s+/', ' ', $value);
        return trim((string)$value);
    }

    private static function isUsableSiteIdentity(string $value): bool {
        $value = mb_strtolower(self::cleanSiteIdentityCandidate($value));
        if ($value === '' || mb_strlen($value) < 3) return false;

        $blocked = [
            'error',
            'errore',
            'facebook',
            'log into facebook',
            'log in to facebook',
            'accedi a facebook',
            'pagina non disponibile',
            'page not found',
            'not found',
            'access denied',
            'just a moment',
            'attention required',
            'login',
            'sign in',
            'sign up',
        ];

        foreach ($blocked as $needle) {
            if ($value === $needle || str_contains($value, $needle)) return false;
        }

        return true;
    }

    private static function titleizeWords(string $value): string {
        $value = preg_replace('/[_\-]+/', ' ', trim($value));
        $value = preg_replace('/(?<=\p{Ll})(?=\p{Lu})/u', ' ', $value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = mb_strtolower(trim((string)$value));
        if ($value === '') return '';

        $parts = preg_split('/\s+/', $value) ?: [];
        $out = [];
        foreach ($parts as $part) {
            $out[] = mb_strtoupper(mb_substr($part, 0, 1)) . mb_substr($part, 1);
        }
        return trim(implode(' ', $out));
    }

    private static function deriveSiteIdentityFromSource(array $source): string {
        $label = self::cleanSiteIdentityCandidate((string)($source['label'] ?? ''));
        if ($label !== '') {
            $label = preg_replace('/\b(facebook|instagram|youtube|tiktok|official|ufficiale)\b/i', ' ', $label);
            $label = self::titleizeWords($label);
            if (self::isUsableSiteIdentity($label)) return $label;
        }

        $url = trim((string)($source['url'] ?? ''));
        if ($url !== '') {
            $path = parse_url($url, PHP_URL_PATH) ?: '';
            $path = trim($path, '/');
            if ($path !== '') {
                $segments = array_values(array_filter(explode('/', $path)));
                $candidate = $segments[0] ?? '';
                if ($candidate !== '') {
                    $candidate = preg_replace('/\.(php|html?)$/i', '', $candidate);
                    $candidate = self::titleizeWords($candidate);
                    if (self::isUsableSiteIdentity($candidate)) return $candidate;
                }
            }
        }

        return '';
    }


    // ── Rileva la piattaforma dall'URL ─────────────────────────────────────
    public static function platform(string $url): string {
        return Refetcher::platform($url) ?: 'website';
    }

    // ── ID univoco del contenuto (per evitare duplicati) ───────────────────
    private static function postId(string $platform, string $url): string {
        if ($platform === 'youtube') {
            if (preg_match('~(?:v=|youtu\.be/|shorts/|/embed/)([A-Za-z0-9_-]{11})~', $url, $m)) {
                return $m[1];
            }
        }
        return substr(md5($url), 0, 24);
    }

    private static function contentHash(string $text): string {
        $normalized = mb_strtolower(strip_tags($text));
        $normalized = preg_replace('/https?:\/\/\S+/', ' ', $normalized);
        $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', trim($normalized));
        return hash('sha256', mb_substr($normalized, 0, 4000));
    }

    // ── Ingestione di un singolo link → bozza nel DB ───────────────────────
    public static function url(int $userId, string $url, array $prefetched = []): array {
        $url = trim($url);
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new Exception('Link non valido');
        }
        $platform = self::platform($url);
        if (!$platform) {
            throw new Exception('Piattaforma non riconosciuta');
        }
        if ($platform !== 'website' && !$prefetched) {
            $result = Refetcher::source($url, 1);
            $prefetched = $result['items'][0] ?? [];
            if (!$prefetched) throw new Exception('Refetch(er) non ha restituito contenuti pubblici per questo URL');
            $url = (string)($prefetched['url'] ?? $url);
        }
        $postId = trim((string)($prefetched['id'] ?? '')) ?: self::postId($platform, $url);

        // Già importato?
        $exists = DB::fetch(
            'SELECT id, published, seo_score, raw_content FROM posts WHERE user_id=? AND platform=? AND platform_post_id=?',
            [$userId, $platform, $postId]
        );
        if ($exists) {
            // È un post visibile o già elaborato: è un vero duplicato → skip
            if ((int)$exists['published'] === 1 || (int)$exists['seo_score'] > -1) {
                Logger::debug('ingest', 'Duplicato (elaborato)', ['platform' => $platform, 'postId' => $postId, 'db_id' => $exists['id']]);
                return ['id' => (int) $exists['id'], 'platform' => $platform, 'duplicate' => true];
            }
            // È una bozza fallita/vuota (published=0, seo_score=-1 e raw vuoto):
            // la eliminiamo così il re-import può procedere pulito
            if (empty(trim($exists['raw_content'] ?? ''))) {
                Logger::info('ingest', 'Bozza vuota eliminata per re-import', ['platform' => $platform, 'postId' => $postId, 'db_id' => $exists['id']]);
                DB::execute('DELETE FROM posts WHERE id=?', [(int)$exists['id']]);
            } else {
                Logger::debug('ingest', 'Duplicato (bozza con contenuto)', ['platform' => $platform, 'postId' => $postId, 'db_id' => $exists['id']]);
                // Ha contenuto ma non è stato pubblicato: lo trattiamo comunque come duplicato
                return [
                    'id' => (int) $exists['id'],
                    'platform' => $platform,
                    'duplicate' => true,
                    'retryable' => true,
                ];
            }
        }

        $transcript = '';
        $caption = trim((string)($prefetched['caption'] ?? ''));
        $mediaUrl = trim((string)($prefetched['media_url'] ?? ''));
        $mediaType = strtolower((string)($prefetched['media_type'] ?? 'text'));
        if ($caption === '' && $platform === 'website') {
            $page = WebsiteSource::page($url);
            $caption = trim($page['title'] . "\n\n" . $page['description'] . "\n\n" . $page['text']);
            if ($mediaUrl === '' && !empty($page['image_url'])) { $mediaUrl = $page['image_url']; $mediaType = 'image'; }
        }
        if (in_array($mediaType, ['image', 'video'], true) && str_starts_with($mediaUrl, 'http') && !($platform === 'youtube' && $mediaType === 'video')) {
            $saved = self::saveMedia($mediaUrl, $platform, $postId, $mediaType === 'video' ? 'mp4' : 'jpg');
            if ($saved) $mediaUrl = $saved['url'];
        }

        $raw = $transcript ?: $caption;
        if (!$raw && !$mediaUrl) {
            Logger::warn('ingest', 'Nessun testo o media estratto', ['platform' => $platform, 'url' => $url]);
            throw new Exception('Nessun testo estratto e nessun media trovato.');
        }
        $contentHash = self::contentHash($raw ?: $mediaUrl);
        $hashExists = DB::fetch('SELECT id, published, seo_score FROM posts WHERE user_id=? AND content_hash=?', [$userId, $contentHash]);
        if ($hashExists) {
            // Bozza fallita/vuota → elimina e reimporta
            if ((int)$hashExists['published'] === 0 && (int)$hashExists['seo_score'] === -1) {
                Logger::info('ingest', 'content_hash: bozza fallita eliminata per re-import', ['db_id' => $hashExists['id'], 'platform' => $platform]);
                DB::execute('DELETE FROM posts WHERE id=?', [(int)$hashExists['id']]);
            } else {
                Logger::debug('ingest', 'Duplicato per content_hash', ['platform' => $platform, 'db_id' => $hashExists['id']]);
                return ['id' => (int) $hashExists['id'], 'platform' => $platform, 'duplicate' => true, 'duplicate_reason' => 'contenuto equivalente'];
            }
        }

        $id = DB::insert('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               media_url, media_type, source_url, published_at, content_hash, seo_score, published)
            VALUES (?,?,?,?,?,?,?,?,?,?,-1,0)
        ', [
            $userId, $platform, $postId,
            $caption, $transcript,
            $mediaUrl, $mediaType, $url, $prefetched['published_at'] ?? date('Y-m-d H:i:s'), $contentHash,
        ]);

        return [
            'id'         => $id,
            'platform'   => $platform,
            'duplicate'  => false,
            'transcript' => $transcript,
            'preview'    => mb_substr($transcript ?: $caption, 0, 280),
        ];
    }

    // ── Scarica e conserva un media nel sito (public/media) ────────────────
    // Ritorna ['url'=>pubblico, 'path'=>locale, 'size'=>byte] oppure null.
    public static function saveMedia(string $src, string $platform, string $postId, string $ext): ?array {
        if (!in_array(strtolower((string)parse_url($src, PHP_URL_SCHEME)), ['http', 'https'], true)) return null;
        $dir = __DIR__ . '/../../public/media';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (!is_dir($dir) || !is_writable($dir)) return null;

        require_once __DIR__ . '/website_source.php';
        try {
            $download = WebsiteSource::download($src);
        } catch (Throwable $e) {
            return null;
        }
        $bytes = (string)($download['body'] ?? '');
        if ($bytes === '') return null;

        $safePlatform = preg_replace('/[^A-Za-z0-9_-]/', '', $platform) ?: 'media';
        $safePostId = preg_replace('/[^A-Za-z0-9_-]/', '', $postId) ?: bin2hex(random_bytes(8));
        $name = $safePlatform . '_' . $safePostId . '.' . $ext;
        $path = "$dir/$name";

        $detectedExt = '';
        if (class_exists('finfo')) {
            $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';
            $detectedExt = match ($mime) {
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                'image/gif' => 'gif',
                'video/mp4' => 'mp4',
                'video/quicktime' => 'mov',
                default => '',
            };
        }
        if ($detectedExt === '') return null;
        $name = $safePlatform . '_' . $safePostId . '.' . $detectedExt;
        $path = "$dir/$name";
        $written = @file_put_contents($path, $bytes, LOCK_EX);
        if ($written === false || $written < 1) return null;
        $size = (int)$written;

        $base = function_exists('app_base_url') ? app_base_url() : '';
        return ['url' => "$base/public/media/$name", 'path' => $path, 'size' => $size];
    }

    // ── AGENTE 2 (Armonizzatore): bozza → articolo SEO pubblicato ──────────
    public static function harmonize(int $userId, int $postId, int $autoPublish = 1, string $length = 'compact'): array {
        self::ensureProcessingSchema();
        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post) throw new Exception('Contenuto non trovato');

        $sources = DB::fetchAll(
            'SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id',
            [$userId]
        );

        // Anche la rigenerazione manuale deve passare dall'analisi media.
        // In precedenza solo process-pending trascriveva video e immagini:
        // richiamando direttamente harmonize si riscriveva quindi la sola
        // didascalia, spesso breve o priva delle informazioni dell'evento.
        if (trim((string)($post['transcript'] ?? '')) === '' && !empty($post['media_url'])) {
            try {
                $mediaContext = AI::analyzePostMedia(
                    (string)($post['platform'] ?? ''),
                    (string)$post['media_url'],
                    (string)($post['media_type'] ?? ''),
                    (string)($post['source_url'] ?? '')
                );
                if ($mediaContext !== '') {
                    DB::execute('UPDATE posts SET transcript=? WHERE id=? AND user_id=?', [$mediaContext, $postId, $userId]);
                    $post['transcript'] = $mediaContext;
                }
            } catch (Throwable $mediaError) {
                if (trim((string)($post['raw_content'] ?? '')) === '') throw $mediaError;
                Logger::warn('media', 'Rigenerazione senza contesto media', [
                    'post_id' => $postId,
                    'platform' => $post['platform'] ?? '',
                    'error' => $mediaError->getMessage(),
                ]);
            }
        }

        $transcriptText = trim((string)($post['transcript'] ?? ''));
        $captionText = trim((string)($post['raw_content'] ?? ''));
        $raw = $transcriptText !== '' ? $transcriptText : $captionText;
        if (!$raw) throw new Exception('Nessun testo da armonizzare');

        $site = self::siteEditorialContext($userId);
        $profileSummary = trim($site['profile_summary'] ?? ($site['bio'] ?? ''));
        $sourceContext = '';
        if (!empty($site['brand_voice_profile'])) {
            $sourceContext .= "Profilo Brand Voice (Tono di voce e Topic Clusters):\n" . $site['brand_voice_profile'] . "\n\n";
        }
        if ($profileSummary !== '') {
            $sourceContext .= "Profilo utente/brand:\n" . $profileSummary . "\n\n";
        }
        if (!empty($site['role_mission'])) {
            $sourceContext .= "Ruolo e missione dichiarati:\n" . trim((string)$site['role_mission']) . "\n\n";
        }
        if (!empty($site['content_strategy'])) {
            $sourceContext .= "Strategia editoriale dichiarata:\n" . trim((string)$site['content_strategy']) . "\n\n";
        }
        if (!empty($site['site_understanding'])) {
            $understanding = json_decode($site['site_understanding'], true);
            if (is_array($understanding)) {
                $sourceContext .= "Comprensione dell'attivita confermata dall'utente (fonte prioritaria):\n"
                    . json_encode($understanding, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";
            }
        }
        if (!empty($site['rag_knowledge'])) {
            $sourceContext .= "Memoria Storica e Stile (RAG):\n" . $site['rag_knowledge'] . "\n\n";
        }
        foreach ($sources as $source) {
            $sourceContext .= '- ' . $source['platform'] . ': ' . ($source['label'] ?: $source['url']);
            if (!empty($source['topic_summary'])) $sourceContext .= ' — ' . $source['topic_summary'];
            $sourceContext .= "\n";
        }
        if (!empty($site['user_agent_prompt'])) {
            $sourceContext .= "\nISTRUZIONI PERSONALIZZATE DELL'UTENTE (Tono di voce e Stile):\n" . trim($site['user_agent_prompt']) . "\n\n";
        }

        $agentName = !empty($site['harmonize_agent']) ? $site['harmonize_agent'] : 'content_editor';
        $accountType = !empty($site['account_type']) ? $site['account_type'] : 'business';

        // Ciclo di ritorno: le ricerche reali da Search Console entrano nel
        // prompt. Se il sito è nuovo o Search Console non è collegata il
        // briefing è vuoto e il comportamento resta identico a prima.
        $searchDemand = VisibilityAnalytics::demandBriefing($userId, $post['slug'] ?? null);

        // IL REVISORE EDITORIALE INTERNO: decide se il post è idoneo
        $recentPosts = DB::fetchAll('SELECT generated_title, generated_excerpt, raw_content FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 10', [$userId]);
        $decisionInput = trim(implode("\n\n", array_values(array_unique(array_filter([$captionText, $transcriptText])))));
        $decision = AI::contentDecision($decisionInput, $post['platform'], $post['source_url'] ?? '', $sourceContext, $recentPosts);
        if (empty($decision['publish'])) {
            $autoPublish = 0;
            $agentNotes = 'Respinto dal revisore editoriale: ' . ($decision['reason'] ?? 'Non idoneo');
        } else {
            $agentNotes = 'Approvato dal revisore editoriale: ' . ($decision['reason'] ?? 'Idoneo');
        }

        $seo = AI::harmonize($raw, $post['platform'], $transcriptText !== '' ? $captionText : '', $sourceContext, $agentName, $accountType, $searchDemand, $length, $userId);

        DB::execute('
            UPDATE posts SET
              generated_title=?, generated_body=?, generated_excerpt=?,
              tags=?, meta_description=?, seo_score=?, slug=?, published=?, agent_notes=?,
              processing_status=\'done\', processing_started_at=NULL, processing_error=NULL
            WHERE id=? AND user_id=?
        ', [
            $seo['title'] ?? '', $seo['body'] ?? '', $seo['excerpt'] ?? '',
            json_encode($seo['tags'] ?? []), $seo['meta_description'] ?? '',
            $seo['seo_score'] ?? 0, slugify($seo['title'] ?? (string) $postId),
            $autoPublish, $agentNotes, $postId, $userId,
        ]);

        return ['id' => $postId, 'seo' => $seo, 'decision' => $decision];
    }

    public static function markProcessingFailed(int $userId, int $postId, string $error = ''): array {
        self::ensureProcessingSchema();
        $post = DB::fetch('SELECT id FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post) throw new Exception('Contenuto non trovato durante il recupero');

        $message = mb_substr(trim($error) ?: 'Il motore editoriale non ha prodotto un articolo valido', 0, 2000);
        DB::execute(
            'UPDATE posts SET generated_title=NULL, generated_body=NULL, generated_excerpt=NULL, tags=?, meta_description=NULL, seo_score=-1, published=0, agent_notes=?, processing_status=\'failed\', processing_started_at=NULL, processing_error=? WHERE id=? AND user_id=?',
            ['[]', 'Armonizzazione da riprovare: ' . $message, $message, $postId, $userId]
        );

        return ['id' => $postId, 'retryable' => true, 'error' => $message];
    }

    // ── AGENTE 2b (Riottimizzatore): articolo pubblicato → titolo che risponde
    //    alla ricerca reale. Tocca solo titolo, meta ed estratto: il corpo
    //    dell'articolo e lo slug restano invariati, così non si perdono i
    //    segnali già accumulati su quell'URL.
    public static function reoptimize(int $userId, int $postId, bool $apply = true): array {
        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post) throw new Exception('Contenuto non trovato');
        if ((int)($post['published'] ?? 0) !== 1) throw new Exception('Riottimizza solo gli articoli già pubblicati');

        $slug = trim((string)($post['slug'] ?? ''));
        if ($slug === '') throw new Exception('Articolo senza slug: impossibile associarlo alle ricerche di Google');

        $queries = VisibilityAnalytics::postQueries($userId, $slug);
        if (!$queries) {
            return [
                'ok' => false,
                'id' => $postId,
                'message' => 'Google non ha ancora dati di ricerca per questo articolo. Riprova fra qualche settimana.',
            ];
        }

        $site = DB::fetch('SELECT profile_summary, bio FROM sites WHERE user_id=?', [$userId]);
        $profileSummary = trim((string)($site['profile_summary'] ?? ($site['bio'] ?? '')));

        $result = AI::reoptimizeMeta($post, $queries, $profileSummary);
        if (empty($result['ok'])) {
            return ['ok' => false, 'id' => $postId, 'message' => $result['message'] ?? 'Riottimizzazione non riuscita'];
        }

        // Anteprima: l'utente vede la proposta e decide. Serve perché il titolo
        // è la cosa più personale del contenuto e un'AI non deve cambiarlo di
        // nascosto a un articolo che sta già andando bene.
        if ($apply) {
            DB::execute(
                'UPDATE posts SET generated_title=?, meta_description=?, generated_excerpt=? WHERE id=? AND user_id=?',
                [
                    mb_substr((string)$result['title'], 0, 255),
                    mb_substr((string)($result['meta_description'] ?? ''), 0, 255),
                    (string)($result['excerpt'] ?? ''),
                    $postId,
                    $userId,
                ]
            );
            if (class_exists('Logger')) {
                Logger::info('seo', 'Articolo riottimizzato sulla ricerca reale', [
                    'user_id' => $userId,
                    'post_id' => $postId,
                    'target_query' => $result['target_query'] ?? '',
                ]);
            }
        }

        return ['ok' => true, 'id' => $postId, 'applied' => $apply, 'proposal' => $result, 'queries' => $queries];
    }

    public static function scanSources(int $userId, int $limitPerSource = 5, string $profileOverride = '', string $roleMission = '', string $contentStrategy = '', ?int $sourceId = null, ?string $fallbackSinceDate = null): array {
        $sql = 'SELECT * FROM social_sources WHERE user_id=? AND active=1';
        $params = [$userId];
        if ($sourceId) {
            $sql .= ' AND id=?';
            $params[] = $sourceId;
        }
        $sql .= ' ORDER BY platform, id';
        
        $sources = DB::fetchAll($sql, $params);
        if (!$sources && !$sourceId) throw new Exception('Inserisci almeno una fonte prima della scansione');

        $profileOverride = trim($profileOverride);
        $roleMission = trim($roleMission);
        $contentStrategy = trim($contentStrategy);
        if ($profileOverride !== '' || $roleMission !== '' || $contentStrategy !== '') {
            DB::execute(
                'UPDATE sites SET profile_summary=COALESCE(?,profile_summary), bio=COALESCE(NULLIF(bio, ""), ?), role_mission=COALESCE(?,role_mission), content_strategy=COALESCE(?,content_strategy) WHERE user_id=?',
                [$profileOverride !== '' ? $profileOverride : null, $profileOverride !== '' ? $profileOverride : null, $roleMission !== '' ? $roleMission : null, $contentStrategy !== '' ? $contentStrategy : null, $userId]
            );
        }

        Logger::info('scan', 'Inizio scanSources', [
            'user_id'          => $userId,
            'sources'          => count($sources),
            'limitPerSource'   => $limitPerSource,
        ]);

        $report = ['sources' => count($sources), 'found' => 0, 'imported' => 0, 'imported_ids' => [], 'retryable_ids' => [], 'duplicates' => 0, 'errors' => []];
        $seenUrls = [];
        foreach ($sources as $source) {
            try {
                $siteVisuals = DB::fetch('SELECT logo_url, cover_url FROM sites WHERE user_id=?', [$userId]);
                $needsLogo = empty($siteVisuals['logo_url']);
                $needsCover = empty($siteVisuals['cover_url']);
                if (($needsLogo || $needsCover) && $source['platform'] === 'website') {
                    try {
                        $visuals = WebsiteSource::profileVisuals($source['url']);
                        $logoUrl = trim($visuals['logo_url'] ?? '');
                        $coverUrl = trim($visuals['cover_url'] ?? '');
                        $pageTitle = self::cleanSiteIdentityCandidate((string)($visuals['page_title'] ?? ''));
                        if (!self::isUsableSiteIdentity($pageTitle)) {
                            $pageTitle = self::deriveSiteIdentityFromSource($source);
                        }
                        $profileDetails = array_filter([
                            $pageTitle,
                            trim((string)($visuals['category'] ?? '')),
                            trim((string)($visuals['description'] ?? '')),
                            trim((string)($visuals['address'] ?? '')),
                            trim((string)($visuals['phone'] ?? '')),
                            trim((string)($visuals['email'] ?? '')),
                        ]);

                        if (!empty($profileDetails)) {
                            $currentTopic = trim((string)($source['topic_summary'] ?? ''));
                            $enrichedTopic = implode(' | ', array_unique(array_filter([$currentTopic, ...$profileDetails])));
                            DB::execute('UPDATE social_sources SET topic_summary=? WHERE id=? AND user_id=?', [$enrichedTopic, $source['id'], $userId]);
                            $source['topic_summary'] = $enrichedTopic;

                            $siteRecord = DB::fetch('SELECT title, profile_summary, bio FROM sites WHERE user_id=?', [$userId]);
                            $summaryCandidate = trim((string)($visuals['description'] ?? ''));
                            $currentSiteTitle = trim((string)($siteRecord['title'] ?? ''));
                            if ($pageTitle !== '' && in_array($currentSiteTitle, ['', 'Sito Personale', 'Il mio sito'], true)) DB::execute('UPDATE sites SET title=? WHERE user_id=?', [$pageTitle, $userId]);
                            if ($summaryCandidate !== '' && empty($siteRecord['profile_summary']) && empty($siteRecord['bio'])) DB::execute('UPDATE sites SET profile_summary=?, bio=COALESCE(NULLIF(bio, \'\'), ?) WHERE user_id=?', [$summaryCandidate, $summaryCandidate, $userId]);
                        }

                        if ($needsLogo && $logoUrl !== '') {
                            $savedLogo = self::saveMedia($logoUrl, $source['platform'], 'profile_logo_' . $source['id'], 'jpg');
                            if ($savedLogo && !empty($savedLogo['url'])) {
                                DB::execute('UPDATE sites SET logo_url=? WHERE user_id=?', [$savedLogo['url'], $userId]);
                            }
                        }

                        if ($needsCover && $coverUrl !== '') {
                            $savedCover = self::saveMedia($coverUrl, $source['platform'], 'profile_cover_' . $source['id'], 'jpg');
                            if ($savedCover && !empty($savedCover['url'])) {
                                DB::execute('UPDATE sites SET cover_url=COALESCE(NULLIF(cover_url, \'\'), ?) WHERE user_id=?', [$savedCover['url'], $userId]);
                            }
                        }
                    } catch (Throwable $e) {
                        Logger::warn('scan', 'Impossibile estrarre visual profilo', ['platform' => $source['platform'], 'url' => $source['url'], 'error' => $e->getMessage()]);
                    }
                }

                // Rispettiamo la since_date se è stata configurata dall'utente.
                $sourceSinceDate = !empty($source['since_date']) ? $source['since_date'] : null;
                $effectiveSinceDate = $sourceSinceDate ?: $fallbackSinceDate;
                
                $autoPublish = (int)($source['auto_publish'] ?? 1);
                $limit = !empty($source['max_posts']) ? (int)$source['max_posts'] : ($effectiveSinceDate ? 100 : $limitPerSource);
                
                Logger::info('scan', 'Scansione sorgente', [
                    'platform'          => $source['platform'],
                    'url'               => $source['url'],
                    'limit'             => $limit,
                    'effectiveSinceDate'=> $effectiveSinceDate,
                    'sinceDate_stored'  => $sourceSinceDate,
                ]);
                
                if (function_exists('setSyncStatus')) setSyncStatus($userId, "Ricerca post su " . ucfirst($source['platform']) . "...");
                
                if ($source['platform'] === 'website') {
                    $items = WebsiteSource::items($source['url'], $limit, $effectiveSinceDate);
                } else {
                    $refetched = Refetcher::source($source['url'], $limit, $effectiveSinceDate);
                    $items = $refetched['items'];
                    $profile = $refetched['profile'];
                    if ($profile) {
                        $profileDetails = array_values(array_filter([
                            trim((string)($profile['name'] ?? '')),
                            trim((string)($profile['biography'] ?? $profile['description'] ?? '')),
                            trim((string)($profile['categoryName'] ?? '')),
                        ]));
                        if ($profileDetails) {
                            $topic = implode(' | ', array_unique(array_filter([trim((string)($source['topic_summary'] ?? '')), ...$profileDetails])));
                            DB::execute('UPDATE social_sources SET topic_summary=? WHERE id=? AND user_id=?', [$topic, $source['id'], $userId]);
                        }
                        $profileImage = trim((string)($profile['profilePicUrlHd'] ?? $profile['profilePicUrl'] ?? $profile['thumbnailUrl'] ?? ''));
                        if ($needsLogo && $profileImage !== '') {
                            $saved = self::saveMedia($profileImage, $source['platform'], 'profile_logo_' . $source['id'], 'jpg');
                            if ($saved) DB::execute("UPDATE sites SET logo_url=COALESCE(NULLIF(logo_url, ''), ?) WHERE user_id=?", [$saved['url'], $userId]);
                        }
                    }
                }
                $report['found'] += count($items);
                
                Logger::info('scan', 'Items trovati da sorgente', [
                    'platform' => $source['platform'],
                    'count'    => count($items),
                ]);
                
                if (function_exists('setSyncStatus')) setSyncStatus($userId, "Trovati " . count($items) . " post su " . ucfirst($source['platform']) . ", inizio acquisizione...");
                
                foreach ($items as $item) {
                    $sourceUrl = $item['url'] ?? '';
                    if (!$sourceUrl) continue;
                    // Le query possono identificare il contenuto (per esempio
                    // `watch?v=` su YouTube): non vanno eliminate durante la
                    // deduplica della singola scansione.
                    $normalizedUrl = rtrim($sourceUrl, '/');
                    if (isset($seenUrls[$normalizedUrl])) {
                        $report['duplicates']++;
                        continue;
                    }
                    $seenUrls[$normalizedUrl] = true;
                    try {
                        $ingested = self::url($userId, $sourceUrl, $item);
                        if (!empty($ingested['duplicate'])) {
                            $report['duplicates']++;
                            if (!empty($ingested['retryable']) && !empty($ingested['id'])) {
                                $report['retryable_ids'][] = (int)$ingested['id'];
                            }
                            continue;
                        }
                        $report['imported']++;
                        if (!empty($ingested['id'])) $report['imported_ids'][] = (int)$ingested['id'];
                        Logger::info('scan', 'Post importato', ['platform' => $source['platform'], 'url' => $sourceUrl, 'db_id' => $ingested['id'] ?? null]);
                        // L'ingestione si ferma qui (bozza creata). L'elaborazione AI avviene in process-pending.
                    } catch (Throwable $e) {
                        $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
                        Logger::error('scan', 'Errore ingestione singolo post', ['platform' => $source['platform'], 'url' => $sourceUrl, 'error' => $e->getMessage()]);
                    }
                }
            } catch (Throwable $e) {
                $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
                Logger::error('scan', 'Errore sorgente', ['platform' => $source['platform'], 'url' => $source['url'], 'error' => $e->getMessage()]);
            }
        }
        
        $report['retryable_ids'] = array_values(array_unique($report['retryable_ids']));
        Logger::info('scan', 'scanSources completato', $report);

        // L'orchestrazione globale (Caporedattore, SEO, Graphic Designer) 
        // è stata spostata all'endpoint finalize-sync per essere eseguita a fine batch.

        DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);

        return $report;
    }
}
