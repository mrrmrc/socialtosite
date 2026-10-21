<?php
// No database connection, production credentials, emails or external requests.
require_once __DIR__ . '/../api/services/password_recovery.php';
function recoveryCheck(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function recoveryRejects(callable $call): void {
    try { $call(); } catch (InvalidArgumentException $e) { return; }
    throw new RuntimeException('Expected invalid input rejection');
}
class DB {
    public static array $users = [], $events = [];
    public static bool $loseRace = false, $unavailable = false;
    public static int $quota = 0;
    public static function fetch(string $sql, array $params = []): ?array {
        if (self::$unavailable) throw new RuntimeException('Private database details');
        if (str_contains($sql, 'COUNT(*)')) return ['c' => self::$quota, 'last_at' => time()];
        foreach (self::$users as $user) if ((str_contains($sql, 'WHERE email=') ? $user['email'] : $user['id']) === $params[0]) return $user;
        return null;
    }
    public static function execute(string $sql, array $params = []): int {
        self::$events[] = [$sql, $params];
        if (str_starts_with($sql, 'UPDATE users SET password=')) {
            [$hash, $id, $previous, $version] = $params;
            if (self::$loseRace) return 0;
            $user = self::$users[$id] ?? null;
            if (!$user || $user['password'] !== $previous || $user['token_version'] !== $version) return 0;
            self::$users[$id]['password'] = $hash;
            self::$users[$id]['token_version']++;
        }
        return 1;
    }
}
define('JWT_SECRET', str_repeat('test-only-secret-', 3));
$secret = JWT_SECRET;
$user = ['id' => 7, 'email' => 'owner@example.test', 'password' => password_hash('Original-password-123', PASSWORD_BCRYPT), 'token_version' => 4];
DB::$users = [7 => $user];
$token = PasswordRecovery::issue($user, $secret);
recoveryCheck(PasswordRecovery::valid($token, $user, $secret), 'Authentic token accepted');
recoveryCheck(PasswordRecovery::issue($user, $secret) !== $token, 'Requests have independent random nonces');
recoveryCheck(!PasswordRecovery::valid($token, $user, 'another-secret-with-sufficient-length'), 'Wrong signing key rejected');
recoveryCheck(!PasswordRecovery::valid($token . 'x', $user, $secret), 'Tampering rejected');
recoveryCheck(!PasswordRecovery::valid($token, $user, $secret, time() + 1801), 'Expired link rejected');
recoveryCheck(!PasswordRecovery::valid($token, array_replace($user, ['token_version' => 5]), $secret), 'Session revocation invalidates reset tokens');
recoveryCheck(!PasswordRecovery::valid($token, array_replace($user, ['email' => 'changed@example.test']), $secret), 'Email change invalidates reset tokens');
recoveryCheck(!PasswordRecovery::valid($token, array_replace($user, ['id' => 8]), $secret), 'Token cannot target another account');
foreach (['', 'broken', str_repeat('x', 1025)] as $bad) recoveryCheck(PasswordRecovery::claims($bad) === null, 'Malformed token rejected');
foreach (['short', str_repeat('x', 73)] as $password) recoveryRejects(fn() => PasswordRecovery::password($password));
$link = PasswordRecovery::link('https://example.test', $token);
recoveryCheck(parse_url($link, PHP_URL_QUERY) === null && str_contains($link, '/accedi#reset-password='), 'Token stays out of server URLs and referrers');
$sent = [];
$send = function ($email, $url) use (&$sent) { $sent[] = [$email, $url]; return true; };
PasswordRecovery::request('unknown@example.test', 'https://example.test', $secret, $send);
recoveryCheck($sent === [], 'Unknown email never receives a link');
PasswordRecovery::request($user['email'], 'https://example.test', $secret, $send);
recoveryCheck(count($sent) === 1 && $sent[0][0] === $user['email'], 'Email only delivered to saved account address');
$issued = rawurldecode(substr(parse_url($sent[0][1], PHP_URL_FRAGMENT), strlen('reset-password=')));
recoveryCheck(PasswordRecovery::valid($issued, $user, $secret), 'Delivered token works');
recoveryRejects(fn() => PasswordRecovery::reset($token, 'Original-password-123', $secret));
DB::$loseRace = true;
recoveryCheck(!PasswordRecovery::reset($token, 'Replacement-password-123', $secret), 'Concurrent reset cannot succeed twice');
DB::$loseRace = false;
recoveryCheck(PasswordRecovery::reset($token, 'Replacement-password-123', $secret), 'Reset completed');
recoveryCheck(password_verify('Replacement-password-123', DB::$users[7]['password']) && DB::$users[7]['token_version'] === 5, 'Password hashed and all sessions revoked');
recoveryCheck(!PasswordRecovery::reset($token, 'Another-password-123', $secret), 'Token replay rejected');
recoveryCheck(!PasswordRecovery::valid($issued, DB::$users[7], $secret), 'Other pending links invalidated after reset');
recoveryCheck(PasswordRecovery::throttle('request:unknown@example.test', '192.0.2.1') === 0, 'Initial recovery request allowed');
$event = end(DB::$events);
recoveryCheck(!str_contains(json_encode($event), 'unknown@example.test') && $event[1][0] !== $token, 'Rate limiting stores neither emails nor reset tokens');
DB::$quota = 5;
recoveryCheck(PasswordRecovery::throttle('request:unknown@example.test', '192.0.2.1') > 0, 'Excessive requests throttled');
DB::$quota = 0;

// Exercise the public auth branch without loading application bootstrap.
class RecoveryResponse extends RuntimeException {
    public function __construct(public array $data, public int $status) { parent::__construct('response'); }
}
function json(array $data, int $status = 200): void { throw new RecoveryResponse($data, $status); }
function jsonError(string $error, int $status = 400): void { json(['error' => $error], $status); }
function body(): array { return $GLOBALS['recoveryBody']; }
function app_base_url(): string { return 'https://example.test'; }
class LoginGuard { public static function clientIp(): string { return '192.0.2.2'; } public static function ensureSchema(): void {} }
function recoveryRoute(string $path, array $payload): RecoveryResponse {
    $method = 'POST'; $GLOBALS['recoveryBody'] = $payload;
    $code = file_get_contents(__DIR__ . '/../api/routes/auth.php');
    $start = strpos($code, "if (\$method === 'POST' && in_array(\$path, ['forgot-password'");
    $end = strpos($code, '// POST /api/auth.php?action=login', $start);
    $code = str_replace('__DIR__', var_export(realpath(__DIR__ . '/../api/routes'), true), substr($code, $start, $end - $start));
    try { eval($code); } catch (RecoveryResponse $response) { return $response; }
    throw new RuntimeException('Missing recovery response');
}
recoveryCheck(recoveryRoute('forgot-password', ['email' => 'not-an-email'])->status === 422, 'Email syntax validated');
$response = recoveryRoute('forgot-password', ['email' => 'unknown@example.test']);
recoveryCheck($response->status === 202 && $response->data['message'] === PasswordRecovery::REQUEST_MESSAGE && !isset($response->data['token']), 'Unknown account response is generic without token');
DB::$quota = 5;
recoveryCheck(recoveryRoute('forgot-password', ['email' => 'unknown@example.test'])->status === 429, 'Public endpoint throttles requests');
DB::$quota = 0;
recoveryCheck(recoveryRoute('reset-password', ['token' => 'bad', 'password' => 'Valid-password-123', 'password_confirmation' => 'different'])->status === 422, 'Confirmation checked');
recoveryCheck(recoveryRoute('reset-password', ['token' => 'bad', 'password' => 'Valid-password-123', 'password_confirmation' => 'Valid-password-123'])->status === 422, 'Invalid link rejected by public route');
$freshToken = PasswordRecovery::issue(DB::$users[7], $secret);
recoveryCheck(recoveryRoute('reset-password', ['token' => $freshToken, 'password' => 'Final-password-123', 'password_confirmation' => 'Final-password-123'])->status === 200, 'Public reset flow completes');
DB::$unavailable = true;
recoveryCheck(recoveryRoute('forgot-password', ['email' => 'unknown@example.test'])->status === 503, 'Unavailable throttle storage fails closed');
echo "Password recovery: signatures, expiry, single use, concurrent resets, account binding, delivery boundary, throttling, generic responses and public routes passed.\n";
