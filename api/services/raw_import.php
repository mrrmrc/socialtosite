<?php

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/refetcher.php';
require_once __DIR__ . '/website_source.php';
require_once __DIR__ . '/profile_analyzer.php';

final class RawImport
{
    private static bool $schemaReady = false;

    public static function ensureSchema(): void
    {
        if (self::$schemaReady) return;
        DB::execute("CREATE TABLE IF NOT EXISTS content_sources (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            platform VARCHAR(30) NOT NULL,
            label VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            url_hash CHAR(64) NOT NULL,
            source_profile LONGTEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'ready',
            last_message TEXT NULL,
            last_import_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_content_source (user_id, url_hash),
            KEY source_user (user_id),
            CONSTRAINT fk_content_sources_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::execute("CREATE TABLE IF NOT EXISTS import_runs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            source_id INT NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'queued',
            phase VARCHAR(30) NOT NULL DEFAULT 'queued',
            message VARCHAR(500) NOT NULL DEFAULT 'Acquisizione in coda',
            found_count INT NOT NULL DEFAULT 0,
            imported_count INT NOT NULL DEFAULT 0,
            duplicate_count INT NOT NULL DEFAULT 0,
            error_message TEXT NULL,
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY run_user (user_id, created_at),
            KEY run_source (source_id, created_at),
            CONSTRAINT fk_import_runs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_import_runs_source FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        DB::execute("CREATE TABLE IF NOT EXISTS raw_contents (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            source_id INT NOT NULL,
            import_run_id BIGINT NULL,
            platform VARCHAR(30) NOT NULL,
            external_id VARCHAR(255) NULL,
            source_url TEXT NOT NULL,
            content_hash CHAR(64) NOT NULL,
            title TEXT NULL,
            body_text LONGTEXT NULL,
            media_url TEXT NULL,
            image_urls LONGTEXT NULL,
            media_type VARCHAR(40) NULL,
            post_status VARCHAR(30) NOT NULL DEFAULT 'potential',
            draft_title TEXT NULL,
            draft_body LONGTEXT NULL,
            draft_image_url TEXT NULL,
            draft_updated_at DATETIME NULL,
            published_at DATETIME NULL,
            raw_payload LONGTEXT NOT NULL,
            imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_raw_content (user_id, source_id, content_hash),
            KEY raw_user_date (user_id, imported_at),
            KEY raw_source (source_id),
            CONSTRAINT fk_raw_contents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_raw_contents_source FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE,
            CONSTRAINT fk_raw_contents_run FOREIGN KEY (import_run_id) REFERENCES import_runs(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        self::addColumnIfMissing('content_sources', 'since_date', 'DATE NULL AFTER url_hash');
        self::addColumnIfMissing('content_sources', 'acquisition_limit', 'INT NOT NULL DEFAULT 500 AFTER since_date');
        self::addColumnIfMissing('content_sources', 'source_profile', 'LONGTEXT NULL AFTER acquisition_limit');
        self::addColumnIfMissing('raw_contents', 'image_urls', 'LONGTEXT NULL AFTER media_url');
        self::addColumnIfMissing('raw_contents', 'post_status', "VARCHAR(30) NOT NULL DEFAULT 'potential' AFTER media_type");
        self::addColumnIfMissing('raw_contents', 'draft_title', 'TEXT NULL AFTER post_status');
        self::addColumnIfMissing('raw_contents', 'draft_body', 'LONGTEXT NULL AFTER draft_title');
        self::addColumnIfMissing('raw_contents', 'draft_image_url', 'TEXT NULL AFTER draft_body');
        self::addColumnIfMissing('raw_contents', 'draft_updated_at', 'DATETIME NULL AFTER draft_image_url');
        self::addColumnIfMissing('raw_contents', 'editorial_status', "VARCHAR(30) NOT NULL DEFAULT 'raw' AFTER draft_updated_at");
        self::addColumnIfMissing('raw_contents', 'editorial_notes', 'TEXT NULL AFTER editorial_status');
        self::addColumnIfMissing('raw_contents', 'seo_score', 'INT NOT NULL DEFAULT 0 AFTER editorial_notes');
        self::addColumnIfMissing('raw_contents', 'meta_description', 'VARCHAR(255) NULL AFTER seo_score');
        self::addColumnIfMissing('raw_contents', 'generated_at', 'DATETIME NULL AFTER meta_description');
        ProfileAnalyzer::ensureSchema();
        self::$schemaReady = true;
    }

    private static function addColumnIfMissing(string $table, string $column, string $definition): void
    {
        $exists = DB::fetch('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?', [DB_NAME, $table, $column]);
        if (!$exists) DB::execute("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
    }

    public static function detectPlatform(string $url): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host);
        $matches = static fn(string $domain): bool => $host === $domain || str_ends_with($host, '.' . $domain);
        if ($matches('youtube.com') || $host === 'youtu.be') return 'youtube';
        if ($matches('instagram.com')) return 'instagram';
        if ($matches('tiktok.com')) return 'tiktok';
        if ($matches('facebook.com') || $host === 'fb.watch') return 'facebook';
        if ($matches('x.com') || $matches('twitter.com')) return 'x';
        return 'website';
    }

    public static function normalizeUrl(string $url): string
    {
        $url = trim($url);
        if ($url !== '' && !preg_match('~^https?://~i', $url)) $url = 'https://' . $url;
        if (!filter_var($url, FILTER_VALIDATE_URL)) throw new InvalidArgumentException('Inserisci un URL valido.');
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) throw new InvalidArgumentException('Sono consentiti soltanto link HTTP o HTTPS.');
        return rtrim($url, '/');
    }

    public static function addSource(int $userId, string $url, string $label = '', ?string $sinceDate = null): array
    {
        self::ensureSchema();
        $url = self::normalizeUrl($url);
        $platform = self::detectPlatform($url);
        $host = preg_replace('/^www\./', '', (string) parse_url($url, PHP_URL_HOST));
        $label = trim($label) ?: ($host ?: ucfirst($platform));
        $sinceDate = self::validateSinceDate($sinceDate);
        $acquisitionLimit = $platform === 'website' ? 100 : 500;
        $hash = hash('sha256', strtolower($url));
        try {
            $id = DB::insert('INSERT INTO content_sources (user_id, platform, label, url, url_hash, since_date, acquisition_limit) VALUES (?, ?, ?, ?, ?, ?, ?)', [$userId, $platform, mb_substr($label, 0, 255), $url, $hash, $sinceDate, $acquisitionLimit]);
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) !== 1062) throw $e;
            $existing = DB::fetch('SELECT * FROM content_sources WHERE user_id=? AND url_hash=?', [$userId, $hash]);
            if (!$existing) throw $e;
            DB::execute('UPDATE content_sources SET label=?, since_date=?, acquisition_limit=? WHERE id=? AND user_id=?', [mb_substr($label, 0, 255), $sinceDate, $acquisitionLimit, $existing['id'], $userId]);
            return DB::fetch('SELECT * FROM content_sources WHERE id=? AND user_id=?', [$existing['id'], $userId]);
        }
        return DB::fetch('SELECT * FROM content_sources WHERE id=? AND user_id=?', [$id, $userId]);
    }

