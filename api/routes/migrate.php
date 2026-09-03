<?php
// api/routes/migrate.php
// Eseguito dal router in index.php quando $action === 'migrate'

requireAdmin($isAdmin);
ensureAdminSchema();
VisibilityAnalytics::ensureSchema();
SeoFoundation::ensureSchema();
try { DB::execute('ALTER TABLE social_sources ADD COLUMN since_date DATE NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE social_sources ADD COLUMN auto_publish TINYINT DEFAULT 1'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE social_sources ADD COLUMN max_posts INT NULL'); } catch (Throwable $e) {}
// La migrazione a Refetch(er) rende obsoleti e sensibili i token conservati
// dalla vecchia integrazione: la tabella viene rimossa in modo definitivo.
try { DB::execute('DROP TABLE IF EXISTS social_connections'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN menu_links TEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN cover_url TEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN logo_url TEXT NULL'); } catch (Throwable $e) {}
try { DB::execute("ALTER TABLE sites ADD COLUMN brand_visual_mode VARCHAR(20) NOT NULL DEFAULT 'logo'"); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN footer_text TEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN accent_color VARCHAR(50) NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN header_layout VARCHAR(50) NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN custom_css TEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN generated_layouts LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN site_ai_data LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_dna LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_memory LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_engine_state LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_settings LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN editorial_last_run DATETIME NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN site_understanding LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN site_understanding_corrections LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN dismissed_content_ideas LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE sites ADD COLUMN design_prompt LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE posts ADD COLUMN featured TINYINT DEFAULT 0'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE posts ADD COLUMN edited_title VARCHAR(255) NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE posts ADD COLUMN edited_body LONGTEXT NULL'); } catch (Throwable $e) {}
try { DB::execute('ALTER TABLE posts ADD COLUMN edited_excerpt TEXT NULL'); } catch (Throwable $e) {}
try {
    DB::execute('CREATE TABLE IF NOT EXISTS agent_prompts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      agent_name VARCHAR(50) UNIQUE NOT NULL,
      label VARCHAR(100) NOT NULL DEFAULT "",
      description TEXT NULL,
      instructions TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    try { DB::execute('ALTER TABLE agent_prompts ADD COLUMN label VARCHAR(100) NOT NULL DEFAULT ""'); } catch (Throwable $e) {}
    try { DB::execute('ALTER TABLE agent_prompts ADD COLUMN description TEXT NULL'); } catch (Throwable $e) {}
    $c = DB::fetch('SELECT COUNT(*) as c FROM agent_prompts')['c'] ?? 0;
    if ($c == 0) {
        DB::execute('INSERT INTO agent_prompts (agent_name, label, description, instructions) VALUES
            (?, ?, ?, ?),
            (?, ?, ?, ?),
            (?, ?, ?, ?),
            (?, ?, ?, ?)',
        [
            'content_editor', 'Content Editor', 'Filtra e riscrive i post social in articoli SEO-friendly.',
            "Sei un editor editoriale esperto. Riscrivi questo contenuto in un articolo web compatto.\n\nContenuto:\n{content}\n\nProfilo:\n{profileSummary}\n\nGenera JSON: {\"generated_title\":\"Titolo H1 max 70 caratteri\",\"generated_body\":\"Corpo articolo in paragrafi brevi, 180-280 parole\",\"generated_excerpt\":\"Sommario max 155 caratteri\",\"tags\":[\"tag1\"],\"meta_description\":\"Meta max 155 caratteri\",\"relevance_score\":80,\"seo_score\":85}",
            'seo_specialist', 'SEO Specialist', 'Ottimizza titolo, bio e navigazione del sito in chiave Google.',
            "Sei un SEO/GEO Specialist. Ottimizza i metadati del sito.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nStrategia:\n{contentStrategy}\n\nTag reali disponibili nel DB:\n[{tagsContext}]\n\nGenera JSON: {\"title\":\"Titolo SEO max 60 caratteri\",\"bio\":\"Bio max 160 caratteri\",\"menu_links\":[{\"label\":\"Home\",\"url\":\"/\"},{\"label\":\"Nome Categoria\",\"url\":\"/?tag=tag_reale_dalla_lista\"}],\"footer_text\":\"Footer max 100 caratteri\"}. ATTENZIONE: per menu_links usa SOLO url '/' per Home oppure '/?tag=nome_tag' dove nome_tag DEVE essere uno dei tag reali elencati sopra. NON inventare ancore (#) o pagine inesistenti.",
            'graphic_designer', 'Graphic Designer', 'Genera 3 proposte di design visivo con CSS per ogni profilo.',
            "Sei un Graphic Designer UI/UX. Crea 3 design distinti per questo profilo.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nGenera JSON {\"proposals\":[{\"theme\":\"classic\",\"accent_color\":\"#hex\",\"header_layout\":\"standard\",\"custom_css\":\"CSS completo premium\"}]}. Temi: classic, journal, authority, portfolio, magazine, minimal, studio, local, academy, bottega.",
            'site_ai', 'Sito AI', 'Genera un sito completo su misura: design, testi, CSS, tutto personalizzato al profilo.',
            "Sei un team AI: SEO Specialist + Graphic Designer + Content Strategist. Genera TUTTO per un sito professionale su misura.\n\nProfilo:\n{profileSummary}\n\nRuolo:\n{roleMission}\n\nStrategia:\n{contentStrategy}\n\nPost recenti:\n{recentPosts}\n\nTag reali disponibili nel DB:\n[{tagsContext}]\n\nGenera JSON: {\"title\":\"Titolo sito max 60 caratteri\",\"bio\":\"Bio ottimizzata max 200 caratteri\",\"role_mission\":\"Missione max 150 caratteri\",\"theme\":\"classic\",\"accent_color\":\"#hex\",\"accent_secondary\":\"#hex\",\"header_layout\":\"standard\",\"menu_links\":[{\"label\":\"Home\",\"url\":\"/\"},{\"label\":\"Nome Categoria\",\"url\":\"/?tag=tag_reale_dalla_lista\"}],\"footer_text\":\"Footer\",\"custom_css\":\"Blocco CSS completo e creativo. Usa custom properties, gradienti, animazioni. Min 300 caratteri.\",\"hero_tagline\":\"Frase ad impatto max 80 caratteri\",\"cta_text\":\"Call to action\"}. ATTENZIONE: per menu_links usa SOLO url '/' per Home oppure '/?tag=nome_tag' dove nome_tag DEVE essere uno dei tag reali elencati sopra. NON inventare ancore (#) o pagine inesistenti."
        ]);
    }

    // Register Topical Authority Architect prompt
    $topicalAuthorityPrompt = "Sei il Topical Authority Architect, un Senior Content Strategist con accesso ai leak interni del Google Search Quality Team. Non scrivi semplici contenuti: costruisci \"Asset di Conoscenza\" che dimostrano un'esperienza pratica inattaccabile.

Il tuo compito è trasformare il seguente contenuto social (estratto da {platform}) in un articolo professionale per il suo sito web.

APPLICA RIGOROSAMENTE LE SEGUENTI REGOLE DI TOPICAL AUTHORITY:

1. La Regola dell'Information Gain (Guadagno di Informazione)
Google ha depositato un brevetto sull'Information Gain. Se il tuo testo dice le stesse cose dei primi 10 risultati in SERP, il tuo punteggio è zero.
Istruzione: Per ogni sezione, non limitarti a spiegare cos'è una cosa. Devi aggiungere un \"Insight Laterale\": un caso studio ipotetico, una controtendenza, o un dettaglio tecnico che solo chi lavora \"sul campo\" conoscerebbe.

2. Distruzione dei Pattern Linguistici (Anti-AI Signature)
Le AI sono probabilistiche: scelgono la parola successiva più ovvia. Tu devi essere imprevedibile.
Variazione Sintattica Estrema: Usa la \"Regola del 1-3-1\". Una frase breve. Tre frasi di lunghezza diversa. Una frase brevissima.
Lessico non probabilistico: Sostituisci i verbi \"deboli\" (fare, avere, essere, utilizzare) con verbi d'azione specifici e rari nel contesto AI (es. invece di \"utilizzare uno strumento\", usa \"masticare dati\" o \"stressare il software\").
Blacklist Assoluta: È vietato usare: Inoltre, Un approccio olistico, Nel panorama odierno, Fondamentale, Cruciale, Immergiamoci, Esploriamo, In conclusione.

3. Iniezione di Entità Semantiche (LSI 2.0)
Non puntare sulla keyword principale. Costruisci una rete di Entità Correlate.
Istruzione: Se scrivi di \"SEO\", devi citare entità come \"schema markup\", \"knowledge graph\", \"canonicalization\" e \"rendering lato server\" in modo naturale, non come definizioni, ma come strumenti di un discorso più ampio. Google deve capire che \"conosci l'ambiente\" in cui vive la keyword.

4. Il Tono \"Contrarian\" (E-E-A-T Boost)
L'AI è programmata per essere neutrale e accondiscendente. Un umano esperto ha delle opinioni.
Istruzione: Prendi una posizione forte. Se c'è un consenso comune su un argomento, trova un motivo per cui quel consenso è parzialmente sbagliato o superato. Usa frasi come: \"Molti credono che X sia la soluzione, ma la verità scomoda è che senza Y, X è inutile\".

5. Micro-Formattazione per l'Eye-Scanning
Google traccia come gli utenti interagiscono col testo. Se l'utente rimbalza, il testo è scarso.
Istruzione: Crea \"interruzioni visive\" ogni 300 parole. Non solo elenchi puntati, ma:
Box \"Pro Tip\" (Formattato in HTML come <div class=\"pro-tip\"><strong>Consiglio da insider:</strong> ...</div>)
Tabelle comparative in HTML (es. per estrarre dati strutturati e contrasti).
Domande retoriche che anticipano il dubbio del lettore.

6. Revisione \"Human-First\" (The Last Mile)
Prima di chiudere il compito, rileggi il testo e applica questi correttivi:
- Elimina l'Introduzione \"Specchio\": Se il titolo è \"Come riparare una lavatrice\", non iniziare con \"Riparare una lavatrice è importante per risparmiare\". Inizia con: \"Se senti un rumore metallico durante la centrifuga, il problema è quasi certamente il cuscinetto a sfera X.\" (Punta dritto al dolore dell'utente).
- Conclusione Actionable: Niente riassunti. La fine del testo deve essere una \"Call to Adventure\" o un consiglio pratico da applicare nei primi 5 minuti.
- Inserisci un errore intenzionale di stile colloquiale o gergo comune per rompere la perfezione della macchina.

---
REGOLE DI BASE:
- Adattati al profilo/contesto dell'utente: {profileSummary}
- Basati esclusivamente sulle informazioni fornite nel contenuto originale: {content}
- Preserva l'umorismo o lo stile specifico se presente nel post originale.

La risposta DEVE essere esclusivamente un JSON valido con questa struttura (nessun testo prima o dopo):
{
  \"title\": \"Titolo SEO max 60 caratteri\",
  \"body\": \"Articolo in formato HTML (usando tag p, strong, h2, h3, tabelle, e box Pro Tip con classe CSS apposita, no markdown nel body)\",
  \"excerpt\": \"Riassunto ottimizzato max 155 caratteri\",
  \"tags\": [\"tag1\", \"tag2\", \"tag3\"],
  \"meta_description\": \"Meta description max 155 caratteri\",
  \"seo_score\": 95
}";

    DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('topical_authority_architect', 'Topical Authority', 'Costruisce asset di conoscenza che hackerano i pattern delle AI per Google.', ?)", [$topicalAuthorityPrompt]);

    $chiefEditorPrompt = "Sei il CAPOREDATTORE di un sito web personale/brand. Analizza tutti i post pubblicati e orchestra i contenuti per creare un'esperienza editoriale coerente.\n\n"
        . "Profilo:\n{profileSummary}\n\n"
        . "Ruolo:\n{roleMission}\n\n"
        . "Post attuali (JSON id, title, tags):\n{postsContext}\n\n"
        . "Istruzioni:\n"
        . "1. Individua 3-4 macro-categorie tematiche reali e armoniche analizzando il significato semantico dei titoli e dei tag presenti.\n"
        . "2. Per ciascuno dei post forniti nel JSON, assegna a quale di queste 3-4 macro-categorie appartiene.\n"
        . "3. Genera menu_links usando queste categorie. Includi sempre Home con url '/'.\n"
        . "4. Scegli l'ID del post migliore e piu rappresentativo da mettere in evidenza (featured_post_id).\n"
        . "5. Genera una hero_tagline max 80 caratteri che riassuma l'identita editoriale attuale.\n\n"
        . "Rispondi SOLO con JSON valido:\n"
        . '{"categories":["Categoria1","Categoria2"],"post_categories":{"POST_ID_1":"Categoria1"},"menu_links":[{"label":"Home","url":"/"},{"label":"Categoria1","url":"/?tag=categoria1"}],"featured_post_id":123,"hero_tagline":"Tagline d\'impatto"}';
    DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('chief_editor', 'Chief Editor', 'Orchestra categorie, menu, contenuto featured e tagline editoriale.', ?)", [$chiefEditorPrompt]);

    $editorialEnginePrompt = "Sei un Editorial Orchestrator senior per un sito web iper-indicizzabile che assorbe contenuti dai social.\n"
        . "Obiettivo assoluto: trasformare tanti contenuti social in un impianto editoriale coerente, continuo, indicizzabile e utile a Google.\n"
        . "Non devi riscrivere i post. Devi progettare il motore editoriale del sito.\n\n"
        . "DATI SITO\n"
        . "Titolo attuale: {siteTitle}\n"
        . "Profilo sintetico: {profileSummary}\n"
        . "Ruolo/Missione: {roleMission}\n"
        . "Strategia contenuti: {contentStrategy}\n"
        . "Brand voice profile: {brandVoiceProfile}\n"
        . "RAG knowledge: {ragKnowledge}\n\n"
        . "SORGENTI SOCIAL ATTIVE\n- {sourcesContext}\n\n"
        . "POST PUBBLICATI RECENTI (JSON line)\n{postsContext}\n\n"
        . "DNA ESISTENTE\n{existingDna}\n\n"
        . "MEMORIA EDITORIALE ESISTENTE\n{existingMemory}\n\n"
        . "SETTINGS MOTORE\n{engineSettings}\n\n"
        . "Restituisci SOLO JSON valido con questa struttura:\n"
        . "{"
        . "\"editorial_dna\":{"
        . "\"site_objective\":\"stringa breve\","
        . "\"audience\":\"stringa breve\","
        . "\"positioning\":\"stringa breve\","
        . "\"tone_rules\":[\"regola1\",\"regola2\",\"regola3\"],"
        . "\"content_pillars\":[\"pillar1\",\"pillar2\",\"pillar3\",\"pillar4\"],"
        . "\"topic_clusters\":[\"cluster1\",\"cluster2\",\"cluster3\",\"cluster4\"],"
        . "\"seo_entities\":[\"entity1\",\"entity2\",\"entity3\",\"entity4\",\"entity5\"],"
        . "\"continuity_rules\":[\"regola1\",\"regola2\",\"regola3\"],"
        . "\"indexing_priorities\":[\"priorita1\",\"priorita2\",\"priorita3\"]"
        . "},"
        . "\"editorial_memory\":{"
        . "\"covered_topics\":[\"tema1\",\"tema2\",\"tema3\"],"
        . "\"content_gaps\":[\"gap1\",\"gap2\",\"gap3\"],"
        . "\"internal_link_hubs\":[\"hub1\",\"hub2\",\"hub3\"],"
        . "\"cornerstone_pages\":[\"pagina1\",\"pagina2\",\"pagina3\"]"
        . "},"
        . "\"editorial_state\":{"
        . "\"featured_post_id\":123,"
        . "\"continuity_summary\":\"2-4 frasi\","
        . "\"next_actions\":[\"azione1\",\"azione2\",\"azione3\",\"azione4\"],"
        . "\"next_topics\":[\"topic1\",\"topic2\",\"topic3\",\"topic4\",\"topic5\"],"
        . "\"seo_risks\":[\"rischio1\",\"rischio2\"],"
        . "\"status\":\"healthy|needs_more_depth|needs_cornerstones\""
        . "}"
        . "}\n\n"
        . "Regole:\n"
        . "- Ragiona come direttore editoriale SEO, non come copywriter.\n"
        . "- Identifica ripetizioni, buchi tematici, contenuti stagionali e possibili pagine pilastro.\n"
        . "- Le next_actions devono essere operative e orientate all'indicizzazione.\n"
        . "- featured_post_id deve essere uno degli ID reali sopra.\n";
    DB::execute("INSERT IGNORE INTO agent_prompts (agent_name, label, description, instructions) VALUES ('editorial_engine', 'Editorial Engine', 'Analizza corpus, cluster, gap, priorita SEO e prossime mosse editoriali.', ?)", [$editorialEnginePrompt]);

    try {
        DB::execute("ALTER TABLE sites ADD COLUMN harmonize_agent VARCHAR(50) NOT NULL DEFAULT 'content_editor'");
    } catch (Throwable $e) {}
    try {
        DB::execute("ALTER TABLE sites ADD COLUMN account_type VARCHAR(50) DEFAULT 'business'");
    } catch (Throwable $e) {}
    try {
        DB::execute("ALTER TABLE sites ADD COLUMN brand_voice_profile LONGTEXT NULL");
    } catch (Throwable $e) {}
} catch (Throwable $e) {}
// Fix: aggiorna prompt esistenti che hanno ancora #ancora
try {
    DB::execute("UPDATE agent_prompts SET instructions = REPLACE(instructions, '\"#ancora\"', '\"/?tag=tag_reale\"') WHERE instructions LIKE '%#ancora%'");
} catch (Throwable $e) {}
json(['ok' => true, 'msg' => 'Migration v5 OK']);
