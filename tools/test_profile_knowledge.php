<?php
require_once __DIR__ . '/../api/services/profile_knowledge.php';
function checkKnowledge(string $label, bool $pass): void {
    if (!$pass) throw new RuntimeException($label);
    echo "OK: {$label}\n";
}
$empty = ProfileKnowledge::coverage([]);
checkKnowledge('profilo vuoto non viene dichiarato verificato', $empty['coverage'] === 0 && $empty['score'] === null && !$empty['reviewed']);
$site = ['site_understanding'=>['declared_strategy'=>['activity_type'=>'Vecchia attività','priority_services'=>['A','B']]],
    'site_understanding_corrections'=>['declared_strategy'=>['activity_type'=>'Nuova attività','priority_services'=>[]]]];
$merged = ProfileKnowledge::understanding($site);
checkKnowledge('le correzioni prevalgono e una lista vuota rimuove le vecchie priorità', $merged['declared_strategy']['activity_type'] === 'Nuova attività' && $merged['declared_strategy']['priority_services'] === []);
$strategy = array_fill_keys(array_keys(ProfileKnowledge::FIELDS), 'Risposta concreta');
$full = ProfileKnowledge::coverage(['site_understanding'=>['declared_strategy'=>$strategy]]);
checkKnowledge('dati presenti non equivalgono a conoscenza AI', $full['coverage'] === 100 && $full['score'] === null);
$fields = array_map(fn($field)=>['key'=>$field['key'],'status'=>'clear'], $full['fields']);
$fields[2]['status'] = 'unclear';
$fields[2]['question'] = 'Quale pubblico prioritario vuoi raggiungere?';
$review = ProfileKnowledge::applyReview($full, ['fields'=>$fields]);
checkKnowledge('una risposta vaga riduce la conoscenza e genera approfondimento', $review['score'] === 95 && $review['fields'][2]['status'] === 'unclear');
$emptyReview = ProfileKnowledge::applyReview($empty, ['fields'=>$fields]);
checkKnowledge('AI non può assegnare conoscenza a campi assenti', $emptyReview['score'] === 0);
try {
    ProfileKnowledge::applyReview($full, ['fields'=>array_slice($fields,0,3)]);
    throw new RuntimeException('Revisione parziale accettata');
} catch (RuntimeException $e) {
    checkKnowledge('revisione parziale rifiutata', $e->getMessage() === 'Revisione LIA incompleta');
}
