<?php
require_once __DIR__ . '/publication/wordpress.php';
require_once __DIR__ . '/post_media.php';

/** Connector settings use the existing system_settings store; no schema migration. */
final class WordPressBridge {
    public static function crypt(string $value, bool $decrypt = false): string {
        $key = hash('sha256', 'wordpress-bridge:' . JWT_SECRET, true);
        if ($decrypt) {
            $raw = base64_decode($value, true);
            if ($raw === false || strlen($raw) < 29) throw new RuntimeException('Credenziale non valida.');
            $result = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        } else {
            $iv = random_bytes(12); $tag = '';
            $result = openssl_encrypt($value, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
            if ($result !== false) return base64_encode($iv . $tag . $result);
        }
        if ($result === false) throw new RuntimeException('Credenziale non decifrabile.');
        return $result;
    }

    public static function load(int $userId): array {
        $row = DB::fetch('SELECT key_value FROM system_settings WHERE key_name=?', ['wordpress_bridge_' . $userId]);
        return json_decode($row['key_value'] ?? '{}', true) ?: [];
    }

    public static function save(int $userId, array $settings): void {
        $json = json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($json) > 60000) throw new DomainException('Troppi abbinamenti: riduci la configurazione.');
        DB::execute('INSERT INTO system_settings (key_name,key_value) VALUES (?,?) ON DUPLICATE KEY UPDATE key_value=VALUES(key_value)', ['wordpress_bridge_' . $userId, $json]);
    }

    public static function remote(array $settings, string $method, string $route, ?array $payload = null): array {
        if (empty($settings['endpoint']) || empty($settings['secret'])) throw new DomainException('Collega prima WordPress.');
        return WordPressPublicationAdapter::request(['endpoint'=>$settings['endpoint'], '_secret'=>self::crypt($settings['secret'], true)], $method, $route, $payload);
    }

    public static function topics(int $userId): array {
        $topics = [];
        foreach (DB::fetchAll('SELECT tags FROM posts WHERE user_id=?', [$userId]) as $row) {
            $tags = json_decode($row['tags'] ?? '[]', true);
            if (!is_array($tags)) $tags = explode(',', $row['tags'] ?? '');
            foreach ($tags as $tag) if (is_string($tag) && trim($tag) !== '') $topics[trim($tag)] = true;
        }
        $topics = array_keys($topics); natcasesort($topics);
        return array_values($topics);
    }

    public static function feedToken(int $userId, string $secret): string {
        return hash_hmac('sha256', 'wordpress-feed:' . $userId, $secret);
    }

    public static function settingsPayload(int $userId, array $connection, array $options): array {
        $base = app_base_url();
        if (!str_starts_with($base, 'https://')) throw new DomainException('Per collegare l’archivio WordPress usa AllSocialToWeb dal suo indirizzo HTTPS. Il collegamento non è completo finché il feed non è configurato.');
        return [
            'feed_url'=>$base . '/api/wordpress-feed.php?user_id=' . $userId,
            'feed_token'=>self::feedToken($userId, self::crypt($connection['secret'], true)),
            'enabled'=>!empty($options['enabled']),
            'post_status'=>($options['post_status'] ?? '') === 'publish' ? 'publish' : 'draft',
            'category_id'=>(int)($options['category_id'] ?? 0),
            'mappings'=>$options['mappings'] ?? [],
            'filters'=>self::filters(is_array($options['filters'] ?? null) ? $options['filters'] : ['scope'=>'all']),
        ];
    }

    public static function configure(int $userId, array $connection, array $options): array {
        $result = self::remote($connection, 'POST', '/sync-settings', self::settingsPayload($userId, $connection, $options));
        if (empty($result['ok']) || empty($result['archive_available'])) throw new DomainException('Il plugin non ha confermato la configurazione dell’archivio. Aggiorna il plugin WordPress e riprova.');
        return $result;
    }

    public static function ready(array $health): bool {
        // Older supported plugins expose post_status only after saving the complete feed settings.
        return array_key_exists('feed_ready', $health) ? !empty($health['feed_ready']) : !empty($health['settings']['post_status']);
    }

    public static function filters(array $input): array {
        $scope = $input['scope'] ?? 'published';
        if (!in_array($scope, ['all','published','drafts'], true)) throw new DomainException('Seleziona un archivio valido.');
        $platforms = $input['platforms'] ?? [];
        if (!is_array($platforms) || count($platforms) > 30) throw new DomainException('Seleziona le fonti da sincronizzare.');
        foreach ($platforms as $platform) if (!is_string($platform) || !preg_match('/^[a-z0-9_-]{1,50}$/i', $platform)) throw new DomainException('Fonte non valida.');
        $dates = [];
        foreach (['since_date','until_date'] as $field) {
            $date = $input[$field] ?? '';
            if (!is_string($date)) throw new DomainException('Data non valida.');
            if ($date !== '') {
                $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
                if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new DomainException('Data non valida.');
            }
            $dates[$field] = $date;
        }
        if ($dates['since_date'] && $dates['until_date'] && $dates['since_date'] > $dates['until_date']) throw new DomainException('La data finale deve seguire quella iniziale.');
        return ['scope'=>$scope, 'platforms'=>array_values(array_unique($platforms)), 'batch_size'=>max(1, min(20, (int)($input['batch_size'] ?? 20)))] + $dates;
    }

