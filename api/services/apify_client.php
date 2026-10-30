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

        // Il secret iniettato dalla release viene validato da GitHub Actions
        // prima dell'upload e deve quindi avere precedenza su una credenziale
        // storica eventualmente rimasta nel database.
        $envToken = getenv('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN');
        if ($envToken !== false && trim((string)$envToken) !== '') {
            return trim((string)$envToken);
        } elseif (defined('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN')) {
            $runtimeValue = trim((string)constant('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN'));
            if ($runtimeValue !== '') return $runtimeValue;
        }

        $environmentValue = getenv('APIFY_API_TOKEN');
        if ($environmentValue !== false && trim((string)$environmentValue) !== '') {
            return trim((string)$environmentValue);
        }

        if (defined('APIFY_API_TOKEN')) {
            $configuredValue = trim((string)constant('APIFY_API_TOKEN'));
            if ($configuredValue !== '') return $configuredValue;
        }

        $managed = ProviderConfig::secret('apify');
        if ($managed !== '') return $managed;

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
            if ($status === 401) {
                throw new RuntimeException('Apify: credenziale non valida o revocata; aggiornare APIFY_API_TOKEN e ridistribuire (HTTP 401)');
            }
            throw new RuntimeException('Apify: ' . ($message ?: 'richiesta fallita') . ' (HTTP ' . $status . ')');
        }

        try {
            global $userId;
            DB::execute('INSERT INTO api_usage_logs (user_id,provider,action,tokens_used,estimated_cost) VALUES (?,?,?,0,?)', [isset($userId) ? $userId : null, 'apify', $actorId, ProviderConfig::estimatedCost('apify')]);
        } catch (Throwable $e) {}

        // dataset-items ritorna direttamente l'array di risultati
        return is_array($data) ? $data : [];
    }

    private static function itemUrl(array $item): string {
        foreach (['url','postUrl','shareable_url','topLevelReelUrl','inputUrl','topLevelUrl','link','webVideoUrl','videoUrl'] as $key) {
            if (is_string($item[$key] ?? null) && filter_var(trim($item[$key]), FILTER_VALIDATE_URL)) return trim($item[$key]);
        }
        return '';
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

        $assets = self::media($result);
        if (self::platform($url) === 'facebook' && preg_match('~/(?:reels?|videos?)(?:/|$)|^/watch(?:/|$)|^/video\.php$~i', (string)parse_url($url, PHP_URL_PATH))) $assets['is_video'] = true;
        
        $imageUrls = $assets['images'];
        $mediaType = $assets['is_video'] || $assets['video'] !== '' ? 'video' : ($imageUrls ? 'image' : 'text');
        $mediaUrl = $mediaType === 'video' ? $assets['video'] : ($imageUrls[0] ?? '');
        if ($mediaType === 'video' && $assets['poster'] === '' && $imageUrls) $assets['poster'] = $imageUrls[0];

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
            'id' => trim((string)($result['id'] ?? $result['postId'] ?? $result['video']['id'] ?? $result['playback_video']['id'] ?? $result['tracking']['video_id'] ?? '')),
            'title' => $title,
            'caption' => $caption,
            'published_at' => $timestamp ? date('Y-m-d H:i:s', $timestamp) : null,
            'media_url' => $mediaUrl,
            'image_urls' => $imageUrls,
            'media_type' => $mediaType,
            'poster_url' => $assets['poster'],
            'raw_payload' => $result,
        ];
    }

    public static function media(array $result): array {
        $images = []; $videos = []; $poster = ''; $isVideo = false;
        $add = static function (&$list, $value): void {
            if (is_string($value) && filter_var($value, FILTER_VALIDATE_URL) && preg_match('~^https?://~i', $value)) $list[] = $value;
        };
        $walk = static function ($node, int $depth = 0, string $context = '') use (&$walk, &$images, &$videos, &$poster, &$isVideo, $add): void {
            if ($depth > 10 || !is_array($node)) return;
            $hint = strtolower((string)($node['__typename'] ?? $node['__isMedia'] ?? $node['type'] ?? $node['mediaType'] ?? $node['contentType'] ?? $node['searchType'] ?? ''));
            if (str_contains($hint, 'video') || str_contains($hint, 'reel') || !empty($node['isVideo'])) $isVideo = true;
            foreach (['playable_url_quality_hd','browser_native_hd_url','hdVideoUrl','videoUrl','video_url','playable_url','browser_native_sd_url','downloadAddr','originalDownloadAddr','videoDownloadUrl'] as $key) {
                if (!empty($node[$key]) && is_string($node[$key])) { $add($videos,$node[$key]); $isVideo=true; }
            }
            foreach ($node as $key => $value) {
                if (in_array($key, ['imageUrl','displayUrl','thumbnailUrl','coverUrl','thumbnail','poster','thumbnailImage','first_frame_thumbnail'], true)) {
                    if (is_string($value)) { $add($images, $value); if ($poster === '' && filter_var($value, FILTER_VALIDATE_URL)) $poster = $value; }
                    elseif (is_array($value)) { $candidate = $value['uri'] ?? $value['url'] ?? ''; $add($images, $candidate); if ($poster === '' && is_string($candidate)) $poster = $candidate; }
                }
                if (in_array($context, ['photo_image','image','imageSrc','image_versions2','candidates','images','photos','displayResources'], true)) {
                    if (in_array($key, ['uri','url','src'], true) || is_int($key)) $add($images, $value);
                }
                if (is_array($value) && !in_array($key, ['user','owner','author','video_owner','tracking','comments','taggedUsers'], true)) $walk($value, $depth+1, is_string($key) ? $key : $context);
            }
        };
        $walk($result);
        return ['images'=>array_values(array_unique($images)), 'video'=>$videos[0] ?? '', 'poster'=>$poster, 'is_video'=>$isVideo];
    }

    public static function facebookSearch(string $url, int $limit): ?array {
        if (self::platform($url) !== 'facebook' || !str_starts_with((string)parse_url($url, PHP_URL_PATH), '/search/')) return null;
        parse_str((string)parse_url($url, PHP_URL_QUERY), $query);
        $term = trim((string)($query['q'] ?? ''));
        if ($term === '') throw new RuntimeException('La ricerca Facebook deve contenere una parola chiave.');
        return ['categories'=>[$term], 'searchType'=>str_contains((string)parse_url($url, PHP_URL_PATH), '/reels') ? 'reels' : 'posts', 'resultsLimit'=>max(1,min(100,$limit))];
    }

    public static function source(string $url, int $limit = 20, ?string $sinceDate = null): array {
        $platform = self::validateSourceUrl($url);
        $limit = max(1, min(100, $limit));

        $actorId = '';
        $payload = [];

        switch ($platform) {
            case 'facebook':
                $search = self::facebookSearch($url, $limit);
                if ($search !== null) { $actorId = 'apify/facebook-search-scraper'; $payload = $search; break; }
                $actorId = preg_match('~/reels?/~i', (string)parse_url($url, PHP_URL_PATH)) ? 'apify/facebook-reels-scraper' : 'apify/facebook-posts-scraper';
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
        
        // Search results/reels often expose only thumbnails. Hydrate their direct
        // post URLs in one bounded actor request to obtain actual playable files.
        $missingVideos = array_filter($items, static fn($item) => $platform === 'facebook' && $item['media_type'] === 'video' && $item['media_url'] === '');
        if ($missingVideos && $actorId === 'apify/facebook-search-scraper') {
            $groups = [];
            foreach ($missingVideos as $key=>$item) { $detailActor = preg_match('~/reels?/~i', (string)parse_url($item['url'],PHP_URL_PATH)) ? 'apify/facebook-reels-scraper' : 'apify/facebook-posts-scraper'; $groups[$detailActor][$key]=$item; }
            foreach ($groups as $detailActor=>$group) {
            try {
                $details = self::request($detailActor, ['startUrls'=>array_map(static fn($item)=>['url'=>$item['url']], array_values($group)), 'resultsLimit'=>1]);
                foreach ($details as $detail) {
                    $extra = self::normalize($detail);
                    if (!$extra || $extra['media_type'] !== 'video' || $extra['media_url'] === '') continue;
                    foreach ($group as $key=>$item) {
                        $sameId = $extra['id'] !== '' && $extra['id'] === $item['id'];
                        $samePath = rtrim((string)parse_url($extra['url'],PHP_URL_PATH),'/') === rtrim((string)parse_url($item['url'],PHP_URL_PATH),'/') && parse_url($extra['url'],PHP_URL_QUERY) === parse_url($item['url'],PHP_URL_QUERY);
                        if (!$sameId && !$samePath) continue;
                        $items[$key]['media_url'] = $extra['media_url'];
                        $items[$key]['poster_url'] = $extra['poster_url'] ?: $item['poster_url'];
                        $items[$key]['image_urls'] = array_values(array_unique(array_merge($item['image_urls'],$extra['image_urls'])));
                        $debug['videos_enriched'] = ($debug['videos_enriched'] ?? 0)+1;
                    }
                }
            } catch (Throwable $e) { $debug['media_warning'] = 'File video non fornito dal social: anteprime e collegamenti conservati.'; }
            }
        }
        $debug['normalized_items'] = count($items);
        
        return ['platform' => $platform, 'profile' => $profile, 'items' => array_values($items), 'debug' => $debug];
    }
}

