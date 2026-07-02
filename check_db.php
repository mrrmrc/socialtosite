<?php
require_once __DIR__ . '/config/db.php';
header('Content-Type: text/plain; charset=utf-8');

try {
    DB::execute("ALTER TABLE sites ADD COLUMN design_archetype VARCHAR(100) NULL");
    echo "Column design_archetype added successfully!\n";
} catch (Throwable $e) {
    echo "Migration error (could mean it already exists): " . $e->getMessage() . "\n";
}

$user = DB::fetch('SELECT * FROM users WHERE slug=?', ['duemmemail']);
if (!$user) {
    echo "Utente duemmemail non trovato!\n";
    exit;
}

$site = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$user['id']]);
if (!$site) {
    echo "Sito non trovato!\n";
    exit;
}

echo "=== STATO SITO UTENTE ===\n";
echo "Theme: " . ($site['theme'] ?? 'NULL') . "\n";
echo "Design Archetype: " . ($site['design_archetype'] ?? 'NULL') . "\n";
echo "Site AI Data empty?: " . (empty($site['site_ai_data']) ? 'YES' : 'NO') . "\n";
echo "Site AI Data preview: " . substr($site['site_ai_data'] ?? '', 0, 300) . "\n";
echo "Menu Links: " . ($site['menu_links'] ?? 'NULL') . "\n";