    public static function archive(int $userId): array {
        $total = 0; $published = 0; $platforms = [];
        foreach (DB::fetchAll('SELECT platform,published,COUNT(*) total FROM posts WHERE user_id=? GROUP BY platform,published', [$userId]) as $row) {
            $total += (int)$row['total'];
            if (!empty($row['published'])) $published += (int)$row['total'];
            $platforms[(string)$row['platform']] = true;
        }
        return ['total'=>$total, 'published'=>$published, 'drafts'=>$total-$published, 'platforms'=>array_keys($platforms)];
    }

    public static function feed(int $userId, int $cursor, array $input = []): array {
        $filters = self::filters($input);
        $sql = 'SELECT * FROM posts WHERE user_id=? AND id>?';
        $params = [$userId, max(0, $cursor)];
        if ($filters['scope'] === 'published') $sql .= ' AND published=1';
        if ($filters['scope'] === 'drafts') $sql .= ' AND published=0';
        if ($filters['platforms']) {
            $sql .= ' AND platform IN (' . implode(',', array_fill(0, count($filters['platforms']), '?')) . ')';
            array_push($params, ...$filters['platforms']);
        }
        if ($filters['since_date']) { $sql .= ' AND COALESCE(published_at,imported_at)>=?'; $params[] = $filters['since_date'] . ' 00:00:00'; }
        if ($filters['until_date']) { $sql .= ' AND COALESCE(published_at,imported_at)<?'; $params[] = (new DateTimeImmutable($filters['until_date']))->modify('+1 day')->format('Y-m-d') . ' 00:00:00'; }
        $size = $filters['batch_size'];
        $rows = DB::fetchAll($sql . ' ORDER BY id LIMIT ' . ($size + 1), $params);
        $more = count($rows) > $size; $rows = array_slice($rows, 0, $size);
        $posts = [];
        foreach ($rows as $row) {
            $cursor = (int)$row['id'];
            $raw = trim((string)($row['transcript'] ?? '')) ?: trim((string)($row['raw_content'] ?? ''));
            $title = trim(strip_tags(($row['edited_title'] ?? '') ?: ($row['generated_title'] ?? '')));
            if ($title === '' && $raw !== '') {
                $plain = preg_replace('/\s+/u', ' ', strip_tags($raw)) ?? '';
                $title = function_exists('mb_substr') ? mb_substr($plain, 0, 100) : substr($plain, 0, 100);
            }
            $html = trim(($row['edited_body'] ?? '') ?: ($row['generated_body'] ?? ''));
            if ($html === '' && $raw !== '') $html = '<p>' . nl2br(htmlspecialchars($raw, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) . '</p>';
            $row = PostMedia::hydrate($row);
            $hasMedia = PostMedia::url($row['media_url'] ?? '') !== '' || !empty($row['image_urls']);
            if ($title === '' && $hasMedia) $title = 'Contenuto ' . ucfirst((string)($row['platform'] ?? 'social')) . ' ' . $row['id'];
            if (trim(strip_tags($html)) === '' && $hasMedia) {
                $source = PostMedia::url($row['source_url'] ?? '');
                $html = '<p>' . htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '</p>';
                if ($source !== '') $html .= '<p><a href="' . htmlspecialchars($source, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">Apri il contenuto originale</a></p>';
            }
            if ($title === '' || trim(strip_tags($html)) === '') continue;
            $tags = json_decode($row['tags'] ?? '[]', true);
            if (!is_array($tags)) $tags = explode(',', $row['tags'] ?? '');
            $posts[] = [
                'key'=>hash('sha256', app_base_url() . ':' . $userId . ':' . $row['id']),
                'title'=>$title, 'html'=>$html,
                'excerpt'=>strip_tags(($row['edited_excerpt'] ?? '') ?: ($row['generated_excerpt'] ?? '')),
                'id'=>(int)$row['id'], 'platform'=>$row['platform'] ?? '', 'published'=>!empty($row['published']),
                'topics'=>array_values(array_filter($tags, 'is_string')),
                'media_url'=>PostMedia::url($row['media_url'] ?? ''), 'media_type'=>$row['media_type'] ?? '',
                'image_urls'=>$row['image_urls'], 'poster_url'=>$row['poster_url'],
                'source_url'=>PostMedia::url($row['source_url'] ?? ''), 'media_html'=>PostMedia::render($row, $title),
            ];
        }
        return ['posts'=>$posts, 'next_cursor'=>$more ? $cursor : 0, 'has_more'=>$more];
    }
}
