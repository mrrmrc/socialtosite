<?php

// TikTok non consente parametri query negli URI di redirect registrati.
// Questo endpoint dedicato mantiene il callback condiviso senza affidarsi a
// ?platform=tiktok nell'URL configurato nel Developer Portal.
$_GET['platform'] = 'tiktok';
require __DIR__ . '/callback.php';
