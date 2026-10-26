<?php
// Exercise the real authentication boundary and /me route without storage/network.
function checkIdentity(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
}
class IdentityResponse extends RuntimeException {
    public function __construct(public array $data, public int $status) { parent::__construct('response'); }
}
function json(array $data, int $status = 200): void { throw new IdentityResponse($data, $status); }
class JWT {
    public static array $claims = [];
    public static function require(): array { return self::$claims; }
}
class DB {
    public static ?array $account;
    public static array $queries = [];
    public static function fetch(string $sql, array $params): ?array {
        self::$queries[] = [$sql, $params];
        return self::$account;
    }
}
$source = file_get_contents(__DIR__ . '/../api/index.php');
$start = strpos($source, '$me = JWT::require();');
$end = strpos($source, "\nif (str_starts_with(\$action, 'publication-'))", $start);
checkIdentity($start !== false && $end !== false, 'Authentication boundary exists');
$boundary = substr($source, $start, $end - $start);
$start = strpos($source, "if (\$action === 'me' && \$method === 'GET') {");
$end = strpos($source, "\nif (\$action ===", $start + 1);
$route = substr($source, $start, $end - $start);
JWT::$claims = ['id' => 7, 'role' => 'user', 'plan' => 'base', 'tv' => 3];
DB::$account = ['id' => 7, 'email' => 'admin@example.test', 'name' => 'Amministratore', 'slug' => 'admin', 'role' => 'admin', 'plan' => 'agency', 'token_version' => 3];
eval($boundary);
checkIdentity($isAdmin && $me['role'] === 'admin' && $me['plan'] === 'agency', 'Role and plan come from current account, not stale token claims');
checkIdentity(str_contains(DB::$queries[0][0], 'role, plan, token_version'), 'Identity lookup reads current plan');
$action = 'me'; $method = 'GET';
try { eval($route); throw new RuntimeException('No identity response'); }
catch (IdentityResponse $result) {
    checkIdentity($result->status === 200 && $result->data['user']['role'] === 'admin' && $result->data['user']['plan'] === 'agency', 'Session endpoint returns authoritative identity');
    checkIdentity(!isset($result->data['user']['token_version']), 'Internal revocation version is not exposed');
}
JWT::$claims['role'] = 'admin'; JWT::$claims['plan'] = 'agency';
DB::$account['role'] = 'user'; DB::$account['plan'] = 'professional';
eval($boundary);
checkIdentity(!$isAdmin && $me['plan'] === 'professional', 'Stale admin claims cannot override current user role');
DB::$account['token_version'] = 4;
try { eval($boundary); throw new RuntimeException('Revoked token accepted'); }
catch (IdentityResponse $result) { checkIdentity($result->status === 401, 'Revoked sessions remain rejected'); }
DB::$account = null;
try { eval($boundary); throw new RuntimeException('Deleted account accepted'); }
catch (IdentityResponse $result) { checkIdentity($result->status === 401, 'Deleted accounts remain rejected'); }
echo "Session identity: authoritative role/plan, safe response, revoked and deleted sessions passed.\n";
