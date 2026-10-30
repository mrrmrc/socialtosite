<?php
if (PHP_SAPI !== 'cli') exit;
define('JWT_SECRET', 'fixture-secret-which-never-leaves-tests');
function app_base_url(): string { return 'https://platform.example'; }
class DB {
    public static array $settings = [];
    public static array $posts = [];
    public static function fetch($sql, $params) { return self::$settings[$params[0]] ?? null; }
    public static function execute($sql, $params) { self::$settings[$params[0]] = ['key_value'=>$params[1]]; }
    public static array $queries = [];
    public static function fetchAll($sql, $params) {
        self::$queries[] = [$sql, $params];
        $rows = array_filter(self::$posts, fn($p) => $p['user_id'] === $params[0]);
        if (str_contains($sql, 'GROUP BY')) {
            $groups=[];
            foreach ($rows as $p) { $key=($p['platform'] ?? 'website').':'.$p['published']; if (!isset($groups[$key])) $groups[$key]=['platform'=>$p['platform'] ?? 'website', 'published'=>$p['published'], 'total'=>0]; $groups[$key]['total']++; }
            return array_values($groups);
        }
        if (!str_contains($sql, 'id>?')) return array_values($rows);
        $rows=array_filter($rows, fn($p) => $p['id'] > $params[1]);
        if (str_contains($sql, 'published=1')) $rows = array_filter($rows, fn($p) => $p['published'] === 1 && $p['seo_score'] >= 0);
        if (str_contains($sql, 'published=0')) $rows = array_filter($rows, fn($p) => $p['published'] === 0);
        if (str_contains($sql, 'platform IN')) $rows = array_filter($rows, fn($p) => in_array($p['platform'] ?? 'website', array_slice($params,2),true));
        usort($rows, fn($a,$b) => $a['id'] <=> $b['id']);
        preg_match('/LIMIT (\d+)/', $sql, $limit);
        return array_slice($rows, 0, (int)$limit[1]);
    }
}
require __DIR__ . '/../api/services/wordpress_bridge.php';
function bridgeCheck($condition, $label) { if (!$condition) throw new RuntimeException($label); echo "OK $label\n"; }
$secret = str_repeat('a', 64);
$cipher = WordPressBridge::crypt($secret);
bridgeCheck($cipher !== $secret && WordPressBridge::crypt($cipher, true) === $secret, 'credenziale cifrata e decifrata');
$damaged = base64_decode($cipher); $damaged[20] = chr(ord($damaged[20]) ^ 1);
$rejected = false; try { WordPressBridge::crypt(base64_encode($damaged), true); } catch (Throwable $e) { $rejected = true; }
bridgeCheck($rejected, 'credenziale alterata rifiutata');
WordPressBridge::save(12, ['secret'=>$cipher]);
bridgeCheck(WordPressBridge::load(12)['secret'] === $cipher && WordPressBridge::load(13) === [], 'impostazioni isolate per proprietario');
bridgeCheck(WordPressBridge::feedToken(12, $secret) !== WordPressBridge::feedToken(13, $secret), 'feed legato al proprietario');
for ($id=1; $id<=24; $id++) DB::$posts[] = ['id'=>$id, 'user_id'=>12, 'published'=>1, 'seo_score'=>80, 'edited_title'=>'', 'generated_title'=>'Titolo '.$id, 'edited_body'=>'', 'generated_body'=>'<p>Articolo</p>', 'edited_excerpt'=>'', 'tags'=>'["Viaggi","Cucina"]'];
DB::$posts[] = ['id'=>25, 'user_id'=>13, 'published'=>1, 'seo_score'=>80];
DB::$posts[] = ['id'=>26, 'user_id'=>12, 'platform'=>'manual', 'published'=>0, 'seo_score'=>80, 'generated_title'=>'Bozza privata', 'generated_body'=>'<p>Testo non pubblicato</p>'];
$first = WordPressBridge::feed(12, 0);
bridgeCheck(count($first['posts']) === 20 && $first['has_more'] && $first['next_cursor'] === 20, 'feed paginato a 20 contenuti');
$last = WordPressBridge::feed(12, $first['next_cursor']);
bridgeCheck(count($last['posts']) === 4 && !$last['has_more'] && $last['next_cursor'] === 0, 'fine scansione riparte per intercettare pubblicazioni tardive');
bridgeCheck($first['posts'][0]['topics'] === ['Viaggi','Cucina'], 'argomenti esportati per abbinamento');
bridgeCheck(WordPressBridge::feed(12, 0)['posts'][0]['key'] === $first['posts'][0]['key'], 'identificativo stabile senza duplicati');
bridgeCheck(WordPressBridge::topics(12) === ['Cucina','Viaggi'], 'argomenti unici del solo proprietario');
DB::$posts[] = ['id'=>27, 'user_id'=>12, 'platform'=>'instagram', 'published'=>0, 'seo_score'=>-2, 'raw_content'=>"Testo acquisito <script>alert(1)</script>\nSeconda riga"];
DB::$posts[] = ['id'=>28, 'user_id'=>12, 'platform'=>'website', 'published'=>0, 'seo_score'=>-2];
$all=WordPressBridge::feed(12,20,['scope'=>'all']);
bridgeCheck(count($all['posts'])===6 && in_array(26,array_column($all['posts'],'id')) && in_array(27,array_column($all['posts'],'id')), 'archivio completo include bozze e acquisiti senza punteggio SEO');
$raw=array_values(array_filter($all['posts'],fn($p)=>$p['id']===27))[0];
bridgeCheck($raw['title']!=='' && str_contains($raw['html'],'&lt;script&gt;') && !str_contains($raw['html'],'<script>'), 'testo acquisito esportato con titolo e HTML sicuro');
$drafts=WordPressBridge::feed(12,0,['scope'=>'drafts']);
bridgeCheck(array_column($drafts['posts'],'id')===[26,27], 'solo bozze esclude i pubblicati e ignora testi vuoti');
$filtered=WordPressBridge::feed(12,0,['scope'=>'all','platforms'=>['instagram'],'since_date'=>'2026-01-01','until_date'=>'2026-12-31','batch_size'=>1]);
bridgeCheck(array_column($filtered['posts'],'id')===[27], 'filtro fonte applicato anche ai testi acquisiti');
[$sql,$params]=end(DB::$queries);
bridgeCheck(str_contains($sql,'platform IN (?)') && str_contains($sql,'COALESCE(published_at,imported_at)>=?') && in_array('2027-01-01 00:00:00',$params,true), 'fonti e date usano parametri SQL inclusivi per il giorno finale');
$size=WordPressBridge::feed(12,0,['scope'=>'all','batch_size'=>2]);
bridgeCheck(count($size['posts'])===2 && $size['has_more'] && $size['next_cursor']===2, 'dimensione configurabile mantiene la paginazione');
foreach ([['scope'=>'private-other-users'],['platforms'=>["x') OR 1=1"]],['since_date'=>'2026-02-31'],['since_date'=>'2026-12-31','until_date'=>'2026-01-01']] as $bad) {
    $reject=false; try { WordPressBridge::filters($bad); } catch (DomainException $e) { $reject=true; }
    bridgeCheck($reject, 'filtro non valido respinto');
}
$archive=WordPressBridge::archive(12);
bridgeCheck($archive['total']===27 && $archive['published']===24 && $archive['drafts']===3 && in_array('instagram',$archive['platforms'],true), 'conteggio completo isolato sul proprietario');
DB::$posts[]=['id'=>29,'user_id'=>12,'platform'=>'facebook','published'=>0,'seo_score'=>-1,'media_url'=>'https://platform.example/photo.jpg','media_type'=>'image'];
$mediaOnly=WordPressBridge::feed(12,28,['scope'=>'all']);
bridgeCheck(count($mediaOnly['posts'])===1 && $mediaOnly['posts'][0]['title']!=='' && str_contains($mediaOnly['posts'][0]['media_html'],'photo.jpg'), 'articoli con sole foto inclusi nel connettore');
WordPressBridge::save(12, []);
bridgeCheck(WordPressBridge::load(12) === [], 'disconnessione revoca credenziale feed');

