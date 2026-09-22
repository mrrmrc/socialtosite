<?php
require_once __DIR__ . '/../../config/db.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) require_once __DIR__ . '/../middleware/logger.php';
require_once __DIR__ . '/../services/visibility.php';

// Cron job da eseguire giornalmente (es. alle 3 del mattino)
// Recupera i dati da Google Search Console per ogni utente.

function getGoogleAccessToken(string $jsonFile): string {
    if (!file_exists($jsonFile)) throw new Exception("GCP Credentials file not found: $jsonFile");
    $credentials = json_decode(file_get_contents($jsonFile), true);
    if (!$credentials || !isset($credentials['client_email']) || !isset($credentials['private_key'])) {
        throw new Exception("Invalid GCP Credentials JSON");
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/webmasters.readonly',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = '';
    openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $credentials['private_key'], "sha256WithRSAEncryption");
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ])
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("OAuth Error: $response");
    }

    $data = json_decode($response, true);
    return $data['access_token'];
}

function fetchGscData(string $accessToken, string $siteUrl, string $startDate, string $endDate, array $dimensions = ['date'], string $pagePrefix = '', int $rowLimit = 1000): array {
    $apiUrl = "https://searchconsole.googleapis.com/webmasters/v3/sites/" . urlencode($siteUrl) . "/searchAnalytics/query";
    $request = [
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dimensions' => $dimensions,
        'rowLimit' => $rowLimit,
        'dataState' => 'final',
    ];
    if ($pagePrefix !== '') {
        $request['dimensionFilterGroups'] = [[
            'groupType' => 'and',
            'filters' => [[
                'dimension' => 'page',
                'operator' => 'contains',
                'expression' => $pagePrefix,
            ]],
        ]];
    }
    $payload = json_encode($request);

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $payload
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        Logger::error('seo', "GSC API Error per $siteUrl", ['response' => $response]);
        return [];
    }

    $data = json_decode($response, true);
    return $data['rows'] ?? [];
}

function fetchGscProperties(string $accessToken): array {
    $ch = curl_init('https://searchconsole.googleapis.com/webmasters/v3/sites');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) return [];
    $data = json_decode($response, true);
    return array_values(array_filter(array_map(fn($entry) => $entry['siteUrl'] ?? '', $data['siteEntry'] ?? [])));
}

function chooseGscProperty(array $properties, string $publicUrl): string {
    $normalizedUrl = rtrim($publicUrl, '/') . '/';
    $host = strtolower((string)(parse_url(preg_replace('/^sc-domain:/i', 'https://', $publicUrl), PHP_URL_HOST) ?? ''));
    $candidates = array_values(array_filter([
        $normalizedUrl,
        rtrim($publicUrl, '/'),
        $host !== '' ? 'sc-domain:' . $host : '',
    ]));
    foreach ($candidates as $candidate) {
        foreach ($properties as $property) {
<?php
require_once __DIR__ . '/../../config/db.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) require_once __DIR__ . '/../middleware/logger.php';
require_once __DIR__ . '/../services/visibility.php';

// Cron job da eseguire giornalmente (es. alle 3 del mattino)
// Recupera i dati da Google Search Console per ogni utente.

function getGoogleAccessToken(string $jsonFile): string {
    if (!file_exists($jsonFile)) throw new Exception("GCP Credentials file not found: $jsonFile");
    $credentials = json_decode(file_get_contents($jsonFile), true);
    if (!$credentials || !isset($credentials['client_email']) || !isset($credentials['private_key'])) {
        throw new Exception("Invalid GCP Credentials JSON");
    }

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/webmasters.readonly',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = '';
    openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $credentials['private_key'], "sha256WithRSAEncryption");
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ])
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("OAuth Error: $response");
    }

    $data = json_decode($response, true);
    return $data['access_token'];
}

