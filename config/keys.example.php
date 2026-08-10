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

// Apify (per scaricare i media da TikTok/Instagram/Facebook).
if (!defined('APIFY_TOKEN'))    define('APIFY_TOKEN', '');

// Meta Graph API (Facebook / IG Aziendale) per OAuth ufficiale.
if (!defined('FB_APP_ID'))      define('FB_APP_ID', '');
if (!defined('FB_APP_SECRET'))  define('FB_APP_SECRET', '');

// Instagram API with Instagram Login (login diretto, solo Creator/Aziende).
if (!defined('IG_LOGIN_APP_ID'))      define('IG_LOGIN_APP_ID', FB_APP_ID);
if (!defined('IG_LOGIN_APP_SECRET'))  define('IG_LOGIN_APP_SECRET', FB_APP_SECRET);
