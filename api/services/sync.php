<?php
// api/services/sync.php — Importa contenuti social, trascrive, genera SEO
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/../middleware/response.php';
require_once __DIR__ . '/../middleware/crypto.php';

class Sync {

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
            CURLOPT_USERAGENT      => 'SocialToSite/1.0',
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        return json_decode($res, true) ?? [];
    }

    // ── Inserisce post nel DB (salta duplicati) ────────────────────────────
    private static function upsert(int $userId, string $platform, string $postId, array $d, int $autoPublish = 1): bool {
        $exists = DB::fetch(
            'SELECT id FROM posts WHERE user_id=? AND platform=? AND platform_post_id=?',
            [$userId, $platform, $postId]
        );
        if ($exists) return false;

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

    // ── Processa un contenuto: trascrive se video, genera SEO ─────────────
    private static function process(int $userId, string $platform, string $postId, string $text, string $mediaUrl, string $mediaType, string $publishedAt, int $autoPublish = 1): bool {
        if (!trim($text) && !$mediaUrl) return false;
        $transcript = '';
        if ($mediaUrl && strtoupper($mediaType) === 'VIDEO') {
            $transcript = AI::transcribeUrl($mediaUrl);
        }

        $raw  = $transcript ?: $text;
        $seo  = strlen($raw) > 30
            ? AI::generateSeo($raw, $platform, $text)
            : ['title' => mb_substr($text, 0, 60), 'body' => $text,
               'excerpt' => mb_substr($text, 0, 155), 'tags' => [],
               'meta_description' => mb_substr($text, 0, 155), 'seo_score' => 40];

        $seo['raw_content'] = $text;
        $seo['transcript'] = $transcript;
        $seo['media_url'] = $mediaUrl;
        $seo['media_type'] = $mediaType;
        $seo['published_at'] = $publishedAt;

        return self::upsert($userId, $platform, $postId, $seo, $autoPublish);
    }

    // ── Instagram ──────────────────────────────────────────────────────────
    public static function instagram(int $userId, string $token, int $maxPosts = 20, ?string $sinceDate = null, int $autoPublish = 1): array {
        $log = ['platform' => 'instagram', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $profile = self::get('https://graph.facebook.com/v18.0/me',
                '', ['fields' => 'instagram_business_account', 'access_token' => $token]);
            $igId = $profile['instagram_business_account']['id'] ?? null;
            if (!$igId) throw new Exception('Nessun account Instagram Business');

            $url = "https://graph.facebook.com/v18.0/$igId/media";
            $params = [
                'fields'       => 'id,caption,media_type,media_url,thumbnail_url,timestamp',
                'limit'        => min(50, $maxPosts),
                'access_token' => $token,
            ];

            while ($url && $log['found'] < $maxPosts) {
                $data = self::get($url, '', $params);
                $posts = $data['data'] ?? [];
                if (empty($posts)) break;
                
                foreach ($posts as $p) {
                    if ($log['found'] >= $maxPosts) break;
                    
                    $ts = $p['timestamp'] ?? date('Y-m-d H:i:s');
                    if ($sinceDate && strtotime($ts) < strtotime($sinceDate)) {
                        $url = null; // stop pagination
                        break;
                    }
                    
                    $new = self::process($userId, 'instagram', $p['id'],
                        $p['caption'] ?? '', $p['media_url'] ?? $p['thumbnail_url'] ?? '',
                        $p['media_type'] ?? 'IMAGE', $ts, $autoPublish);
                    if ($new) $log['new']++;
                    $log['found']++;
                }
                
                if ($url && isset($data['paging']['next'])) {
                    $url = $data['paging']['next'];
                    $params = []; // The next URL already contains parameters and tokens
                } else {
                    break;
                }
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
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

    // ── Facebook ───────────────────────────────────────────────────────────
    public static function facebook(int $userId, string $token, int $maxPosts = 20, ?string $sinceDate = null, int $autoPublish = 1): array {
        $log = ['platform' => 'facebook', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $pages = self::get('https://graph.facebook.com/v18.0/me/accounts',
                '', ['access_token' => $token]);
            $page = $pages['data'][0] ?? null;
            if (!$page) throw new Exception('Nessuna pagina Facebook trovata');

            $url = "https://graph.facebook.com/v18.0/{$page['id']}/posts";
            $params = [
                'fields'       => 'id,message,story,created_time,full_picture',
                'limit'        => min(50, $maxPosts),
                'access_token' => $page['access_token'],
            ];

            while ($url && $log['found'] < $maxPosts) {
                $data = self::get($url, '', $params);
                $posts = $data['data'] ?? [];
                if (empty($posts)) break;
                
                foreach ($posts as $p) {
                    if ($log['found'] >= $maxPosts) break;
                    
                    $ts = $p['created_time'] ?? date('Y-m-d H:i:s');
                    if ($sinceDate && strtotime($ts) < strtotime($sinceDate)) {
                        $url = null;
                        break;
                    }

                    $mediaUrl = $p['full_picture'] ?? '';
                    $mediaType = $mediaUrl ? 'IMAGE' : 'text';
                    
                    $new = self::process($userId, 'facebook', $p['id'],
                        $p['message'] ?? $p['story'] ?? '',
                        $mediaUrl, $mediaType, $ts, $autoPublish);
                    if ($new) $log['new']++;
                    $log['found']++;
                }

                if ($url && isset($data['paging']['next'])) {
                    $url = $data['paging']['next'];
                    $params = [];
                } else {
                    break;
                }
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── Sync completo utente ───────────────────────────────────────────────
    public static function syncUser(int $userId, int $maxPosts = 20, ?string $sinceDate = null): array {
        $connections = DB::fetchAll(
            'SELECT * FROM social_connections WHERE user_id=? AND active=1', [$userId]
        );
        $results = [];
        foreach ($connections as $conn) {
            $token  = Crypto::decrypt($conn['access_token']);
            $connSinceDate = !empty($conn['since_date']) ? $conn['since_date'] : $sinceDate;
            $autoPublish = (int)($conn['auto_publish'] ?? 1);
            $result = match($conn['platform']) {
                'instagram' => self::instagram($userId, $token, $maxPosts, $connSinceDate, $autoPublish),
                'tiktok'    => self::tiktok($userId, $token, $maxPosts, $connSinceDate, $autoPublish),
                'youtube'   => self::youtube($userId, $token, $maxPosts, $connSinceDate, $autoPublish),
                'facebook'  => self::facebook($userId, $token, $maxPosts, $connSinceDate, $autoPublish),
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
        }
        $totalNew = 0;
        foreach ($results as $res) {
            $totalNew += $res['new'] ?? 0;
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
            self::pingGoogle($userId);
        }

        return $results;
    }

    public static function pingGoogle(int $userId): void {
        $user = DB::fetch('SELECT slug FROM users WHERE id=?', [$userId]);
        if ($user && !empty($user['slug'])) {
            $sitemapUrl = BASE_URL . "/s/" . $user['slug'] . "/sitemap.xml";
            $pingUrl = "http://www.google.com/ping?sitemap=" . urlencode($sitemapUrl);
            $ch = curl_init($pingUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_exec($ch);
            curl_close($ch);
        }
    }
}
