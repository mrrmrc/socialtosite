<?php
require_once __DIR__ . '/../api/services/admin_operations.php';

function verifyContent(bool $value, string $message): void {
    if (!$value) throw new RuntimeException($message);
}
class DB {
    public static array $calls = [];
    public static int $affected = 1;
    public static bool $exists = true;
    public static function fetch(string $sql, array $params = []): ?array {
        self::$calls[] = [$sql, $params];
        return str_contains($sql, 'COUNT(*)') ? ['total' => 51] : (self::$exists ? ['id' => 42] : null);
    }
    public static function fetchAll(string $sql, array $params = []): array { self::$calls[] = [$sql, $params]; return []; }
    public static function execute(string $sql, array $params = []): int { self::$calls[] = [$sql, $params]; return self::$affected; }
}
class Logger {
    public static array $entries = [];
    public static function info(string $context, string $message, array $data): void { self::$entries[] = [$context, $message, $data]; }
}
foreach (['delete', '', 'drop'] as $operation) {
    DB::$calls = [];
    try { AdminOperations::change(['id' => 42, 'operation' => $operation], 7); throw new RuntimeException('Accepted unsupported operation'); }
    catch (InvalidArgumentException $e) { verifyContent(DB::$calls === [], 'Invalid operation cannot access storage'); }
}
foreach (['publish','unpublish','retry','index','noindex'] as $operation) {
    DB::$calls = []; Logger::$entries = [];
    AdminOperations::change(['id' => 42, 'operation' => $operation], 7);
    [$sql, $params] = DB::$calls[1];
    verifyContent(str_starts_with($sql, 'UPDATE posts SET') && $params === [42], 'Writes are bounded to a single post');
    verifyContent(Logger::$entries[0][2] === ['admin_id' => 7, 'post_id' => 42], 'Audit identifies actor and target without payloads');
    if ($operation === 'retry') verifyContent(str_contains($sql, 'INTERVAL 10 MINUTE') && str_contains($sql, "processing_status='failed'") && str_contains($sql, 'published=0') && str_contains($sql, 'processing_attempts=0'), 'Retry protects active jobs and published articles, resets exhausted attempts');
    if ($operation === 'publish') verifyContent(str_contains($sql, "processing_status='done'") && str_contains($sql, 'generated_body') && str_contains($sql, 'seo_score>=0'), 'Publishing requires a finished article');
}
DB::$affected = 0; Logger::$entries = [];
try { AdminOperations::change(['id' => 42, 'operation' => 'retry'], 7); throw new RuntimeException('Concurrent state change accepted'); }
catch (DomainException $e) { verifyContent(Logger::$entries === [], 'Conflicts cannot report success'); }
DB::$exists = false;
try { AdminOperations::change(['id' => 42, 'operation' => 'publish'], 7); throw new RuntimeException('Missing post accepted'); }
catch (OutOfBoundsException $e) {}
DB::$exists = true;
DB::$calls = [];
$result = AdminOperations::listing(['q' => "' OR 1=1 --", 'status' => 'failed', 'page' => 999, 'user_id' => 8]);
verifyContent($result['page'] === 3 && $result['pages'] === 3 && $result['total'] === 51, 'Pagination clamps to existing pages');
[$sql, $params] = DB::$calls[1];
verifyContent(!str_contains($sql, "' OR 1=1 --") && count($params) === 6 && $params[0] === 8, 'Search and client scope are bound parameters');
verifyContent(str_contains($sql, 'LIMIT 25 OFFSET 50') && !str_contains($sql, 'p.*') && !str_contains($sql, 'processing_error'), 'Bounded listing exposes only necessary fields');
try { AdminOperations::listing(['status' => 'unknown']); throw new RuntimeException('Unknown filter accepted'); }
catch (InvalidArgumentException $e) {}
echo "Admin content: bounded listing, validation, publish/retry guards, conflicts and audit passed.\n";