    public static function dashboard(int $userId): array
    {
        self::ensureSchema();
        $sources = DB::fetchAll("SELECT s.id,s.user_id,s.platform,s.label,s.url,s.url_hash,s.since_date,s.acquisition_limit,s.status,s.last_message,s.last_import_at,s.created_at,s.updated_at,COUNT(c.id) content_count FROM content_sources s LEFT JOIN raw_contents c ON c.source_id=s.id WHERE s.user_id=? GROUP BY s.id ORDER BY s.created_at DESC", [$userId]);
        $contents = DB::fetchAll("SELECT c.id, c.platform, c.source_url, c.title, c.body_text, c.media_url, c.image_urls, c.media_type, c.post_status, c.draft_title, c.draft_body, c.draft_image_url, c.draft_updated_at, c.editorial_status, c.editorial_notes, c.seo_score, c.meta_description, c.generated_at, c.published_at, c.imported_at, s.label source_label FROM raw_contents c JOIN content_sources s ON s.id=c.source_id WHERE c.user_id=? ORDER BY COALESCE(c.published_at, c.imported_at) DESC LIMIT 100", [$userId]);
        $latestRun = DB::fetch('SELECT r.*, s.label source_label, s.platform FROM import_runs r JOIN content_sources s ON s.id=r.source_id WHERE r.user_id=? ORDER BY r.id DESC LIMIT 1', [$userId]);
        return ['sources' => $sources, 'contents' => $contents, 'latest_run' => $latestRun, 'profile' => ProfileAnalyzer::profile($userId), 'profile_questions' => ProfileAnalyzer::questions($userId)];
    }

