<?php

/** Short-lived reset capabilities bound to the current account credentials. */
final class PasswordRecovery
{
    public const LIFETIME = 1800;
    public const REQUEST_MESSAGE = 'Se l’indirizzo è associato a un account, riceverai un’email con il link per reimpostare la password. Controlla anche la cartella spam.';

    private static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function signature(string $payload, array $user, string $secret): string
    {
        $key = hash_hmac('sha256', json_encode([
            'password-reset-v1', (int)$user['id'], (string)$user['email'],
            (string)$user['password'], (int)$user['token_version'],
        ]), $secret, true);
        return self::encode(hash_hmac('sha256', $payload, $key, true));
    }

    public static function issue(array $user, string $secret, ?int $now = null): string
    {
        if (strlen($secret) < 24) throw new RuntimeException('Recovery signing key is not configured');
        $now ??= time();
        $payload = self::encode(json_encode([
            'purpose' => 'password-reset', 'uid' => (int)$user['id'],
            'exp' => $now + self::LIFETIME, 'nonce' => bin2hex(random_bytes(24)),
        ]));
        return $payload . '.' . self::signature($payload, $user, $secret);
    }

    public static function claims(string $token, ?int $now = null): ?array
    {
        if (strlen($token) > 1024 || !preg_match('/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/D', $token, $parts)) return null;
        $payload = json_decode((string)base64_decode(strtr($parts[1], '-_', '+/'), true), true);
        $now ??= time();
        if (!is_array($payload) || ($payload['purpose'] ?? '') !== 'password-reset'
            || !is_int($payload['uid'] ?? null) || $payload['uid'] <= 0
            || !is_int($payload['exp'] ?? null) || $payload['exp'] <= $now
            || $payload['exp'] > $now + self::LIFETIME
            || !is_string($payload['nonce'] ?? null) || !preg_match('/^[a-f0-9]{48}$/D', $payload['nonce'])) return null;
        return $payload;
    }

    public static function valid(string $token, array $user, string $secret, ?int $now = null): bool
    {
        $claims = self::claims($token, $now);
        if (!$claims || strlen($secret) < 24 || $claims['uid'] !== (int)$user['id']) return false;
        [$payload, $signature] = explode('.', $token, 2);
        return hash_equals(self::signature($payload, $user, $secret), $signature);
    }

    public static function link(string $baseUrl, string $token): string
    {
        $url = parse_url($baseUrl);
        if (!$url || !in_array($url['scheme'] ?? '', ['https', 'http'], true) || empty($url['host'])
            || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])) {
            throw new RuntimeException('Recovery base URL is not configured');
        }
        // Fragment tokens are not sent in HTTP requests or Referer headers.
        return rtrim($baseUrl, '/') . '/accedi#reset-password=' . rawurlencode($token);
    }

    public static function password(string $password): void
    {
        if (strlen($password) < 10 || strlen($password) > 72) throw new InvalidArgumentException('La password deve contenere da 10 a 72 caratteri.');
    }

    public static function throttle(string $identity, string $ip): int
    {
        $key = 'recovery:' . hash('sha256', $identity);
        $email = DB::fetch("SELECT COUNT(*) c,UNIX_TIMESTAMP(MAX(attempted_at)) last_at FROM login_attempts WHERE email=? AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)", [$key]) ?: [];
        $network = DB::fetch("SELECT COUNT(*) c,UNIX_TIMESTAMP(MAX(attempted_at)) last_at FROM login_attempts WHERE ip=? AND email LIKE 'recovery:%' AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)", [$ip]) ?: [];
        if ((int)($email['c'] ?? 0) >= 5 || (int)($network['c'] ?? 0) >= 20) {
            return max(1, max((int)($email['last_at'] ?? 0), (int)($network['last_at'] ?? 0)) + 900 - time());
        }
        // Namespaced events are excluded from failed-login counts. No token or
        // actual email address is persisted in the rate-limiting record.
        DB::execute('INSERT INTO login_attempts(email,ip,succeeded) VALUES(?,?,1)', [$key, $ip]);
        return 0;
    }

    public static function request(string $email, string $baseUrl, string $secret, callable $send): void
    {
        $user = DB::fetch('SELECT id,email,password,token_version FROM users WHERE email=? LIMIT 1', [$email]);
        if (!$user) return;
        $token = self::issue($user, $secret);
        $link = self::link($baseUrl, $token);
        if (!$send($user['email'], $link)) throw new RuntimeException('Recovery email delivery failed');
    }

    public static function reset(string $token, string $password, string $secret): bool
    {
        self::password($password);
        $claims = self::claims($token);
        if (!$claims) return false;
        $user = DB::fetch('SELECT id,email,password,token_version FROM users WHERE id=? LIMIT 1', [$claims['uid']]);
        if (!$user || !self::valid($token, $user, $secret)) return false;
        if (password_verify($password, $user['password'])) throw new InvalidArgumentException('Scegli una password diversa da quella attuale.');
        // Compare-and-swap makes concurrent requests and replay single-use.
        $updated = DB::execute('UPDATE users SET password=?,token_version=token_version+1 WHERE id=? AND password=? AND token_version=?', [
            password_hash($password, PASSWORD_BCRYPT), (int)$user['id'], $user['password'], (int)$user['token_version'],
        ]);
        if ($updated !== 1) return false;
        // A recovered account can log in even after previously failed attempts.
        try { DB::execute('DELETE FROM login_attempts WHERE email=? AND succeeded=0', [$user['email']]); }
        catch (Throwable $e) { error_log('[password-recovery] Could not clear previous login attempts'); }
        return true;
    }
}

/** SMTP settings already used by the monitor, or the hosting's PHP mail transport. */
final class PasswordRecoveryMailer
{
    public static function send(string $to, string $link): bool
    {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) return false;
        $subject = 'Reimposta la password di All Social To Web';
        $body = "Hai richiesto di reimpostare la password di All Social To Web.\n\nApri questo link entro 30 minuti:\n" . $link
            . "\n\nIl link può essere usato una sola volta. Se non hai fatto questa richiesta, ignora l’email: la tua password non è cambiata.\n";
        $settings = [];
        try { $settings = DB::fetch('SELECT * FROM monitor_alert_settings WHERE id=1') ?: []; }
        catch (Throwable $e) { /* SMTP is optional; no schema creation in recovery. */ }
        if (trim((string)($settings['smtp_host'] ?? '')) !== '') {
            require_once __DIR__ . '/monitor_settings.php';
            return !empty(monitor_smtp_send($settings, $to, $subject, $body)['ok']);
        }
        if (!function_exists('mail')) return false;
        return mail($to, $subject, $body, ['MIME-Version' => '1.0', 'Content-Type' => 'text/plain; charset=UTF-8']);
    }
}
