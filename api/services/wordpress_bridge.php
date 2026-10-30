<?php
require_once __DIR__ . '/publication/wordpress.php';

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

    public static function feed(int $userId, int $cursor): array {
        $rows = DB::fetchAll('SELECT * FROM posts WHERE user_id=? AND published=1 AND seo_score>=0 AND id>? ORDER BY id LIMIT 21', [$userId, max(0, $cursor)]);
        $more = count($rows) > 20; $rows = array_slice($rows, 0, 20);
        $posts = [];
        foreach ($rows as $row) {
            $cursor = (int)$row['id'];
            $title = trim(strip_tags($row['edited_title'] ?: ($row['generated_title'] ?? '')));
            $html = trim($row['edited_body'] ?: ($row['generated_body'] ?? ''));
            if ($title === '' || trim(strip_tags($html)) === '') continue;
            $tags = json_decode($row['tags'] ?? '[]', true);
            if (!is_array($tags)) $tags = explode(',', $row['tags'] ?? '');
            $posts[] = [
                'key'=>hash('sha256', app_base_url() . ':' . $userId . ':' . $row['id']),
                'title'=>$title, 'html'=>$html,
                'excerpt'=>strip_tags($row['edited_excerpt'] ?: ($row['generated_excerpt'] ?? '')),
                'topics'=>array_values(array_filter($tags, 'is_string')),
            ];
        }
        return ['posts'=>$posts, 'next_cursor'=>$more ? $cursor : 0, 'has_more'=>$more];
    }
}
