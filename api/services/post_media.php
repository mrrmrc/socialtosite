<?php
/** Gallery/poster metadata alongside uploaded media, without changing the database schema. */
final class PostMedia {
    public static function url($value): string {
        if (!is_string($value)) return '';
        $value = html_entity_decode(trim($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (str_starts_with($value, '/public/media/') && !str_contains($value, '..')) return $value;
        return filter_var($value, FILTER_VALIDATE_URL) && in_array(strtolower((string)parse_url($value, PHP_URL_SCHEME)), ['http','https'], true) && !parse_url($value, PHP_URL_USER) && !parse_url($value, PHP_URL_PASS) ? $value : '';
    }

    private static function path(int $userId, int $postId): string {
        if ($userId < 1 || $postId < 1) throw new InvalidArgumentException('Media owner required.');
        return __DIR__ . '/../../public/media/.metadata/' . $userId . '_' . $postId . '.json';
    }

    public static function read(int $userId, int $postId): array {
        if ($userId < 1 || $postId < 1) return [];
        $path = self::path($userId, $postId);
        if (!is_file($path) || filesize($path) > 100000) return [];
        $data = json_decode((string)file_get_contents($path), true);
        return is_array($data) ? $data : [];
    }

    public static function write(int $userId, int $postId, array $data): bool {
        $path = self::path($userId, $postId);
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return false;
        @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        $temp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($temp, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE), LOCK_EX) === false) return false;
        if (@rename($temp, $path)) return true;
        @unlink($temp);
        return false;
    }

    public static function hydrate(array $post): array {
        $data = self::read((int)($post['user_id'] ?? 0), (int)($post['id'] ?? 0));
        $post['image_urls'] = array_values(array_filter(array_map([self::class,'url'], (array)($data['images'] ?? $post['image_urls'] ?? []))));
        $post['poster_url'] = self::url($data['poster'] ?? $post['poster_url'] ?? '');
        return $post;
    }

    public static function localExists(string $url): bool {
        $path = (string)parse_url($url, PHP_URL_PATH);
        return str_starts_with($path, '/public/media/') && basename($path) !== '' && is_file(__DIR__ . '/../../public/media/' . basename($path));
    }

    public static function playable(string $url): bool {
        $host = strtolower((string)parse_url($url, PHP_URL_HOST));
        return $url !== '' && !preg_match('/(^|\.)(facebook\.com|fb\.watch|youtube\.com|youtu\.be|tiktok\.com)$/i', $host);
    }

    public static function render(array $post, string $label = ''): string {
        $post = self::hydrate($post);
        $escape = static fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $primary = self::url($post['media_url'] ?? '');
        $type = strtolower((string)($post['media_type'] ?? ''));
        $html = ''; $images = $post['image_urls'];
        if ($type === 'video') {
            $poster = $post['poster_url'] ? ' poster="' . $escape($post['poster_url']) . '"' : '';
            if (preg_match('~(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([\w-]{11})~', $primary, $matches)) {
                $html = '<iframe src="https://www.youtube.com/embed/' . $matches[1] . '" title="' . $escape($label) . '" loading="lazy" allowfullscreen></iframe>';
            } elseif ($primary && self::playable($primary)) {
                $html = '<video controls playsinline preload="metadata"' . $poster . ' aria-label="' . $escape($label) . '"><source src="' . $escape($primary) . '"></video>';
                $source = self::url($post['source_url'] ?? '');
                if ($source) $html .= '<a href="' . $escape($source) . '" target="_blank" rel="noopener noreferrer">Guarda il video originale</a>';
            } else {
                $source = self::url($post['source_url'] ?? '') ?: $primary;
                if ($source) $html = '<a class="social-video-link" href="' . $escape($source) . '" target="_blank" rel="noopener noreferrer">' . ($post['poster_url'] ? '<img src="' . $escape($post['poster_url']) . '" alt="' . $escape($label) . '" loading="lazy">' : '') . '<span>Guarda il video originale</span></a>';
            }
            // Video previews are posters, not extra photos or playable video files.
            $images = array_values(array_filter($images, static fn($u) => $u !== $post['poster_url']));
        } elseif ($primary) {
            array_unshift($images, $primary);
        }
        foreach (array_slice(array_unique($images), 0, 20) as $url) $html .= '<img src="' . $escape($url) . '" alt="' . $escape($label) . '" loading="lazy" decoding="async">';
        return $html;
    }
}
