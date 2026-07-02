<?php
require_once __DIR__ . '/config/db.php';
header('Content-Type: text/plain; charset=utf-8');

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

