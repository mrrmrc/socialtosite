<?php
require_once __DIR__ . '/security.php';

final class WordPressPublicationAdapter
{
    public static function request(array $connection, string $method, string $route, ?array $payload = null): array
    {
        $endpoint = PublicationSecurity::endpoint($connection['endpoint']);
        $host = parse_url($endpoint, PHP_URL_HOST);
        $ips = gethostbynamel($host) ?: [];
        if (!$ips) throw new RuntimeException('Host non risolvibile.');
        foreach ($ips as $ip) if (!PublicationSecurity::publicIp($ip)) throw new RuntimeException('Destinazione non pubblica.');
        $body = $payload === null ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $timestamp = (string)time();
        $nonce = bin2hex(random_bytes(16));
        $signature = PublicationSecurity::signature(PublicationSecurity::decrypt($connection['secret_ciphertext']), $timestamp, $nonce, $method, $route, $body);
        $response = '';
        $ch = curl_init($endpoint . '/wp-json/allsocialtoweb/v1' . $route);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-ASTW-Time: ' . $timestamp, 'X-ASTW-Nonce: ' . $nonce, 'X-ASTW-Signature: ' . $signature],
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_PROXY => '',
            CURLOPT_RESOLVE => [$host . ':443:' . $ips[0]],
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$response): int {
                if (strlen($response) + strlen($chunk) > 1048576) return 0;
                $response .= $chunk;
                return strlen($chunk);
            },
        ]);
        if ($payload !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        $ok = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($ok === false) throw new RuntimeException('Connessione interrotta: verificare la consegna prima di ripetere.');
        if (in_array($status, [401, 403], true)) throw new RuntimeException('Collegamento non autorizzato: riconnettere il sito.');
        if ($status < 200 || $status >= 300) throw new RuntimeException('Il sito ha risposto con HTTP ' . $status . '.');
        $data = json_decode($response, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($data)) throw new RuntimeException('Risposta del connettore non valida.');
        return $data;
    }
}
