<?php

require_once __DIR__ . '/../../config/config.php';
if (file_exists(__DIR__ . '/../../config/keys.php')) require_once __DIR__ . '/../../config/keys.php';
if (file_exists(__DIR__ . '/../../config/runtime-secrets.php')) require_once __DIR__ . '/../../config/runtime-secrets.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/crypto.php';

final class SocialHttp {
    public static function request(string $method, string $url, array $options = []): array {
        $headers = $options['headers'] ?? ['Accept: application/json'];
        $query = $options['query'] ?? [];
        if ($query) $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($query, '', '&', PHP_QUERY_RFC3986);

        $ch = curl_init($url);
        $curlOptions = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => (int)($options['timeout'] ?? 30),
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];
        if (strtoupper($method) !== 'GET') {
            $curlOptions[CURLOPT_CUSTOMREQUEST] = strtoupper($method);
            if (array_key_exists('json', $options)) {
                $curlOptions[CURLOPT_POSTFIELDS] = json_encode($options['json'], JSON_UNESCAPED_SLASHES);
            } elseif (array_key_exists('form', $options)) {
                $curlOptions[CURLOPT_POSTFIELDS] = http_build_query($options['form'], '', '&', PHP_QUERY_RFC3986);
            }
        }
        curl_setopt_array($ch, $curlOptions);
        $body = curl_exec($ch);
        $networkError = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false) throw new RuntimeException('Servizio social non raggiungibile: ' . $networkError);
        if (trim((string)$body) === '' && $status >= 200 && $status < 300) return [];
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) throw new RuntimeException('Il servizio social ha restituito una risposta non valida');
        $providerError = $decoded['error'] ?? null;
        $providerErrorCode = is_array($providerError) ? ($providerError['code'] ?? null) : $providerError;
        $hasProviderError = $providerError !== null
            && !in_array($providerErrorCode, [null, '', 0, '0', 'ok'], true);
        if ($status >= 400 || $hasProviderError) {
            $error = $decoded['error'] ?? $decoded;
            $message = is_array($error)
                ? ($error['message'] ?? $error['description'] ?? $error['error_description'] ?? 'richiesta rifiutata')
                : (string)($decoded['error_description'] ?? $decoded['message'] ?? $error);
            throw new RuntimeException('Servizio social (' . ($status ?: 'errore') . '): ' . mb_substr((string)$message, 0, 500));
        }
        return $decoded;
    }
}

final class SocialOAuth {
    private const STATE_TTL = 600;

    public static function supportedPlatforms(): array {
        return ['facebook', 'instagram', 'tiktok', 'youtube'];
    }

    public static function facebookGraphBase(): string {
        $version = defined('META_GRAPH_VERSION') ? trim((string)META_GRAPH_VERSION) : 'v26.0';
        if (!preg_match('/^v\d+\.\d+$/', $version)) $version = 'v26.0';
        return 'https://graph.facebook.com/' . $version;
    }

    private static function value(string $primary, string $fallback = ''): string {
        $runtime = 'SOCIALTOSITE_RUNTIME_' . $primary;
        if (defined($runtime) && trim((string)constant($runtime)) !== '') return trim((string)constant($runtime));
        if (defined($primary) && trim((string)constant($primary)) !== '') return trim((string)constant($primary));
        if ($fallback !== '' && defined($fallback)) return trim((string)constant($fallback));
        return '';
    }

    public static function redirectUri(string $platform): string {
        if ($platform === 'tiktok') {
            return app_base_url() . '/api/auth/tiktok_callback.php';
        }
        return app_base_url() . '/api/auth/callback.php?platform=' . rawurlencode($platform);
    }

    private static function requireConfig(string $label, string $value): string {
        if ($value === '') throw new RuntimeException($label . ' non configurato sul server');
        return $value;
    }

