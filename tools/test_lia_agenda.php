<?php
if (PHP_SAPI!=='cli') exit;
require_once __DIR__.'/../api/services/lia_agenda.php';
class DB {
    public static array $settings=[]; public static array $reads=[]; public static bool $emptyContent=false; public static bool $conflict=false;
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
    public static function execute($sql,$params) {if(str_starts_with($sql,'UPDATE')){if(self::$conflict || (self::$settings[$params[1]]['key_value']??'')!==$params[2])return 0;self::$settings[$params[1]]=['key_value'=>$params[0]];return 1;}self::$settings[$params[0]]=['key_value'=>$params[1]];return 1;}
}
class AI {public static string $response='';public static bool $fail=false;public static string $prompt='';public static function gemini($parts,$options){self::$prompt=$parts[0]['text'];if(self::$fail)throw new RuntimeException('Provider unavailable');return self::$response;}}
function agendaCheck($value,$label){if(!$value)throw new RuntimeException($label);echo 'OK '.$label.PHP_EOL;}
function agendaReject($fn){try{$fn();}catch(RuntimeException|InvalidArgumentException $e){return;}throw new RuntimeException('Invalid agenda accepted');}
$tasks=[];foreach(['editorial','social','seo','geo'] as $day=>$role)$tasks[]=['role'=>$role,'day'=>$day,'title'=>'Azione '.$role,'reason'=>'Motivazione dai contenuti','brief'=>'Aiutami a sviluppare questa attività','post_id'=>1200];
$strategy=['summary'=>'Una guida utile e i suoi adattamenti social','audience'=>'Piccole imprese','positioning'=>'Aiuto pratico','tone'=>'Chiaro e concreto','resources'=>'Da confermare','goals'=>'Far conoscere il servizio','pillars'=>['Guide pratiche'],'channels'=>['site','instagram'],'frequency'=>['Una guida e un post questa settimana'],'kpis'=>['Clic sul contenuto se disponibili'],'assumptions'=>['Disponibilita di due ore da confermare'],'missing_info'=>['Tempo disponibile'],'evidence'=>['Obiettivo dichiarato dal titolare'],'status'=>'approved','approved_at'=>'forged'];
AI::$response=json_encode(['strategy'=>$strategy,'tasks'=>$tasks]);
$agenda=LiaAgenda::generate(12,['name'=>'Titolare'],'Far conoscere il servizio');
agendaCheck(count($agenda['tasks'])===4 && count(array_unique(array_column($agenda['tasks'],'role')))===4,'piano coordina tutte le quattro competenze');
agendaCheck(LiaAgenda::read(12)['id']===$agenda['id'] && LiaAgenda::read(13)['tasks']===[],'piano salvato nel solo account del titolare');
agendaCheck(str_contains(AI::$prompt,'Contenuto proprietario 12') && !str_contains(AI::$prompt,'Contenuto proprietario 13'),'pianificazione usa contenuti reali del proprietario');
foreach(['in_progress','done'] as $status) agendaReject(fn()=>LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],$status));
agendaReject(fn()=>LiaAgenda::taskContext(12,$agenda['id'],$agenda['tasks'][0]['id']));
agendaReject(fn()=>LiaAgenda::approveStrategy(13,$agenda['id']));
agendaReject(fn()=>LiaAgenda::approveStrategy(12,'old-plan'));
DB::$conflict=true;agendaReject(fn()=>LiaAgenda::approveStrategy(12,$agenda['id']));DB::$conflict=false;
agendaCheck(LiaAgenda::read(12)===$agenda,'conflitto approvazione conserva strategia proposta senza autorizzazioni');
$approved=LiaAgenda::approveStrategy(12,$agenda['id']);
agendaCheck($approved['strategy']['status']==='approved' && $approved['strategy']['approved_by']===12 && strtotime($approved['strategy']['approved_at'])!==false,'strategia approvata esplicitamente dal proprietario con data verificabile');
agendaCheck(LiaAgenda::approveStrategy(12,$agenda['id'])===$approved,'approvazione ripetuta non cambia data o proprietario');
agendaReject(fn()=>LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'approved'));
agendaReject(fn()=>LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'done'));
LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'in_review');
$reviewed=LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'approved');
agendaCheck($reviewed['tasks'][0]['approved_by']===12 && strtotime($reviewed['tasks'][0]['approved_at'])!==false,'scheda attivita richiede revisione prima di approvazione tracciata');
$done=LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'done');
agendaCheck($done['tasks'][0]['status']==='done' && LiaAgenda::read(12)['tasks'][0]['status']==='done','avanzamento attività persistente');
agendaReject(fn()=>LiaAgenda::update(13,$agenda['id'],$agenda['tasks'][0]['id'],'done'));
agendaReject(fn()=>LiaAgenda::update(12,'old-plan',$agenda['tasks'][0]['id'],'done'));
agendaReject(fn()=>LiaAgenda::update(12,$agenda['id'],$agenda['tasks'][0]['id'],'publish'));
agendaCheck(LiaAgenda::taskContext(12,$agenda['id'],$agenda['tasks'][0]['id'])===$done['tasks'][0],'contesto LIA proviene dalla scheda salvata del proprietario');
agendaReject(fn()=>LiaAgenda::taskContext(13,$agenda['id'],$agenda['tasks'][0]['id']));
agendaReject(fn()=>LiaAgenda::taskContext(12,'old-plan',$agenda['tasks'][0]['id']));
agendaReject(fn()=>LiaAgenda::taskContext(12,$agenda['id'],'missing-task'));
$wrong=$tasks;$wrong[0]['post_id']=1300;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
$wrong=$tasks;$wrong[0]['role']='admin';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
$wrong=$tasks;$wrong[0]['day']=8;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
agendaReject(fn()=>LiaAgenda::normalize('{"tasks":[]}',[1200],'Obiettivo'));
$enriched=$tasks;
$enriched[0]+=['channel'=>'site','format'=>'Articolo','time'=>'09:30','deliverable'=>'<b>Guida pratica</b> per scegliere il servizio','measure'=>'Controllare i clic disponibili, altrimenti annotare manualmente le richieste','campaign'=>'Scegliere con fiducia','publish'=>true];
$enriched[1]+=['channel'=>'instagram','format'=>'Carosello','time'=>'18:15','deliverable'=>'Cinque slide che riprendono la guida','measure'=>'Verifica manuale dei salvataggi del post','campaign'=>'Scegliere con fiducia'];
$enriched[0]+=['kind'=>'content','audience'=>'Piccole imprese','objective'=>'Spiegare il servizio','copy'=>"Una guida concreta.\nScopri come scegliere.",'visual_brief'=>'Foto autentica fornita dal titolare','materials'=>'Foto da richiedere','owner'=>'','execution_mode'=>'ai','evidence'=>'Titolo presente nel contesto','missing_info'=>'Foto non ancora ricevuta'];
$campaign=LiaAgenda::normalize(json_encode(['strategy'=>$strategy,'tasks'=>$enriched]),[1200],'Far conoscere il servizio');
agendaCheck($campaign['timezone']==='Europe/Rome' && $campaign['schedule_mode']==='suggested' && $campaign['tasks'][0]['time']==='09:30','calendario indica fuso e orari suggeriti senza programmare pubblicazioni');
agendaCheck($campaign['tasks'][0]['deliverable']==='Guida pratica per scegliere il servizio' && $campaign['tasks'][0]['campaign']===$campaign['tasks'][1]['campaign'] && !isset($campaign['tasks'][0]['publish']),'campagna collega sito e social e conserva solo campi consentiti');
agendaCheck($campaign['tasks'][2]['channel']==='' && $campaign['tasks'][2]['time']==='' && $campaign['tasks'][2]['measure']==='','piani precedenti senza dettagli restano compatibili');
agendaCheck($campaign['strategy']['status']==='proposed' && !isset($campaign['strategy']['approved_at']) && $campaign['strategy']['missing_info']===['Tempo disponibile'],'strategia separa ipotesi e informazioni mancanti e AI non puo approvarla');
agendaCheck($campaign['tasks'][0]['kind']==='content' && $campaign['tasks'][0]['owner']==='Da assegnare' && $campaign['tasks'][0]['execution_mode']==='ai' && str_contains($campaign['tasks'][0]['copy'],"\n"),'scheda contenuto conserva testo materiali e responsabilita senza inventare assegnazioni');
$legacy=LiaAgenda::normalize(json_encode(['tasks'=>$tasks]),[1200],'Obiettivo');
agendaCheck(!isset($legacy['strategy']) && $legacy['tasks'][0]['kind']==='activity' && $legacy['tasks'][0]['execution_mode']==='human','piani legacy restano senza strategia e non acquisiscono autorizzazioni AI');
LiaAgenda::save(16,$legacy);
$legacyDone=LiaAgenda::update(16,$legacy['id'],$legacy['tasks'][0]['id'],'done');
agendaCheck($legacyDone['tasks'][0]['status']==='done','piano legacy conserva aggiornamento diretto senza nuova strategia obbligatoria');
LiaAgenda::save(15,$campaign);
$contentId=$campaign['tasks'][0]['id'];
agendaReject(fn()=>LiaAgenda::reviseTask(16,$campaign['id'],$contentId,['copy'=>'Testo altrui']));
agendaReject(fn()=>LiaAgenda::reviseTask(15,'old-plan',$contentId,['copy'=>'Testo vecchio']));
agendaReject(fn()=>LiaAgenda::reviseTask(15,$campaign['id'],'missing-task',['copy'=>'Testo sconosciuto']));
foreach ([[],['status'=>'approved'],['approved_by'=>'15'],['approved_at'=>'2026-11-05'],['post_id'=>'1200'],['date'=>'2026-02-30'],['date'=>'2026-13-01'],['date'=>'today'],['time'=>'24:00'],['channel'=>'unapproved'],['execution_mode'=>'publish'],['kind'=>'approved'],['copy'=>[]]] as $changes) agendaReject(fn()=>LiaAgenda::reviseTask(15,$campaign['id'],$contentId,$changes));
agendaCheck(LiaAgenda::read(15)===$campaign,'modifiche invalide non cambiano scheda stato o autorizzazioni');
$preApproval=LiaAgenda::reviseTask(15,$campaign['id'],$contentId,['materials'=>'Fotografia da ricevere dal titolare']);
agendaCheck($preApproval['tasks'][0]['status']==='todo' && $preApproval['strategy']['status']==='proposed','revisione scheda non approva strategia ne avvia lavoro');
LiaAgenda::approveStrategy(15,$campaign['id']);
foreach (['audience','objective','channel','format','copy'] as $required) {
    $before=LiaAgenda::read(15);
    LiaAgenda::reviseTask(15,$campaign['id'],$contentId,[$required=>'']);
    LiaAgenda::update(15,$campaign['id'],$contentId,'in_review');
    agendaReject(fn()=>LiaAgenda::update(15,$campaign['id'],$contentId,'approved'));
    LiaAgenda::save(15,$before);
}
agendaCheck(true,'contenuto non approvabile senza pubblico obiettivo canale formato o testo');
LiaAgenda::update(15,$campaign['id'],$contentId,'in_review');
$contentApproved=LiaAgenda::update(15,$campaign['id'],$contentId,'approved');
DB::$conflict=true;
agendaReject(fn()=>LiaAgenda::reviseTask(15,$campaign['id'],$contentId,['copy'=>'Una modifica concorrente']));
agendaReject(fn()=>LiaAgenda::update(15,$campaign['id'],$contentId,'done'));
DB::$conflict=false;
agendaCheck(LiaAgenda::read(15)===$contentApproved,'conflitti scheda e avanzamento preservano contenuto e approvazione precedenti');
$edited=LiaAgenda::reviseTask(15,$campaign['id'],$contentId,['copy'=>"<b>Nuova guida concreta.</b>\nContattaci per conoscere il servizio.",'date'=>'2026-12-01','owner'=>'Titolare']);
$editedTask=array_values(array_filter($edited['tasks'],static fn($task)=>$task['id']===$contentId))[0];
agendaCheck($editedTask['status']==='in_progress' && !isset($editedTask['approved_at']) && !isset($editedTask['approved_by']) && $edited['strategy']['status']==='approved','modifica contenuto revoca approvazione scheda e conserva strategia approvata');
agendaCheck($editedTask['copy']==="Nuova guida concreta.\nContattaci per conoscere il servizio." && $editedTask['date']==='2026-12-01' && end($edited['tasks'])['id']===$contentId,'revisione salva testo semplice multilinea e riordina la data valida');
agendaReject(fn()=>LiaAgenda::update(15,$campaign['id'],$contentId,'done'));
agendaCheck(LiaAgenda::reviseTask(15,$campaign['id'],$contentId,['copy'=>$editedTask['copy']])===$edited,'salvataggio senza modifiche non altera stato e data');
$operational=$enriched;$operational[2]['role']='community';$operational[3]['role']='report';
agendaCheck(count(LiaAgenda::normalize(json_encode(['strategy'=>$strategy,'tasks'=>$operational]),[1200],'Obiettivo')['tasks'])===4,'piano include community e report mantenendo redazione e social');
$wrong=$operational;$wrong[0]['role']='reputation';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
foreach (['execution_mode'=>'publish_now','kind'=>'published','materials'=>['token'=>'secret']] as $key=>$value) {$wrong=$enriched;$wrong[0][$key]=$value;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));}
$badStrategy=$strategy;$badStrategy['pillars']='not-an-array';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['strategy'=>$badStrategy,'tasks'=>$tasks]),[1200],'Obiettivo'));
$badStrategy=$strategy;$badStrategy['audience']=['forged'];agendaReject(fn()=>LiaAgenda::normalize(json_encode(['strategy'=>$badStrategy,'tasks'=>$tasks]),[1200],'Obiettivo'));
foreach (['24:00','12:60','9:30',[],"09:30\n"] as $time) {$wrong=$enriched;$wrong[0]['time']=$time;agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));}
$wrong=$enriched;$wrong[0]['channel']='https://evil.test';agendaReject(fn()=>LiaAgenda::normalize(json_encode(['tasks'=>$wrong]),[1200],'Obiettivo'));
agendaCheck(str_contains(AI::$prompt,'REGIA SOCIAL MEDIA MANAGER') && str_contains(AI::$prompt,'non esistono post importati') && str_contains(AI::$prompt,'non sono pubblicazioni programmate'),'LIA parte dall attivita e distingue pianificazione da pubblicazione');
$again=LiaAgenda::generate(12,[],'Proseguire la campagna');
agendaCheck(str_contains(AI::$prompt,'previous_tasks') && str_contains(AI::$prompt,'"status":"done"'),'nuovo piano considera i lavori gia completati');
LiaAgenda::save(12,$done);
AI::$fail=true;agendaReject(fn()=>LiaAgenda::generate(12,[],'Nuovo obiettivo'));
agendaCheck(LiaAgenda::read(12)===$done,'errore provider conserva il piano e gli avanzamenti precedenti');
AI::$fail=false;AI::$response=json_encode(['tasks'=>$tasks]);
agendaReject(fn()=>LiaAgenda::generate(12,[],'Nuovo obiettivo senza strategia'));
agendaCheck(LiaAgenda::read(12)===$done,'nuova generazione senza strategia valida non sostituisce il piano precedente');
AI::$fail=false;DB::$emptyContent=true;
$original=$enriched;foreach($original as &$task)$task['post_id']=null;unset($task);
AI::$response=json_encode(['strategy'=>$strategy,'tasks'=>$original]);
$fromActivity=LiaAgenda::generate(14,[],'Creare contenuti originali dalla mia attivita');
agendaCheck(count($fromActivity['tasks'])===4 && $fromActivity['tasks'][0]['post_id']===null && $fromActivity['tasks'][1]['channel']==='instagram','campagna originale puo partire senza contenuti importati e senza canali collegati');
LiaAgenda::approveStrategy(14,$fromActivity['id']);
$resultTask=$fromActivity['tasks'][0]['id'];
LiaAgenda::update(14,$fromActivity['id'],$resultTask,'in_review');
$resultApproved=LiaAgenda::update(14,$fromActivity['id'],$resultTask,'approved');
LiaAgenda::update(14,$fromActivity['id'],$resultTask,'done');
$observed=LiaAgenda::reviseTask(14,$fromActivity['id'],$resultTask,['result_notes'=>'Tre richieste annotate dal titolare','results_source'=>'Registro manuale dei contatti','results_period'=>'Ultimi sette giorni']);
agendaCheck($observed['tasks'][0]['status']==='done' && $observed['tasks'][0]['approved_at']===$resultApproved['tasks'][0]['approved_at'] && $observed['tasks'][0]['results_provenance']==='owner_reported','annotare risultati dichiarati conserva completamento e approvazione del contenuto');
LiaAgenda::generate(14,[],'Migliorare il prossimo piano');
agendaCheck(str_contains(AI::$prompt,'Tre richieste annotate dal titolare') && str_contains(AI::$prompt,'owner_reported') && str_contains(AI::$prompt,'Registro manuale dei contatti'),'piano successivo usa risultati dichiarati con fonte e periodo senza simularne la verifica');
$sameDay=$enriched;$sameDay[0]['day']=0;$sameDay[0]['time']='18:00';$sameDay[1]['day']=0;$sameDay[1]['time']='09:00';
$sorted=LiaAgenda::normalize(json_encode(['strategy'=>$strategy,'tasks'=>$sameDay]),[1200],'Verificare ordine orari');
agendaCheck($sorted['tasks'][0]['time']==='09:00' && $sorted['tasks'][1]['time']==='18:00','attivita nello stesso giorno ordinate anche per orario proposto');
echo "LIA agenda: ownership, strategy approval, content review, validated edits, concurrent writes, legacy progress, reported results and failure recovery passed.\n";
