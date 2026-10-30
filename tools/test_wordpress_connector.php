<?php
// Contratto locale del plugin con storage e funzioni WordPress simulati.
// Non sostituisce il collaudo con WordPress e MariaDB reali.
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__ . '/'); define('ARRAY_A', 'ARRAY_A');
function register_activation_hook(...$args) {} function add_action(...$args) {}
function add_filter(...$args) {} function register_deactivation_hook(...$args) {}
class WP_Error { public function __construct(public string $code, public string $message, public array $data=[]) {} }
class WP_REST_Request implements ArrayAccess {
    public array $headers=[];
    public string $key; public array $payload;
    public function __construct(string $key, array|string $payload) { $this->key=$key; $this->payload=is_array($payload) ? $payload : []; }
    public function set_url_params($params) { $this->key=$params['key']; }
    public function set_body($body) { $this->payload=json_decode($body,true); }
    public function set_header($name,$value) { $this->headers[$name]=$value; }
    public function get_header($name) { return $this->headers[$name] ?? ''; }
    public function get_route() { return '/allsocialtoweb/v1/deliveries/' . $this->key; }
    public function get_method() { return 'POST'; }
    public function get_body() { return json_encode($this->payload); }
    public function get_json_params() { return $this->payload; }
    public function offsetExists(mixed $o): bool { return $o === 'key'; }
    public function offsetGet(mixed $o): mixed { return $this->key; }
    public function offsetSet(mixed $o,mixed $v): void {} public function offsetUnset(mixed $o): void {}
}
$posts = []; $nextId = 1; $failCreate = false;
$options=['astw_secret'=>'test-secret','astw_author'=>3];
function get_option($name,$default=null) { global $options; return $options[$name] ?? $default; }
function user_can(...$args) { return true; }
function wp_set_current_user($id) {}
function sanitize_text_field($v) { return strip_tags($v); }
function sanitize_textarea_field($v) { return strip_tags($v); }
function wp_kses($v, $allowed, $protocols) { return strip_tags($v, '<p><strong>'); }
function wp_strip_all_tags($v) { return strip_tags($v); }
function absint($v) { return abs((int)$v); }
function term_exists($id,$taxonomy) { return in_array($id, $taxonomy === 'post_tag' ? [9,10] : [7,8], true); }
function wp_slash($v) { return $v; }
function get_current_user_id() { return 3; }
function current_user_can(...$args) { return true; }
function is_wp_error($v) { return $v instanceof WP_Error; }
function get_permalink($id) { return 'https://example.com/?p=' . $id; }
function get_post($id) { global $posts; return isset($posts[$id]) ? (object)$posts[$id] : null; }
function wp_insert_post($data,$error) { global $posts,$nextId,$failCreate; if ($failCreate) return new WP_Error('failed','simulated'); $id=$nextId++; $posts[$id]=array_merge($data,['ID'=>$id]); return $id; }
function wp_update_post($data,$error) { global $posts,$failPublish; if (!empty($failPublish)) return new WP_Error('failed','simulated'); $posts[$data['ID']]=array_merge($posts[$data['ID']],$data); return $data['ID']; }
function get_post_meta($id,$key,$single) { global $posts; return $posts[$id]['meta_input'][$key] ?? ''; }
function delete_post_meta($id,$key) { global $posts; unset($posts[$id]['meta_input'][$key]); }
class FakeWpDb {
    public string $prefix='wp_'; public string $posts='wp_posts'; public array $rows=[];
    public array $nonces=[];
    public function query($prepared) {
        if(is_string($prepared))return 0;
        $nonce=$prepared[1][0];
        if(isset($this->nonces[$nonce]))return 0;
        $this->nonces[$nonce]=true; return 1;
    }
    public function prepare($query,...$args) { return [$query,$args]; }
    public function get_row($prepared,$format) { return $this->rows[$prepared[1][0]] ?? null; }
    public function get_var($prepared) {
        global $posts;
        [$query,$args]=$prepared;
        if (str_contains($query,'GET_LOCK') || str_contains($query,'RELEASE_LOCK')) return 1;
        foreach($posts as $post) if($post['post_content_filtered'] === $args[0]) return $post['ID'];
        return null;
    }
    public function insert($table,$row) { $key=$row['delivery_key']; if(isset($this->rows[$key]))return false; $this->rows[$key]=$row+['post_id'=>null]; return 1; }
    public function update($table,$values,$where) { $key=$where['delivery_key']; $this->rows[$key]=array_merge($this->rows[$key],$values); return 1; }
}
$wpdb=new FakeWpDb();
require __DIR__ . '/../integrations/wordpress/allsocialtoweb/allsocialtoweb.php';
function expect($value,$label) { if(!$value)throw new RuntimeException('FAIL '.$label); echo 'OK '.$label.PHP_EOL; }
$key=str_repeat('a',64); $payload=['title'=>'Titolo','html'=>'<p>Testo</p>','category_id'=>7];
$request=new WP_REST_Request($key,$payload);
require_once __DIR__ . '/../api/services/publication/security.php';
$time=(string)time(); $nonce=bin2hex(random_bytes(16));
$request->headers=['x-astw-time'=>$time,'x-astw-nonce'=>$nonce,'x-astw-signature'=>PublicationSecurity::signature('test-secret',$time,$nonce,'POST','/deliveries/'.$key,$request->get_body())];
expect(astw_permission($request)===true,'firma client compatibile con plugin');
expect(is_wp_error(astw_permission($request)),'richiesta firmata riutilizzata respinta');
$tampered=new WP_REST_Request($key,['title'=>'alterato']); $tampered->headers=$request->headers;
expect(is_wp_error(astw_permission($tampered)),'payload alterato respinto');
$options['astw_secret']='';
expect(is_wp_error(astw_permission($request)),'revoca remota applicata');
$options['astw_secret']='test-secret';
expect(astw_receipt($key)['state']==='missing','nessuna bozza al test connessione');
$first=astw_deliver($request);
expect($first['state']==='draft' && count($posts)===1,'prima consegna solo bozza');
$again=astw_deliver($request);
expect($again['id']===$first['id'] && count($posts)===1,'retry senza duplicati');
$posts[$first['id']]['post_content']='<p>Modifica del cliente</p>';
astw_deliver($request);
expect($posts[$first['id']]['post_content']==='<p>Modifica del cliente</p>','retry conserva modifica cliente');
expect(is_wp_error(astw_deliver(new WP_REST_Request($key,$payload+['excerpt'=>'diverso']))),'versione diversa respinta');
$wpdb->rows[$key]['post_id']=null;
expect(astw_receipt($key)['id']===$first['id'],'riconciliazione dopo crash prima della ricevuta');
expect(astw_publish($request)['state']==='published','pubblicazione esplicita');
expect($posts[$first['id']]['post_content']==='<p>Modifica del cliente</p>','pubblicazione conserva versione CMS');
$failCreate=true; $failedKey=str_repeat('b',64); astw_deliver(new WP_REST_Request($failedKey,$payload)); $failCreate=false;
expect(astw_deliver(new WP_REST_Request($failedKey,$payload))['state']==='uncertain' && count($posts)===1,'esito incerto non crea un duplicato');
expect(is_wp_error(astw_deliver(new WP_REST_Request(str_repeat('c',64),['title'=>'x','html'=>'<p>x</p>','category_id'=>99]))),'categoria inesistente respinta');
echo "Contratto WordPress locale superato.\n";

