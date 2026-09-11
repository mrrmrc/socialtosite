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
if (!defined('GEMINI_MODEL'))   define('GEMINI_MODEL', 'gemini-3.6-flash');

// Apify: un'unica chiave backend per Facebook, Instagram, TikTok,
// YouTube e X. Non inserire mai questa chiave nel codice React.
if (!defined('APIFY_API_TOKEN')) define('APIFY_API_TOKEN', '');
