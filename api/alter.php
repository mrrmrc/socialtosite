<?php
require_once __DIR__ . '/../config/db.php';
try {
    DB::execute('ALTER TABLE sites ADD COLUMN generated_layouts LONGTEXT');
    echo "Column generated_layouts added.\n";
} catch (Exception $e) {
    echo "Error generated_layouts: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN site_ai_data LONGTEXT');
    echo "Column site_ai_data added.\n";
} catch (Exception $e) {
    echo "Error site_ai_data: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE posts ADD COLUMN featured TINYINT DEFAULT 0');
    echo "Column featured added.\n";
} catch (Exception $e) {
    echo "Error featured: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN footer_text TEXT');
    echo "Column footer_text added.\n";
} catch (Exception $e) {
    echo "Error footer_text: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN menu_links TEXT');
    echo "Column menu_links added.\n";
} catch (Exception $e) {
    echo "Error menu_links: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN header_layout VARCHAR(50) DEFAULT \'standard\'');
    echo "Column header_layout added.\n";
} catch (Exception $e) {
    echo "Error header_layout: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN custom_css TEXT');
    echo "Column custom_css added.\n";
} catch (Exception $e) {
    echo "Error custom_css: " . $e->getMessage() . "\n";
}
try {
    DB::execute('ALTER TABLE sites ADD COLUMN hero_tagline TEXT');
    echo "Column hero_tagline added.\n";
} catch (Exception $e) {
    echo "Error hero_tagline: " . $e->getMessage() . "\n";
}
