<?php
require_once __DIR__ . '/../api/services/ai_health.php';
require_once __DIR__ . '/../api/services/profile_knowledge.php';
function healthCheck(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
healthCheck(AIHealth::runtime(['curl'=>true,'mbstring'=>true,'openssl'=>true])['ready'], 'Complete runtime accepted');
$missing = AIHealth::runtime(['curl'=>false,'mbstring'=>false,'openssl'=>true]);
healthCheck(!$missing['ready'] && $missing['missing_extensions'] === ['curl','mbstring'], 'Missing runtime dependencies identified');
$cases = [
    ['AI_RUNTIME_MISSING:curl,mbstring','runtime_unavailable'],
    ['Call to undefined function curl_init()','runtime_unavailable'],
    ['Call to undefined function mb_substr()','runtime_unavailable'],
    ['GEMINI_API_KEY mancante secret-value','provider_not_configured'],
    ['Gemini (403): private provider response','provider_access_denied'],
    ['Gemini (429): private quota details','provider_rate_limited'],
    ['Gemini (404): private model details','provider_model_unavailable'],
    ['Gemini (400): private request details','provider_invalid_request'],
    ['SQLSTATE[HY000] private table details','provider_storage_error'],
    ['Gemini: errore di rete (Operation timed out)','provider_timeout'],
    ['Gemini: errore di rete (SSL certificate error)','provider_network_error'],
    ['Revisione LIA incompleta','provider_incomplete_response'],
    ['unknown failure with secret-value','provider_unavailable'],
];
foreach ($cases as [$input,$code]) {
    $failure = AIHealth::failure(new RuntimeException($input));
    healthCheck($failure['code'] === $code, 'Correct actionable diagnosis: '.$code);
    healthCheck(!str_contains(json_encode($failure), 'secret-value') && !str_contains(json_encode($failure),'private'), 'Provider details and credentials never exposed');
}
class AI { public static function gemini($parts,$config) { throw new RuntimeException('Gemini (429): private quota'); } }
$strategy = array_fill_keys(array_keys(ProfileKnowledge::FIELDS),'Informazione già salvata');
$review = ProfileKnowledge::review(['site_understanding'=>['declared_strategy'=>$strategy]]);
healthCheck($review['coverage']===100 && !$review['reviewed'] && $review['score']===null, 'Provider failure cannot erase saved information or fabricate a score');
healthCheck(isset($review['error']['code']) && $review['summary']===$review['error']['message'], 'Unavailability has a safe user-facing reason');
if (AIHealth::runtime()['ready']) healthCheck($review['error']['code']==='provider_rate_limited','Provider failure propagated when runtime is healthy');
else healthCheck($review['error']['code']==='runtime_unavailable','Runtime failure diagnosed before provider call');
echo "AI health: runtime dependencies, safe error categories and saved profile preservation passed.\n";
