<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/services/ai.php';

$userId = 1; // Assuming user 1 exists
try {
    $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy FROM sites WHERE user_id=?', [$userId]);
    if (!$site) {
        die("Site not found for user 1");
    }
    
    $summary = trim($site['profile_summary'] ?? '');
    $role    = trim($site['role_mission'] ?? '');
    $strategy = trim($site['content_strategy'] ?? '');

    echo "Calling seoSpecialistSetup...\n";
    $seo = AI::seoSpecialistSetup($summary, $role, $strategy);
    echo "SEO Setup OK.\n";
    
    echo "Calling graphicDesignerSetup...\n";
    $proposals = AI::graphicDesignerSetup($summary, $role, $strategy);
    echo "Graphic Designer Setup OK.\n";
    
    print_r($proposals);
    
} catch (Throwable $e) {
    echo "FATAL ERROR: " . $e->getMessage() . " on line " . $e->getLine() . " in " . $e->getFile() . "\n";
}
