const fs = require('fs');
let code = fs.readFileSync('api/index.php', 'utf8');
const insertPoint = code.indexOf("if ($action === 'create-idea-draft'");

if (insertPoint > -1) {
    const newEndpoint = `if ($action === 'generate-ai-texts' && $method === 'POST') {
    $b = body();
    $argomento = trim((string)($b['argomento'] ?? ''));
    $usaProfilo = !empty($b['usa_profilo']);
    $links = trim((string)($b['links'] ?? ''));
    
    $prompt = "Devi generare ESATTAMENTE 2 varianti distinte per un testo/brano richiesto dall'utente.\\n";
    if ($argomento) $prompt .= "L'argomento o la richiesta è: {$argomento}\\n";
    if ($usaProfilo) {
        require_once __DIR__ . '/services/ai.php';
        $understanding = json_decode((string)($me['understanding'] ?? '{}'), true) ?: [];
        $profile = "Nome: " . ($me['name']??'') . "\\nRuolo/Mission: " . ($understanding['role_mission']??'') . "\\nFocus: " . implode(', ', $understanding['key_topics']??[]);
        $prompt .= "Scrivi tenendo conto di questo profilo (usa anche informazioni da internet aggiornate alla data di oggi se necessario per contestualizzare al meglio):\\n{$profile}\\n";
    }
    if ($links) {
        $prompt .= "Prendi spunto e leggi queste fonti/link forniti dall'utente:\\n{$links}\\n";
    }
    $prompt .= "Fornisci il risultato esclusivamente come JSON array valido. L'array deve contenere esattamente 2 oggetti, ognuno con le chiavi 'title' (titolo) e 'content' (il testo finale curato in HTML: usa paragrafi <p>, titoli <h2>, <strong>, liste <ul> se appropriato). NON inserire blockcode markdown, solo l'array JSON.";
    
    require_once __DIR__ . '/services/ai.php';
    $result = AI::gemini([['text' => $prompt]], ['response_mime_type' => 'application/json', 'temperature' => 0.7]);
    
    $json = json_decode($result, true);
    if (!is_array($json) || count($json) < 2) {
        // Fallback or retry?
        jsonError('Errore nella generazione dei testi AI. Riprova. Risposta: ' . $result, 500);
    }
    json(['variants' => $json]);
}

`;
    code = code.substring(0, insertPoint) + newEndpoint + code.substring(insertPoint);
    fs.writeFileSync('api/index.php', code);
    console.log('Endpoint added!');
} else {
    console.log('Could not find insert point!');
}