function update_option($name,$value,...$args) { global $options; $options[$name]=$value; }
function wp_parse_url($url) { return parse_url($url); }
function wp_http_validate_url($url) { return filter_var($url,FILTER_VALIDATE_URL); }
function wp_next_scheduled(...$args) { return false; }
function wp_schedule_event(...$args) {}
function wp_clear_scheduled_hook(...$args) {}
function wp_json_encode($value) { return json_encode($value); }
function add_query_arg($name,$value,$url) { return $url.'&'.$name.'='.$value; }
function wp_safe_remote_get(...$args) { global $remoteFeed,$feedRequestUrl; $feedRequestUrl=$args[0]; return ['body'=>json_encode($remoteFeed)]; }
function wp_remote_retrieve_response_code($response) { return 200; }
function wp_remote_retrieve_body($response) { return $response['body']; }
$settings=['feed_url'=>'https://platform.example/api/wordpress-feed.php?user_id=3','feed_token'=>str_repeat('f',64),'enabled'=>true,'post_status'=>'publish','category_id'=>7,'mappings'=>['Viaggi'=>['category_id'=>8,'tag_id'=>9]]];
expect(astw_save_sync_settings(new WP_REST_Request('', $settings))['ok'], 'abbinamenti salvati sul plugin');
$bad=$settings; $bad['mappings']['Viaggi']['tag_id']=99;
expect(is_wp_error(astw_save_sync_settings(new WP_REST_Request('', $bad))), 'tag eliminato respinto prima del salvataggio');
expect(is_wp_error(astw_save_sync_settings(new WP_REST_Request('', array_replace($settings,['feed_url'=>'http://platform.example/feed'])))), 'feed HTTP respinto');
$mapped=astw_mapping(['Viaggi'], $settings);
expect($mapped===['category_ids'=>[8],'tag_ids'=>[9]], 'categoria e tag abbinati per argomento');
expect(astw_mapping(['Altro'], $settings)['category_ids']===[7], 'categoria predefinita per argomento sconosciuto');
$before=count($posts);
$remoteFeed=['posts'=>[['key'=>str_repeat('d',64),'title'=>'Post pubblicato sulla piattaforma','html'=>'<p>Testo pubblicato</p>','topics'=>['Viaggi']]],'next_cursor'=>0,'has_more'=>false];
$result=astw_sync_feed();
expect(!is_wp_error($result) && $result['imported']===1 && count($posts)===$before+1, 'sincronizzazione importa il contenuto pubblicato');
$newId=$nextId-1;
expect($posts[$newId]['post_status']==='publish' && $posts[$newId]['post_category']===[8] && $posts[$newId]['tags_input']===[9], 'post WordPress pubblicato con categoria e tag corretti');
$posts[$newId]['post_content']='<p>Versione locale</p>';
$result=astw_sync_feed();
expect($result['imported']===0 && $result['skipped']===1 && count($posts)===$before+1 && $posts[$newId]['post_content']==='<p>Versione locale</p>', 'seconda sincronizzazione non duplica e conserva modifiche WordPress');
$settings['post_status']='draft';
astw_save_sync_settings(new WP_REST_Request('', $settings));
$remoteFeed['posts'][0]['key']=str_repeat('e',64);
$result=astw_sync_feed();
expect($result['imported']===1 && $posts[$nextId-1]['post_status']==='draft', 'modalit? bozza rispettata');
expect(!isset(astw_public_sync_settings()['feed_token']), 'credenziali escluse dalla risposta delle impostazioni');

