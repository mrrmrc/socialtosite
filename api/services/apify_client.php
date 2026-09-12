<?php
require_once __DIR__ . '/provider_config.php';

/**
 * Gateway per l'acquisizione dei contenuti social tramite Apify.
 *
 * Utilizza attori (bot) specifici per ciascuna piattaforma per aggirare i blocchi,
 * in particolare quelli di Meta, ed estrae i dati standardizzati.
 */
final class ApifyClient {
    private const API_BASE = 'https://api.apify.com/v2';
    private const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x'];

    public static function supportedPlatforms(): array {
        return self::PLATFORMS;
    }

    public static function platform(string $url): ?string {
        $host = strtolower((string)parse_url(trim($url), PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host);
        return match (true) {
            $host === 'instagram.com' || str_ends_with($host, '.instagram.com') => 'instagram',
            $host === 'tiktok.com' || str_ends_with($host, '.tiktok.com') => 'tiktok',
            $host === 'facebook.com' || str_ends_with($host, '.facebook.com') || $host === 'fb.watch' => 'facebook',
            $host === 'youtube.com' || str_ends_with($host, '.youtube.com') || $host === 'youtu.be' => 'youtube',
            $host === 'x.com' || str_ends_with($host, '.x.com') || $host === 'twitter.com' || str_ends_with($host, '.twitter.com') => 'x',
            default => null,
        };
    }

    public static function validateSourceUrl(string $url, ?string $expectedPlatform = null): string {
        if (!filter_var($url, FILTER_VALIDATE_URL)) throw new RuntimeException('URL social non valido');
        if (!in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)) {
            throw new RuntimeException('Protocollo social non supportato');
        }
        $platform = self::platform($url);
        if ($platform === null) throw new RuntimeException('Piattaforma social non supportata da Apify in questa configurazione');
        if ($expectedPlatform !== null && $expectedPlatform !== $platform) throw new RuntimeException('La piattaforma non corrisponde all’URL');
        return $platform;
    }

    private static function apiKey(): string {
        if (!ProviderConfig::enabled('apify')) throw new RuntimeException('Connessione Apify disattivata dal pannello amministrativo');
        $managed = ProviderConfig::secret('apify');
        if ($managed !== '') return $managed;
        $environmentValue = getenv('APIFY_API_TOKEN');
        if ($environmentValue !== false && trim((string)$environmentValue) !== '') {
            return trim((string)$environmentValue);
        }
        foreach (['SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN', 'APIFY_API_TOKEN'] as $name) {
            if (defined($name) && trim((string)constant($name)) !== '') return trim((string)constant($name));
        }
        throw new RuntimeException('APIFY_API_TOKEN non configurata sul server');
    }

    private static function request(string $actorId, array $payload): array {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) throw new RuntimeException('Richiesta Apify non serializzabile');

