<?php
require_once __DIR__ . '/../../config/db.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) require_once __DIR__ . '/../middleware/logger.php';

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

function fetchGscData(string $accessToken, string $siteUrl, string $startDate, string $endDate): array {
    $apiUrl = "https://searchconsole.googleapis.com/webmasters/v3/sites/" . urlencode($siteUrl) . "/searchAnalytics/query";
    $payload = json_encode([
        'startDate' => $startDate,
        'endDate' => $endDate,
        'dimensions' => ['date']
    ]);

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

try {
    $credentialsPath = __DIR__ . '/../../config/gcp-credentials.json';
    if (!file_exists($credentialsPath)) {
        Logger::warn('seo', "File credenziali Google (gcp-credentials.json) non trovato. Skipping SEO fetch.");
        echo "GCP Credentials non configurate.\n";
        exit;
    }

    $token = getGoogleAccessToken($credentialsPath);

    // Ipotizziamo di fetchare i dati di 2 giorni fa (spesso GSC ha un delay di 48h)
    $targetDate = date('Y-m-d', strtotime('-2 days'));

    $sites = DB::fetchAll("SELECT user_id, custom_domain FROM sites");
    $basePlatformUrl = defined('BASE_URL') ? rtrim(BASE_URL, '/') : 'https://allsocialtoweb.com';

    foreach ($sites as $site) {
        // La property su GSC potrebbe essere il dominio personalizzato o il prefisso (sc-domain:...)
        // Per semplicità usiamo il dominio base, ma potresti voler adattare.
        $siteUrl = !empty($site['custom_domain']) ? $site['custom_domain'] : $basePlatformUrl; 
        
        $rows = fetchGscData($token, $siteUrl, $targetDate, $targetDate);
        
        $totalClicks = 0;
        $totalImpressions = 0;
        $totalPosition = 0;
        $count = 0;

        foreach ($rows as $row) {
            $totalClicks += $row['clicks'];
            $totalImpressions += $row['impressions'];
            $totalPosition += ($row['position'] * $row['impressions']); // weighted average
            $count++;
        }

        if ($totalImpressions > 0) {
            $avgPosition = $totalPosition / $totalImpressions;
            $ctr = ($totalClicks / $totalImpressions) * 100;
        } else {
            $avgPosition = 0;
            $ctr = 0;
        }

        DB::execute("
            INSERT INTO seo_analytics (user_id, record_date, impressions, clicks, ctr, position)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE impressions=?, clicks=?, ctr=?, position=?
        ", [
            $site['user_id'], $targetDate, $totalImpressions, $totalClicks, $ctr, $avgPosition,
            $totalImpressions, $totalClicks, $ctr, $avgPosition
        ]);
        
        Logger::info('seo', "Aggiornata SEO", ['user_id' => $site['user_id'], 'date' => $targetDate, 'clicks' => $totalClicks]);
    }
    
    echo "Sync completata.\n";

} catch (Exception $e) {
    Logger::error('seo', 'Cron Error', ['error' => $e->getMessage()]);
    echo "Errore: " . $e->getMessage() . "\n";
}
