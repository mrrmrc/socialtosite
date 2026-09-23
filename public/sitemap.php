<?php
// public/sitemap.php — Indice delle Sitemap dinamiche per Google Search Console
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

// La colonna search_visible può non esistere se la migrazione non è ancora
// stata applicata: in quel caso si considerano tutti i siti visibili.
$hasVisibilityColumn = false;
try {
    foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) {
        if (($column['Field'] ?? '') === 'search_visible') { $hasVisibilityColumn = true; break; }
    }
} catch (Throwable $e) { $hasVisibilityColumn = false; }
$visibilityFilter = $hasVisibilityColumn ? ' AND s.search_visible = 1' : '';

// Solo i siti che hanno acceso "Fatti trovare da Google".
$users = DB::fetchAll('
    SELECT u.slug, s.last_sync
    FROM users u
    JOIN sites s ON u.id = s.user_id
    WHERE u.slug IS NOT NULL AND u.slug != ""' . app_public_user_sql('u') . $visibilityFilter);

header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

echo "  <sitemap>\n";
echo "    <loc>" . htmlspecialchars(app_base_url() . '/scopri/sitemap.xml', ENT_XML1, 'UTF-8') . "</loc>\n";
echo "  </sitemap>\n";

foreach ($users as $user) {
    // Genera l\'URL della sitemap specifica dell\'utente
    $loc = app_base_url() . '/' . urlencode($user['slug']) . '/sitemap.xml';
    
    echo "  <sitemap>\n";
    echo "    <loc>" . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . "</loc>\n";
    
    if (!empty($user['last_sync'])) {
        $lastmod = substr($user['last_sync'], 0, 10); // Estrae YYYY-MM-DD
        echo "    <lastmod>$lastmod</lastmod>\n";
    }
    
    echo "  </sitemap>\n";
}

echo '</sitemapindex>';
