<?php
if (PHP_SAPI !== 'cli') exit;
if (($argv[1] ?? '') === '--request') {
    $method=$argv[2]; $action=$argv[3]; $userId=12; $_GET=['cursor'=>20];
    class PublicationSecurity { public static function endpoint($url){return $url;} }
    class WordPressBridge {
        public static function load($uid){return ['endpoint'=>'https://wp.example','secret'=>'encrypted','filters'=>['scope'=>'published']];}
        public static function topics($uid){return ['Viaggi'];}
        public static function filters($input){return $input;}
        public static function archive($uid){return ['total'=>45];}
        public static function remote($settings,$method,$route,$payload=null){return ['sync_available'=>true,'archive_available'=>true,'method'=>$method,'route'=>$route,'categories'=>[['id'=>7,'name'=>'Viaggi']]];}
        public static function feed($uid,$cursor,$filters){return ['posts'=>[['id'=>21,'html'=>'private body','title'=>'Articolo']],'scope'=>$filters['scope'],'next_cursor'=>40,'has_more'=>true];}
        public static function crypt($value,...$args){return $value;}
        public static function save(...$args){}
    }
    function body(){return ['endpoint'=>'https://wp.example','secret'=>str_repeat('a',64)];}
    function json($data,$status=200){echo json_encode(['status'=>$status,'data'=>$data]);exit;}
    function jsonError($message,$status=400){json(['error'=>$message],$status);}
    $source=file_get_contents(__DIR__.'/../api/routes/wordpress.php');
    $source=preg_replace('/^require_once .*;\R/m','',$source);
    eval(substr($source,5));
    exit;
}
foreach ([['GET','wordpress-taxonomies',200],['POST','wordpress-taxonomies',200],['POST','wordpress-connect',200],['GET','wordpress-connect',405],['GET','wordpress-library',200]] as [$method,$action,$expected]) {
    $command=escapeshellarg(PHP_BINARY).' '.escapeshellarg(__FILE__).' --request '.$method.' '.$action;
    $response=json_decode(shell_exec($command),true);
    if(($response['status'] ?? 0)!==$expected)throw new RuntimeException("$method $action failed");
    if($action==='wordpress-taxonomies' && $response['data']['method']!=='GET')throw new RuntimeException('WordPress health must use GET');
    if($action==='wordpress-library' && ($response['data']['scope']!=='all' || isset($response['data']['posts'][0]['html'])))throw new RuntimeException('Library must list the entire archive without full article bodies');
    echo "OK $method $action HTTP $expected\n";
}
