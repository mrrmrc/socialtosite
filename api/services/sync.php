<?php
// api/services/sync.php — Importa contenuti social, trascrive, genera SEO
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/../middleware/response.php';
require_once __DIR__ . '/../middleware/crypto.php';

class Sync {
    public static function ensureAutoSyncSchema(): void {
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

    private static function isLegacyMetaConnection(array $connection): bool {
        return in_array((string)($connection['platform'] ?? ''), ['facebook', 'instagram', 'instagram_login'], true);
    }

    /**
     * Converte una vecchia connessione Meta in una sorgente URL pubblica.
     * Il token viene conservato nel record storico ma disattivato e non viene
     * mai decifrato o inviato alle Graph API durante la sincronizzazione.
     */
    private static function migrateLegacyMetaConnection(int $userId, array $connection): void {
        $rawPlatform = (string)($connection['platform'] ?? '');
        $platform = $rawPlatform === 'instagram_login' ? 'instagram' : $rawPlatform;
        if (!in_array($platform, ['facebook', 'instagram'], true)) return;

        $existing = DB::fetch(
            'SELECT id, url FROM social_sources WHERE user_id=? AND platform=? LIMIT 1',
            [$userId, $platform]
        );
        $handle = trim((string)($connection['handle'] ?? ''));
        $platformUid = trim((string)($connection['platform_uid'] ?? ''));
        $url = trim((string)($existing['url'] ?? ''));

        if ($url === '' && filter_var($handle, FILTER_VALIDATE_URL)) {
            $url = $handle;
        } elseif ($url === '' && $platform === 'instagram') {
            $username = ltrim($handle, '@');
            if (preg_match('/^[A-Za-z0-9._]+$/', $username)) {
                $url = 'https://www.instagram.com/' . rawurlencode($username) . '/';
            }
        } elseif ($url === '' && $platform === 'facebook') {
            // I vecchi callback salvavano talvolta il nome visualizzato e
            // talvolta l'ID della Pagina: l'ID e' il riferimento piu' stabile.
            if ($platformUid !== '' && preg_match('/^[A-Za-z0-9._-]+$/', $platformUid)) {
                $url = 'https://www.facebook.com/' . rawurlencode($platformUid) . '/';
            } elseif (preg_match('/^[A-Za-z0-9._-]+$/', $handle)) {
                $url = 'https://www.facebook.com/' . rawurlencode($handle) . '/';
            }
        }

        if ($url === '') {
            throw new Exception('La vecchia connessione ' . ucfirst($platform) . ' non contiene un URL pubblico utilizzabile. Reinserisci il link completo del profilo: l\'acquisizione ora usa SocialCrawl, non Meta Graph API.');
        }

        $label = $handle !== '' ? $handle : ucfirst($platform);
        $sinceDate = !empty($connection['since_date']) ? $connection['since_date'] : null;
        $autoPublish = (int)($connection['auto_publish'] ?? 1);
        $autoSync = (int)($connection['auto_sync'] ?? 1);
        $maxPosts = !empty($connection['max_posts']) ? (int)$connection['max_posts'] : null;
        $topic = 'Profilo ' . ucfirst($platform) . ' migrato alla pipeline pubblica SocialCrawl';

        if ($existing) {
            DB::execute(
                'UPDATE social_sources
                    SET label=?, url=?, topic_summary=?, since_date=?, auto_publish=?, auto_sync=?, max_posts=?, active=1
                  WHERE id=? AND user_id=?',
                [$label, $url, $topic, $sinceDate, $autoPublish, $autoSync, $maxPosts, $existing['id'], $userId]
            );
        } else {
            DB::insert(
                'INSERT INTO social_sources (user_id, platform, label, url, topic_summary, active, since_date, auto_publish, auto_sync, max_posts)
                 VALUES (?,?,?,?,?,1,?,?,?,?)',
                [$userId, $platform, $label, $url, $topic, $sinceDate, $autoPublish, $autoSync, $maxPosts]
            );
        }

        DB::execute(
            'UPDATE social_connections SET active=0 WHERE user_id=? AND platform=?',
            [$userId, $rawPlatform]
        );
    }
    private static function isLocalMediaUrl(string $url): bool {
        return $url !== '' && strpos($url, '/public/media/') !== false;
    }

    private static function localMediaPathFromUrl(string $url): ?string {
        if (!self::isLocalMediaUrl($url)) return null;
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $name = basename($path);
        if ($name === '' || $name === '.' || $name === '..') return null;
        return __DIR__ . '/../../public/media/' . $name;
    }

    private static function normalizeLocalMediaUrl(string $url): string {
        if (!self::isLocalMediaUrl($url)) return trim($url);
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $name = basename($path);
        if ($name === '' || $name === '.' || $name === '..') return trim($url);
        $base = defined('BASE_URL') ? rtrim(BASE_URL, '/') : '';
        return $base . '/public/media/' . $name;
    }

    // ── Chiama un'API social con curl ──────────────────────────────────────
    private static function get(string $url, string $token = '', array $params = []): array {
        if ($params) $url .= '?' . http_build_query($params);
        $ch = curl_init($url);
        $headers = ['Accept: application/json'];
        if ($token) $headers[] = "Authorization: Bearer $token";
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_USERAGENT      => 'LinkSeoWeb/1.0',
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        return json_decode($res, true) ?? [];
    }

    // ── Inserisce post nel DB (salta duplicati) ────────────────────────────
    private static function upsert(int $userId, string $platform, string $postId, array $d, int $autoPublish = 1): bool {
        $exists = DB::fetch(
            'SELECT id, media_url FROM posts WHERE user_id=? AND platform=? AND platform_post_id=?',
            [$userId, $platform, $postId]
        );

        // ── Media in locale: gli URL CDN dei social (Instagram/Facebook) sono
        //    firmati e SCADONO dopo poche ore. Se non li scarichiamo, immagini
        //    e video spariscono dal sito. saveMedia() ritorna un URL locale
        //    persistente (/public/media/...). ─────────────────────────────────
        $mUrl  = trim($d['media_url'] ?? '');
        $mType = strtolower($d['media_type'] ?? '');
        $hasUsableText = mb_strlen(trim(strip_tags((string)($d['raw_content'] ?? '')))) >= 40;
        $deferVideoDownload = $mType === 'video' && $hasUsableText;
        $isRemoteMedia = $mUrl && str_starts_with($mUrl, 'http') && in_array($mType, ['image', 'video'], true) && !$deferVideoDownload;

        // Auto-heal: post già presente ma con media ancora remoto (CDN scaduto)
        // → riscaricalo dall'URL fresco appena ottenuto dall'API e aggiorna.
        if ($exists) {
            $curUrl = $exists['media_url'] ?? '';
            $curIsLocal = self::isLocalMediaUrl($curUrl);
            if ($isRemoteMedia && !$curIsLocal) {
                require_once __DIR__ . '/ingest.php';
                $saved = Ingest::saveMedia($mUrl, $platform, $postId, $mType === 'video' ? 'mp4' : 'jpg');
                if ($saved && !empty($saved['url'])) {
                    DB::execute('UPDATE posts SET media_url=? WHERE id=?', [$saved['url'], $exists['id']]);
                }
            }
            return false;
        }

        // Nuovo post: scarica il media prima dell'INSERT (fallback: URL remoto).
        if ($isRemoteMedia) {
            require_once __DIR__ . '/ingest.php';
            $saved = Ingest::saveMedia($mUrl, $platform, $postId, $mType === 'video' ? 'mp4' : 'jpg');
            if ($saved && !empty($saved['url'])) {
                $d['media_url'] = $saved['url'];
            }
        }

        DB::execute('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               generated_title, generated_body, generated_excerpt, tags,
               meta_description, media_url, media_type, published_at, seo_score, slug, published)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ', [
            $userId, $platform, $postId,
            $d['raw_content'] ?? '',
            $d['transcript']  ?? '',
            $d['title']       ?? '',
            $d['body']        ?? '',
            $d['excerpt']     ?? '',
            json_encode($d['tags'] ?? []),
            $d['meta_description'] ?? '',
            $d['media_url']   ?? '',
            $d['media_type']  ?? 'text',
            $d['published_at'] ?? date('Y-m-d H:i:s'),
            $d['seo_score']   ?? 0,
            slugify($d['title'] ?? $postId),
            $autoPublish
        ]);
        return true;
    }

    // ── Processa un contenuto: salva bozza per AI ─────────────
    public static function repairMediaLibrary(int $userId, int $maxPosts = 50): array {
        $posts = DB::fetchAll(
            'SELECT id, platform, platform_post_id, media_url, media_type
             FROM posts
             WHERE user_id=? AND media_url IS NOT NULL AND media_url != ""',
            [$userId]
        );

        $stats = [
            'checked' => count($posts),
            'normalized' => 0,
            'downloaded' => 0,
            'healthy_local' => 0,
            'missing_local' => 0,
            'remote_pending_refresh' => 0,
            'sync_sources' => 0,
        ];

        foreach ($posts as $post) {
            $mediaUrl = trim($post['media_url'] ?? '');
            if ($mediaUrl === '') continue;

            if (self::isLocalMediaUrl($mediaUrl)) {
                $normalizedUrl = self::normalizeLocalMediaUrl($mediaUrl);
                if ($normalizedUrl !== $mediaUrl) {
                    DB::execute('UPDATE posts SET media_url=? WHERE id=?', [$normalizedUrl, $post['id']]);
                    $stats['normalized']++;
                    $mediaUrl = $normalizedUrl;
                }

                $localPath = self::localMediaPathFromUrl($mediaUrl);
                if ($localPath && file_exists($localPath)) {
                    $stats['healthy_local']++;
                } else {
                    $stats['missing_local']++;
                }
                continue;
            }

            $mediaType = strtolower($post['media_type'] ?? '');
            if (!str_starts_with($mediaUrl, 'http') || !in_array($mediaType, ['image', 'video'], true)) {
                continue;
            }

            $saved = Ingest::saveMedia(
                $mediaUrl,
                (string)$post['platform'],
                (string)($post['platform_post_id'] ?: $post['id']),
                $mediaType === 'video' ? 'mp4' : 'jpg'
            );
            if ($saved && !empty($saved['url'])) {
                DB::execute('UPDATE posts SET media_url=? WHERE id=?', [$saved['url'], $post['id']]);
                $stats['downloaded']++;
            } else {
                $stats['remote_pending_refresh']++;
            }
        }

        if ($stats['missing_local'] > 0 || $stats['remote_pending_refresh'] > 0) {
            $results = self::syncUser($userId, max(20, $maxPosts), null);
            $stats['sync_sources'] = count($results);
        }

        return $stats;
    }

    private static function process(int $userId, string $platform, string $postId, string $text, string $mediaUrl, string $mediaType, string $publishedAt, int $autoPublish = 1): bool {
        if (!trim($text) && !$mediaUrl) return false;

        $seo = [
            'raw_content' => $text,
            'transcript' => '',
            'media_url' => $mediaUrl,
            'media_type' => $mediaType,
            'published_at' => $publishedAt,
            'title' => '',
            'body' => '',
            'excerpt' => '',
            'tags' => [],
            'meta_description' => '',
            'seo_score' => -1 // Indica che è in attesa di elaborazione AI
        ];

        return self::upsert($userId, $platform, $postId, $seo, $autoPublish);
    }

    // ── TikTok ─────────────────────────────────────────────────────────────
    public static function tiktok(int $userId, string $token, int $maxPosts = 20, ?string $sinceDate = null, int $autoPublish = 1): array {
        $log = ['platform' => 'tiktok', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $cursor = 0;
            $hasMore = true;
            
            while ($hasMore && $log['found'] < $maxPosts) {
                $limit = min(20, $maxPosts - $log['found']);
                $ch = curl_init('https://open.tiktokapis.com/v2/video/list/');
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST           => true,
                    CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token", 'Content-Type: application/json'],
                    CURLOPT_POSTFIELDS     => json_encode([
                        'max_count' => $limit,
                        'cursor' => $cursor,
                        'fields' => ['id','title','video_description','create_time','cover_image_url']
                    ]),
                    CURLOPT_TIMEOUT        => 30,
                ]);
                $res = curl_exec($ch); curl_close($ch);
                $respData = json_decode($res, true)['data'] ?? [];
                $videos = $respData['videos'] ?? [];
                
                if (empty($videos)) break;
                
                foreach ($videos as $v) {
                    if ($log['found'] >= $maxPosts) break;
                    
                    $ts = date('Y-m-d H:i:s', $v['create_time'] ?? time());
                    if ($sinceDate && strtotime($ts) < strtotime($sinceDate)) {
                        $hasMore = false;
                        break;
                    }
                    
                    $new = self::process($userId, 'tiktok', $v['id'],
                        $v['video_description'] ?? $v['title'] ?? '',
                        $v['cover_image_url'] ?? '', 'IMAGE', $ts, $autoPublish);
                    if ($new) $log['new']++;
                    $log['found']++;
                }
                
                if ($hasMore && isset($respData['has_more']) && $respData['has_more']) {
                    $cursor = $respData['cursor'];
                } else {
                    break;
                }
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── YouTube ────────────────────────────────────────────────────────────
    public static function youtube(int $userId, string $token, int $maxPosts = 20, ?string $sinceDate = null, int $autoPublish = 1): array {
        $log = ['platform' => 'youtube', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $ch = self::get('https://www.googleapis.com/youtube/v3/channels',
                $token, ['part' => 'contentDetails', 'mine' => 'true']);
            $uploadId = $ch['items'][0]['contentDetails']['relatedPlaylists']['uploads'] ?? null;
            if (!$uploadId) throw new Exception('Nessun canale trovato');

            $pageToken = '';
            while ($pageToken !== null && $log['found'] < $maxPosts) {
                $params = ['part' => 'snippet', 'playlistId' => $uploadId, 'maxResults' => min(50, $maxPosts - $log['found'])];
                if ($pageToken) $params['pageToken'] = $pageToken;
                
                $items = self::get('https://www.googleapis.com/youtube/v3/playlistItems', $token, $params);
                $videos = $items['items'] ?? [];
                if (empty($videos)) break;

                foreach ($videos as $item) {
                    if ($log['found'] >= $maxPosts) break;
                    
                    $sn  = $item['snippet'] ?? [];
                    $vid = $sn['resourceId']['videoId'] ?? null;
                    if (!$vid) continue;
                    
                    $ts = $sn['publishedAt'] ?? date('Y-m-d H:i:s');
                    if ($sinceDate && strtotime($ts) < strtotime($sinceDate)) {
                        $pageToken = null;
                        break;
                    }

                    $new = self::process($userId, 'youtube', $vid,
                        ($sn['description'] ?? '') ?: ($sn['title'] ?? ''),
                        "https://www.youtube.com/watch?v=$vid", 'VIDEO', $ts, $autoPublish);
                    if ($new) $log['new']++;
                    $log['found']++;
                }

                if ($pageToken !== null && isset($items['nextPageToken'])) {
                    $pageToken = $items['nextPageToken'];
                } else {
                    break;
                }
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── Sync completo utente ───────────────────────────────────────────────
    public static function syncUser(int $userId, int $maxPosts = 20, ?string $sinceDate = null, bool $automatic = false): array {
        if (function_exists('setSyncStatus')) setSyncStatus($userId, "Inizio sincronizzazione canali collegati...");
        self::ensureAutoSyncSchema();
        $connections = DB::fetchAll(
            'SELECT * FROM social_connections WHERE user_id=? AND active=1' . ($automatic ? ' AND auto_sync=1' : ''), [$userId]
        );
        $results = [];
        foreach ($connections as $conn) {
            // Facebook e Instagram non usano piu' token Meta/Graph API.
            // Le connessioni storiche vengono trasformate una volta in URL
            // pubblici e saranno lette dal ciclo social_sources tramite SocialCrawl.
            if (self::isLegacyMetaConnection($conn)) {
                try {
                    self::migrateLegacyMetaConnection($userId, $conn);
                } catch (Throwable $e) {
                    $error = mb_substr($e->getMessage(), 0, 2000);
                    $platform = $conn['platform'] === 'instagram_login' ? 'instagram' : $conn['platform'];
                    $results[] = ['platform' => $platform, 'new' => 0, 'found' => 0, 'error' => $error];
                    DB::execute('INSERT INTO sync_log (user_id, platform, status, posts_found, posts_new, error)
                                 VALUES (?,?,?,?,?,?)', [$userId, $platform, 'error', 0, 0, $error]);
                }
                continue;
            }
            if (function_exists('setSyncStatus')) setSyncStatus($userId, "Scansione " . ucfirst($conn['platform']) . " in corso...");
            try {
                $token  = Crypto::decrypt($conn['access_token']);
                $connSinceDate = !empty($conn['since_date']) ? $conn['since_date'] : $sinceDate;
                $autoPublish = (int)($conn['auto_publish'] ?? 1);
                $limit = !empty($conn['max_posts']) ? (int)$conn['max_posts'] : $maxPosts;
                $result = match($conn['platform']) {
                    'tiktok'    => self::tiktok($userId, $token, $limit, $connSinceDate, $autoPublish),
                    'youtube'   => self::youtube($userId, $token, $limit, $connSinceDate, $autoPublish),
                    default     => null,
                };
                if (!$result) continue;
                $results[] = $result;
                DB::execute('INSERT INTO sync_log (user_id, platform, status, posts_found, posts_new, error)
                             VALUES (?,?,?,?,?,?)', [
                    $userId, $conn['platform'],
                    $result['error'] ? 'error' : 'ok',
                    $result['found'], $result['new'], $result['error'],
                ]);
            } catch (Throwable $e) {
                // Un token scaduto o cifrato con una vecchia chiave non deve
                // impedire il controllo delle altre connessioni e fonti URL.
                $error = mb_substr($e->getMessage(), 0, 2000);
                $results[] = ['platform' => $conn['platform'], 'new' => 0, 'found' => 0, 'error' => $error];
                DB::execute('INSERT INTO sync_log (user_id, platform, status, posts_found, posts_new, error)
                             VALUES (?,?,?,?,?,?)', [
                    $userId, $conn['platform'], 'error', 0, 0, $error,
                ]);
            }
        }
        $totalNew = 0;
        foreach ($results as $res) {
            $totalNew += $res['new'] ?? 0;
        }

        // Sincronizza anche social_sources (canali aggiunti tramite URL)
        require_once __DIR__ . '/ingest.php';
        $sources = DB::fetchAll('SELECT * FROM social_sources WHERE user_id=? AND active=1' . ($automatic ? ' AND auto_sync=1' : ''), [$userId]);
        $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy FROM sites WHERE user_id=?', [$userId]);
        
        foreach ($sources as $src) {
            if (function_exists('setSyncStatus')) setSyncStatus($userId, "Analisi sorgente " . ucfirst($src['platform']) . " in corso...");
            try {
                $res = Ingest::scanSources($userId, $maxPosts, $site['profile_summary'] ?? '', $site['role_mission'] ?? '', $site['content_strategy'] ?? '', $src['id']);
                
                $imported = $res['imported'] ?? 0;
                $duplicates = $res['duplicates'] ?? 0;
                $scanErrors = array_values(array_filter($res['errors'] ?? []));
                $scanError = $scanErrors ? mb_substr(implode(' | ', $scanErrors), 0, 2000) : null;
                $totalNew += $imported;

                $results[] = [
                    'platform' => $src['platform'],
                    'new' => $imported,
                    'found' => (int)($res['found'] ?? ($imported + $duplicates)),
                    'duplicates' => $duplicates,
                    'imported_ids' => array_values(array_map('intval', $res['imported_ids'] ?? [])),
                    'debug_trace' => array_values($res['debug_trace'] ?? []),
                    'error' => $scanError,
                ];

                DB::execute('INSERT INTO sync_log (user_id, platform, status, posts_found, posts_new, error) VALUES (?,?,?,?,?,?)', [
                    $userId, $src['platform'], $scanError ? ($imported > 0 ? 'partial' : 'error') : 'ok', (int)($res['found'] ?? ($imported + $duplicates)), $imported, $scanError
                ]);
            } catch (Throwable $e) {
                $error = mb_substr($e->getMessage(), 0, 2000);
                $results[] = [
                    'platform' => $src['platform'],
                    'new' => 0,
                    'found' => 0,
                    'error' => $error,
                ];
                DB::execute('INSERT INTO sync_log (user_id, platform, status, posts_found, posts_new, error) VALUES (?,?,?,?,?,?)', [
                    $userId, $src['platform'], 'error', 0, 0, $error
                ]);
            }
        }

        // Aggiorna cover_url se vuoto
        $site = DB::fetch('SELECT cover_url FROM sites WHERE user_id=?', [$userId]);
        if (empty($site['cover_url'])) {
            $latestImage = DB::fetch("SELECT media_url FROM posts WHERE user_id=? AND UPPER(media_type)='IMAGE' AND media_url!='' ORDER BY published_at DESC LIMIT 1", [$userId]);
            if ($latestImage) {
                DB::execute('UPDATE sites SET cover_url=? WHERE user_id=?', [$latestImage['media_url'], $userId]);
            }
        }

        // Aggiorna score SEO sito
        $scores = DB::fetchAll('SELECT seo_score FROM posts WHERE user_id=? AND published=1', [$userId]);
        if ($scores) {
            $avg = array_sum(array_column($scores, 'seo_score')) / count($scores);
            DB::execute('UPDATE sites SET last_sync=NOW(), seo_score=? WHERE user_id=?',
                [round($avg), $userId]);
        } else {
            DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);
        }

        // Ping Google Sitemap se ci sono nuovi contenuti
        if ($totalNew > 0) {
            if (function_exists('setSyncStatus')) setSyncStatus($userId, "Avviso motori di ricerca dei nuovi contenuti...");
            self::pingGoogle($userId);
        }

        if (function_exists('setSyncStatus')) setSyncStatus($userId, "Sincronizzazione completata.");
        return $results;
    }

    public static function pingGoogle(int $userId): void {
        $user = DB::fetch('SELECT slug FROM users WHERE id=?', [$userId]);
        if ($user && !empty($user['slug'])) {
            $sitemapUrl = BASE_URL . "/" . $user['slug'] . "/sitemap.xml";
            $pingUrl = "http://www.google.com/ping?sitemap=" . urlencode($sitemapUrl);
            $ch = curl_init($pingUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            curl_close($ch);
        }
    }
}
