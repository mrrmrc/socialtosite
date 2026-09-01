<?php

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../middleware/crypto.php';
require_once __DIR__ . '/social_oauth.php';

final class Sync {
    private static function credential(string $name): string {
        $runtimeName = 'SOCIALTOSITE_RUNTIME_' . $name;
        $value = defined($runtimeName) ? trim((string)constant($runtimeName)) : '';
        if ($value === '' && defined($name)) $value = trim((string)constant($name));
        if ($value === '') throw new RuntimeException($name . ' non configurato sul server');
        return $value;
    }

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
        // Le vecchie sorgenti social basate su URL non sono più eseguibili.
        try { DB::execute("UPDATE social_sources SET active=0 WHERE platform IN ('facebook','instagram','tiktok','youtube')"); } catch (Throwable $e) {}
        try { DB::execute("UPDATE social_connections SET active=0, access_token='', refresh_token=NULL, expires_at=NULL WHERE platform='instagram_login'"); } catch (Throwable $e) {}
    }

    private static function connectionToken(array &$connection): string {
        $token = Crypto::decrypt((string)($connection['access_token'] ?? ''));
        if ($token === '') throw new RuntimeException('Token non disponibile: ricollega il canale.');
        $expires = !empty($connection['expires_at']) ? strtotime((string)$connection['expires_at']) : null;
        if ($connection['platform'] === 'facebook') {
            if ($expires !== null && $expires <= time() + 600) throw new RuntimeException('Autorizzazione Facebook scaduta: ricollega la Pagina.');
            return $token;
        }
        if ($expires === null || $expires > time() + 600) return $token;

        $platform = (string)$connection['platform'];
        if ($platform === 'instagram') {
            $response = SocialHttp::request('GET', 'https://graph.instagram.com/refresh_access_token', ['query' => [
                'grant_type' => 'ig_refresh_token', 'access_token' => $token,
            ]]);
        } elseif ($platform === 'tiktok') {
            $refresh = Crypto::decrypt((string)($connection['refresh_token'] ?? ''));
            if ($refresh === '') throw new RuntimeException('Autorizzazione TikTok scaduta: ricollega il canale.');
            $response = SocialHttp::request('POST', 'https://open.tiktokapis.com/v2/oauth/token/', [
                'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
                'form' => [
                    'client_key' => self::credential('TIKTOK_CLIENT_KEY'),
                    'client_secret' => self::credential('TIKTOK_CLIENT_SECRET'),
                    'grant_type' => 'refresh_token', 'refresh_token' => $refresh,
                ],
            ]);
        } elseif ($platform === 'youtube') {
            $refresh = Crypto::decrypt((string)($connection['refresh_token'] ?? ''));
            if ($refresh === '') throw new RuntimeException('Autorizzazione YouTube scaduta: ricollega il canale.');
            $response = SocialHttp::request('POST', 'https://oauth2.googleapis.com/token', [
                'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
                'form' => [
                    'client_id' => self::credential('GOOGLE_CLIENT_ID'), 'client_secret' => self::credential('GOOGLE_CLIENT_SECRET'),
                    'grant_type' => 'refresh_token', 'refresh_token' => $refresh,
                ],
            ]);
        } else {
            return $token;
        }

        $token = (string)($response['access_token'] ?? '');
        if ($token === '') throw new RuntimeException('Il provider non ha rinnovato il token.');
        $newRefresh = (string)($response['refresh_token'] ?? '');
        $expiresAt = date('Y-m-d H:i:s', time() + (int)($response['expires_in'] ?? ($platform === 'instagram' ? 5184000 : 3600)));
        DB::execute(
            'UPDATE social_connections SET access_token=?, refresh_token=COALESCE(?,refresh_token), expires_at=? WHERE id=?',
            [Crypto::encrypt($token), $newRefresh !== '' ? Crypto::encrypt($newRefresh) : null, $expiresAt, $connection['id']]
        );
        $connection['access_token'] = Crypto::encrypt($token);
        $connection['expires_at'] = $expiresAt;
        return $token;
    }

    private static function normalizeDate(?string $value): string {
        $timestamp = $value ? strtotime($value) : false;
        return $timestamp ? date('Y-m-d H:i:s', $timestamp) : date('Y-m-d H:i:s');
    }

    private static function savePost(int $userId, string $platform, array $item, int $autoPublish): bool {
        $postId = trim((string)($item['id'] ?? ''));
        $sourceUrl = trim((string)($item['source_url'] ?? ''));
        $text = trim((string)($item['text'] ?? ''));
        if ($postId === '' || ($text === '' && $sourceUrl === '')) return false;
        if (DB::fetch('SELECT id FROM posts WHERE user_id=? AND platform=? AND platform_post_id=? LIMIT 1', [$userId, $platform, $postId])) return false;

        $mediaUrl = trim((string)($item['media_url'] ?? ''));
        $mediaType = strtolower((string)($item['media_type'] ?? ''));
        if ($mediaUrl !== '' && in_array($mediaType, ['image', 'video'], true) && !($platform === 'youtube' && $mediaType === 'video')) {
            require_once __DIR__ . '/ingest.php';
            $saved = Ingest::saveMedia($mediaUrl, $platform, $postId, $mediaType === 'video' ? 'mp4' : 'jpg');
            if ($saved && !empty($saved['url'])) $mediaUrl = (string)$saved['url'];
        }
        $publishedAt = self::normalizeDate($item['published_at'] ?? null);
        $contentHash = hash('sha256', $platform . '|' . $postId . '|' . $text);
        DB::execute(
            'INSERT INTO posts (user_id,platform,platform_post_id,raw_content,transcript,generated_title,generated_body,generated_excerpt,tags,meta_description,media_url,media_type,source_url,published_at,content_hash,seo_score,processing_status,slug,published)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$userId,$platform,$postId,$text,'','','','',json_encode([]),'',$mediaUrl,$mediaType ?: 'text',$sourceUrl,$publishedAt,$contentHash,-1,'pending','',$autoPublish]
        );
        return true;
    }

    private static function withinDate(string $publishedAt, ?string $sinceDate): bool {
        return !$sinceDate || strtotime($publishedAt) >= strtotime($sinceDate);
    }

    private static function facebook(array &$connection, int $limit, ?string $sinceDate, int $autoPublish): array {
        $token = self::connectionToken($connection);
        $pageId = (string)$connection['platform_uid'];
        if ($pageId === '') throw new RuntimeException('Identificativo Pagina Facebook mancante.');
        $items = [];
        $url = SocialOAuth::facebookGraphBase() . '/' . rawurlencode($pageId) . '/posts';
        $query = [
            'fields' => 'id,message,story,created_time,permalink_url,full_picture,attachments{media_type,media,target,url,subattachments}',
            'limit' => min(100, max(1, $limit)), 'access_token' => $token,
        ];
        $pages = 0;
        while ($url !== '' && count($items) < $limit && $pages++ < 10) {
            $response = SocialHttp::request('GET', $url, ['query' => $query]);
            $query = [];
            foreach (($response['data'] ?? []) as $post) {
                $date = self::normalizeDate($post['created_time'] ?? null);
                if (!self::withinDate($date, $sinceDate)) continue;
                $attachment = $post['attachments']['data'][0] ?? [];
                $image = (string)($post['full_picture'] ?? $attachment['media']['image']['src'] ?? '');
                $items[] = [
                    'id' => (string)($post['id'] ?? ''), 'text' => (string)($post['message'] ?? $post['story'] ?? ''),
                    'source_url' => (string)($post['permalink_url'] ?? $attachment['url'] ?? ''),
                    'media_url' => $image, 'media_type' => $image !== '' ? 'image' : 'text', 'published_at' => $date,
                ];
                if (count($items) >= $limit) break;
            }
            $url = count($items) < $limit ? (string)($response['paging']['next'] ?? '') : '';
        }
        return self::persistItems((int)$connection['user_id'], 'facebook', $items, $autoPublish);
    }

    private static function instagram(array &$connection, int $limit, ?string $sinceDate, int $autoPublish): array {
        $token = self::connectionToken($connection);
        $items = [];
        $url = 'https://graph.instagram.com/me/media';
        $query = [
            'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}',
            'limit' => min(100, max(1, $limit)), 'access_token' => $token,
        ];
        $pages = 0;
        while ($url !== '' && count($items) < $limit && $pages++ < 10) {
            $response = SocialHttp::request('GET', $url, ['query' => $query]);
            $query = [];
            foreach (($response['data'] ?? []) as $media) {
                $date = self::normalizeDate($media['timestamp'] ?? null);
                if (!self::withinDate($date, $sinceDate)) continue;
                $type = strtoupper((string)($media['media_type'] ?? ''));
                $mediaUrl = (string)($media['media_url'] ?? $media['thumbnail_url'] ?? '');
                if ($mediaUrl === '' && !empty($media['children']['data'][0])) {
                    $child = $media['children']['data'][0];
                    $type = strtoupper((string)($child['media_type'] ?? $type));
                    $mediaUrl = (string)($child['media_url'] ?? $child['thumbnail_url'] ?? '');
                }
                $items[] = [
                    'id' => (string)($media['id'] ?? ''), 'text' => (string)($media['caption'] ?? ''),
                    'source_url' => (string)($media['permalink'] ?? ''), 'media_url' => $mediaUrl,
                    'media_type' => $mediaUrl !== '' ? ($type === 'VIDEO' ? 'video' : 'image') : 'text', 'published_at' => $date,
                ];
                if (count($items) >= $limit) break;
            }
            $url = count($items) < $limit ? (string)($response['paging']['next'] ?? '') : '';
        }
        return self::persistItems((int)$connection['user_id'], 'instagram', $items, $autoPublish);
    }

    private static function tiktok(array &$connection, int $limit, ?string $sinceDate, int $autoPublish): array {
        $token = self::connectionToken($connection);
        $items = [];
        $cursor = 0;
        $pages = 0;
        do {
            $response = SocialHttp::request('POST', 'https://open.tiktokapis.com/v2/video/list/', [
                'headers' => ['Accept: application/json', 'Content-Type: application/json', 'Authorization: Bearer ' . $token],
                'query' => ['fields' => 'id,title,video_description,create_time,cover_image_url,share_url'],
                'json' => ['max_count' => min(20, max(1, $limit - count($items))), 'cursor' => $cursor],
            ]);
            $data = $response['data'] ?? [];
            foreach (($data['videos'] ?? []) as $video) {
                $date = self::normalizeDate(isset($video['create_time']) ? '@' . $video['create_time'] : null);
                if (!self::withinDate($date, $sinceDate)) continue;
                $items[] = [
                    'id' => (string)($video['id'] ?? ''), 'text' => (string)($video['video_description'] ?? $video['title'] ?? ''),
                    'source_url' => (string)($video['share_url'] ?? ''), 'media_url' => (string)($video['cover_image_url'] ?? ''),
                    'media_type' => !empty($video['cover_image_url']) ? 'image' : 'text', 'published_at' => $date,
                ];
                if (count($items) >= $limit) break;
            }
            $cursor = (int)($data['cursor'] ?? 0);
            $hasMore = !empty($data['has_more']) && count($items) < $limit;
        } while ($hasMore && ++$pages < 10);
        return self::persistItems((int)$connection['user_id'], 'tiktok', $items, $autoPublish);
    }

    private static function youtube(array &$connection, int $limit, ?string $sinceDate, int $autoPublish): array {
        $token = self::connectionToken($connection);
        $channelId = (string)$connection['platform_uid'];
        $channel = SocialHttp::request('GET', 'https://www.googleapis.com/youtube/v3/channels', [
            'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
            'query' => ['part' => 'contentDetails', 'id' => $channelId],
        ]);
        $playlistId = (string)($channel['items'][0]['contentDetails']['relatedPlaylists']['uploads'] ?? '');
        if ($playlistId === '') throw new RuntimeException('Playlist upload YouTube non trovata.');
        $items = [];
        $pageToken = '';
        $pages = 0;
        do {
            $query = ['part' => 'snippet,contentDetails', 'playlistId' => $playlistId, 'maxResults' => min(50, max(1, $limit - count($items)))];
            if ($pageToken !== '') $query['pageToken'] = $pageToken;
            $response = SocialHttp::request('GET', 'https://www.googleapis.com/youtube/v3/playlistItems', [
                'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token], 'query' => $query,
            ]);
            foreach (($response['items'] ?? []) as $entry) {
                $snippet = $entry['snippet'] ?? [];
                $videoId = (string)($entry['contentDetails']['videoId'] ?? $snippet['resourceId']['videoId'] ?? '');
                $date = self::normalizeDate($entry['contentDetails']['videoPublishedAt'] ?? $snippet['publishedAt'] ?? null);
                if (!self::withinDate($date, $sinceDate)) continue;
                $watchUrl = 'https://www.youtube.com/watch?v=' . rawurlencode($videoId);
                $items[] = [
                    'id' => $videoId, 'text' => trim((string)($snippet['title'] ?? '') . "\n\n" . (string)($snippet['description'] ?? '')),
                    'source_url' => $watchUrl, 'media_url' => $watchUrl,
                    'media_type' => 'video', 'published_at' => $date,
                ];
                if (count($items) >= $limit) break;
            }
            $pageToken = count($items) < $limit ? (string)($response['nextPageToken'] ?? '') : '';
        } while ($pageToken !== '' && ++$pages < 10);
        return self::persistItems((int)$connection['user_id'], 'youtube', $items, $autoPublish);
    }

    private static function persistItems(int $userId, string $platform, array $items, int $autoPublish): array {
        $new = 0;
        foreach ($items as $item) if (self::savePost($userId, $platform, $item, $autoPublish)) $new++;
        return ['platform' => $platform, 'found' => count($items), 'new' => $new, 'error' => null];
    }

    private static function logResult(int $userId, array $result): void {
        try {
            DB::execute(
                'INSERT INTO sync_log (user_id,platform,status,posts_found,posts_new,error,ran_at) VALUES (?,?,?,?,?,?,NOW())',
                [
                    $userId,
                    (string)($result['platform'] ?? ''),
                    empty($result['error']) ? 'success' : 'error',
                    (int)($result['found'] ?? 0),
                    (int)($result['new'] ?? 0),
                    $result['error'] ?? null,
                ]
            );
        } catch (Throwable $e) {}
    }

    public static function syncUser(int $userId, int $maxPosts = 20, ?string $sinceDate = null, bool $automatic = false): array {
        self::ensureAutoSyncSchema();
        $connections = DB::fetchAll('SELECT * FROM social_connections WHERE user_id=? AND active=1' . ($automatic ? ' AND auto_sync=1' : ''), [$userId]);
        $results = [];
        foreach ($connections as &$connection) {
            $platform = (string)$connection['platform'];
            $limit = max(1, min(500, (int)($connection['max_posts'] ?: $maxPosts)));
            $effectiveSince = !empty($connection['since_date']) ? (string)$connection['since_date'] : $sinceDate;
            $autoPublish = (int)($connection['auto_publish'] ?? 1);
            try {
                if (function_exists('setSyncStatus')) setSyncStatus($userId, 'Sincronizzazione ' . ucfirst($platform) . '…');
                $result = match ($platform) {
                    'facebook' => self::facebook($connection, $limit, $effectiveSince, $autoPublish),
                    'instagram' => self::instagram($connection, $limit, $effectiveSince, $autoPublish),
                    'tiktok' => self::tiktok($connection, $limit, $effectiveSince, $autoPublish),
                    'youtube' => self::youtube($connection, $limit, $effectiveSince, $autoPublish),
                    default => null,
                };
                if ($result) { $results[] = $result; self::logResult($userId, $result); }
            } catch (Throwable $e) {
                $error = mb_substr($e->getMessage(), 0, 1500);
                $result = ['platform' => $platform, 'found' => 0, 'new' => 0, 'error' => $error];
                $results[] = $result;
                self::logResult($userId, $result);
            }
        }
        unset($connection);

        require_once __DIR__ . '/ingest.php';
        $websiteSources = DB::fetchAll("SELECT id FROM social_sources WHERE user_id=? AND active=1 AND platform='website'" . ($automatic ? ' AND auto_sync=1' : ''), [$userId]);
        foreach ($websiteSources as $source) {
            try {
                $report = Ingest::scanSources($userId, $maxPosts, '', '', '', (int)$source['id']);
                $result = ['platform' => 'website', 'found' => (int)($report['found'] ?? 0), 'new' => (int)($report['imported'] ?? 0), 'error' => !empty($report['errors']) ? implode(' | ', $report['errors']) : null];
                $results[] = $result; self::logResult($userId, $result);
            } catch (Throwable $e) {
                $result = ['platform' => 'website', 'found' => 0, 'new' => 0, 'error' => mb_substr($e->getMessage(), 0, 1500)];
                $results[] = $result;
                self::logResult($userId, $result);
            }
        }
        try {
            $site = DB::fetch('SELECT cover_url FROM sites WHERE user_id=?', [$userId]);
            if (empty($site['cover_url'])) {
                $latestImage = DB::fetch("SELECT media_url FROM posts WHERE user_id=? AND UPPER(media_type)='IMAGE' AND media_url<>'' ORDER BY published_at DESC LIMIT 1", [$userId]);
                if (!empty($latestImage['media_url'])) DB::execute('UPDATE sites SET cover_url=? WHERE user_id=?', [$latestImage['media_url'], $userId]);
            }
            $score = DB::fetch('SELECT AVG(seo_score) average FROM posts WHERE user_id=? AND published=1 AND seo_score>=0', [$userId]);
            DB::execute('UPDATE sites SET last_sync=NOW(), seo_score=? WHERE user_id=?', [round((float)($score['average'] ?? 0)), $userId]);
        } catch (Throwable $e) {}
        if (function_exists('setSyncStatus')) setSyncStatus($userId, 'Sincronizzazione completata.');
        return $results;
    }

}
