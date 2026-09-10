$_SERVER['REQUEST_METHOD'] = 'POST';
$_GET['action'] = 'post-update';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer test';
// mock db and json functions to trace calls
function body() { return ['id' => 1, 'edited_body' => 'Test Body', 'edited_title' => 'Test Title']; }
function json($data) { var_dump('JSON:', $data); exit; }
function jsonError($msg, $code=400) { var_dump('ERROR:', $msg); exit; }
class DB {
    public static function execute($sql, $params=[]) { var_dump('EXEC:', $sql, $params); }
    public static function fetchAll($sql, $params=[]) { return []; }
}
function ensurePostMediaSchema() {}
$userId = 1; $action = 'post-update'; $method = 'POST';
require 'api/index.php';
