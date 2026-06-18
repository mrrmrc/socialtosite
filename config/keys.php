<?php
// config/keys.php — Chiavi dei servizi AI (repo PRIVATO).
// Caricato dall'app in aggiunta a config.php. NON è servito via web (è PHP)
// ed è comunque bloccato da .htaccess.

// Google Gemini (Google AI Studio → Get API key).
if (!defined('GEMINI_API_KEY')) define('GEMINI_API_KEY', 'AQ.Ab8RN6IVK8R4ALnNEUtplCHMfX_Be-liS8dkoWv3mHHF2XHgbQ');
// Modello Gemini (flash = veloce, economico, gestisce video/YouTube da link).
if (!defined('GEMINI_MODEL'))   define('GEMINI_MODEL', 'gemini-2.5-flash');

// Apify (per scaricare i media da TikTok/Instagram/Facebook). Opzionale per ora.
if (!defined('APIFY_TOKEN'))    define('APIFY_TOKEN', '');
