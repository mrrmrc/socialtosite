<?php
require __DIR__ . '/config/db.php';
try {
    DB::execute('CREATE TABLE IF NOT EXISTS agent_prompts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_name VARCHAR(50) UNIQUE NOT NULL,
      instructions TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    
    // Default prompts
    $seoPrompt = "Sei un agente SEO/GEO Specialist esperto. Il tuo compito è ottimizzare i metadati di un sito web in base al profilo dell'utente.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Strategia Editoriale:\n{contentStrategy}\n\n"
            . "Genera un JSON valido con questa struttura:\n"
            . '{"title":"Titolo SEO max 60 caratteri (es. Nome Cognome | Mestiere a Città)","bio":"Biografia SEO friendly, max 160 caratteri","menu_links":[{"label":"Voce Menu","url":"#ancora"}],"footer_text":"Testo SEO per il footer, max 100 caratteri"}'
            . "\nCrea 3 o 4 voci di menu pertinenti al mestiere (es. per un ristorante: Menu, Chi Siamo, Prenota). Usa hash URLs (#) poichè la pagina potrebbe essere single page.";

    $graphicPrompt = "Sei un agente Graphic Designer esperto in UI/UX web moderna. Devi creare 3 proposte di design premium e distinte per questo profilo.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Istruzioni:\n"
            . "Genera un array JSON con ESATTAMENTE 3 oggetti. Ogni oggetto rappresenta una proposta e deve avere questa struttura:\n"
            . "1. 'theme' scelto tra: classic, journal, authority, portfolio, magazine, minimal, studio, local, academy, timeline, bottega.\n"
            . "2. 'accent_color' esadecimale (es. #FF0000) super accattivante e adatto al mestiere.\n"
            . "3. 'header_layout' scelto tra: standard, centered, split.\n"
            . "4. 'custom_css' un blocco di CSS creativo per abbellire il sito in modo drastico (sfumature, ombreggiature moderne, border-radius). Il CSS verrà iniettato globalmente.\n\n"
            . "Esempio output:\n"
            . '{"proposals": [{"theme":"classic","accent_color":"#000000","header_layout":"standard","custom_css":":root { --dynamic-radius: 12px; } body { background: linear-gradient(...); }"}]}';

    DB::execute('INSERT IGNORE INTO agent_prompts (agent_name, instructions) VALUES ("seo_specialist", ?), ("graphic_designer", ?)', [$seoPrompt, $graphicPrompt]);

    try {
        DB::execute('ALTER TABLE sites ADD COLUMN generated_layouts LONGTEXT NULL');
    } catch (Exception $e) {
        // Might already exist
    }

    echo "Migration completed successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