$settings['post_status']='publish';
astw_save_sync_settings(new WP_REST_Request('', $settings));
$remoteFeed['posts'][0]['key']=str_repeat('f',64);
$failPublish=true;
expect(is_wp_error(astw_sync_feed()), 'pubblicazione interrotta segnalata senza esito positivo fittizio');
$pendingId=$nextId-1; $pendingCount=count($posts); $failPublish=false;
$result=astw_sync_feed();
expect(!is_wp_error($result) && count($posts)===$pendingCount && $posts[$pendingId]['post_status']==='publish', 'pubblicazione interrotta ripresa senza duplicare la bozza');

$settings['filters']=['scope'=>'all','platforms'=>['instagram'],'batch_size'=>5];
$options['astw_sync_cursor']=100;
expect(astw_save_sync_settings(new WP_REST_Request('', $settings))['archive_available'], 'plugin supporta parametri archivio completo');
expect($options['astw_sync_cursor']===0 && astw_public_sync_settings()['filters']===$settings['filters'], 'cambio filtri azzera scansione e conserva parametri');
$options['astw_sync_cursor']=200;
astw_sync_feed(new WP_REST_Request('', ['restart'=>true]));
expect(str_contains($feedRequestUrl,'cursor=0'), 'sincronizzazione completa riparte dal primo contenuto');
