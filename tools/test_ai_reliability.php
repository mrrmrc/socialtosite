<?php
// Offline behavioral checks: no credentials, database or provider requests.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
function reliabilityCheck(string $name, bool $ok): void {
    if (!$ok) throw new RuntimeException($name);
    echo "OK: $name\n";
}
class DB {
    public static array $writes = [];
    public static function execute($sql, $params = []) { self::$writes[] = [$sql, $params]; return 1; }
    public static function fetchAll($sql, $params = []) { return [['Field'=>'reachability_profile'], ['Field'=>'reachability_updated_at']]; }
    public static function fetch($sql, $params = []) {
        if (str_contains($sql, 'FROM raw_contents c')) return ['draft_body'=>'Fonte originale', 'platform'=>'website', 'title'=>'Fonte', 'source_label'=>'Test', 'source_profile_url'=>'https://example.com'];
        return [];
    }
}
require_once __DIR__ . '/../api/services/reachability.php';
require_once __DIR__ . '/../api/services/visibility.php';
VisibilityAnalytics::ensureSchema();
reliabilityCheck('opening analytics preserves stored history', count(array_filter(DB::$writes, fn($write) => preg_match('/^\s*(?:DELETE|TRUNCATE|DROP)\b/i', $write[0]))) === 0);
foreach ([['', 'unverified', false], [date('Y-m-d', strtotime('-2 days')), 'active', true], [date('Y-m-d', strtotime('-20 days')), 'stale', true], ['invalid', 'unverified', false]] as [$date, $status, $connected]) {
    $summary = ReachabilityNetwork::summary(1, [], [], [], ['latest_search_date'=>$date]);
    reliabilityCheck("Google $status ($date)", $summary['google']['status'] === $status && $summary['google']['connected'] === $connected && $summary['data_sources'][1]['connected'] === $connected);
    reliabilityCheck("Google connection percentage follows evidence ($date)", $summary['google']['connection_percent'] === ($connected ? 100 : 0));
}

// Load the actual production decision method with an offline provider response.
$ai = file_get_contents(__DIR__ . '/../api/services/ai.php');
$start = strpos($ai, '    public static function contentDecision(');
$end = strpos($ai, '    public static function editorialEngineBlueprint(', $start);
eval('class DecisionUnderTest { public static string $response = ""; public static function gemini($parts, $config) { return self::$response; }' . substr($ai, $start, $end - $start) . '}');
foreach (['garbage', 'null', '[]', '{"reason":"missing decision"}', '{"publish":"false"}', '{"publish":false}', '{"publish":true}'] as $response) {
    DecisionUnderTest::$response = $response;
    $decision = DecisionUnderTest::contentDecision('Fonte', 'website', '', '');
    reliabilityCheck("curation accepts only explicit boolean approval: $response", $decision['publish'] === ($response === '{"publish":true}'));
}

class AI {
    public static $review;
    public static function harmonize(...$args) { return ['title'=>'Prima bozza', 'body'=>'<p>Fonte originale.</p>', 'seo_score'=>65]; }
    public static function gemini(...$args) { if (self::$review instanceof Throwable) throw self::$review; return self::$review; }
}
// Strip dependency includes only; execute the unmodified supervisor class.
$supervisor = file_get_contents(__DIR__ . '/../api/services/editorial_supervisor.php');
$supervisor = preg_replace('/^<\?php\s*|^require_once[^\n]+\n/m', '', $supervisor);
eval($supervisor);
foreach ([
    ['{"approved":true,"title":"Approvata","body":"<p>Verificata.</p>"}', 'ready'],
    ['{"approved":false,"title":"Respinta","body":"<p>Non pubblicare.</p>","review_notes":"Fatti da verificare"}', 'needs_review'],
    ['{"approved":"true","title":"Titolo","body":"Testo"}', 'needs_review'],
    ['{"approved":true,"title":"Titolo","body":"<p></p>"}', 'needs_review'],
    ['{"approved":true,"title":["malformed"],"body":["malformed"]}', 'needs_review'],
    ['invalid', 'needs_review'],
    [new RuntimeException('Provider unavailable'), 'needs_review'],
] as [$review, $expected]) {
    DB::$writes = [];
    AI::$review = $review;
    EditorialSupervisor::generate(1, 10);
    $write = DB::$writes[0];
    reliabilityCheck("review result controls readiness: $expected", $write[1][2] === $expected);
    if ($expected !== 'ready') reliabilityCheck('unapproved review preserves original draft', $write[1][0] === 'Prima bozza');
}

// Execute the actual Google request logic with a fake transport.
class Logger { public static function error(...$args) {} }
foreach (['CURLOPT_RETURNTRANSFER', 'CURLOPT_POST', 'CURLOPT_HTTPHEADER', 'CURLOPT_POSTFIELDS', 'CURLINFO_HTTP_CODE'] as $constant) {
    if (!defined($constant)) define($constant, 1);
}
$cron = file_get_contents(__DIR__ . '/../cron/fetch_seo.php');
$start = strpos($cron, 'function fetchGscData(');
$end = strpos($cron, 'function fetchGscProperties(', $start);
$method = 'public static ' . substr($cron, $start, $end - $start);
$method = preg_replace('/\bcurl_(init|setopt_array|exec|getinfo|close)\(/', 'self::transport_$1(', $method);
eval('class GscUnderTest { public static $response; public static int $status; public static function transport_init(...$args) { return 1; } public static function transport_setopt_array(...$args) {} public static function transport_exec(...$args) { return self::$response; } public static function transport_getinfo(...$args) { return self::$status; } public static function transport_close(...$args) {}' . $method . '}');
foreach ([[403, '{"error":"forbidden"}', true], [0, false, true], [200, 'invalid', true], [200, '{"rows":"invalid"}', true], [200, '{}', false], [200, '{"rows":[]}', false]] as [$status, $response, $mustFail]) {
    GscUnderTest::$status = $status;
    GscUnderTest::$response = $response;
    $failed = false;
    try { GscUnderTest::fetchGscData('offline', 'https://example.com', '2026-01-01', '2026-01-01'); }
    catch (RuntimeException $e) { $failed = true; }
    reliabilityCheck("Google errors cannot become successful zero imports: $status " . (string)$response, $failed === $mustFail);
}
