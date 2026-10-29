<?php
// Run the real authenticated route with an isolated database stub.
class AccountResponse extends RuntimeException { public function __construct(public array $data, public int $status = 200) { parent::__construct('response'); } }
function json(array $data, int $status = 200): void { throw new AccountResponse($data, $status); }
function jsonError(string $message, int $status = 400): void { throw new AccountResponse(['error' => $message], $status); }
function body(): array { return $GLOBALS['payload']; }
class DB {
    public static bool $duplicate = false;
    public static array $writes = [];
    public static function fetch(string $sql, array $params): ?array {
        if (str_contains($sql, 'password FROM users')) return ['password' => password_hash('correct-password', PASSWORD_BCRYPT)];
        return self::$duplicate ? ['id' => 88] : null;
    }
    public static function execute(string $sql, array $params): void { self::$writes[] = [$sql, $params]; }
}
$source = file_get_contents(__DIR__ . '/../api/index.php');
$start = strpos($source, "if (\$action === 'account-update'");
$end = strpos($source, "\nif (\$action === 'sync-status'", $start);
if ($start === false || $end === false || $start < strpos($source, '$me = JWT::require();')) throw new RuntimeException('Account route must follow the verified identity boundary');
$route = substr($source, $start, $end - $start);
function runAccount(array $input, string $route): AccountResponse {
    $GLOBALS['payload'] = $input;
    $action = 'account-update'; $method = 'POST'; $userId = 7;
    $me = ['id' => 7, 'email' => 'old@example.test', 'name' => 'Old', 'role' => 'user', 'plan' => 'base', 'slug' => 'old', 'tv' => 2];
    try { eval($route); } catch (AccountResponse $response) { return $response; }
    throw new RuntimeException('Response missing');
}
function accountCheck(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
$response = runAccount(['name' => 'New Name', 'email' => 'old@example.test', 'id' => 99, 'role' => 'admin', 'plan' => 'agency'], $route);
accountCheck($response->status === 200 && $response->data['user']['role'] === 'user' && $response->data['user']['plan'] === 'base', 'Self-service cannot change privileges');
accountCheck(DB::$writes[0][1] === ['New Name', 'old@example.test', 7], 'Writes target the authenticated account only');
accountCheck(!isset($response->data['user']['tv']) && !isset($response->data['user']['password']), 'Private authentication fields are excluded');
foreach ([[], ['name' => '', 'email' => 'a@example.test'], ['name' => 'Test', 'email' => 'invalid'], ['name' => [], 'email' => 'a@example.test']] as $input) accountCheck(runAccount($input, $route)->status === 422, 'Invalid account fields rejected');
$before = count(DB::$writes);
accountCheck(runAccount(['name' => 'Test', 'email' => 'new@example.test'], $route)->status === 403, 'Email change requires password');
accountCheck(runAccount(['name' => 'Test', 'email' => 'new@example.test', 'current_password' => 'wrong'], $route)->status === 403, 'Incorrect password rejected');
accountCheck(count(DB::$writes) === $before, 'Failed password verification never writes data');
accountCheck(runAccount(['name' => 'Test', 'email' => 'NEW@example.test', 'current_password' => 'correct-password'], $route)->data['user']['email'] === 'new@example.test', 'Verified email change is normalized and saved');
DB::$duplicate = true;
$before = count(DB::$writes);
accountCheck(runAccount(['name' => 'Test', 'email' => 'old@example.test'], $route)->status === 409 && count(DB::$writes) === $before, 'Duplicate address does not write');
echo "Account update: validation, password verification, ownership, privilege isolation and duplicate email passed.\n";
