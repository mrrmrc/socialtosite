<?php

class VisibilityAnalytics {
    private static bool $schemaReady = false;

    public static function ensureSchema(): void {
        if (self::$schemaReady) return;
        self::$schemaReady = true;

        DB::execute("CREATE TABLE IF NOT EXISTS seo_analytics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            record_date DATE NOT NULL,
            impressions INT DEFAULT 0,
            clicks INT DEFAULT 0,
            ctr FLOAT DEFAULT 0,
            position FLOAT DEFAULT 0,
            UNIQUE KEY unique_user_seo_date (user_id, record_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::execute("CREATE TABLE IF NOT EXISTS site_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            post_id INT NULL,
            event_type VARCHAR(40) NOT NULL,
            path VARCHAR(1024) NOT NULL,
            target_url VARCHAR(2048) NULL,
            referrer_host VARCHAR(255) NULL,
            visitor_hash CHAR(64) NULL,
            occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_site_events_user_date (user_id, occurred_at),
            INDEX idx_site_events_user_type_date (user_id, event_type, occurred_at),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::execute("CREATE TABLE IF NOT EXISTS seo_search_details (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            record_date DATE NOT NULL,
            page_url VARCHAR(1024) NOT NULL,
            query_text VARCHAR(255) NOT NULL DEFAULT '',
            impressions INT NOT NULL DEFAULT 0,
            clicks INT NOT NULL DEFAULT 0,
            ctr FLOAT NOT NULL DEFAULT 0,
            position FLOAT NOT NULL DEFAULT 0,
            INDEX idx_seo_details_user_date (user_id, record_date),
            INDEX idx_seo_details_user_page (user_id, page_url(191)),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::execute("CREATE TABLE IF NOT EXISTS analytics_schema_migrations (
            migration_key VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $scopeMigration = DB::fetch("SELECT migration_key FROM analytics_schema_migrations WHERE migration_key='gsc_path_scope_v1'");
        if (!$scopeMigration) {
            // I dati storici precedenti erano totali di dominio replicati su ogni utente.
            // Ripartiamo da zero per non mostrare numeri attribuiti al profilo sbagliato.
            DB::execute('DELETE FROM seo_search_details');
            DB::execute('DELETE FROM seo_analytics');
            DB::execute("INSERT INTO analytics_schema_migrations (migration_key) VALUES ('gsc_path_scope_v1')");
        }
    }

    public static function recordEvent(array $payload): bool {
        $slug = strtolower(trim((string)($payload['slug'] ?? '')));
        if ($slug === '' || !preg_match('/^[a-z0-9-]{1,100}$/', $slug)) return false;

        $allowedTypes = [
            'page_view', 'call_click', 'directions_click', 'whatsapp_click',
            'booking_click', 'social_click', 'contact_click', 'external_click',
            'path_select', 'path_content_click',
        ];
        $eventType = trim((string)($payload['event_type'] ?? ''));
        if (!in_array($eventType, $allowedTypes, true)) return false;
        $userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
        if ($userAgent !== '' && preg_match('/bot|crawler|spider|slurp|lighthouse|headless/i', $userAgent)) return true;

        $user = DB::fetch('SELECT id FROM users WHERE slug=?', [$slug]);
        if (!$user) return false;

        $path = mb_substr(trim((string)($payload['path'] ?? '')), 0, 1024);
        if ($path === '' || !str_starts_with($path, '/')) $path = '/' . $slug;

        $targetUrl = mb_substr(trim((string)($payload['target_url'] ?? '')), 0, 2048);
        if ($targetUrl !== '' && !preg_match('/^(https?:|tel:|mailto:)/i', $targetUrl)) $targetUrl = '';

        $postId = (int)($payload['post_id'] ?? 0);
        if ($postId > 0) {
            $post = DB::fetch('SELECT id FROM posts WHERE id=? AND user_id=?', [$postId, $user['id']]);
            if (!$post) $postId = 0;
        }

        $referrer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
        $referrerHost = $referrer !== '' ? (string)(parse_url($referrer, PHP_URL_HOST) ?? '') : '';
        // Sale dedicato: se coincidesse con JWT_SECRET, ruotare il segreto di
        // autenticazione spezzerebbe la continuità storica delle statistiche.
        $secret = defined('ANALYTICS_SALT') && ANALYTICS_SALT !== ''
            ? ANALYTICS_SALT
            : (defined('JWT_SECRET') ? JWT_SECRET : (defined('DB_NAME') ? DB_NAME : 'linkseoweb'));
        $visitorHash = hash('sha256',
            (string)($_SERVER['REMOTE_ADDR'] ?? '') . '|' .
            $userAgent . '|' .
            date('Y-m-d') . '|' . $secret
        );

        $params = [(int)$user['id'], $postId ?: null, $eventType, $path, $targetUrl ?: null, $referrerHost ?: null, $visitorHash];
        try {
            DB::execute(
                'INSERT INTO site_events (user_id, post_id, event_type, path, target_url, referrer_host, visitor_hash) VALUES (?,?,?,?,?,?,?)',
                $params
            );
        } catch (Throwable $e) {
            // Primo evento dopo il deploy: crea lo schema e riprova una sola volta.
            self::ensureSchema();
            DB::execute(
                'INSERT INTO site_events (user_id, post_id, event_type, path, target_url, referrer_host, visitor_hash) VALUES (?,?,?,?,?,?,?)',
                $params
            );
        }
        return true;
    }

    public static function userSummary(int $userId): array {
        self::ensureSchema();

        $publishedPosts = (int)(DB::fetch('SELECT COUNT(*) c FROM posts WHERE user_id=? AND published=1 AND seo_score>=0', [$userId])['c'] ?? 0);
        $publishedPages = $publishedPosts + 1;
        $seo = DB::fetch(
            "SELECT COALESCE(SUM(impressions),0) impressions,
                    COALESCE(SUM(clicks),0) clicks,
                    MAX(record_date) latest_date,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position * impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_analytics
             WHERE user_id=? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)",
            [$userId]
        ) ?: [];
        $visiblePages = (int)(DB::fetch(
            "SELECT COUNT(DISTINCT page_url) c FROM seo_search_details
             WHERE user_id=? AND impressions>0 AND record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)",
            [$userId]
        )['c'] ?? 0);
        $events = DB::fetchAll(
            "SELECT event_type, COUNT(*) total
             FROM site_events
             WHERE user_id=? AND occurred_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
             GROUP BY event_type",
            [$userId]
        );
        $eventMap = [];
        foreach ($events as $row) $eventMap[$row['event_type']] = (int)$row['total'];
        $uniqueVisitors = (int)(DB::fetch(
            "SELECT COUNT(DISTINCT visitor_hash) c FROM site_events
             WHERE user_id=? AND event_type='page_view' AND occurred_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
            [$userId]
        )['c'] ?? 0);

        $impressions = (int)($seo['impressions'] ?? 0);
        $clicks = (int)($seo['clicks'] ?? 0);
        $actionTypes = ['call_click', 'directions_click', 'whatsapp_click', 'booking_click', 'contact_click'];
        $actions = 0;
        foreach ($actionTypes as $type) $actions += (int)($eventMap[$type] ?? 0);

        $trackingRow = DB::fetch('SELECT MIN(occurred_at) started_at FROM site_events WHERE user_id=?', [$userId]);

        return [
            'period_days' => 30,
            'published_pages' => $publishedPages,
            'published_posts' => $publishedPosts,
            'google_visible_pages' => $visiblePages,
            'impressions' => $impressions,
            'clicks' => $clicks,
            'ctr' => $impressions > 0 ? ($clicks / $impressions) * 100 : 0,
            'position' => (float)($seo['position'] ?? 0),
            'latest_search_date' => $seo['latest_date'] ?? null,
            'unique_visitors' => $uniqueVisitors,
            'actions' => $actions,
            'event_counts' => $eventMap,
            'tracking_started' => $trackingRow['started_at'] ?? null,
        ];
    }

    public static function topPages(int $userId, int $limit = 8): array {
        self::ensureSchema();
        $limit = max(1, min(25, $limit));
        return DB::fetchAll(
            "SELECT page_url, SUM(impressions) impressions, SUM(clicks) clicks,
                    CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END ctr,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position*impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_search_details
             WHERE user_id=? AND record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
             GROUP BY page_url
             ORDER BY impressions DESC, clicks DESC
             LIMIT $limit",
            [$userId]
        );
    }

    public static function topQueries(int $userId, int $limit = 8): array {
        self::ensureSchema();
        $limit = max(1, min(25, $limit));
        return DB::fetchAll(
            "SELECT query_text, SUM(impressions) impressions, SUM(clicks) clicks,
                    CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions)*100 ELSE 0 END ctr,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position*impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_search_details
             WHERE user_id=? AND query_text<>'' AND record_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
             GROUP BY query_text
             ORDER BY impressions DESC, clicks DESC
             LIMIT $limit",
            [$userId]
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CICLO DI RITORNO SEO
    //  Search Console non serve solo a mostrare numeri in dashboard: le query
    //  reali tornano dentro ai prompt, così l'AI scrive a partire da quello che
    //  le persone cercano davvero e non solo da quello che l'utente ha postato.
    // ══════════════════════════════════════════════════════════════════════

    /** Finestra di analisi predefinita: 90 giorni danno abbastanza segnale
     *  sulla coda lunga senza pescare query ormai superate. */
    private const DEMAND_WINDOW_DAYS = 90;

    /** Sotto questa soglia di impression una query è rumore statistico. */
    private const MIN_IMPRESSIONS = 3;

    /** Fascia "a un passo dalla prima pagina": il sito compare ma non viene
     *  cliccato. È dove un titolo migliore rende di più e più in fretta. */
    private const STRIKING_MIN_POSITION = 4.0;
    private const STRIKING_MAX_POSITION = 20.0;

    /**
     * Query aggregate per l'intero sito, divise per tipo di occasione.
     * Restituisce sempre le tre chiavi, anche vuote.
     */
    public static function searchDemand(int $userId, int $days = self::DEMAND_WINDOW_DAYS): array {
        self::ensureSchema();
        $days = max(7, min(365, $days));

        $rows = DB::fetchAll(
            "SELECT query_text,
                    SUM(impressions) impressions,
                    SUM(clicks) clicks,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position*impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_search_details
             WHERE user_id=? AND query_text<>'' AND record_date >= DATE_SUB(CURDATE(), INTERVAL $days DAY)
             GROUP BY query_text
             HAVING impressions >= " . self::MIN_IMPRESSIONS . "
             ORDER BY impressions DESC
             LIMIT 60",
            [$userId]
        );

        $top = [];
        $striking = [];
        $unclicked = [];

        foreach ($rows as $row) {
            $entry = [
                'query'       => (string)$row['query_text'],
                'impressions' => (int)$row['impressions'],
                'clicks'      => (int)$row['clicks'],
                'position'    => round((float)$row['position'], 1),
            ];
            // La soglia è già nella HAVING, ma la regola appartiene a questo
            // metodo: ribadirla qui evita che una modifica alla query faccia
            // entrare rumore nei prompt senza che nessuno se ne accorga.
            if ($entry['impressions'] < self::MIN_IMPRESSIONS) continue;
            if (count($top) < 15) $top[] = $entry;

            $inStrikingRange = $entry['position'] >= self::STRIKING_MIN_POSITION
                            && $entry['position'] <= self::STRIKING_MAX_POSITION;

            if ($inStrikingRange && count($striking) < 10) {
                $striking[] = $entry;
            } elseif ($entry['clicks'] === 0 && $entry['position'] > self::STRIKING_MAX_POSITION && count($unclicked) < 10) {
                $unclicked[] = $entry;
            }
        }

        return ['top' => $top, 'striking' => $striking, 'unclicked' => $unclicked];
    }

    /**
     * Query con cui le persone arrivano su UNA pagina specifica.
     * Il match è sull'ultimo segmento di path: GSC salva l'URL completo,
     * noi conosciamo solo lo slug del post.
     */
    public static function postQueries(int $userId, string $postSlug, int $days = self::DEMAND_WINDOW_DAYS): array {
        self::ensureSchema();
        $postSlug = trim($postSlug, '/ ');
        if ($postSlug === '') return [];
        $days = max(7, min(365, $days));

        return DB::fetchAll(
            "SELECT query_text,
                    SUM(impressions) impressions,
                    SUM(clicks) clicks,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position*impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_search_details
             WHERE user_id=?
               AND query_text<>''
               AND record_date >= DATE_SUB(CURDATE(), INTERVAL $days DAY)
               AND (page_url LIKE ? OR page_url LIKE ? OR page_url LIKE ?)
             GROUP BY query_text
             ORDER BY impressions DESC
             LIMIT 20",
            [$userId, '%/' . $postSlug, '%/' . $postSlug . '/', '%/' . $postSlug . '?%']
        );
    }

    /**
     * Articoli già pubblicati che compaiono su Google in posizione 4-20:
     * sono quelli dove riscrivere titolo e meta description rende di più.
     * Ordinati per impression perse, cioè per occasione mancata.
     */
    public static function opportunities(int $userId, int $limit = 10, int $days = self::DEMAND_WINDOW_DAYS): array {
        self::ensureSchema();
        $limit = max(1, min(50, $limit));
        $days = max(7, min(365, $days));

        $pages = DB::fetchAll(
            "SELECT page_url,
                    SUM(impressions) impressions,
                    SUM(clicks) clicks,
                    CASE WHEN SUM(impressions)>0 THEN SUM(position*impressions)/SUM(impressions) ELSE 0 END position
             FROM seo_search_details
             WHERE user_id=? AND record_date >= DATE_SUB(CURDATE(), INTERVAL $days DAY)
             GROUP BY page_url
             HAVING impressions >= " . self::MIN_IMPRESSIONS . "
                AND position >= " . self::STRIKING_MIN_POSITION . "
                AND position <= " . self::STRIKING_MAX_POSITION . "
             ORDER BY impressions DESC
             LIMIT $limit",
            [$userId]
        );
        if (!$pages) return [];

        // Risolvi ogni URL nel post corrispondente, così la dashboard può
        // offrire l'azione di riottimizzazione direttamente sull'articolo.
        $out = [];
        foreach ($pages as $page) {
            $path = (string)parse_url((string)$page['page_url'], PHP_URL_PATH);
            $slug = trim((string)$path, '/');
            if ($slug !== '' && str_contains($slug, '/')) {
                $parts = explode('/', $slug);
                $slug = (string)end($parts);
            }

            $post = $slug !== ''
                ? DB::fetch('SELECT id, slug, generated_title, edited_title, meta_description FROM posts WHERE user_id=? AND slug=? LIMIT 1', [$userId, $slug])
                : null;

            $out[] = [
                'page_url'    => (string)$page['page_url'],
                'impressions' => (int)$page['impressions'],
                'clicks'      => (int)$page['clicks'],
                'position'    => round((float)$page['position'], 1),
                'post_id'     => $post ? (int)$post['id'] : null,
                'title'       => $post ? ($post['edited_title'] ?: $post['generated_title']) : null,
                'queries'     => $slug !== '' ? array_slice(self::postQueries($userId, $slug, $days), 0, 5) : [],
            ];
        }
        return $out;
    }

    /**
     * Traduce i dati di Search Console in un blocco di testo da inserire nei
     * prompt. Restituisce stringa vuota se non c'è ancora segnale: un sito
     * appena nato deve comportarsi esattamente come prima di questa funzione.
     */
    public static function demandBriefing(int $userId, ?string $postSlug = null, int $days = self::DEMAND_WINDOW_DAYS): string {
        try {
            $demand = self::searchDemand($userId, $days);
            $pageRows = $postSlug !== null ? self::postQueries($userId, $postSlug, $days) : [];
        } catch (Throwable $e) {
            // Il ciclo di ritorno è un miglioramento, non una dipendenza:
            // se Search Console non è configurata si prosegue senza.
            if (class_exists('Logger')) Logger::warn('seo', 'Briefing domanda non disponibile', ['user_id' => $userId, 'error' => $e->getMessage()]);
            return '';
        }

        if (!$demand['top'] && !$pageRows) return '';

        $fmt = static function (array $row): string {
            $query = (string)($row['query'] ?? $row['query_text'] ?? '');
            $impressions = (int)($row['impressions'] ?? 0);
            $clicks = (int)($row['clicks'] ?? 0);
            $position = round((float)($row['position'] ?? 0), 1);
            return sprintf('- "%s" — %d impression, %d click, posizione media %.1f', $query, $impressions, $clicks, $position);
        };

        $out = "DOMANDA DI RICERCA REALE (Google Search Console, ultimi $days giorni)\n"
             . "Queste sono le parole che le persone digitano davvero su Google per arrivare su questo sito.\n"
             . "Usale per scegliere il taglio, il titolo e le domande a cui rispondere.\n"
             . "NON infilarle a forza nel testo: servono a capire l'intenzione di chi cerca, non a essere ripetute.\n\n";

        if ($pageRows) {
            $out .= "Ricerche che portano già su QUESTA pagina:\n";
            foreach (array_slice($pageRows, 0, 8) as $row) $out .= $fmt($row) . "\n";
            $out .= "\n";
        }

        if ($demand['top']) {
            $out .= "Ricerche principali di tutto il sito:\n";
            foreach ($demand['top'] as $row) $out .= $fmt($row) . "\n";
            $out .= "\n";
        }

        if ($demand['striking']) {
            $out .= "Occasioni ravvicinate (il sito compare ma raramente viene cliccato:\n"
                 .  "un titolo che risponde meglio a questa intenzione guadagna click subito):\n";
            foreach ($demand['striking'] as $row) $out .= $fmt($row) . "\n";
            $out .= "\n";
        }

        if ($demand['unclicked']) {
            $out .= "Domande ancora senza una risposta adeguata sul sito\n"
                 .  "(molte impression, nessun click, posizione lontana):\n";
            foreach ($demand['unclicked'] as $row) $out .= $fmt($row) . "\n";
            $out .= "\n";
        }

        return $out;
    }
}
