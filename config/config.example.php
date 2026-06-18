<?php
// config/config.php — Configurazione centrale
// RINOMINA config.example.php in config.php e compila i valori

define('DB_HOST', 'localhost');
define('DB_NAME', 'tuo_database');
define('DB_USER', 'tuo_utente');
define('DB_PASS', 'tua_password');
define('DB_CHARSET', 'utf8mb4');

// JWT Secret — genera con: php -r "echo bin2hex(random_bytes(32));"
define('JWT_SECRET', 'cambia_con_stringa_segreta_lunga');

// URL base del sito (senza slash finale)
define('BASE_URL', 'https://tuodominio.it');

// OpenAI — per Whisper (trascrizione) e GPT (generazione testo)
define('OPENAI_API_KEY', 'sk-...');

// Anthropic Claude — per generazione contenuti SEO
define('ANTHROPIC_API_KEY', 'sk-ant-...');

// Meta OAuth (Instagram + Facebook)
define('META_APP_ID', '');
define('META_APP_SECRET', '');
define('META_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=instagram');

// TikTok OAuth
define('TIKTOK_CLIENT_KEY', '');
define('TIKTOK_CLIENT_SECRET', '');
define('TIKTOK_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=tiktok');

// Google / YouTube OAuth
define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_CLIENT_SECRET', '');
define('GOOGLE_REDIRECT_URI', BASE_URL . '/api/auth/callback.php?platform=youtube');

// Timezone
date_default_timezone_set('Europe/Rome');
