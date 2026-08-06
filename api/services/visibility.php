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
        $secret = defined('JWT_SECRET') ? JWT_SECRET : (defined('DB_NAME') ? DB_NAME : 'socialtosite');
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
}
