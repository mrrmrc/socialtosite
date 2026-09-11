<?php
require_once __DIR__ . '/provider_config.php';

/**
 * Unico gateway per l'acquisizione dei contenuti social pubblici.
 *
 * Nessuna credenziale dell'utente attraversa SocialToSite: il backend invia
 * esclusivamente URL pubblici a Refetch(er) e normalizza la risposta prima di
 * passarla al motore di ingestione.
 */
final class Refetcher {
    private const ENDPOINT = 'https://api.refetcher.com/';
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
        if ($platform === null) throw new RuntimeException('Piattaforma social non supportata da Refetch(er)');
        if ($expectedPlatform !== null && $expectedPlatform !== $platform) throw new RuntimeException('La piattaforma non corrisponde all’URL');
        return $platform;
    }

    private static function apiKey(): string {
        if (!ProviderConfig::enabled('refetcher')) throw new RuntimeException('Connessione Refetch(er) disattivata dal pannello amministrativo');
        $managed = ProviderConfig::secret('refetcher');
        if ($managed !== '') return $managed;
        $environmentValue = getenv('REFETCHER_API_KEY');
        if ($environmentValue !== false && trim((string)$environmentValue) !== '') {
            return trim((string)$environmentValue);
        }
        foreach (['SOCIALTOSITE_RUNTIME_REFETCHER_API_KEY', 'REFETCHER_API_KEY'] as $name) {
            if (defined($name) && trim((string)constant($name)) !== '') return trim((string)constant($name));
        }
        throw new RuntimeException('REFETCHER_API_KEY non configurata sul server');
    }

    private static function request(array $payload): array {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) throw new RuntimeException('Richiesta Refetch(er) non serializzabile');

        $ch = curl_init(self::ENDPOINT);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/json',
                'X-API-Key: ' . self::apiKey(),
            ],
            CURLOPT_CONNECTTIMEOUT => 12,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new RuntimeException('Refetch(er) non raggiungibile: ' . $curlError);

        $data = json_decode((string)$raw, true);
        if (!is_array($data)) throw new RuntimeException('Risposta Refetch(er) non valida (HTTP ' . $status . ')');
        if ($status < 200 || $status >= 300) {
            $message = $data['error']['message'] ?? $data['message'] ?? null;
            if (!$message && !empty($data['results'][0]['error'])) {
                $message = is_array($data['results'][0]['error'])
                    ? ($data['results'][0]['error']['message'] ?? $data['results'][0]['error']['category'] ?? null)
                    : $data['results'][0]['error'];
            }
            throw new RuntimeException('Refetch(er): ' . ($message ?: 'richiesta fallita') . ' (HTTP ' . $status . ')');
        }
        try {
            global $userId;
            DB::execute('INSERT INTO api_usage_logs (user_id,provider,action,tokens_used) VALUES (?,?,?,0)', [isset($userId) ? $userId : null,'refetcher',(string)($payload['type'] ?? (!empty($payload['urls']) ? 'details' : 'fetch'))]);
        } catch (Throwable $e) {}
        return $data;
    }

    private static function successfulResults(array $envelope): array {
        $results = $envelope['results'] ?? [];
        if (!is_array($results)) return [];
        $successful = [];
        foreach ($results as $result) {
            if (is_array($result) && !empty($result['success'])) $successful[] = $result;
        }
        return $successful;
    }

    private static function isSingleContentUrl(string $platform, string $url): bool {
        $path = strtolower((string)parse_url($url, PHP_URL_PATH));
        return match ($platform) {
            'instagram' => (bool)preg_match('~/(?:p|reel|reels|tv)/~', $path),
            'tiktok' => str_contains($path, '/video/'),
            'facebook' => (bool)preg_match('~/(?:posts|reel|reels|videos|watch|share/p)/~', $path) || str_contains(strtolower($url), 'fb.watch'),
            'youtube' => str_contains($path, '/watch') || str_contains($path, '/shorts/') || str_contains($path, '/embed/') || strtolower((string)parse_url($url, PHP_URL_HOST)) === 'youtu.be',
            'x' => str_contains($path, '/status/'),
            default => false,
        };
    }

    private static function itemUrl(array $item): string {
        return trim((string)($item['url'] ?? $item['normalizedUrl'] ?? $item['post']['normalizedUrl'] ?? ''));
    }

    private static function normalize(array $result): ?array {
        $post = is_array($result['post'] ?? null) ? $result['post'] : $result;
        $media = is_array($result['media'] ?? null) ? $result['media'] : (is_array($post['media'] ?? null) ? $post['media'] : []);
        $url = self::itemUrl($result) ?: self::itemUrl($post);
        if ($url === '') return null;
        // Ogni social usa campi diversi per il testo esteso. Conserviamo tutte
        // le parti editoriali note, senza troncare e senza includere commenti.
        $captionParts = [];
        foreach ([$post, $result] as $candidate) {
            foreach (['caption','description','text','fullText','message','content','videoDescription','accessibilityCaption'] as $key) {
                $value = $candidate[$key] ?? '';
                if (is_scalar($value) && trim((string)$value) !== '') $captionParts[] = trim((string)$value);
            }
        }
        $edgeCaption = $post['edge_media_to_caption']['edges'][0]['node']['text'] ?? '';
        if (is_scalar($edgeCaption) && trim((string)$edgeCaption) !== '') $captionParts[] = trim((string)$edgeCaption);
        $captionParts = array_values(array_unique($captionParts));
        $caption = implode("\n\n", array_values(array_unique($captionParts)));
        $title = trim((string)($post['title'] ?? ''));
        if ($caption === '') $caption = $title;
        $firstChild = is_array($media['children'][0] ?? null) ? $media['children'][0] : [];
        $mediaUrl = trim((string)(
            $media['videoUrl'] ?? $media['hdVideoUrl'] ?? $media['thumbnailUrl']
            ?? $firstChild['videoUrl'] ?? $firstChild['thumbnailUrl'] ?? $firstChild['url']
            ?? $post['displayUrl'] ?? ''
        ));
        $mediaType = strtolower((string)($media['type'] ?? $post['type'] ?? 'text'));
        if (str_contains($mediaType, 'video') || !empty($media['videoUrl']) || !empty($media['hdVideoUrl'])) $mediaType = 'video';
        elseif ($mediaUrl !== '') $mediaType = 'image';
        else $mediaType = 'text';
        $imageUrls = array_merge(self::mediaImageUrls($media), self::findImageUrls($result));
        $displayUrl = trim((string)($post['displayUrl'] ?? ''));
        if ($displayUrl !== '') array_unshift($imageUrls, $displayUrl);
        if ($mediaType === 'image' && $mediaUrl !== '') array_unshift($imageUrls, $mediaUrl);
        $imageUrls = array_values(array_unique(array_filter($imageUrls, static fn(string $value): bool => filter_var($value, FILTER_VALIDATE_URL) !== false)));
        $published = $post['publishedAt'] ?? (isset($post['createTime']) ? '@' . $post['createTime'] : null);
        $timestamp = $published ? strtotime((string)$published) : false;
        return [
            'url' => $url,
            'id' => trim((string)($post['id'] ?? $post['shortcode'] ?? '')),
            'title' => $title,
            'caption' => $caption,
            'published_at' => $timestamp ? date('Y-m-d H:i:s', $timestamp) : null,
            'media_url' => $mediaUrl,
            'image_urls' => $imageUrls,
            'media_type' => $mediaType,
            'raw_payload' => $result,
        ];
    }

    private static function mediaImageUrls(array $media): array {
        $urls = [];
        foreach (['imageUrl', 'displayUrl', 'thumbnailUrl', 'url'] as $key) {
            $value = trim((string)($media[$key] ?? ''));
            if ($value !== '') $urls[] = $value;
        }
        foreach ((is_array($media['images'] ?? null) ? $media['images'] : []) as $image) {
            if (is_string($image)) $urls[] = trim($image);
            elseif (is_array($image)) {
                foreach (['url', 'imageUrl', 'displayUrl', 'thumbnailUrl'] as $key) {
                    $value = trim((string)($image[$key] ?? ''));
                    if ($value !== '') $urls[] = $value;
                }
            }
        }
        foreach ((is_array($media['children'] ?? null) ? $media['children'] : []) as $child) {
            if (is_array($child)) $urls = array_merge($urls, self::mediaImageUrls($child));
        }
        return $urls;
    }

    private static function findImageUrls(mixed $value, string $keyHint = '', int $depth = 0): array {
        if ($depth > 8) return [];
        if (is_string($value)) {
            $candidate = trim($value);
            $hint = strtolower($keyHint);
            $looksLikeImageKey = preg_match('/(?:image|photo|picture|thumbnail|display|cover|poster|preview)/', $hint);
            $looksLikeImageUrl = preg_match('/\.(?:jpe?g|png|webp|gif)(?:\?|$)/i', $candidate) || str_contains($candidate, 'fbcdn.net') || str_contains($candidate, 'cdninstagram.com');
            return $looksLikeImageKey && $looksLikeImageUrl && filter_var($candidate, FILTER_VALIDATE_URL) ? [$candidate] : [];
        }
        if (!is_array($value)) return [];
        $urls = [];
        foreach ($value as $key => $child) {
            $urls = array_merge($urls, self::findImageUrls($child, is_string($key) ? $key : $keyHint, $depth + 1));
        }
        return $urls;
    }

    private static function profileUrls(array $profileResult): array {
        $items = [];
        foreach (['recentPosts', 'recentVideos', 'videos'] as $key) {
            foreach (($profileResult[$key] ?? []) as $item) if (is_array($item)) $items[] = $item;
        }
        // channelVideos usa talvolta `results` per i video del canale.
        foreach (($profileResult['results'] ?? []) as $item) if (is_array($item)) $items[] = $item;
        foreach (($profileResult['postLinks'] ?? []) as $url) $items[] = ['url' => $url];
        $urls = [];
        foreach ($items as $item) {
            $url = self::itemUrl($item);
            if ($url !== '') $urls[$url] = $item;
        }
        return $urls;
    }

    private static function facebookUsername(string $url): ?string {
        $path = trim((string)parse_url($url, PHP_URL_PATH), '/');
        if ($path === '') return null;
        $first = rawurldecode((string)explode('/', $path, 2)[0]);
        if (in_array(strtolower($first), ['profile.php', 'pages', 'groups', 'events', 'watch', 'reel', 'reels', 'videos'], true)) return null;
        return preg_match('/^[a-z0-9._-]+$/i', $first) ? $first : null;
    }

    private static function pageDebug(array $profileResult, string $strategy = 'profile_url'): array {
        $recent = is_array($profileResult['pageInfo']['recentPosts'] ?? null)
            ? $profileResult['pageInfo']['recentPosts']
            : [];
        return [
            'strategy' => $strategy,
            'requested_limit' => isset($recent['requestedLimit']) ? (int)$recent['requestedLimit'] : null,
            'returned_count' => isset($recent['returnedCount']) ? (int)$recent['returnedCount'] : null,
            'pages_requested' => isset($recent['pagesRequested']) ? (int)$recent['pagesRequested'] : null,
            'pages_fetched' => isset($recent['pagesFetched']) ? (int)$recent['pagesFetched'] : null,
            'has_next_page' => !empty($recent['hasNextPage']),
            'incomplete' => !empty($recent['incomplete']),
            'end_cursor' => trim((string)($recent['endCursor'] ?? '')) !== '',
            'limitations' => array_values(array_filter(array_map(
                static fn($value): string => is_scalar($value) ? trim((string)$value) : (string)json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                is_array($profileResult['limitations'] ?? null) ? $profileResult['limitations'] : []
            ))),
        ];
    }

    public static function source(string $url, int $limit = 20, ?string $sinceDate = null): array {
        $platform = self::validateSourceUrl($url);
        $limit = max(1, min(500, $limit));
        $profile = null;
        $rawItems = [];
        $debug = [
            'requested_limit' => $limit,
            'pages_requested' => 1,
            'provider_requests' => 0,
            'provider_links' => 0,
            'complete_items' => 0,
            'light_links' => 0,
            'detail_results' => 0,
            'normalized_items' => 0,
            'filtered_by_date' => 0,
            'provider_pages' => [],
        ];

        if (self::isSingleContentUrl($platform, $url)) {
            $debug['provider_requests']++;
            $rawItems = self::successfulResults(self::request(['url' => $url]));
        } else {
            if ($platform === 'youtube') {
                $payload = ['type' => 'channelVideos', 'platform' => 'youtube', 'channelUrl' => $url, 'recentVideosLimit' => min(50, $limit)];
            } else {
                $pageSize = $platform === 'facebook' ? 3 : ($platform === 'x' ? 5 : 12);
                $payload = [
                    'type' => 'profile', 'platform' => $platform, 'profileUrl' => $url,
                    'includeRecentPosts' => true,
                    'pages' => min($platform === 'facebook' ? 10 : 25, max(1, (int)ceil($limit / $pageSize))),
                ];
                if ($platform === 'facebook') $payload['recentPostsLimit'] = min(25, $limit);
            }
            $debug['pages_requested'] = (int)($payload['pages'] ?? 1);
            $debug['provider_requests']++;
            $profileResults = self::successfulResults(self::request($payload));
            if (!$profileResults) throw new RuntimeException('Refetch(er) non ha restituito il profilo pubblico');
            $profileResult = $profileResults[0];
            $profile = $profileResult['profile'] ?? $profileResult['channel'] ?? null;
            $discovered = self::profileUrls($profileResult);
            $debug['provider_pages'][] = self::pageDebug($profileResult);

            // Facebook può restituire soltanto la prima pagina e segnalare una
            // timeline incompleta. Riprendiamo dal cursore, senza superare il
            // numero di pagine e di contenuti già richiesto dall'utente.
            if ($platform === 'facebook') {
                $seenCursors = [];
                $pageInfo = is_array($profileResult['pageInfo']['recentPosts'] ?? null) ? $profileResult['pageInfo']['recentPosts'] : [];
                $pagesConsumed = max(1, (int)($pageInfo['pagesFetched'] ?? 1));

                // Un primo tentativo Facebook può essere troncato prima che il
                // provider esponga un cursore. Una nuova scansione tramite lo
                // username usa un ingresso documentato alternativo e spesso
                // ottiene il cursore che manca alla richiesta via profileUrl.
                if (count($discovered) < min(3, $limit) && !empty($pageInfo['incomplete']) && empty($pageInfo['endCursor'])) {
                    usleep(900000);
                    $restartPayload = $payload;
                    $username = self::facebookUsername($url);
                    $strategy = 'profile_restart';
                    if ($username !== null) {
                        unset($restartPayload['profileUrl']);
                        $restartPayload['username'] = $username;
                        $strategy = 'username_restart';
                    }
                    $debug['provider_requests']++;
                    $restartResults = self::successfulResults(self::request($restartPayload));
                    if ($restartResults) {
                        $restartResult = $restartResults[0];
                        foreach (self::profileUrls($restartResult) as $itemUrl => $item) $discovered[$itemUrl] = $item;
                        $debug['provider_pages'][] = self::pageDebug($restartResult, $strategy);
                        $restartPageInfo = is_array($restartResult['pageInfo']['recentPosts'] ?? null) ? $restartResult['pageInfo']['recentPosts'] : [];
                        $pagesConsumed += max(1, (int)($restartPageInfo['pagesFetched'] ?? 1));
                        if (!empty($restartPageInfo['endCursor']) || (int)($restartPageInfo['returnedCount'] ?? 0) > (int)($pageInfo['returnedCount'] ?? 0)) {
                            $pageInfo = $restartPageInfo;
                        }
                    }
                }

                $remainingPages = max(0, (int)($payload['pages'] ?? 1) - $pagesConsumed);
                while (count($discovered) < $limit && $remainingPages > 0 && !empty($pageInfo['incomplete']) && !empty($pageInfo['endCursor'])) {
                    $cursor = (string)$pageInfo['endCursor'];
                    if (isset($seenCursors[$cursor])) break;
                    $seenCursors[$cursor] = true;
                    usleep(350000);
                    $resumePayload = $payload;
                    $resumePayload['after'] = $cursor;
                    $resumePayload['pages'] = $remainingPages;
                    $resumePayload['recentPostsLimit'] = min(25, $limit - count($discovered));
                    $debug['provider_requests']++;
                    $resumeResults = self::successfulResults(self::request($resumePayload));
                    if (!$resumeResults) break;
                    $resumeResult = $resumeResults[0];
                    foreach (self::profileUrls($resumeResult) as $itemUrl => $item) $discovered[$itemUrl] = $item;
                    $debug['provider_pages'][] = self::pageDebug($resumeResult, 'cursor_resume');
                    $pageInfo = is_array($resumeResult['pageInfo']['recentPosts'] ?? null) ? $resumeResult['pageInfo']['recentPosts'] : [];
                    $fetched = max(1, (int)($pageInfo['pagesFetched'] ?? 1));
                    $remainingPages = max(0, $remainingPages - $fetched);
                }
            }
            $debug['provider_links'] = count($discovered);

            // Il piano Refetch(er) configurato accetta al massimo 10 URL per
            // richiesta di dettaglio. Suddividere qui consente comunque di
            // acquisire limiti superiori senza perdere contenuti.
            $complete = [];
            $lightUrls = [];
            foreach ($discovered as $itemUrl => $item) {
                if (!empty($item['caption']) || !empty($item['description']) || !empty($item['media'])) $complete[] = $item + ['url' => $itemUrl];
                else $lightUrls[] = $itemUrl;
            }
            $debug['complete_items'] = count($complete);
            $debug['light_links'] = count($lightUrls);
            // Il testo incluso nella risposta profilo e spesso una preview.
            // Apriamo quindi ogni singolo URL scoperto, anche se contiene gia
            // una caption, e usiamo il record del profilo soltanto come fallback.
            $detailedByUrl = [];
            foreach (array_chunk(array_slice(array_keys($discovered), 0, $limit), 10) as $chunk) {
                $debug['provider_requests']++;
                $details = self::successfulResults(self::request(['urls' => $chunk]));
                $debug['detail_results'] += count($details);
                foreach ($details as $detail) {
                    $detailUrl = self::itemUrl($detail);
                    if ($detailUrl !== '') $detailedByUrl[rtrim($detailUrl, '/')] = $detail;
                }
            }
            $rawItems = [];
            foreach (array_slice($discovered, 0, $limit, true) as $itemUrl => $profileItem) {
                $rawItems[] = $detailedByUrl[rtrim($itemUrl, '/')] ?? ($profileItem + ['url'=>$itemUrl]);
            }
        }

        $items = [];
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
        return ['platform' => $platform, 'profile' => is_array($profile) ? $profile : [], 'items' => array_values($items), 'debug' => $debug];
    }
}