    public static function updateSourcePeriod(int $userId, int $sourceId, ?string $sinceDate): array
    {
        self::ensureSchema();
        $sinceDate = self::validateSinceDate($sinceDate);
        $updated = DB::execute('UPDATE content_sources SET since_date=? WHERE id=? AND user_id=?', [$sinceDate, $sourceId, $userId]);
        $source = DB::fetch('SELECT * FROM content_sources WHERE id=? AND user_id=?', [$sourceId, $userId]);
        if (!$source) throw new RuntimeException('Sorgente non trovata.');
        return $source;
    }

    public static function updatePotentialPost(int $userId, int $contentId, string $title, string $body, ?string $imageUrl): array
    {
        self::ensureSchema();
        $content = DB::fetch('SELECT id FROM raw_contents WHERE id=? AND user_id=?', [$contentId, $userId]);
        if (!$content) throw new RuntimeException('Post potenziale non trovato.');
        $title = trim($title);
        $body = trim($body);
        $imageUrl = trim((string)$imageUrl);
        if (mb_strlen($title) > 1000) throw new InvalidArgumentException('Il titolo supera i 1.000 caratteri.');
        if (mb_strlen($body) > 500000) throw new InvalidArgumentException('Il testo supera la dimensione consentita.');
        if ($imageUrl !== '' && (!filter_var($imageUrl, FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($imageUrl, PHP_URL_SCHEME)), ['http', 'https'], true))) {
            throw new InvalidArgumentException('L’URL dell’immagine non è valido.');
        }
        DB::execute('UPDATE raw_contents SET draft_title=?, draft_body=?, draft_image_url=?, draft_updated_at=NOW() WHERE id=? AND user_id=?', [$title, $body, $imageUrl ?: null, $contentId, $userId]);
        return DB::fetch('SELECT id, draft_title, draft_body, draft_image_url, draft_updated_at FROM raw_contents WHERE id=? AND user_id=?', [$contentId, $userId]);
    }

    public static function deletePotentialPost(int $userId, int $contentId): void
    {
        self::ensureSchema();
        $content = DB::fetch('SELECT id FROM raw_contents WHERE id=? AND user_id=?', [$contentId, $userId]);
        if (!$content) throw new RuntimeException('Contenuto non trovato.');
        DB::execute('DELETE FROM raw_contents WHERE id=? AND user_id=?', [$contentId, $userId]);
    }

    public static function createRun(int $userId, int $sourceId): array
    {
        self::ensureSchema();
        $source = DB::fetch('SELECT * FROM content_sources WHERE id=? AND user_id=?', [$sourceId, $userId]);
        if (!$source) throw new RuntimeException('Sorgente non trovata.');
        $running = DB::fetch("SELECT * FROM import_runs WHERE source_id=? AND user_id=? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1", [$sourceId, $userId]);
        if ($running) return self::runStatus($userId, (int)$running['id']);
        $id = DB::insert('INSERT INTO import_runs (user_id, source_id) VALUES (?, ?)', [$userId, $sourceId]);
        return self::runStatus($userId, $id);
    }

    public static function runStatus(int $userId, int $runId): array
    {
        self::ensureSchema();
        $run = DB::fetch('SELECT r.*, s.label source_label, s.platform FROM import_runs r JOIN content_sources s ON s.id=r.source_id WHERE r.id=? AND r.user_id=?', [$runId, $userId]);
        if (!$run) throw new RuntimeException('Acquisizione non trovata.');
        return $run;
    }

    private static function progress(int $runId, string $phase, string $message, array $counts = []): void
    {
        DB::execute('UPDATE import_runs SET status="running", phase=?, message=?, found_count=?, imported_count=?, duplicate_count=? WHERE id=?', [$phase, mb_substr($message, 0, 500), (int)($counts['found'] ?? 0), (int)($counts['imported'] ?? 0), (int)($counts['duplicates'] ?? 0), $runId]);
    }

    public static function execute(int $userId, int $runId, int $limit = 0): array
    {
        self::ensureSchema();
        $run = self::runStatus($userId, $runId);
        if ($run['status'] === 'completed') return $run;
        $source = DB::fetch('SELECT * FROM content_sources WHERE id=? AND user_id=?', [(int)$run['source_id'], $userId]);
        if (!$source) throw new RuntimeException('Sorgente non trovata.');
        $configuredLimit = (int)($source['acquisition_limit'] ?? ($source['platform'] === 'website' ? 100 : 500));
        $maximum = $source['platform'] === 'website' ? 100 : 500;
        $limit = $limit > 0 ? min($limit, $configuredLimit) : $configuredLimit;
        $limit = max(1, min($maximum, $limit));
        $sinceDate = self::validateSinceDate($source['since_date'] ?? null);
        DB::execute('UPDATE import_runs SET status="running", phase="connecting", message="Connessione alla sorgente", started_at=NOW(), error_message=NULL WHERE id=?', [$runId]);
        DB::execute('UPDATE content_sources SET status="importing", last_message="Connessione alla sorgente" WHERE id=?', [$source['id']]);
        try {
            self::progress($runId, 'discovering', 'Ricerca dei contenuti pubblici');
            if ($source['platform'] === 'website') {
                $items = WebsiteSource::items($source['url'], $limit, $sinceDate);
            } else {
                $response = Refetcher::source($source['url'], $limit, $sinceDate);
                $items = is_array($response['items'] ?? null) ? $response['items'] : [];
                if (is_array($response['profile'] ?? null) && $response['profile']) {
                    DB::execute('UPDATE content_sources SET source_profile=? WHERE id=? AND user_id=?', [json_encode($response['profile'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE), $source['id'], $userId]);
                }
            }
            $counts = ['found' => count($items), 'imported' => 0, 'duplicates' => 0];
            self::progress($runId, 'importing', 'Salvataggio dei contenuti grezzi', $counts);
            foreach ($items as $item) {
                if (!is_array($item)) continue;
                $sourceUrl = trim((string)($item['url'] ?? $item['postUrl'] ?? $item['webVideoUrl'] ?? ''));
                if ($sourceUrl === '') continue;
                $externalId = trim((string)($item['id'] ?? $item['post_id'] ?? $item['videoId'] ?? ''));
                $caption = trim((string)($item['caption'] ?? $item['description'] ?? $item['text'] ?? $item['title'] ?? ''));
                $title = trim((string)($item['title'] ?? ''));
                if ($title === '' && $caption !== '') $title = trim((string)strtok($caption, "\n"));
                $mediaUrl = trim((string)($item['media_url'] ?? $item['image_url'] ?? $item['thumbnailUrl'] ?? $item['displayUrl'] ?? ''));
                $mediaType = trim((string)($item['media_type'] ?? $item['type'] ?? ''));
                $published = self::dateValue($item['published_at'] ?? $item['timestamp'] ?? $item['createTime'] ?? null);
                if ($sinceDate && $published && strtotime($published) < strtotime($sinceDate)) continue;
                $imageUrls = self::imageUrls($item, $mediaUrl, $mediaType);
                $rawPayload = $item['raw_payload'] ?? $item;
                $raw = json_encode($rawPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
                $contentHash = hash('sha256', strtolower(rtrim($sourceUrl, '/')) ?: $raw);
                try {
                    DB::insert('INSERT INTO raw_contents (user_id, source_id, import_run_id, platform, external_id, source_url, content_hash, title, body_text, media_url, image_urls, media_type, post_status, published_at, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "potential", ?, ?)', [$userId, $source['id'], $runId, $source['platform'], $externalId ?: null, $sourceUrl, $contentHash, $title ?: null, $caption ?: null, $mediaUrl ?: null, json_encode($imageUrls, JSON_UNESCAPED_SLASHES), $mediaType ?: null, $published, $raw ?: '{}']);
                    $counts['imported']++;
                } catch (PDOException $e) {
                    if ((int)($e->errorInfo[1] ?? 0) !== 1062) throw $e;
                    $imagesJson = json_encode($imageUrls, JSON_UNESCAPED_SLASHES) ?: '[]';
                    DB::execute('UPDATE raw_contents SET external_id=COALESCE(NULLIF(?,""),external_id), title=COALESCE(NULLIF(?,""),title), body_text=COALESCE(NULLIF(?,""),body_text), media_url=COALESCE(NULLIF(?,""),media_url), image_urls=IF(?<>"[]",?,image_urls), media_type=COALESCE(NULLIF(?,""),media_type), published_at=COALESCE(?,published_at), raw_payload=? WHERE user_id=? AND source_id=? AND content_hash=?', [$externalId, $title, $caption, $mediaUrl, $imagesJson, $imagesJson, $mediaType, $published, $raw ?: '{}', $userId, $source['id'], $contentHash]);
                    $counts['duplicates']++;
                }
                self::progress($runId, 'importing', "Salvati {$counts['imported']} di {$counts['found']} contenuti", $counts);
            }
            self::progress($runId, 'profiling', 'Aggiornamento del profilo utente', $counts);
            try {
                ProfileAnalyzer::analyze($userId);
            } catch (Throwable $profileError) {
                error_log('[PROFILE] ' . $profileError->getMessage());
            }
            DB::execute('UPDATE import_runs SET status="completed", phase="completed", message="Acquisizione completata", found_count=?, imported_count=?, duplicate_count=?, completed_at=NOW() WHERE id=?', [$counts['found'], $counts['imported'], $counts['duplicates'], $runId]);
            DB::execute('UPDATE content_sources SET status="ready", last_message=?, last_import_at=NOW() WHERE id=?', ["{$counts['imported']} nuovi contenuti importati", $source['id']]);
        } catch (Throwable $e) {
            $message = mb_substr($e->getMessage(), 0, 1500);
            DB::execute('UPDATE import_runs SET status="failed", phase="failed", message="Acquisizione non riuscita", error_message=?, completed_at=NOW() WHERE id=?', [$message, $runId]);
            DB::execute('UPDATE content_sources SET status="error", last_message=? WHERE id=?', [$message, $source['id']]);
        }
        return self::runStatus($userId, $runId);
    }

    private static function dateValue(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;
        if (is_numeric($value)) {
            $timestamp = (int)$value;
            if ($timestamp > 20000000000) $timestamp = (int)($timestamp / 1000);
        } else {
            $timestamp = strtotime((string)$value);
        }
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : null;
    }

    private static function validateSinceDate(?string $value): ?string
    {
        $value = trim((string)$value);
        if ($value === '') return null;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('La data iniziale non è valida.');
        if ($date > new DateTimeImmutable('today')) throw new InvalidArgumentException('La data iniziale non può essere nel futuro.');
        return $value;
    }

    private static function imageUrls(array $item, string $mediaUrl, string $mediaType): array
    {
        $urls = is_array($item['image_urls'] ?? null) ? $item['image_urls'] : [];
        if ($mediaUrl !== '' && $mediaType !== 'video') array_unshift($urls, $mediaUrl);
        return array_values(array_unique(array_filter(array_map('trim', $urls), static fn(string $url): bool => filter_var($url, FILTER_VALIDATE_URL) !== false)));
    }
}