$payload=WordPressBridge::settingsPayload(12,['secret'=>$cipher],[]);
bridgeCheck($payload['feed_url']==='https://platform.example/api/wordpress-feed.php?user_id=12' && $payload['feed_token']===WordPressBridge::feedToken(12,$secret), 'prima connessione configura URL e credenziale del feed del proprietario');
bridgeCheck($payload['post_status']==='draft' && $payload['enabled']===false && $payload['filters']['scope']==='all', 'prima connessione legge tutto archivio senza pubblicare o attivare automatismi');
$preferences=['post_status'=>'publish','enabled'=>true,'category_id'=>7,'mappings'=>['Viaggi'=>['category_id'=>7,'tag_id'=>9]],'filters'=>['scope'=>'drafts','platforms'=>['instagram']]];
$preserved=WordPressBridge::settingsPayload(12,['secret'=>$cipher],$preferences);
bridgeCheck($preserved['post_status']==='publish' && $preserved['category_id']===7 && $preserved['mappings']===$preferences['mappings'] && $preserved['filters']['scope']==='drafts', 'ricollegamento conserva categorie, tag e preferenze gia configurate');
bridgeCheck(!WordPressBridge::ready(['settings'=>[]]) && WordPressBridge::ready(['settings'=>['post_status'=>'draft']]), 'plugin precedenti: configurazione archivio distinta dal codice verificato');
bridgeCheck(!WordPressBridge::ready(['feed_ready'=>false,'settings'=>['post_status'=>'draft']]), 'feed esplicitamente assente richiede ripristino');
