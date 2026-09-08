<?php

function envValue(string $name, string $default = ''): string {
    $value = getenv($name);
    return $value === false || trim((string)$value) === '' ? $default : trim((string)$value);
}

define('DB_HOST', envValue('DB_HOST', 'db'));
define('DB_NAME', envValue('DB_NAME', 'linkseoweb'));
define('DB_USER', envValue('DB_USER', 'linkseoweb'));
define('DB_PASS', envValue('DB_PASS'));
define('DB_CHARSET', envValue('DB_CHARSET', 'utf8mb4'));
define('BASE_URL', envValue('BASE_URL', 'http://localhost:8081'));
define('ALLOWED_ORIGIN', envValue('ALLOWED_ORIGIN', BASE_URL));
define('JWT_SECRET', envValue('JWT_SECRET'));
define('REFETCHER_API_KEY', envValue('REFETCHER_API_KEY'));
define('GEMINI_API_KEY', envValue('GEMINI_API_KEY'));
define('GEMINI_MODEL', envValue('GEMINI_MODEL', 'gemini-2.5-flash'));
