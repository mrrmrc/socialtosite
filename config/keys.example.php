<?php
// config/keys.example.php — Modello per config/keys.php
//
// COPIA questo file in config/keys.php DIRETTAMENTE SUL SERVER e compila i
// valori. keys.php non è committato (vedi .gitignore) e non è servito via web
// (è PHP, ed è comunque bloccato da .htaccess).
//
// Se una chiave è mancante la funzione corrispondente si disattiva: non ci
// sono valori di ripiego scritti nel codice, perché una chiave di default nel
// sorgente vale quanto nessuna chiave.

// Google Gemini (Google AI Studio → Get API key).
if (!defined('GEMINI_API_KEY')) define('GEMINI_API_KEY', '');
// Modello Gemini (flash = veloce, economico, gestisce video/YouTube da link).
if (!defined('GEMINI_MODEL'))   define('GEMINI_MODEL', 'gemini-2.5-flash');

// Facebook Login for Business / Pages API.
if (!defined('FB_APP_ID'))      define('FB_APP_ID', '');
if (!defined('FB_APP_SECRET'))  define('FB_APP_SECRET', '');

// Instagram API with Instagram Login (solo account Creator o Business).
if (!defined('IG_LOGIN_APP_ID'))      define('IG_LOGIN_APP_ID', '');
if (!defined('IG_LOGIN_APP_SECRET'))  define('IG_LOGIN_APP_SECRET', '');

// TikTok Login Kit + Display API.
if (!defined('TIKTOK_CLIENT_KEY'))    define('TIKTOK_CLIENT_KEY', '');
if (!defined('TIKTOK_CLIENT_SECRET')) define('TIKTOK_CLIENT_SECRET', '');

// Google OAuth 2.0 + YouTube Data API v3.
if (!defined('GOOGLE_CLIENT_ID'))     define('GOOGLE_CLIENT_ID', '');
if (!defined('GOOGLE_CLIENT_SECRET')) define('GOOGLE_CLIENT_SECRET', '');
