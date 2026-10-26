<?php
// The actual save endpoint must produce a ready private draft, even with hostile flags.
class DraftResponse extends RuntimeException {
    public function __construct(public array $data, public int $status) { parent::__construct('response'); }
}
function json(array $data, int $status = 200): void { throw new DraftResponse($data, $status); }
function jsonError(string $message, int $status = 400): void { json(['error' => $message], $status); }
function body(): array { return $GLOBALS['draftPayload']; }
function ensurePostMediaSchema(): void {}
function slugify(string $value): string { return 'draft-test'; }
if (!function_exists('mb_strlen')) { function mb_strlen(string $value): int { return strlen($value); } }
class DB {
    public static array $writes = [];
    public static function insert(string $sql, array $parameters): int { self::$writes[] = [$sql, $parameters]; return 321; }
}
$source = file_get_contents(__DIR__ . '/../api/index.php');
$start = strpos($source, "if (\$action === 'post-create' && \$method === 'POST') {");
$end = strpos($source, "\nif (\$action ===", $start + 1);
$route = substr($source, $start, $end - $start);
$action = 'post-create'; $method = 'POST'; $userId = 22;
$GLOBALS['draftPayload'] = ['edited_title' => 'Una guida per le famiglie', 'edited_body' => '<p>La bozza preparata con LIA.</p>', 'published' => 1, 'user_id' => 999, 'processing_status' => 'processing'];
try { eval($route); throw new LogicException('Missing response'); }
catch (DraftResponse $result) {
    if ($result->status !== 200 || $result->data['id'] !== 321) throw new LogicException('Draft save failed');
}
[$sql, $parameters] = DB::$writes[0];
if ($parameters[0] !== 22) throw new LogicException('The authenticated owner must own the draft');
if (!str_contains($sql, 'seo_score, processing_status, published') || !str_contains($sql, "10, 'done', 0")) throw new LogicException('A saved draft must be ready but unpublished');
DB::$writes = [];
$GLOBALS['draftPayload'] = ['edited_title' => str_repeat('x', 241), 'edited_body' => '<p>Text</p>'];
try { eval($route); throw new LogicException('Long title accepted'); }
catch (DraftResponse $result) { if ($result->status !== 422 || DB::$writes) throw new LogicException('Invalid drafts cannot write'); }
echo "LIA draft: authenticated ownership, ready state, unpublished save and validation passed.\n";
