<?php
// api/middleware/response.php
function cors(): void {
    // Origine consentita: ALLOWED_ORIGIN da config (default = BASE_URL).
    // Imposta ALLOWED_ORIGIN a '*' solo in sviluppo locale.
    $allowed = function_exists('app_allowed_origin') ? app_allowed_origin()
             : (defined('ALLOWED_ORIGIN') ? ALLOWED_ORIGIN : (defined('BASE_URL') ? BASE_URL : ''));
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($allowed === '*') {
        header('Access-Control-Allow-Origin: *');
    } else {
        header('Access-Control-Allow-Origin: ' . ($origin === $allowed ? $origin : $allowed));
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

function json(mixed $data, int $code = 200): void {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function jsonError(string $msg, int $code = 400): void {
    json(['error' => $msg], $code);
}

function body(): array {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (!is_array($data) && !empty($_POST)) {
        return $_POST;
    }
    return $data ?? [];
}

function slugify(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $map  = ['à'=>'a','á'=>'a','â'=>'a','ä'=>'a','è'=>'e','é'=>'e','ê'=>'e','ë'=>'e',
             'ì'=>'i','í'=>'i','ò'=>'o','ó'=>'o','ù'=>'u','ú'=>'u','ç'=>'c','ñ'=>'n'];
    $text = strtr($text, $map);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    return trim(substr($text, 0, 80), '-');
}