function fetchGscData(string $accessToken, string $siteUrl, string $startDate, string $endDate, array $dimensions = ['date'], string $pagePrefix = '', int $rowLimit = 1000): array {
    $apiUrl = "https://searchconsole.googleapis.com/webmasters/v3/sites/" . urlencode($siteUrl) . "/searchAnalytics/query";
    $request = [
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dimensions' => $dimensions,
        'rowLimit' => $rowLimit,
        'dataState' => 'final',
    ];
    if ($pagePrefix !== '') {
        $request['dimensionFilterGroups'] = [[
            'groupType' => 'and',
            'filters' => [[
                'dimension' => 'page',
                'operator' => 'contains',
                'expression' => $pagePrefix,
            ]],
        ]];
    }
    $payload = json_encode($request);

    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => $payload
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        Logger::error('seo', "GSC API Error per $siteUrl", ['response' => $response]);
        return [];
    }

    $data = json_decode($response, true);
    return $data['rows'] ?? [];
}

function fetchGscProperties(string $accessToken): array {
    $ch = curl_init('https://searchconsole.googleapis.com/webmasters/v3/sites');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) return [];
    $data = json_decode($response, true);
    return array_values(array_filter(array_map(fn($entry) => $entry['siteUrl'] ?? '', $data['siteEntry'] ?? [])));
}

function chooseGscProperty(array $properties, string $publicUrl): string {
    $normalizedUrl = rtrim($publicUrl, '/') . '/';
    $host = strtolower((string)(parse_url(preg_replace('/^sc-domain:/i', 'https://', $publicUrl), PHP_URL_HOST) ?? ''));
    $candidates = array_values(array_filter([
        $normalizedUrl,
        rtrim($publicUrl, '/'),
        $host !== '' ? 'sc-domain:' . $host : '',
    ]));
    foreach ($candidates as $candidate) {
        foreach ($properties as $property) {
            if (strcasecmp($candidate, $property) === 0) return $property;
        }
    }
    return $normalizedUrl;
}

try {
    VisibilityAnalytics::ensureSchema();

    $isForce = (isset($argv[1]) && $argv[1] === 'force');
    $intervalHours = 24;
    try {
        $row = DB::fetch("SELECT key_value FROM system_settings WHERE key_name='cron_interval_seo'");
        if ($row && is_numeric($row['key_value'])) $intervalHours = (int)$row['key_value'];
    } catch (Throwable $e) {}

    if (!$isForce && $intervalHours > 0) {
        try {
            $lastRow = DB::fetch("SELECT run_at FROM cron_logs WHERE job_name='fetch_seo' AND status='success' ORDER BY run_at DESC LIMIT 1");
            if ($lastRow) {
                $lastRun = strtotime($lastRow['run_at']);
                if ((time() - $lastRun) < ($intervalHours * 3600)) {
                    echo "[" . date('Y-m-d H:i:s') . "] Fetch SEO non necessario (intervallo: $intervalHours ore). Ultima esecuzione: " . $lastRow['run_at'] . "\n";
                    exit;
                }
            }
        } catch (Throwable $e) {}
    }

    Logger::info('seo', 'Avvio esecuzione cron fetch_seo', ['force' => $isForce, 'interval_hours' => $intervalHours]);

    $credentialsPath = defined('GCP_CREDENTIALS_PATH')
        ? GCP_CREDENTIALS_PATH
        : __DIR__ . '/../../config/gcp-credentials.json';
    if (!file_exists($credentialsPath)) {
        Logger::warn('seo', "File credenziali Google (gcp-credentials.json) non trovato. Skipping SEO fetch.");
        echo "GCP Credentials non configurate.\n";
        exit;
    }

    $token = getGoogleAccessToken($credentialsPath);
    $availableProperties = fetchGscProperties($token);

    // Ipotizziamo di fetchare i dati di 2 giorni fa (spesso GSC ha un delay di 48h)
    $targetDate = date('Y-m-d', strtotime('-2 days'));

    $sites = DB::fetchAll("SELECT s.user_id, s.custom_domain, u.slug FROM sites s JOIN users u ON u.id=s.user_id WHERE u.slug IS NOT NULL AND u.slug<>''");
    $basePlatformUrl = function_exists('app_base_url') ? app_base_url() : 'http://localhost';
    try {
        DB::execute('INSERT INTO cron_logs (job_name, status, details) VALUES (?, ?, ?)', [
            'fetch_seo',
            'failed',
            $e->getMessage()
        ]);
    } catch (Throwable $dbErr) {}

    echo "Errore: " . $e->getMessage() . "\n";
}
