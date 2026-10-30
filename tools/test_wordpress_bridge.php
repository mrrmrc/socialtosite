<?php
if (PHP_SAPI !== 'cli') exit;
define('JWT_SECRET', 'fixture-secret-which-never-leaves-tests');
function app_base_url(): string { return 'https://platform.example'; }
class DB {
    public static array $settings = [];
    public static array $posts = [];
    public static function fetch($sql, $params) { return self::$settings[$params[0]] ?? null; }
    public static function execute($sql, $params) { self::$settings[$params[0]] = ['key_value'=>$params[1]]; }
    public static function fetchAll($sql, $params) {
        $rows = array_filter(self::$posts, fn($p) => $p['user_id'] === $params[0]);
        if (str_contains($sql, 'published=1')) $rows = array_filter($rows, fn($p) => $p['published'] === 1 && $p['seo_score'] >= 0 && $p['id'] > $params[1]);
        usort($rows, fn($a,$b) => $a['id'] <=> $b['id']);
        return array_slice($rows, 0, 21);
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
DB::$posts[] = ['id'=>26, 'user_id'=>12, 'published'=>0, 'seo_score'=>80];
$first = WordPressBridge::feed(12, 0);
bridgeCheck(count($first['posts']) === 20 && $first['has_more'] && $first['next_cursor'] === 20, 'feed paginato a 20 contenuti');
$last = WordPressBridge::feed(12, $first['next_cursor']);
bridgeCheck(count($last['posts']) === 4 && !$last['has_more'] && $last['next_cursor'] === 0, 'fine scansione riparte per intercettare pubblicazioni tardive');
bridgeCheck($first['posts'][0]['topics'] === ['Viaggi','Cucina'], 'argomenti esportati per abbinamento');
bridgeCheck(WordPressBridge::feed(12, 0)['posts'][0]['key'] === $first['posts'][0]['key'], 'identificativo stabile senza duplicati');
bridgeCheck(WordPressBridge::topics(12) === ['Cucina','Viaggi'], 'argomenti unici del solo proprietario');
WordPressBridge::save(12, []);
bridgeCheck(WordPressBridge::load(12) === [], 'disconnessione revoca credenziale feed');
