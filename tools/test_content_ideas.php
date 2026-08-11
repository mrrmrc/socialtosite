<?php
// Test puro: non usa rete, database o credenziali AI.
if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Solo da CLI'); }
require_once __DIR__ . '/../api/services/content_ideas.php';

$pass = 0; $fail = 0;
function checkIdea(string $name, bool $condition): void {
    global $pass, $fail;
    if ($condition) { $pass++; echo "  ok    {$name}\n"; }
    else { $fail++; echo "  FALLITO {$name}\n"; }
}

echo "\nParsing risposta AI\n";
$decoded = ContentIdeaFormatter::decode("Testo introduttivo\n```json\n" . json_encode([
    'ideas' => [
        ['title'=>'Idea uno', 'reason'=>'Motivo uno', 'type'=>'Guida'],
        ['titolo'=>'Idea due', 'perche'=>'Motivo due', 'tipo'=>'Storia'],
        ['title'=>'Idea tre', 'source_url'=>'javascript:alert(1)'],
    ],
], JSON_UNESCAPED_UNICODE) . "\n```");
checkIdea('estrae il contenitore ideas anche con testo esterno', count($decoded) === 3);

echo "\nCompletamento affidabile\n";
$fallbacks = ContentIdeaFormatter::fallbacks(
    ['title'=>'Studio Esempio', 'profile_summary'=>'Supporto e consulenza'],
    ['activity_type'=>'consulenza professionale', 'primary_audience'=>'famiglie', 'desired_action'=>'richiedere informazioni'],
    ['primary_topic'=>'consulenza per famiglie']
);
$ideas = ContentIdeaFormatter::normalize(array_slice($decoded, 0, 2), $fallbacks);
checkIdea('una risposta con due elementi viene completata a tre', count($ideas) === 3);
checkIdea('i nomi italiani dei campi vengono normalizzati', ($ideas[1]['title'] ?? '') === 'Idea due');
$unsafeUrlIdea = ContentIdeaFormatter::normalize([$decoded[2]])[0] ?? [];
checkIdea('gli URL non sicuri vengono rimossi', ($unsafeUrlIdea['source_url'] ?? 'x') === '');
checkIdea('tutte le idee hanno titolo e motivazione', count(array_filter($ideas, fn($idea) => $idea['title'] !== '' && $idea['reason'] !== '')) === 3);

echo "\nDeduplicazione\n";
$duplicates = ContentIdeaFormatter::normalize([
    ['title'=>'La stessa idea'],
    ['title'=>'La stessa idea!'],
], $fallbacks);
checkIdea('i titoli equivalenti non vengono ripetuti', count(array_filter($duplicates, fn($idea) => str_starts_with($idea['title'], 'La stessa idea'))) === 1);
checkIdea('anche dopo la deduplicazione restano tre proposte', count($duplicates) === 3);

echo "\n" . str_repeat('─', 46) . "\n" . ($fail === 0 ? 'TUTTI I TEST PASSATI' : 'CI SONO FALLIMENTI') . " — {$pass} ok, {$fail} falliti\n";
exit($fail === 0 ? 0 : 1);
