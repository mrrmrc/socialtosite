<?php
// api/middleware/jwt.php — JWT puro PHP, zero dipendenze
require_once __DIR__ . '/../../config/config.php';

class JWT {
    // 7 giorni invece di 30: un token rubato ha una finestra utile molto più
    // corta. La revoca immediata passa comunque da users.token_version.
    public static function encode(array $payload, int $expDays = 7): string {
        $payload['iat'] = time();
        $payload['exp'] = time() + ($expDays * 86400);
        $header  = self::b64(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = self::b64(json_encode($payload));
        $sig     = self::b64(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        return "$header.$payload.$sig";
    }

    public static function decode(string $token): ?array {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return null;
        [$header, $payload, $sig] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$header.$payload", JWT_SECRET, true));
        if (!hash_equals($expected, $sig)) return null;
        $data = json_decode(self::b64d($payload), true);
        if (!$data || $data['exp'] < time()) return null;
        return $data;
    }

    public static function fromRequest(): ?array {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!str_starts_with($auth, 'Bearer ')) return null;
        return self::decode(substr($auth, 7));
    }

    public static function require(): array {
        $user = self::fromRequest();
        if (!$user) { http_response_code(401); echo json_encode(['error' => 'Non autorizzato']); exit; }
        return $user;
    }

    private static function b64(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    private static function b64d(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
