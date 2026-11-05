<?php
if (PHP_SAPI!=='cli') exit;
require_once __DIR__.'/../api/services/lia_agenda.php';
class DB {
    public static array $settings=[]; public static array $reads=[]; public static bool $emptyContent=false;
    public static function fetch($sql,$params) {
        self::$reads[]=[$sql,$params];
        if (str_contains($sql,'system_settings')) return self::$settings[$params[0]] ?? null;
        if (str_contains($sql,'FROM sites')) return ['title'=>'Attività proprietario '.$params[0]];
        if (str_contains($sql,'FROM social_sources')) return ['sources'=>1];
        return ['acquired'=>1,'ready'=>1,'published'=>0,'pending'=>0,'processing'=>0];
    }
    public static function fetchAll($sql,$params) {
        self::$reads[]=[$sql,$params];
        if(self::$emptyContent && (str_contains($sql,'FROM posts') || str_contains($sql,'social_sources'))) return [];
        return str_contains($sql,'social_sources') ? [['platform'=>'instagram','label'=>'Canale proprietario '.$params[0]]] : [['id'=>$params[0]*100,'title'=>'Contenuto proprietario '.$params[0],'platform'=>'manual','seo_score'=>80,'published'=>0,'processing_status'=>'done']];
    }
    public static function execute($sql,$params) {if(str_starts_with($sql,'UPDATE')){if((self::$settings[$params[1]]['key_value']??'')!==$params[2])return 0;self::$settings[$params[1]]=['key_value'=>$params[0]];return 1;}self::$settings[$params[0]]=['key_value'=>$params[1]];return 1;}
}
class AI {public static string $response='';public static bool $fail=false;public static string $prompt='';public static function gemini($parts,$options){self::$prompt=$parts[0]['text'];if(self::$fail)throw new RuntimeException('Provider unavailable');return self::$response;}}
function agendaCheck($value,$label){if(!$value)throw new RuntimeException($label);echo 'OK '.$label.PHP_EOL;}
function agendaReject($fn){try{$fn();}catch(RuntimeException|InvalidArgumentException $e){return;}throw new RuntimeException('Invalid agenda accepted');}
$tasks=[];foreach(array_keys(LiaAgenda::ROLES) as $day=>$role)$tasks[]=['role'=>$role,'day'=>$day,'title'=>'Azione '.$role,'reason'=>'Motivazione dai contenuti','brief'=>'Aiutami a sviluppare questa attività','post_id'=>1200];
AI::$response=json_encode(['tasks'=>$tasks]);
$agenda=LiaAgenda::generate(12,['name'=>'Titolare'],'Far conoscere il servizio');
agendaCheck(count($agenda['tasks'])===4 && count(array_unique(array_column($agenda['tasks'],'role')))===4,'piano coordina tutte le quattro competenze');
agendaCheck(LiaAgenda::read(12)['id']===$agenda['id'] && LiaAgenda::read(13)['tasks']===[],'piano salvato nel solo account del titolare');
agendaCheck(str_contains(AI::$prompt,'Contenuto proprietario 12') && !str_contains(AI::$prompt,'Contenuto proprietario 13'),'pianificazione usa contenuti reali del proprietario');
$done=LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'done');
agendaCheck($done['tasks'][0]['status']==='done' && LiaAgenda::read(12)['tasks'][0]['status']==='done','avanzamento attività persistente');
agendaReject(fn()=>LiaAgenda::update(13,$agenda['id'],$agenda['tasks'][0]['id'],'done'));
agendaReject(fn()=>LiaAgenda::update(12,'old-plan',$agenda['tasks'][0]['id'],'done'));
agendaReject(fn()=>LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'publish'));
$wrong=$tasks;$wrong[0]['post_id']=1300;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
$wrong=$tasks;$wrong[0]['role']='admin';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
$wrong=$tasks;$wrong[0]['day']=8;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
agendaReject(fn()=>LiaAgenda::normalize('{"tasks":[]}',[1200],'Obiettivo'));
$enriched=$tasks;
$enriched[0]+=['channel'=>'site','format'=>'Articolo','time'=>'09:30','deliverable'=>'<b>Guida pratica</b> per scegliere il servizio','measure'=>'Controllare i clic disponibili, altrimenti annotare manualmente le richieste','campaign'=>'Scegliere con fiducia','publish'=>true];
$enriched[1]+=['channel'=>'instagram','format'=>'Carosello','time'=>'18:15','deliverable'=>'Cinque slide che riprendono la guida','measure'=>'Verifica manuale dei salvataggi del post','campaign'=>'Scegliere con fiducia'];
$campaign=LiaAgenda::normalize(json_encode(['tasks'=>$enriched]),[1200],'Far conoscere il servizio');
agendaCheck($campaign['timezone']==='Europe/Rome' && $campaign['schedule_mode']==='suggested' && $campaign['tasks'][0]['time']==='09:30','calendario indica fuso e orari suggeriti senza programmare pubblicazioni');
agendaCheck($campaign['tasks'][0]['deliverable']==='Guida pratica per scegliere il servizio' && $campaign['tasks'][0]['campaign']===$campaign['tasks'][1]['campaign'] && !isset($campaign['tasks'][0]['publish']),'campagna collega sito e social e conserva solo campi consentiti');
agendaCheck($campaign['tasks'][2]['channel']==='' && $campaign['tasks'][2]['time']==='' && $campaign['tasks'][2]['measure']==='','piani precedenti senza dettagli restano compatibili');
foreach (['24:00','12:60','9:30',[],"09:30\n"] as $time) {$wrong=$enriched;$wrong[0]['time']=$time;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));}
$wrong=$enriched;$wrong[0]['channel']='https://evil.test';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
agendaCheck(str_contains(AI::$prompt,'REGIA SOCIAL MEDIA MANAGER') && str_contains(AI::$prompt,'non esistono post importati') && str_contains(AI::$prompt,'non sono pubblicazioni programmate'),'LIA parte dall attivita e distingue pianificazione da pubblicazione');
$again=LiaAgenda::generate(12,[],'Proseguire la campagna');
agendaCheck(str_contains(AI::$prompt,'previous_tasks') && str_contains(AI::$prompt,'"status":"done"'),'nuovo piano considera i lavori gia completati');
LiaAgenda::save(12,$done);
AI::$fail=true;agendaReject(fn()=>LiaAgenda::generate(12,[],'Nuovo obiettivo'));
agendaCheck(LiaAgenda::read(12)===$done,'errore provider conserva il piano e gli avanzamenti precedenti');
AI::$fail=false;DB::$emptyContent=true;
$original=$enriched;foreach($original as &$task)$task['post_id']=null;unset($task);
AI::$response=json_encode(['tasks'=>$original]);
$fromActivity=LiaAgenda::generate(14,[],'Creare contenuti originali dalla mia attivita');
agendaCheck(count($fromActivity['tasks'])===4 && $fromActivity['tasks'][0]['post_id']===null && $fromActivity['tasks'][1]['channel']==='instagram','campagna originale puo partire senza contenuti importati e senza canali collegati');
echo "LIA agenda: ownership, four roles, verified references, durable progress and failure recovery passed.\n";
