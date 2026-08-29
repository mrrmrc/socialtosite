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

// Chiave di cifratura per i token social (64 caratteri hex = 32 byte)
// genera con: php -r "echo bin2hex(random_bytes(32));"
define('ENCRYPTION_KEY', 'cambia_con_64_caratteri_hex');

// URL base del sito (senza slash finale)
define('BASE_URL', 'https://allsocialtoweb.com');
// Opzionale: property esatta di Google Search Console (es. sc-domain:tuodominio.it).
// Se omessa, il cron prova a rilevarla automaticamente tra le property accessibili.
// define('GSC_PROPERTY', 'sc-domain:tuodominio.it');

// Origine consentita per le richieste CORS (default = BASE_URL).
// Usa '*' solo in sviluppo locale.
define('ALLOWED_ORIGIN', BASE_URL);
define('META_GRAPH_VERSION', 'v26.0');

// Google Gemini — trascrizione video (anche da link YouTube) + armonizzazione.
// Le chiavi AI vivono in config/keys.php (repo privato): vedi quel file.
// GEMINI_API_KEY e GEMINI_MODEL sono definiti lì.

// OpenAI — alternativa per Whisper (trascrizione). Opzionale.
define('OPENAI_API_KEY', 'sk-...');

// Anthropic Claude — per generazione contenuti SEO
define('ANTHROPIC_API_KEY', 'sk-ant-...');

// Le credenziali OAuth di Facebook, Instagram, TikTok e YouTube vivono in
// config/keys.php. Gli URI di callback sono calcolati a partire da BASE_URL.

// OpenClaw — chiave del webhook di ingestione articoli esterni.
// OBBLIGATORIA se usi /api/index.php?action=openclaw-webhook: senza questa
// costante l'endpoint risponde 503 e rifiuta ogni chiamata (nessun default).
// Genera con: php -r "echo bin2hex(random_bytes(32));"
define('OPENCLAW_API_KEY', '');

// Sale per lo pseudonimo dei visitatori nelle statistiche.
// Tenuto separato da JWT_SECRET: ruotare il segreto di autenticazione non
// deve azzerare la continuità storica delle statistiche.
// Genera con: php -r "echo bin2hex(random_bytes(32));"
define('ANALYTICS_SALT', '');

// Timezone
date_default_timezone_set('Europe/Rome');
