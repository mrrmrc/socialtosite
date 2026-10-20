<?php
final class ArticleDisplay {
    public static function rules($config): array {
        if (is_string($config)) $config = json_decode($config, true);
        if (!is_array($config)) return [];
        $blocks = $config['blocks'] ?? [];
        foreach (($config['pages'] ?? []) as $page) {
            if (($page['path'] ?? '') === '/') { $blocks = $page['blocks'] ?? []; break; }
        }
        foreach ($blocks as $block) {
            if (($block['type'] ?? '') === 'articles') return is_array($block['props'] ?? null) ? $block['props'] : [];
        }
        return [];
    }
    private static function day($value) {
        if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
        return $date && $date->format('Y-m-d') === $value ? $date->getTimestamp() : false;
    }
    public static function filter(array $posts, array $rules, ?int $now = null): array {
        $days = max(0, min(36500, (int)($rules['recentDays'] ?? 0)));
        $start = self::day($rules['dateFrom'] ?? null);
        $end = self::day($rules['dateTo'] ?? null);
        $today = (int)floor(($now ?? time()) / 86400) * 86400;
        $stamp = static function($post) {
            $value = ($post['published_at'] ?? '') ?: ($post['imported_at'] ?? '');
            return $value !== '' ? strtotime($value . ' UTC') : false;
        };
        $result = array_values(array_filter($posts, static function($post) use ($days, $start, $end, $today, $stamp) {
            $date = $stamp($post);
            if (($days || $start !== false || $end !== false) && $date === false) return false;
            return (!$days || ($date >= $today - ($days - 1) * 86400 && $date < $today + 86400)) && ($start === false || $date >= $start) && ($end === false || $date < $end + 86400);
        }));
        $order = $rules['articleOrder'] ?? 'featured';
        usort($result, static function($a, $b) use ($order, $stamp) {
            if ($order === '' || $order === 'featured') {
                $diff = (int)($b['featured'] ?? 0) <=> (int)($a['featured'] ?? 0);
                if ($diff) return $diff;
            }
            return (($stamp($a) ?: 0) <=> ($stamp($b) ?: 0)) * ($order === 'oldest' ? 1 : -1);
        });
        $max = max(0, min(1000, (int)($rules['maxArticles'] ?? 0)));
        return $max ? array_slice($result, 0, $max) : $result;
    }
}
