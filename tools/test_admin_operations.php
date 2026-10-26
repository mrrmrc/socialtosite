<?php
require_once __DIR__ . '/../api/services/admin_validation.php';

function checkAdmin(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function rejectsAdmin(callable $call): void {
    try { $call(); } catch (InvalidArgumentException $e) { return; }
    throw new RuntimeException('Invalid input was accepted');
}
foreach ([-1, 'abc', [], INF, 1000000000] as $amount) rejectsAdmin(fn() => AdminValidation::amount($amount));
checkAdmin(AdminValidation::amount('0') === 0.0 && AdminValidation::amount('', true) === null, 'Zero and unlimited budget');
foreach ([['cron_interval_sync' => 0], ['cron_interval_seo' => '1.5'], ['cron_interval_sync' => 169], ['arbitrary_setting' => 2]] as $settings) rejectsAdmin(fn() => AdminValidation::settings($settings));
checkAdmin(AdminValidation::settings(['cron_interval_sync' => '6']) === ['cron_interval_sync' => '6'], 'Valid interval');

// Exercise the actual router branches with an in-memory database boundary.
// No application bootstrap, credentials, database connection or network access.
class AdminResponse extends RuntimeException {
    public function __construct(public array $data, public int $status = 200) { parent::__construct('response'); }
}
function json(array $data, int $status = 200): void { throw new AdminResponse($data, $status); }
function jsonError(string $message, int $status = 400): void { json(['error' => $message], $status); }
function body(): array { return $GLOBALS['adminTestBody']; }
function requireAdmin(bool $admin): void { if (!$admin) jsonError('Forbidden', 403); }
function revokeSessions(int $id): void { DB::$revocations[] = $id; }
class JWT { public static array $payload; public static function encode(array $payload, int $days = 7): string { self::$payload = $payload; return 'test-token'; } }
class ProviderConfig { public static function ensureSchema(): void {} }
class DB {
    public static array $writes = [], $revocations = [];
    public static bool $failTotals = false;
    public static bool $failUserDetails = false, $failSources = false;
    public static function fetch(string $sql, array $params = []): ?array {
        if (str_contains($sql, 'COUNT(*) AS value')) {
            if (self::$failTotals) throw new RuntimeException('Private database error');
            return ['value' => str_contains($sql, 'FROM users') ? 17 : (str_contains($sql, 'published=1') ? 123 : 9)];
        }
        if (($params[0] ?? null) === 404) return null;
        if (str_contains($sql, 'agent_prompt_versions')) return ['agent_name' => 'content_editor', 'instructions' => 'Previous instructions'];
        if (str_contains($sql, 'agent_prompts')) return ['instructions' => 'Current instructions'];
        return ['id' => $params[0] ?? 2, 'email' => 'test@example.test', 'name' => 'Test', 'slug' => 'test', 'plan' => 'base', 'role' => 'admin', 'token_version' => 9];
    }
    public static function fetchAll(string $sql, array $params = []): array {
        if (str_contains($sql, 'COUNT(DISTINCT p.id)')) {
            if (self::$failUserDetails) throw new RuntimeException('Private user query error');
            return [['id' => 2, 'name' => 'Cliente', 'posts_count' => 3, 'sources_count' => 1]];
        }
        if (str_contains($sql, 'NULL AS sources_count')) return [['id' => 2, 'name' => 'Cliente', 'posts_count' => null, 'sources_count' => null]];
        if (str_contains($sql, 'FROM social_sources')) {
            if (self::$failSources) throw new RuntimeException('Private source query error');
            return [['user_id' => 2, 'platform' => 'website', 'url' => 'https://example.test', 'label' => 'Sito']];
        }
        if (str_contains($sql, 'FROM ai_provider_connections')) return [['provider' => 'gemini', 'credential_configured' => 0]];
        return [];
    }
    public static function execute(string $sql, array $params = []): void { self::$writes[] = [$sql, $params]; }
}
function adminRoute(string $action, array $payload, bool $isAdmin = true, string $method = 'POST'): AdminResponse {
    $GLOBALS['adminTestBody'] = $payload;
    DB::$writes = []; DB::$revocations = [];
    $userId = 1;
    $source = file_get_contents(__DIR__ . '/../api/index.php');
    $start = strpos($source, "if (\$action === '$action' && \$method === '$method') {");
    if ($start === false) throw new RuntimeException('Missing route');
    $end = strpos($source, "\nif (\$action ===", $start + 1);
    $route = substr($source, $start, $end === false ? null : $end - $start);
    $route = str_replace('__DIR__', var_export(realpath(__DIR__ . '/../api'), true), $route);
    try { eval($route); } catch (AdminResponse $response) { return $response; }
    throw new RuntimeException('No response');
}
foreach (['admin-kill-process', 'admin-editorial-engine-save', 'admin-content-action', 'admin-revoke-sessions', 'admin-update-user', 'admin-impersonate', 'admin-provider-save', 'admin-settings', 'admin-provider-rates', 'admin-password-reset', 'admin-prompt-restore', 'admin-user-economics'] as $route) {
    checkAdmin(adminRoute($route, [], false)->status === 403 && DB::$writes === [], 'Admin guard: ' . $route);
}
foreach ([['id' => 1, 'role' => 'user'], ['id' => 2, 'plan' => 'invented'], ['id' => 2, 'password' => 'short'], ['id' => 2, 'password' => str_repeat('x', 73)]] as $payload) {
    checkAdmin(adminRoute('admin-update-user', $payload)->status === 422 && DB::$writes === [], 'Invalid account change must not partially save');
}
foreach ([['id' => 2, 'role_mission' => []], ['id' => 2, 'content_strategy' => str_repeat('x', 10001)], ['id' => 2, 'name' => str_repeat('x', 101)]] as $payload) {
    checkAdmin(adminRoute('admin-update-user', $payload)->status === 422 && DB::$writes === [], 'Invalid editorial text cannot partially update the account');
}
checkAdmin(adminRoute('admin-update-user', ['id' => 2, 'role' => 'user'])->status === 200 && DB::$revocations === [2], 'Role change revokes sessions');
checkAdmin(adminRoute('admin-update-user', ['id' => 2, 'password' => 'new-valid-password'])->status === 200 && DB::$revocations === [2], 'Password change revokes sessions');
$response = adminRoute('admin-impersonate', ['id' => 2]);
checkAdmin($response->status === 200 && JWT::$payload['tv'] === 9 && JWT::$payload['impersonated_by'] === 1, 'Assisted login uses current token version and records admin');
checkAdmin(!isset($response->data['user']['token_version']) && $response->data['user']['plan'] === 'base', 'Assisted user has plan without internal version');
checkAdmin(adminRoute('admin-impersonate', ['id' => 404])->status === 404, 'Missing assisted user');
checkAdmin(adminRoute('admin-settings', ['settings' => ['cron_interval_sync' => 0]])->status === 422 && DB::$writes === [], 'Reject invalid schedule before writing');
checkAdmin(adminRoute('admin-settings', ['settings' => ['cron_interval_sync' => '6', 'cron_interval_seo' => '24']])->status === 200 && count(DB::$writes) === 2, 'Save validated schedule');
// Restore uses the existing history and returns the restored text to the editor.
function ensureAdminSchema(): void {}
$response = adminRoute('admin-prompt-restore', ['version_id' => 3]);
checkAdmin($response->data['instructions'] === 'Previous instructions' && count(DB::$writes) === 2, 'Restore archives current text and returns active instructions');
checkAdmin(adminRoute('admin-monitoring', [], false, 'GET')->status === 403, 'Monitoring is admin only');
checkAdmin(adminRoute('admin-content-list', [], false, 'GET')->status === 403, 'Content archive is admin only');
checkAdmin(adminRoute('admin-revoke-sessions', ['id' => 2])->status === 200 && str_contains(DB::$writes[0][0], 'token_version=token_version+1'), 'Admin revokes sessions without changing passwords');
checkAdmin(adminRoute('admin-revoke-sessions', ['id' => 404])->status === 404 && DB::$writes === [], 'Revocation checks target exists');
checkAdmin(adminRoute('admin-editorial-engine-save', ['user_id' => 2, 'min_posts' => 61])->status === 422 && DB::$writes === [], 'Reject impossible analysis threshold');
checkAdmin(adminRoute('admin-editorial-engine-save', ['user_id' => 404, 'min_posts' => 8])->status === 404 && DB::$writes === [], 'Editorial settings require an existing site');
function ensureSiteSchemaUpgrades(): void {}
checkAdmin(adminRoute('admin-users', [], false, 'GET')->status === 403, 'Account inventory is admin only');
$response = adminRoute('admin-users', [], true, 'GET');
checkAdmin($response->data['counts_available'] === true && $response->data['users'][0]['posts_count'] === 3, 'Account inventory retains valid counts');
DB::$failUserDetails = true;
$response = adminRoute('admin-users', [], true, 'GET');
checkAdmin($response->data['counts_available'] === false && $response->data['users'][0]['posts_count'] === null && $response->data['users'][0]['sources_count'] === 1, 'Unavailable post counts remain unknown while available sources are counted');
checkAdmin(count($response->data['diagnostics']) > 0 && !str_contains(json_encode($response->data), 'Private user query error'), 'Inventory diagnostics are explicit and safe');
DB::$failSources = true;
$response = adminRoute('admin-users', [], true, 'GET');
checkAdmin($response->data['users'][0]['sources_count'] === null && count($response->data['diagnostics']) === 2, 'Failed sources are not reported as zero');
DB::$failUserDetails = false; DB::$failSources = false;
$previousRuntimeKey = getenv('SOCIALTOSITE_RUNTIME_GEMINI_API_KEY');
try {
    putenv('SOCIALTOSITE_RUNTIME_GEMINI_API_KEY=fixture-private-key');
    $response = adminRoute('admin-monitoring', [], true, 'GET');
    checkAdmin($response->data['totals'] === ['users' => 17, 'published_posts' => 123, 'queued_posts' => 9], 'Overview reads actual database totals');
    checkAdmin($response->data['provider_settings'][0]['credential_source'] === 'server', 'Runtime environment credentials reported correctly');
    checkAdmin(!str_contains(json_encode($response->data), 'fixture-private-key'), 'Monitoring never returns credentials');
    DB::$failTotals = true;
    $response = adminRoute('admin-monitoring', [], true, 'GET');
    checkAdmin($response->data['totals']['users'] === null && count($response->data['diagnostics']) > 0, 'Database failures are unavailable, never fake zero');
    checkAdmin(!str_contains(json_encode($response->data), 'Private database error'), 'Diagnostics never expose storage details');
} finally { putenv($previousRuntimeKey === false ? 'SOCIALTOSITE_RUNTIME_GEMINI_API_KEY' : 'SOCIALTOSITE_RUNTIME_GEMINI_API_KEY=' . $previousRuntimeKey); }
echo "Admin operations: authorization, account validation, session revocation, assisted login, intervals, amounts and prompt restore passed.\n";
