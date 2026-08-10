<?php
// tools/test_seo_feedback.php — Verifica il ciclo di ritorno SEO senza database.
// Uso:  php tools/test_seo_feedback.php   (solo da riga di comando)
if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Solo da CLI'); }
// Test del ciclo di ritorno SEO senza database: DB è sostituito da uno stub
// che restituisce righe finte, così si verifica la logica pura.

$GLOBALS['__rows'] = [];
$GLOBALS['__throw'] = false;

class DB {
    public static function execute(string $sql, array $p = []) { return 0; }
    public static function fetch(string $sql, array $p = []) {
        if ($GLOBALS['__throw']) throw new Exception('tabella assente');
        return $GLOBALS['__rows']['fetch'] ?? null;
    }
    public static function fetchAll(string $sql, array $p = []) {
        if ($GLOBALS['__throw']) throw new Exception('tabella assente');
        if (str_contains($sql, 'GROUP BY query_text') && str_contains($sql, 'page_url LIKE')) {
            return $GLOBALS['__rows']['page'] ?? [];
        }
        if (str_contains($sql, 'GROUP BY query_text')) return $GLOBALS['__rows']['queries'] ?? [];
        if (str_contains($sql, 'GROUP BY page_url'))   return $GLOBALS['__rows']['pages'] ?? [];
        return [];
    }
}

require_once __DIR__ . '/../api/services/visibility.php';

$pass = 0; $fail = 0;
function check(string $name, bool $ok, string $detail = '') {
    global $pass, $fail;
    if ($ok) { $pass++; echo "  ok    $name\n"; }
    else     { $fail++; echo "  FALLITO $name" . ($detail ? " — $detail" : '') . "\n"; }
}

// ── 1. Sito nuovo: nessun dato → briefing vuoto, comportamento invariato ──
echo "\n1. Sito senza dati Search Console\n";
$GLOBALS['__rows'] = [];
$b = VisibilityAnalytics::demandBriefing(1);
check('il briefing è una stringa vuota', $b === '', 'ottenuto: ' . var_export($b, true));

// ── 2. Search Console non configurata: eccezione → nessun crash ───────────
echo "\n2. Tabelle assenti (Search Console mai collegata)\n";
$GLOBALS['__throw'] = true;
$b = VisibilityAnalytics::demandBriefing(1);
check('l\'errore non si propaga, briefing vuoto', $b === '');
$GLOBALS['__throw'] = false;

// ── 3. Con dati reali: classificazione nelle tre fasce ────────────────────
echo "\n3. Classificazione delle query\n";
$GLOBALS['__rows']['queries'] = [
    ['query_text' => 'osteopata bergamo',        'impressions' => 400, 'clicks' => 30, 'position' => 2.1],
    ['query_text' => 'mal di schiena rimedi',    'impressions' => 210, 'clicks' => 0,  'position' => 11.4],
    ['query_text' => 'esercizi cervicale casa',  'impressions' => 150, 'clicks' => 0,  'position' => 34.8],
    ['query_text' => 'rumore statistico',        'impressions' => 1,   'clicks' => 0,  'position' => 60.0],
];
$d = VisibilityAnalytics::searchDemand(1);
$names = fn($k) => array_column($d[$k], 'query');
check('la query sotto soglia impression è scartata', !in_array('rumore statistico', $names('top'), true));
check('posizione 11.4 finisce nelle occasioni ravvicinate', in_array('mal di schiena rimedi', $names('striking'), true));
check('posizione 34.8 senza click finisce fra le domande scoperte', in_array('esercizi cervicale casa', $names('unclicked'), true));
check('la query in posizione 2 non è un\'occasione', !in_array('osteopata bergamo', $names('striking'), true));

$b = VisibilityAnalytics::demandBriefing(1);
check('il briefing contiene le query', str_contains($b, 'osteopata bergamo'));
check('il briefing avvisa di non forzare le parole chiave', str_contains($b, 'NON infilarle a forza'));

// ── 4. Estrazione slug dagli URL di Search Console ───────────────────────
echo "\n4. Associazione URL Google → articolo\n";
$GLOBALS['__rows']['pages'] = [
    ['page_url' => 'https://allsocialtoweb.com/mario/esercizi-per-la-cervicale', 'impressions' => 120, 'clicks' => 2, 'position' => 9.3],
];
$GLOBALS['__rows']['fetch'] = ['id' => 42, 'slug' => 'esercizi-per-la-cervicale', 'generated_title' => 'Esercizi', 'edited_title' => null, 'meta_description' => ''];
$GLOBALS['__rows']['page'] = [['query_text' => 'esercizi cervicale', 'impressions' => 90, 'clicks' => 1, 'position' => 9.1]];
$opp = VisibilityAnalytics::opportunities(1);
check('l\'occasione è stata trovata', count($opp) === 1);
check('l\'URL è risolto nell\'articolo corretto', ($opp[0]['post_id'] ?? null) === 42, 'post_id: ' . var_export($opp[0]['post_id'] ?? null, true));
check('le query della pagina sono allegate', !empty($opp[0]['queries']));

// ── 5. Compatibilità dei template già salvati in agent_prompts ───────────
echo "\n5. Sostituzione segnaposto nei prompt\n";
$demandBlock = "\n\nDOMANDA DI RICERCA REALE\n- \"test\"\n";

// Template vecchio, senza {searchDemand}: la domanda deve arrivare comunque
$vecchio = "Contesto: {sourceContext}\nContenuto: {source}";
$has = str_contains($vecchio, '{searchDemand}');
$reso = str_replace(['{sourceContext}', '{searchDemand}', '{source}'],
                    [($has ? 'CTX' : 'CTX' . $demandBlock), $demandBlock, 'SRC'], $vecchio);
check('template senza segnaposto: la domanda arriva via sourceContext', str_contains($reso, 'DOMANDA DI RICERCA REALE'));

// Template nuovo, con {searchDemand}: nessuna duplicazione
$nuovo = "Contesto: {sourceContext}\n{searchDemand}\nContenuto: {source}";
$has = str_contains($nuovo, '{searchDemand}');
$reso = str_replace(['{sourceContext}', '{searchDemand}', '{source}'],
                    [($has ? 'CTX' : 'CTX' . $demandBlock), $demandBlock, 'SRC'], $nuovo);
check('template con segnaposto: la domanda compare una volta sola',
      substr_count($reso, 'DOMANDA DI RICERCA REALE') === 1,
      'occorrenze: ' . substr_count($reso, 'DOMANDA DI RICERCA REALE'));

echo "\n" . str_repeat('─', 46) . "\n";
echo ($fail === 0 ? "TUTTI I TEST PASSATI" : "CI SONO FALLIMENTI") . " — $pass ok, $fail falliti\n";
exit($fail === 0 ? 0 : 1);