        $token = self::apiKey();
        // Negli URL REST Apify il nome leggibile `owner/actor` deve essere
        // rappresentato come `owner~actor`. Lasciamo gli ID in forma leggibile
        // nelle configurazioni e normalizziamoli in un solo punto.
        $actorApiId = str_replace('/', '~', trim($actorId));
        if (!preg_match('/^[A-Za-z0-9_-]+~[A-Za-z0-9_-]+$/', $actorApiId)) {
            throw new RuntimeException('Identificativo actor Apify non valido');
        }
        // Usiamo run-sync-get-dataset-items che blocca finché l'esecuzione non termina e restituisce i risultati.
        $url = self::API_BASE . "/acts/{$actorApiId}/run-sync-get-dataset-items?token=" . rawurlencode($token);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/json',
            ],
            // Timeout più lungo per permettere allo scraper di completare l'operazione
            CURLOPT_CONNECTTIMEOUT => 12,
            CURLOPT_TIMEOUT => 300, 
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($raw === false) throw new RuntimeException('Apify non raggiungibile: ' . $curlError);

        $data = json_decode((string)$raw, true);
        if (!is_array($data) && $status >= 200 && $status < 300 && $raw !== '') {
            throw new RuntimeException('Risposta Apify non valida');
        }

        if ($status < 200 || $status >= 300) {
            $message = $data['error']['message'] ?? $data['message'] ?? null;
            throw new RuntimeException('Apify: ' . ($message ?: 'richiesta fallita') . ' (HTTP ' . $status . ')');
        }

        try {
            global $userId;
            DB::execute('INSERT INTO api_usage_logs (user_id,provider,action,tokens_used) VALUES (?,?,?,0)', [isset($userId) ? $userId : null, 'apify', $actorId]);
        } catch (Throwable $e) {}

        // dataset-items ritorna direttamente l'array di risultati
        return is_array($data) ? $data : [];
    }

    private static function itemUrl(array $item): string {
        return trim((string)($item['url'] ?? $item['postUrl'] ?? $item['link'] ?? $item['videoUrl'] ?? ''));
    }

    private static function normalize(array $result): ?array {
        $url = self::itemUrl($result);
        if ($url === '') return null;
        
        $captionParts = [];
        foreach (['text', 'caption', 'description', 'fullText', 'message'] as $key) {
            $value = $result[$key] ?? '';
            if (is_scalar($value) && trim((string)$value) !== '') $captionParts[] = trim((string)$value);
        }
        
        $caption = implode("\n\n", array_values(array_unique($captionParts)));
        $title = trim((string)($result['title'] ?? ''));
        if ($caption === '') $caption = $title;
        
        $mediaUrl = trim((string)(
            $result['videoUrl'] ?? $result['hdVideoUrl'] ?? $result['displayUrl'] ?? $result['imageUrl'] ?? $result['thumbnailUrl'] ?? ''
        ));
        
        $mediaType = 'text';
        $typeHint = strtolower((string)($result['type'] ?? $result['mediaType'] ?? ''));
        if (str_contains($typeHint, 'video') || !empty($result['videoUrl'])) {
            $mediaType = 'video';
        } elseif ($mediaUrl !== '' || str_contains($typeHint, 'image') || str_contains($typeHint, 'photo')) {
            $mediaType = 'image';
        }

        $imageUrls = [];
        foreach (['imageUrl', 'displayUrl', 'thumbnailUrl', 'coverUrl'] as $key) {
            if (!empty($result[$key])) $imageUrls[] = $result[$key];
        }
        foreach (($result['images'] ?? []) as $img) {
            if (is_string($img)) $imageUrls[] = $img;
            elseif (is_array($img) && !empty($img['url'])) $imageUrls[] = $img['url'];
        }
        
        if ($mediaType === 'image' && $mediaUrl !== '') array_unshift($imageUrls, $mediaUrl);
        $imageUrls = array_values(array_unique(array_filter($imageUrls, static fn(string $value): bool => filter_var($value, FILTER_VALIDATE_URL) !== false)));

        $published = $result['publishedAt'] ?? $result['time'] ?? $result['timestamp'] ?? $result['createdAt'] ?? $result['takenAt'] ?? $result['takenAtIso'] ?? null;
        $timestamp = false;
        if ($published) {
            if (is_numeric($published)) {
                $timestamp = (int)$published;
                if ($timestamp > 20000000000) $timestamp = (int)floor($timestamp / 1000);
            } else {
                $timestamp = strtotime((string)$published);
            }
        }

        return [
            'url' => $url,
            'id' => trim((string)($result['id'] ?? $result['postId'] ?? '')),
            'title' => $title,
            'caption' => $caption,
            'published_at' => $timestamp ? date('Y-m-d H:i:s', $timestamp) : null,
            'media_url' => $mediaUrl,
            'image_urls' => $imageUrls,
            'media_type' => $mediaType,
            'raw_payload' => $result,
        ];
    }

    public static function source(string $url, int $limit = 20, ?string $sinceDate = null): array {
        $platform = self::validateSourceUrl($url);
        $limit = max(1, min(100, $limit));

        $actorId = '';
        $payload = [];

        switch ($platform) {
            case 'facebook':
                $actorId = 'apify/facebook-posts-scraper';
                $payload = [
                    'startUrls' => [['url' => $url]],
                    'resultsLimit' => $limit
                ];
                if ($sinceDate) $payload['onlyPostsNewerThan'] = $sinceDate;
                break;
            case 'instagram':
                $actorId = 'apify/instagram-scraper';
                $payload = [
                    'directUrls' => [$url],
                    'resultsType' => 'posts',
                    'resultsLimit' => $limit
                ];
                if ($sinceDate) $payload['onlyPostsNewerThan'] = $sinceDate;
                break;
            case 'youtube':
                $actorId = 'streamers/youtube-scraper';
                $payload = [
                    'startUrls' => [['url' => $url]],
                    'maxResults' => $limit
                ];
                break;
            case 'tiktok':
                $actorId = 'clockworks/tiktok-profile-scraper';
                $path = trim((string)parse_url($url, PHP_URL_PATH), '/');
                $segments = array_values(array_filter(explode('/', $path)));
                $profile = ltrim((string)($segments[0] ?? ''), '@');
                if ($profile === '') throw new RuntimeException('URL profilo TikTok non valido');
                $payload = [
                    'profiles' => [$profile],
                    'resultsPerPage' => $limit
                ];
                break;
            case 'x':
                $actorId = 'apidojo/tweet-scraper';
                $payload = [
                    'startUrls' => [$url],
                    'maxItems' => $limit
                ];
                break;
        }

        $debug = [
            'requested_limit' => $limit,
            'actor_id' => $actorId,
            'raw_results' => 0,
            'normalized_items' => 0,
            'filtered_by_date' => 0,
        ];

        $rawItems = self::request($actorId, $payload);
        $debug['raw_results'] = count($rawItems);

        $items = [];
        $profile = [];
        
        // Estraiamo il profilo dal primo item utile, se presente
        if (!empty($rawItems) && isset($rawItems[0]['ownerUsername'])) {
            $profile = [
                'username' => $rawItems[0]['ownerUsername'] ?? null,
                'fullName' => $rawItems[0]['ownerFullName'] ?? null,
            ];
        }

        foreach ($rawItems as $rawItem) {
            $item = self::normalize($rawItem);
            if (!$item) continue;
            
            if ($sinceDate && !empty($item['published_at']) && strtotime($item['published_at']) < strtotime($sinceDate)) {
                $debug['filtered_by_date']++;
                continue;
            }
            $items[$item['url']] = $item;
            if (count($items) >= $limit) break;
        }
        
        $debug['normalized_items'] = count($items);
        
        return ['platform' => $platform, 'profile' => $profile, 'items' => array_values($items), 'debug' => $debug];
    }
}
