<?php
require_once 'config/db.php';

try {
    // Aggiungi colonna brand_voice_profile
    $hasCol = false;
    $cols = DB::fetchAll("SHOW COLUMNS FROM sites");
    foreach($cols as $c) {
        if ($c['Field'] === 'brand_voice_profile') $hasCol = true;
    }
    
    if (!$hasCol) {
        DB::execute("ALTER TABLE sites ADD COLUMN brand_voice_profile TEXT DEFAULT NULL");
        echo "Aggiunta colonna brand_voice_profile a sites.<br>";
    } else {
        echo "Colonna brand_voice_profile già esistente.<br>";
    }

    // Crea tabella seo_analytics
    DB::execute("CREATE TABLE IF NOT EXISTS seo_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        record_date DATE NOT NULL,
        impressions INT DEFAULT 0,
        clicks INT DEFAULT 0,
        ctr FLOAT DEFAULT 0,
        position FLOAT DEFAULT 0,
        UNIQUE KEY(user_id, record_date)
    )");
    echo "Tabella seo_analytics creata con successo.<br>";

    // Crea tabella seo_pages_analytics se serve per il futuro (opzionale)
    echo "Migrazione completata con successo!";
} catch (Exception $e) {
    echo "Errore: " . $e->getMessage();
}
