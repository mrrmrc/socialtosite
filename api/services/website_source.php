<?php

final class WebsiteSource {
    private static function assertPublicUrl(string $url): array {
        if (!filter_var($url, FILTER_VALIDATE_URL)) throw new RuntimeException('URL del sito non valido');
        $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) throw new RuntimeException('Protocollo del sito non supportato');
        if (parse_url($url, PHP_URL_USER) !== null || parse_url($url, PHP_URL_PASS) !== null) throw new RuntimeException('URL con credenziali non consentito');
        $host = (string)parse_url($url, PHP_URL_HOST);
        if ($host === '' || strtolower($host) === 'localhost') throw new RuntimeException('Host del sito non valido');
        $port = (int)(parse_url($url, PHP_URL_PORT) ?: ($scheme === 'https' ? 443 : 80));
        if (!in_array($port, [80, 443], true)) throw new RuntimeException('Porta del sito non consentita');
        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if (!$addresses) throw new RuntimeException('Il dominio del sito non può essere risolto');
        foreach ($addresses as $address) {
            if (!filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                throw new RuntimeException('Il sito punta a una rete privata o riservata');
            }
        }
        return ['host' => $host, 'port' => $port, 'ip' => (string)$addresses[0]];
    }

    public static function validate(string $url): void {
        self::assertPublicUrl($url);
    }

    private static function fetch(string $url, int $maxBytes = 2000000, int $redirects = 3): array {
        $target = self::assertPublicUrl($url);
        $headers = [];
        $body = '';
        $tooLarge = false;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_USERAGENT => 'SocialToSite/2.0 (+https://allsocialtoweb.com)',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_RESOLVE => [$target['host'] . ':' . $target['port'] . ':' . $target['ip']],
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$headers): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                return strlen($line);
            },
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$body, &$tooLarge, $maxBytes): int {
                if (strlen($body) + strlen($chunk) > $maxBytes) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($status >= 300 && $status < 400 && !empty($headers['location']) && $redirects > 0) {
            $next = self::absoluteUrl($url, $headers['location']);
            return self::fetch($next, $maxBytes, $redirects - 1);
        }
        if ($tooLarge) throw new RuntimeException('La risorsa supera la dimensione massima consentita');
        if ($ok === false) throw new RuntimeException('Sito non raggiungibile: ' . $error);
        if ($status >= 400) throw new RuntimeException('Il sito ha risposto con HTTP ' . $status);
        return ['url' => $url, 'body' => $body, 'headers' => $headers];
    }

    public static function download(string $url, int $maxBytes = 30000000): array {
        return self::fetch($url, $maxBytes, 3);
    }

    private static function absoluteUrl(string $base, string $candidate): string {
        if (preg_match('~^https?://~i', $candidate)) return $candidate;
        $parts = parse_url($base);
        if (str_starts_with($candidate, '//')) return ($parts['scheme'] ?? 'https') . ':' . $candidate;
        $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
        if (!empty($parts['port'])) $origin .= ':' . $parts['port'];
        if (str_starts_with($candidate, '/')) return $origin . $candidate;
        $path = (string)($parts['path'] ?? '/');
        return $origin . rtrim(str_replace('\\', '/', dirname($path)), '/') . '/' . ltrim($candidate, '/');
    }

    private static function meta(string $html, string $name): string {
        $quoted = preg_quote($name, '~');
        if (preg_match('~<meta[^>]+(?:property|name)=["\']' . $quoted . '["\'][^>]+content=["\']([^"\']+)["\']~i', $html, $match) ||
            preg_match('~<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' . $quoted . '["\']~i', $html, $match)) {
            return trim(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }
        return '';
    }

    public static function page(string $url): array {
        $response = self::fetch($url);
        $html = $response['body'];
        preg_match('~<title[^>]*>(.*?)</title>~is', $html, $titleMatch);
        $title = trim(html_entity_decode(strip_tags($titleMatch[1] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $description = self::meta($html, 'description') ?: self::meta($html, 'og:description');
        $image = self::meta($html, 'og:image');
        if ($image !== '') $image = self::absoluteUrl($response['url'], $image);
        $clean = preg_replace('~<(script|style|nav|footer|form)[^>]*>.*?</\1>~is', ' ', $html);
        $text = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($clean), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        return ['url' => $response['url'], 'title' => $title, 'description' => $description, 'text' => mb_substr($text, 0, 12000), 'image_url' => $image, 'html' => $html];
    }

    public static function profileVisuals(string $url): array {
        $page = self::page($url);
        return ['logo_url' => $page['image_url'], 'cover_url' => $page['image_url'], 'page_title' => $page['title'], 'description' => $page['description']];
    }

    public static function items(string $url, int $limit = 10, ?string $sinceDate = null): array {
        $page = self::page($url);
        $html = $page['html'];
        $feeds = [];
        if (preg_match_all('~<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]+href=["\']([^"\']+)["\']~i', $html, $matches)) {
            foreach ($matches[1] as $feed) $feeds[] = self::absoluteUrl($page['url'], html_entity_decode($feed, ENT_QUOTES));
        }
        $parts = parse_url($page['url']);
        $origin = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? '');
        $feeds[] = $origin . '/feed/';
        $feeds[] = $origin . '/rss.xml';
        $items = [];
        foreach (array_unique($feeds) as $feedUrl) {
            try {
                $feed = self::fetch($feedUrl, 3000000)['body'];
                libxml_use_internal_errors(true);
                $xml = simplexml_load_string($feed, 'SimpleXMLElement', LIBXML_NONET | LIBXML_NOCDATA);
                if (!$xml) continue;
                $entries = isset($xml->channel->item) ? $xml->channel->item : $xml->entry;
                foreach ($entries as $entry) {
                    $link = trim((string)$entry->link);
                    if ($link === '' && isset($entry->link['href'])) $link = trim((string)$entry->link['href']);
                    if ($link === '') continue;
                    $dateRaw = (string)($entry->pubDate ?? $entry->published ?? $entry->updated ?? '');
                    $timestamp = $dateRaw !== '' ? strtotime($dateRaw) : false;
                    if ($sinceDate && $timestamp && $timestamp < strtotime($sinceDate)) continue;
                    $items[] = [
                        'url' => self::absoluteUrl($feedUrl, $link),
                        'caption' => trim((string)($entry->title ?? '') . "\n\n" . strip_tags((string)($entry->description ?? $entry->summary ?? $entry->content ?? ''))),
                        'published_at' => $timestamp ? date('Y-m-d H:i:s', $timestamp) : date('Y-m-d H:i:s'),
                        'media_type' => 'text',
                    ];
                    if (count($items) >= $limit) break 2;
                }
            } catch (Throwable $e) {}
        }
        if (!$items) {
            $items[] = ['url' => $page['url'], 'caption' => trim($page['title'] . "\n\n" . $page['description'] . "\n\n" . $page['text']), 'published_at' => date('Y-m-d H:i:s'), 'media_url' => $page['image_url'], 'media_type' => $page['image_url'] ? 'image' : 'text'];
        }
        return array_slice($items, 0, max(1, $limit));
    }
}
