<?php
// api/services/sync.php — Importa contenuti social, trascrive, genera SEO
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/../middleware/response.php';

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
    private static function upsert(int $userId, string $platform, string $postId, array $d): bool {
        $exists = DB::fetch(
            'SELECT id FROM posts WHERE user_id=? AND platform=? AND platform_post_id=?',
            [$userId, $platform, $postId]
        );
        if ($exists) return false;

        DB::execute('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               generated_title, generated_body, generated_excerpt, tags,
               meta_description, media_url, media_type, published_at, seo_score, slug)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
        ]);
        return true;
    }

    // ── Processa un contenuto: trascrive se video, genera SEO ─────────────
    private static function process(int $userId, string $platform, string $postId,
                                    string $caption, string $mediaUrl, string $mediaType,
                                    string $publishedAt): bool {
        $transcript = '';
        if ($mediaUrl && strtoupper($mediaType) === 'VIDEO') {
            $transcript = AI::transcribeUrl($mediaUrl);
        }

        $raw  = $transcript ?: $caption;
        $seo  = strlen($raw) > 30
            ? AI::generateSeo($raw, $platform, $caption)
            : ['title' => mb_substr($caption, 0, 60), 'body' => $caption,
               'excerpt' => mb_substr($caption, 0, 155), 'tags' => [],
               'meta_description' => mb_substr($caption, 0, 155), 'seo_score' => 40];

        return self::upsert($userId, $platform, $postId, array_merge($seo, [
            'raw_content'  => $caption,
            'transcript'   => $transcript,
            'media_url'    => $mediaUrl,
            'media_type'   => $mediaType,
            'published_at' => $publishedAt,
        ]));
    }

    // ── Instagram ──────────────────────────────────────────────────────────
    public static function instagram(int $userId, string $token): array {
        $log = ['platform' => 'instagram', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $profile = self::get('https://graph.facebook.com/v18.0/me',
                '', ['fields' => 'instagram_business_account', 'access_token' => $token]);
            $igId = $profile['instagram_business_account']['id'] ?? null;
            if (!$igId) throw new Exception('Nessun account Instagram Business');

            $data = self::get("https://graph.facebook.com/v18.0/$igId/media", '', [
                'fields'       => 'id,caption,media_type,media_url,thumbnail_url,timestamp',
                'limit'        => 20,
                'access_token' => $token,
            ]);
            $posts = $data['data'] ?? [];
            $log['found'] = count($posts);
            foreach ($posts as $p) {
                $new = self::process($userId, 'instagram', $p['id'],
                    $p['caption'] ?? '', $p['media_url'] ?? $p['thumbnail_url'] ?? '',
                    $p['media_type'] ?? 'IMAGE', $p['timestamp'] ?? date('Y-m-d H:i:s'));
                if ($new) $log['new']++;
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── TikTok ─────────────────────────────────────────────────────────────
    public static function tiktok(int $userId, string $token): array {
        $log = ['platform' => 'tiktok', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $ch = curl_init('https://open.tiktokapis.com/v2/video/list/');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_HTTPHEADER     => ["Authorization: Bearer $token", 'Content-Type: application/json'],
                CURLOPT_POSTFIELDS     => json_encode(['max_count' => 20,
                    'fields' => ['id','title','video_description','create_time','cover_image_url']]),
                CURLOPT_TIMEOUT        => 30,
            ]);
            $res    = curl_exec($ch); curl_close($ch);
            $videos = json_decode($res, true)['data']['videos'] ?? [];
            $log['found'] = count($videos);
            foreach ($videos as $v) {
                $new = self::process($userId, 'tiktok', $v['id'],
                    $v['video_description'] ?? $v['title'] ?? '',
                    '', 'VIDEO',
                    date('Y-m-d H:i:s', $v['create_time'] ?? time()));
                if ($new) $log['new']++;
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── YouTube ────────────────────────────────────────────────────────────
    public static function youtube(int $userId, string $token): array {
        $log = ['platform' => 'youtube', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $ch = self::get('https://www.googleapis.com/youtube/v3/channels',
                $token, ['part' => 'contentDetails', 'mine' => 'true']);
            $uploadId = $ch['items'][0]['contentDetails']['relatedPlaylists']['uploads'] ?? null;
            if (!$uploadId) throw new Exception('Nessun canale trovato');

            $items = self::get('https://www.googleapis.com/youtube/v3/playlistItems',
                $token, ['part' => 'snippet', 'playlistId' => $uploadId, 'maxResults' => 20]);
            $videos = $items['items'] ?? [];
            $log['found'] = count($videos);
            foreach ($videos as $item) {
                $sn  = $item['snippet'] ?? [];
                $vid = $sn['resourceId']['videoId'] ?? null;
                if (!$vid) continue;
                $new = self::process($userId, 'youtube', $vid,
                    ($sn['description'] ?? '') ?: ($sn['title'] ?? ''),
                    "https://www.youtube.com/watch?v=$vid", 'VIDEO',
                    $sn['publishedAt'] ?? date('Y-m-d H:i:s'));
                if ($new) $log['new']++;
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── Facebook ───────────────────────────────────────────────────────────
    public static function facebook(int $userId, string $token): array {
        $log = ['platform' => 'facebook', 'found' => 0, 'new' => 0, 'error' => null];
        try {
            $pages = self::get('https://graph.facebook.com/v18.0/me/accounts',
                '', ['access_token' => $token]);
            $page = $pages['data'][0] ?? null;
            if (!$page) throw new Exception('Nessuna pagina Facebook trovata');

            $data  = self::get("https://graph.facebook.com/v18.0/{$page['id']}/posts", '', [
                'fields'       => 'id,message,story,created_time',
                'limit'        => 20,
                'access_token' => $page['access_token'],
            ]);
            $posts = $data['data'] ?? [];
            $log['found'] = count($posts);
            foreach ($posts as $p) {
                $new = self::process($userId, 'facebook', $p['id'],
                    $p['message'] ?? $p['story'] ?? '',
                    '', 'text', $p['created_time'] ?? date('Y-m-d H:i:s'));
                if ($new) $log['new']++;
            }
        } catch (Exception $e) { $log['error'] = $e->getMessage(); }
        return $log;
    }

    // ── Sync completo utente ───────────────────────────────────────────────
    public static function syncUser(int $userId): array {
        $connections = DB::fetchAll(
            'SELECT * FROM social_connections WHERE user_id=? AND active=1', [$userId]
        );
        $results = [];
        foreach ($connections as $conn) {
            $result = match($conn['platform']) {
                'instagram' => self::instagram($userId, $conn['access_token']),
                'tiktok'    => self::tiktok($userId, $conn['access_token']),
                'youtube'   => self::youtube($userId, $conn['access_token']),
                'facebook'  => self::facebook($userId, $conn['access_token']),
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
        // Aggiorna score SEO sito
        $scores = DB::fetchAll('SELECT seo_score FROM posts WHERE user_id=? AND published=1', [$userId]);
        if ($scores) {
            $avg = array_sum(array_column($scores, 'seo_score')) / count($scores);
            DB::execute('UPDATE sites SET last_sync=NOW(), seo_score=? WHERE user_id=?',
                [round($avg), $userId]);
        }
        return $results;
    }
}