    private static function assertPlanAllowsConnection(int $userId, string $platform): void {
        $user = DB::fetch('SELECT plan FROM users WHERE id=? LIMIT 1', [$userId]);
        $plan = strtolower(trim((string)($user['plan'] ?? 'base')));
        if (in_array($plan, ['professional', 'pro', 'agency'], true)) return;
        $usage = DB::fetch(
            'SELECT
                (SELECT COUNT(*) FROM social_sources WHERE user_id=? AND active=1 AND platform=\'website\') +
                (SELECT COUNT(*) FROM social_connections WHERE user_id=? AND active=1 AND platform<>?) AS total',
            [$userId, $userId, $platform]
        );
        if ((int)($usage['total'] ?? 0) >= 1) {
            throw new RuntimeException('Il piano Base consente di collegare un solo canale. Rimuovi quello attivo oppure effettua l’upgrade.');
        }
    }

    private static function startSession(): void {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'secure' => str_starts_with(app_base_url(), 'https://'),
                'samesite' => 'Lax',
                'path' => '/',
            ]);
            session_start();
        }
    }

    private static function createState(int $userId, string $platform, string $returnTo): string {
        self::startSession();
        $now = time();
        foreach (($_SESSION['social_oauth_states'] ?? []) as $key => $entry) {
            if (($entry['expires'] ?? 0) < $now) unset($_SESSION['social_oauth_states'][$key]);
        }
        $state = bin2hex(random_bytes(32));
        $_SESSION['social_oauth_states'][$state] = [
            'user_id' => $userId,
            'platform' => $platform,
            'return_to' => $returnTo,
            'expires' => $now + self::STATE_TTL,
        ];
        return $state;
    }

    public static function consumeState(string $state, string $platform): array {
        self::startSession();
        $entry = $_SESSION['social_oauth_states'][$state] ?? null;
        unset($_SESSION['social_oauth_states'][$state]);
        if (!is_array($entry) || ($entry['expires'] ?? 0) < time() || !hash_equals((string)($entry['platform'] ?? ''), $platform)) {
            throw new RuntimeException('Sessione OAuth non valida o scaduta. Ripeti il collegamento dalla dashboard.');
        }
        return ['user_id' => (int)$entry['user_id'], 'return_to' => (string)($entry['return_to'] ?? '/dashboard')];
    }

    public static function authorizationUrl(int $userId, string $platform, string $returnTo = '/dashboard'): string {
        if (!in_array($platform, self::supportedPlatforms(), true)) throw new RuntimeException('Piattaforma non supportata');
        self::assertPlanAllowsConnection($userId, $platform);
        if (!preg_match('~^/(?:connect|dashboard)(?:/|$)~', $returnTo)) $returnTo = '/dashboard';
        $state = self::createState($userId, $platform, $returnTo);
        $redirectUri = self::redirectUri($platform);

        if ($platform === 'facebook') {
            $appId = self::requireConfig('FB_APP_ID', self::value('FB_APP_ID', 'META_APP_ID'));
            $version = basename(self::facebookGraphBase());
            return 'https://www.facebook.com/' . $version . '/dialog/oauth?' . http_build_query([
                'client_id' => $appId,
                'redirect_uri' => $redirectUri,
                'state' => $state,
                'response_type' => 'code',
                'scope' => 'pages_show_list,pages_read_engagement',
            ], '', '&', PHP_QUERY_RFC3986);
        }
        if ($platform === 'instagram') {
            $appId = self::requireConfig('IG_LOGIN_APP_ID', self::value('IG_LOGIN_APP_ID'));
            return 'https://www.instagram.com/oauth/authorize?' . http_build_query([
                'client_id' => $appId,
                'redirect_uri' => $redirectUri,
                'state' => $state,
                'response_type' => 'code',
                'scope' => 'instagram_business_basic',
                'enable_fb_login' => 0,
                'force_authentication' => 1,
            ], '', '&', PHP_QUERY_RFC3986);
        }
        if ($platform === 'tiktok') {
            $clientKey = self::requireConfig('TIKTOK_CLIENT_KEY', self::value('TIKTOK_CLIENT_KEY'));
            return 'https://www.tiktok.com/v2/auth/authorize/?' . http_build_query([
                'client_key' => $clientKey,
                'redirect_uri' => $redirectUri,
                'state' => $state,
                'response_type' => 'code',
                'scope' => 'user.info.basic,video.list',
            ], '', '&', PHP_QUERY_RFC3986);
        }

        $clientId = self::requireConfig('GOOGLE_CLIENT_ID', self::value('GOOGLE_CLIENT_ID'));
        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'state' => $state,
            'response_type' => 'code',
            'scope' => 'https://www.googleapis.com/auth/youtube.readonly',
            'access_type' => 'offline',
            'include_granted_scopes' => 'true',
            'prompt' => 'consent',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public static function exchange(string $platform, string $code): array {
        $redirectUri = self::redirectUri($platform);
        if ($platform === 'facebook') return self::exchangeFacebook($code, $redirectUri);
        if ($platform === 'instagram') return self::exchangeInstagram($code, $redirectUri);
        if ($platform === 'tiktok') return self::exchangeTikTok($code, $redirectUri);
        if ($platform === 'youtube') return self::exchangeYouTube($code, $redirectUri);
        throw new RuntimeException('Piattaforma non supportata');
    }

    private static function exchangeFacebook(string $code, string $redirectUri): array {
        $appId = self::requireConfig('FB_APP_ID', self::value('FB_APP_ID', 'META_APP_ID'));
        $secret = self::requireConfig('FB_APP_SECRET', self::value('FB_APP_SECRET', 'META_APP_SECRET'));
        $short = SocialHttp::request('GET', self::facebookGraphBase() . '/oauth/access_token', ['query' => [
            'client_id' => $appId, 'client_secret' => $secret, 'redirect_uri' => $redirectUri, 'code' => $code,
        ]]);
        $userToken = (string)($short['access_token'] ?? '');
        $long = SocialHttp::request('GET', self::facebookGraphBase() . '/oauth/access_token', ['query' => [
            'grant_type' => 'fb_exchange_token', 'client_id' => $appId, 'client_secret' => $secret, 'fb_exchange_token' => $userToken,
        ]]);
        $userToken = (string)($long['access_token'] ?? $userToken);
        $pages = SocialHttp::request('GET', self::facebookGraphBase() . '/me/accounts', ['query' => [
            'fields' => 'id,name,access_token,tasks,picture', 'limit' => 100, 'access_token' => $userToken,
        ]]);
        $choices = [];
        foreach (($pages['data'] ?? []) as $page) {
            if (empty($page['id']) || empty($page['access_token'])) continue;
            $choices[] = [
                'platform_uid' => (string)$page['id'],
                'handle' => trim((string)($page['name'] ?? 'Pagina Facebook')),
                'access_token' => (string)$page['access_token'],
                'expires_at' => !empty($long['expires_in']) ? date('Y-m-d H:i:s', time() + (int)$long['expires_in']) : null,
            ];
        }
        if (!$choices) throw new RuntimeException('Nessuna Pagina Facebook autorizzata. Devi amministrare almeno una Pagina.');
        return ['choices' => $choices];
    }

    private static function exchangeInstagram(string $code, string $redirectUri): array {
        $appId = self::requireConfig('IG_LOGIN_APP_ID', self::value('IG_LOGIN_APP_ID'));
        $secret = self::requireConfig('IG_LOGIN_APP_SECRET', self::value('IG_LOGIN_APP_SECRET'));
        $short = SocialHttp::request('POST', 'https://api.instagram.com/oauth/access_token', [
            'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
            'form' => ['client_id' => $appId, 'client_secret' => $secret, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirectUri, 'code' => $code],
        ]);
        $shortToken = (string)($short['access_token'] ?? '');
        $long = SocialHttp::request('GET', 'https://graph.instagram.com/access_token', ['query' => [
            'grant_type' => 'ig_exchange_token', 'client_secret' => $secret, 'access_token' => $shortToken,
        ]]);
        $token = (string)($long['access_token'] ?? $shortToken);
        $profile = SocialHttp::request('GET', 'https://graph.instagram.com/me', ['query' => [
            'fields' => 'user_id,username,account_type,media_count', 'access_token' => $token,
        ]]);
        $accountType = strtoupper((string)($profile['account_type'] ?? ''));
        if ($accountType !== '' && !in_array($accountType, ['BUSINESS', 'MEDIA_CREATOR', 'CREATOR'], true)) {
            throw new RuntimeException('Instagram richiede un account Creator o Business.');
        }
        return ['connection' => [
            'platform_uid' => (string)($profile['user_id'] ?? $profile['id'] ?? $short['user_id'] ?? ''),
            'handle' => (string)($profile['username'] ?? 'Instagram'),
            'access_token' => $token,
            'refresh_token' => null,
            'expires_at' => date('Y-m-d H:i:s', time() + (int)($long['expires_in'] ?? 5184000)),
        ]];
    }

    private static function exchangeTikTok(string $code, string $redirectUri): array {
        $tokens = SocialHttp::request('POST', 'https://open.tiktokapis.com/v2/oauth/token/', [
            'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
            'form' => [
                'client_key' => self::requireConfig('TIKTOK_CLIENT_KEY', self::value('TIKTOK_CLIENT_KEY')),
                'client_secret' => self::requireConfig('TIKTOK_CLIENT_SECRET', self::value('TIKTOK_CLIENT_SECRET')),
                'code' => $code, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirectUri,
            ],
        ]);
        $grantedScopes = array_values(array_filter(preg_split('/[\s,]+/', trim((string)($tokens['scope'] ?? ''))) ?: []));
        $missingScopes = array_values(array_diff(['user.info.basic', 'video.list'], $grantedScopes));
        if ($grantedScopes && $missingScopes) {
            throw new RuntimeException('TikTok non ha concesso tutti i permessi richiesti (' . implode(', ', $missingScopes) . '). Ripeti il collegamento accettandoli entrambi.');
        }
        $token = (string)($tokens['access_token'] ?? '');
        $profile = SocialHttp::request('GET', 'https://open.tiktokapis.com/v2/user/info/', [
            'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
            'query' => ['fields' => 'open_id,display_name,avatar_url'],
        ]);
        $user = $profile['data']['user'] ?? [];
        return ['connection' => [
            'platform_uid' => (string)($user['open_id'] ?? $tokens['open_id'] ?? ''),
            'handle' => (string)($user['display_name'] ?? 'TikTok'),
            'access_token' => $token,
            'refresh_token' => (string)($tokens['refresh_token'] ?? ''),
            'expires_at' => date('Y-m-d H:i:s', time() + (int)($tokens['expires_in'] ?? 86400)),
        ]];
    }

    private static function exchangeYouTube(string $code, string $redirectUri): array {
        $tokens = SocialHttp::request('POST', 'https://oauth2.googleapis.com/token', [
            'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
            'form' => [
                'client_id' => self::requireConfig('GOOGLE_CLIENT_ID', self::value('GOOGLE_CLIENT_ID')),
                'client_secret' => self::requireConfig('GOOGLE_CLIENT_SECRET', self::value('GOOGLE_CLIENT_SECRET')),
                'code' => $code, 'grant_type' => 'authorization_code', 'redirect_uri' => $redirectUri,
            ],
        ]);
        $token = (string)($tokens['access_token'] ?? '');
        $channels = SocialHttp::request('GET', 'https://www.googleapis.com/youtube/v3/channels', [
            'headers' => ['Accept: application/json', 'Authorization: Bearer ' . $token],
            'query' => ['part' => 'id,snippet', 'mine' => 'true'],
        ]);
        $channel = $channels['items'][0] ?? null;
        if (!$channel) throw new RuntimeException('Nessun canale YouTube associato all’account selezionato');
        return ['connection' => [
            'platform_uid' => (string)$channel['id'],
            'handle' => (string)($channel['snippet']['title'] ?? 'YouTube'),
            'access_token' => $token,
            'refresh_token' => (string)($tokens['refresh_token'] ?? ''),
            'expires_at' => date('Y-m-d H:i:s', time() + (int)($tokens['expires_in'] ?? 3600)),
        ]];
    }

    public static function saveConnection(int $userId, string $platform, array $connection): void {
        if (!in_array($platform, self::supportedPlatforms(), true)) throw new RuntimeException('Piattaforma non supportata');
        if (trim((string)($connection['platform_uid'] ?? '')) === '' || trim((string)($connection['access_token'] ?? '')) === '') {
            throw new RuntimeException('Il provider non ha restituito un account o un token valido');
        }
        $existing = DB::fetch('SELECT refresh_token FROM social_connections WHERE user_id=? AND platform=? LIMIT 1', [$userId, $platform]);
        self::assertPlanAllowsConnection($userId, $platform);
        $refresh = (string)($connection['refresh_token'] ?? '');
        $encryptedRefresh = $refresh !== '' ? Crypto::encrypt($refresh) : ($existing['refresh_token'] ?? null);
        DB::execute(
            'INSERT INTO social_connections (user_id, platform, platform_uid, handle, access_token, refresh_token, expires_at, connected_at, active)
             VALUES (?,?,?,?,?,?,?,NOW(),1)
             ON DUPLICATE KEY UPDATE platform_uid=VALUES(platform_uid), handle=VALUES(handle), access_token=VALUES(access_token),
                 refresh_token=VALUES(refresh_token), expires_at=VALUES(expires_at), connected_at=NOW(), active=1',
            [
                $userId, $platform, (string)($connection['platform_uid'] ?? ''), (string)($connection['handle'] ?? ''),
                Crypto::encrypt((string)$connection['access_token']), $encryptedRefresh, $connection['expires_at'] ?? null,
            ]
        );
    }

    public static function disconnect(int $userId, string $platform): void {
        if (!in_array($platform, self::supportedPlatforms(), true)) throw new RuntimeException('Piattaforma non supportata');
        $connection = DB::fetch('SELECT access_token FROM social_connections WHERE user_id=? AND platform=? LIMIT 1', [$userId, $platform]);
        if (!$connection) return;
        $token = Crypto::decrypt((string)($connection['access_token'] ?? ''));
        if ($token !== '') {
            try {
                if ($platform === 'tiktok') {
                    SocialHttp::request('POST', 'https://open.tiktokapis.com/v2/oauth/revoke/', [
                        'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
                        'form' => [
                            'client_key' => self::requireConfig('TIKTOK_CLIENT_KEY', self::value('TIKTOK_CLIENT_KEY')),
                            'client_secret' => self::requireConfig('TIKTOK_CLIENT_SECRET', self::value('TIKTOK_CLIENT_SECRET')),
                            'token' => $token,
                        ],
                    ]);
                } elseif ($platform === 'youtube') {
                    SocialHttp::request('POST', 'https://oauth2.googleapis.com/revoke', [
                        'headers' => ['Accept: application/json', 'Content-Type: application/x-www-form-urlencoded'],
                        'form' => ['token' => $token],
                    ]);
                } elseif ($platform === 'facebook') {
                    SocialHttp::request('DELETE', self::facebookGraphBase() . '/me/permissions', ['query' => ['access_token' => $token]]);
                } elseif ($platform === 'instagram') {
                    SocialHttp::request('DELETE', 'https://graph.instagram.com/me/permissions', ['query' => ['access_token' => $token]]);
                }
            } catch (Throwable $e) {
                error_log('[OAuth revoke ' . $platform . '] ' . $e->getMessage());
            }
        }
        DB::execute('UPDATE social_connections SET active=0, access_token=\'\', refresh_token=NULL, expires_at=NULL WHERE user_id=? AND platform=?', [$userId, $platform]);
    }
}
