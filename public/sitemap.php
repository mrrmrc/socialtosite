<?php
// public/sitemap.php — Indice delle Sitemap dinamiche per Google Search Console
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

// Seleziona tutti gli utenti che hanno un sito configurato
$users = DB::fetchAll('
    SELECT u.slug, s.last_sync 
    FROM users u
    JOIN sites s ON u.id = s.user_id
    WHERE u.slug IS NOT NULL AND u.slug != ""
');

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

echo "  <sitemap>\n";
echo "    <loc>" . htmlspecialchars(BASE_URL . '/scopri/sitemap.xml', ENT_XML1, 'UTF-8') . "</loc>\n";
echo "  </sitemap>\n";

foreach ($users as $user) {
    // Genera l\'URL della sitemap specifica dell\'utente
    $loc = BASE_URL . '/' . urlencode($user['slug']) . '/sitemap.xml';
    
    echo "  <sitemap>\n";
    echo "    <loc>" . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . "</loc>\n";
    
    if (!empty($user['last_sync'])) {
        $lastmod = substr($user['last_sync'], 0, 10); // Estrae YYYY-MM-DD
        echo "    <lastmod>$lastmod</lastmod>\n";
    }
    
    echo "  </sitemap>\n";
}

echo '</sitemapindex>';
