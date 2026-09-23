<?php
// Contratto locale del plugin con storage e funzioni WordPress simulati.
// Non sostituisce il collaudo con WordPress e MariaDB reali.
if (PHP_SAPI !== 'cli') exit;
define('ABSPATH', __DIR__ . '/'); define('ARRAY_A', 'ARRAY_A');
function register_activation_hook(...$args) {} function add_action(...$args) {}
class WP_Error { public function __construct(public string $code, public string $message, public array $data=[]) {} }
class WP_REST_Request implements ArrayAccess {
    public array $headers=[];
    public function __construct(public string $key, public array $payload) {}
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
function term_exists($id,$taxonomy) { return $id === 7; }
function wp_slash($v) { return $v; }
function get_current_user_id() { return 3; }
function current_user_can(...$args) { return true; }
function is_wp_error($v) { return $v instanceof WP_Error; }
function get_permalink($id) { return 'https://example.com/?p=' . $id; }
function get_post($id) { global $posts; return isset($posts[$id]) ? (object)$posts[$id] : null; }
function wp_insert_post($data,$error) { global $posts,$nextId,$failCreate; if ($failCreate) return new WP_Error('failed','simulated'); $id=$nextId++; $posts[$id]=array_merge($data,['ID'=>$id]); return $id; }
function wp_update_post($data,$error) { global $posts; $posts[$data['ID']]=array_merge($posts[$data['ID']],$data); return $data['ID']; }
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
