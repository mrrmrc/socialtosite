<?php
if (PHP_SAPI !== 'cli') exit;
class DB {
    public static array $sources = [
        ['id'=>11,'user_id'=>1,'platform'=>'instagram','auto_sync'=>1],
        ['id'=>12,'user_id'=>1,'platform'=>'website','auto_sync'=>0],
        ['id'=>13,'user_id'=>2,'platform'=>'website','auto_sync'=>1],
    ];
    public static function fetchAll($sql, $params=[]) {
        if (str_starts_with($sql, 'SHOW')) return [['Field'=>'auto_sync']];
        return array_values(array_filter(self::$sources, fn($s) => $s['user_id']===$params[0] && (!isset($params[1]) || $s['id']===$params[1]) && (!str_contains($sql,'auto_sync=1') || $s['auto_sync']===1)));
    }
    public static function fetch(...$args) { return null; }
    public static function execute(...$args) { return 1; }
}
class Ingest {
    public static array $scanned = [];
    public static function scanSources($uid,$limit,$profile,$role,$strategy,$source,$since) {
        self::$scanned[] = $source;
        return ['found'=>1,'imported'=>1,'imported_ids'=>[$source*10],'retryable_ids'=>[$source*10+1]];
    }
}
$source = file_get_contents(__DIR__ . '/../api/services/sync.php');
$source = preg_replace('/^require_once .*;\R/m', '', $source);
eval(substr($source, 5));
function syncCheck($ok, $label) { if (!$ok) throw new RuntimeException($label); echo "OK $label\n"; }
$result = Sync::syncUser(1,20,null,false,12);
syncCheck(Ingest::$scanned===[12], 'sincronizzazione del solo sito selezionato anche se automatismo spento');
syncCheck($result[0]['source_id']===12 && $result[0]['imported_ids']===[120] && $result[0]['retryable_ids']===[121], 'elaborazione limitabile agli articoli del canale selezionato');
$denied=false; try { Sync::syncUser(1,20,null,false,13); } catch (DomainException $e) { $denied=true; }
syncCheck($denied && Ingest::$scanned===[12], 'canale di altro proprietario respinto senza scansionare altri canali');
Ingest::$scanned=[]; Sync::syncUser(1,20,null,true);
syncCheck(Ingest::$scanned===[11], 'cron rispetta aggiornamento automatico per canale');
Ingest::$scanned=[]; Sync::syncUser(1);
syncCheck(Ingest::$scanned===[11,12], 'sincronizza tutti mantiene il comportamento manuale');
