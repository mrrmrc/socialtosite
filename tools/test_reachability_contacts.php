<?php
// tools/test_reachability_contacts.php — Normalizzazione dei contatti diretti
// che alimentano i pulsanti in fondo agli articoli.
// Uso:  php tools/test_reachability_contacts.php   (solo da riga di comando)
if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Solo da CLI'); }

class DB { public static function execute($s,$p=[]){return 0;} public static function fetchAll($s,$p=[]){return [];} }
require_once __DIR__ . '/../api/services/reachability.php';

$pass=0;$fail=0;
function t(string $nome, array $in, array $atteso) {
    global $pass,$fail;
    $out = ReachabilityNetwork::normalize($in);
    $ok = true; $dett = '';
    foreach ($atteso as $k => $v) {
        if (($out[$k] ?? null) !== $v) { $ok=false; $dett .= " $k: atteso ".var_export($v,true).", ottenuto ".var_export($out[$k] ?? null,true).";"; }
    }
    if ($ok) { $pass++; echo "  ok    $nome\n"; }
    else { $fail++; echo "  FALLITO $nome —$dett\n"; }
}

echo "\nTelefono\n";
t('con prefisso e spazi',      ['phone'=>'+39 06 123 4567'], ['phone'=>'+39061234567']);
t('troppo corto → scartato',   ['phone'=>'123'],             ['phone'=>'']);
t('testo non numerico',        ['phone'=>'chiamami'],        ['phone'=>'']);
t('vuoto',                     ['phone'=>''],                ['phone'=>'']);

echo "\nWhatsApp\n";
t('cellulare italiano senza prefisso → completato', ['whatsapp'=>'340 1234567'], ['whatsapp'=>'393401234567']);
t('già con prefisso',          ['whatsapp'=>'+39 340 1234567'], ['whatsapp'=>'393401234567']);
t('estero',                    ['whatsapp'=>'+44 7700 900123'],  ['whatsapp'=>'447700900123']);
t('troppo corto → scartato',   ['whatsapp'=>'1234'],         ['whatsapp'=>'']);

echo "\nEmail\n";
t('valida',                    ['email'=>'info@esempio.it'],  ['email'=>'info@esempio.it']);
t('non valida → scartata',     ['email'=>'non-una-email'],    ['email'=>'']);
t('con spazi',                 ['email'=>'  info@esempio.it '],['email'=>'info@esempio.it']);

echo "\nNessun contatto compilato\n";
$out = ReachabilityNetwork::normalize([]);
$nessuno = ($out['phone']==='' && $out['whatsapp']==='' && $out['email']==='');
if ($nessuno) { $pass++; echo "  ok    profilo vuoto non genera contatti\n"; }
else { $fail++; echo "  FALLITO profilo vuoto\n"; }

echo "\nCompatibilità: i campi preesistenti restano\n";
$out = ReachabilityNetwork::normalize(['official_site_url'=>'esempio.it','primary_topic'=>'test','service_areas'=>['Roma']]);
$ok = $out['official_site_url']==='https://esempio.it' && $out['primary_topic']==='test' && $out['service_areas']===['Roma'];
if ($ok) { $pass++; echo "  ok    sito, tema e territori invariati\n"; }
else { $fail++; echo "  FALLITO campi preesistenti alterati\n"; }

echo "\nScelta della presenza e monitoraggio Google centralizzato\n";
t('solo Spazio Vivo usa il monitoraggio centrale', ['presence_mode'=>'space_only', 'search_console_choice'=>'not_connected'], [
    'presence_mode'=>'space_only',
    'search_console_choice'=>'connected',
]);
t('sito esistente usa il monitoraggio centrale', ['presence_mode'=>'existing_site', 'search_console_choice'=>'connected'], [
    'presence_mode'=>'existing_site',
    'search_console_choice'=>'connected',
]);
t('input tecnico sconosciuto non disattiva il monitoraggio', ['presence_mode'=>'altro', 'search_console_choice'=>'forse'], [
    'presence_mode'=>'undecided',
    'search_console_choice'=>'connected',
]);

echo "\n".str_repeat('─',46)."\n".($fail===0?"TUTTI I TEST PASSATI":"CI SONO FALLIMENTI")." — $pass ok, $fail falliti\n";
exit($fail===0?0:1);
