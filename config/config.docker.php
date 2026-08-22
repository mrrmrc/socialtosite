<?php
// Configurazione per l'immagine Docker. I segreti arrivano esclusivamente
// dall'ambiente del container e non vengono incorporati nell'immagine.

function envValue(string $name, string $default = ''): string {
    $value = getenv($name);
    return $value === false ? $default : $value;
}

define('DB_HOST', envValue('DB_HOST', 'db'));
define('DB_NAME', envValue('DB_NAME', 'linkseoweb'));
define('DB_USER', envValue('DB_USER', 'linkseoweb'));
define('DB_PASS', envValue('DB_PASS'));
define('DB_CHARSET', envValue('DB_CHARSET', 'utf8mb4'));

define('JWT_SECRET', envValue('JWT_SECRET'));
define('ENCRYPTION_KEY', envValue('ENCRYPTION_KEY'));
define('BASE_URL', rtrim(envValue('BASE_URL', 'http://localhost:8081'), '/'));
define('ALLOWED_ORIGIN', envValue('ALLOWED_ORIGIN', BASE_URL));

define('OPENAI_API_KEY', envValue('OPENAI_API_KEY'));
define('ANTHROPIC_API_KEY', envValue('ANTHROPIC_API_KEY'));
define('GEMINI_API_KEY', envValue('GEMINI_API_KEY'));
define('GEMINI_MODEL', envValue('GEMINI_MODEL', 'gemini-2.5-flash'));
define('SOCIALCRAWL_API_KEY', envValue('SOCIALCRAWL_API_KEY'));
define('APIFY_TOKEN', envValue('APIFY_TOKEN')); // DEPRECATO

define('META_APP_ID', envValue('META_APP_ID'));
define('META_APP_SECRET', envValue('META_APP_SECRET'));
define('META_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=instagram');
define('FB_APP_ID', envValue('FB_APP_ID', META_APP_ID));
define('FB_APP_SECRET', envValue('FB_APP_SECRET', META_APP_SECRET));
define('IG_LOGIN_APP_ID', envValue('IG_LOGIN_APP_ID', FB_APP_ID));
define('IG_LOGIN_APP_SECRET', envValue('IG_LOGIN_APP_SECRET', FB_APP_SECRET));

define('TIKTOK_CLIENT_KEY', envValue('TIKTOK_CLIENT_KEY'));
define('TIKTOK_CLIENT_SECRET', envValue('TIKTOK_CLIENT_SECRET'));
define('TIKTOK_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=tiktok');
define('GOOGLE_CLIENT_ID', envValue('GOOGLE_CLIENT_ID'));
define('GOOGLE_CLIENT_SECRET', envValue('GOOGLE_CLIENT_SECRET'));
define('GOOGLE_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=youtube');

define('OPENCLAW_API_KEY', envValue('OPENCLAW_API_KEY'));
define('ANALYTICS_SALT', envValue('ANALYTICS_SALT'));
if (envValue('GSC_PROPERTY') !== '') define('GSC_PROPERTY', envValue('GSC_PROPERTY'));
define('GCP_CREDENTIALS_PATH', envValue('GCP_CREDENTIALS_PATH', __DIR__ . '/gcp-credentials.json'));

date_default_timezone_set(envValue('TZ', 'Europe/Rome'));
