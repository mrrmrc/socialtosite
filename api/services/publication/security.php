<?php

final class PublicationSecurity
{
    private static function key(): string
    {
        $key = getenv('PUBLICATION_ENCRYPTION_KEY') ?: '';
        $decoded = base64_decode($key, true);
        if ($decoded === false || strlen($decoded) !== 32) {
            throw new RuntimeException('Configurare PUBLICATION_ENCRYPTION_KEY (32 byte in base64).');
        }
        return $decoded;
    }

    public static function encrypt(string $value): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($value, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) throw new RuntimeException('Cifratura non disponibile.');
        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(string $value): string
    {
        $raw = base64_decode($value, true);
        if ($raw === false || strlen($raw) < 29) throw new RuntimeException('Credenziale non valida.');
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        if ($plain === false) throw new RuntimeException('Credenziale non decifrabile.');
        return $plain;
    }

    public static function endpoint(string $url): string
    {
        $url = rtrim(trim($url), '/');
        $parts = parse_url($url);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) ||
            isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment']) ||
            (isset($parts['port']) && $parts['port'] !== 443) || preg_match('/[\x00-\x20\\\\]/', $url)) {
            throw new InvalidArgumentException('Usare un indirizzo HTTPS pubblico senza credenziali o parametri.');
        }
        if (!preg_match('/^[a-z0-9.-]+$/i', $parts['host'])) throw new InvalidArgumentException('Host non valido.');
        return $url;
    }

    public static function publicIp(string $ip): bool
    {
        // Solo IPv4 per questa prima versione: niente bypass tramite IPv6 mapped.
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false
            && !self::inBlockedRange($ip);
    }

    private static function inBlockedRange(string $ip): bool
    {
        $n = ip2long($ip);
        if ($n === false) return true;
        foreach ([['100.64.0.0',10],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as [$network,$bits]) {
            $mask = (0xffffffff << (32 - $bits)) & 0xffffffff;
            if (($n & $mask) === (ip2long($network) & $mask)) return true;
        }
        return false;
    }

    public static function signature(string $secret, string $timestamp, string $nonce, string $method, string $route, string $body): string
    {
        return hash_hmac('sha256', implode("\n", [$timestamp, $nonce, $method, $route, hash('sha256', $body)]), $secret);
    }
}
