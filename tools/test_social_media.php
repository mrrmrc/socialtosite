<?php
if (PHP_SAPI !== 'cli') exit;
require __DIR__ . '/../api/services/post_media.php';
class WebsiteSource {
    public static int $downloads = 0;
    public static function downloadToFile($url,$path,...$args) {
        self::$downloads++;
        $bytes = str_contains($url,'video.mp4') ? hex2bin('000000186674797069736f6d0000020069736f6d69736f32000000086d646174') : base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==');
        file_put_contents($path,$bytes);
        return ['size'=>strlen($bytes)];
    }
}
class DB {
    public static array $posts = [];
    public static function fetch($sql,$params) {
        foreach(self::$posts as $post) {
            if (str_contains($sql,'platform_post_id') && $post['user_id']===$params[0] && $post['platform']===$params[1] && $post['platform_post_id']===$params[2]) return $post;
            if (str_contains($sql,'content_hash=?') && $post['user_id']===$params[0] && $post['content_hash']===$params[1]) return $post;
        }
        return null;
    }
    public static function insert($sql,$params) {
        $id=random_int(1000000000,1900000000);
        self::$posts[$id]=array_combine(['user_id','platform','platform_post_id','raw_content','transcript','media_url','media_type','source_url','published_at','content_hash'],$params)+['id'=>$id,'published'=>0,'seo_score'=>-1];
        return $id;
    }
    public static function execute($sql,$params) {
        if(str_starts_with($sql,'UPDATE posts SET media_url')) { self::$posts[$params[2]]['media_url']=$params[0];self::$posts[$params[2]]['media_type']=$params[1]; }
    }
}
class Logger { public static function debug(...$args){} public static function info(...$args){} public static function warn(...$args){} }
function app_base_url(): string { return 'https://platform.example'; }
foreach (['apify_client.php','ingest.php'] as $file) {
    $source=file_get_contents(__DIR__.'/../api/services/'.$file);
    $source=preg_replace('/^\s*require_once .*;\R/m','',$source);
    $source=preg_replace('/^if \(file_exists.*require_once.*;\R/m','',$source);
    $source=str_replace('__DIR__',var_export(realpath(__DIR__.'/../api/services'),true),$source);
    eval(substr($source,5));
}
function mediaCheck($condition,$label) { if(!$condition)throw new RuntimeException($label);echo "OK $label\n"; }
$normalize=new ReflectionMethod(ApifyClient::class,'normalize');
$photo=['url'=>'https://www.facebook.com/example/posts/one','postId'=>'one','text'=>'Foto del luogo','media'=>[
    ['__typename'=>'Photo','image'=>['uri'=>'https://cdn.example/one.jpg']],
    ['__typename'=>'Photo','photo_image'=>['uri'=>'https://cdn.example/two.jpg']],
]];
$album=$normalize->invoke(null,$photo);
mediaCheck($album['media_type']==='image' && count($album['image_urls'])===2 && $album['media_url']==='https://cdn.example/one.jpg','galleria Facebook conserva tutte le foto e sceglie la principale');
$imagesOnly=$normalize->invoke(null,['url'=>$photo['url'],'images'=>['https://cdn.example/one.jpg','https://cdn.example/two.jpg']]);
mediaCheck($imagesOnly['media_type']==='image' && $imagesOnly['media_url']!=='','foto presenti solo in images non vengono scartate');
$video=$normalize->invoke(null,['url'=>'https://www.facebook.com/watch/?v=123','media'=>[['__typename'=>'Video','thumbnail'=>['uri'=>'https://cdn.example/poster.jpg'],'videoDeliveryResponseFragment'=>['video'=>['browser_native_hd_url'=>'https://cdn.example/video.mp4']]]]]);
mediaCheck($video['media_type']==='video' && $video['media_url']==='https://cdn.example/video.mp4' && $video['poster_url']==='https://cdn.example/poster.jpg','video annidato e poster distinti riconosciuti');
$preview=$normalize->invoke(null,['url'=>'https://www.facebook.com/reel/123','type'=>'video','thumbnailUrl'=>'https://cdn.example/poster.jpg']);
mediaCheck($preview['media_type']==='video' && $preview['media_url']==='' && $preview['poster_url']!=='','anteprima non spacciata per file video');
$reel=$normalize->invoke(null,['topLevelReelUrl'=>'https://www.facebook.com/reel/123/','text'=>'Reel','tracking'=>['video_id'=>'123'],'playback_video'=>['__typename'=>'Video','videoDeliveryLegacyFields'=>['browser_native_sd_url'=>'https://cdn.example/low.mp4','browser_native_hd_url'=>'https://cdn.example/video.mp4'],'thumbnailImage'=>['uri'=>'https://cdn.example/poster.jpg']]]);
mediaCheck($reel['media_url']==='https://cdn.example/video.mp4' && $reel['id']==='123' && $reel['poster_url']!=='' ,'formato reale Facebook Reels e file HD riconosciuti');
$search=ApifyClient::facebookSearch('https://www.facebook.com/search/top/?q=agriturismo&locale=it_IT',5);
mediaCheck($search===['categories'=>['agriturismo'],'searchType'=>'posts','resultsLimit'=>5], 'ricerca Facebook instradata al motore di ricerca post');
mediaCheck(ApifyClient::facebookSearch('https://www.facebook.com/example',5)===null,'pagina Facebook mantiene il connettore pagine');
$user=2147483646;
try {
    $created=Ingest::url($user,$photo['url'],$album); $id=$created['id'];
    $post=PostMedia::hydrate(DB::$posts[$id]);
    mediaCheck(count($post['image_urls'])===2 && PostMedia::localExists($post['media_url']), 'ingestione scarica e conserva la galleria senza nuove colonne');
    $html=PostMedia::render($post,'Foto');
    mediaCheck(substr_count($html,'<img ')===2,'sito pubblico rende tutte le foto senza duplicare la principale');
    DB::$posts[$id]['published']=1; DB::$posts[$id]['seo_score']=80; DB::$posts[$id]['edited_body']='<p>Testo del proprietario</p>'; DB::$posts[$id]['media_url']='';
    $before=WebsiteSource::$downloads;
    $repaired=Ingest::url($user,$photo['url'],$album);
    mediaCheck($repaired['duplicate'] && $repaired['media_updated'] && DB::$posts[$id]['media_url']!=='' && DB::$posts[$id]['edited_body']==='<p>Testo del proprietario</p>', 'risincronizzazione ripara media su post pubblicati senza toccare il testo');
    mediaCheck(WebsiteSource::$downloads===$before,'media locali riutilizzati senza altri download');
    $second=$album; $second['id']='two';$second['url']='https://www.facebook.com/example/posts/two';
    mediaCheck(!Ingest::url($user,$second['url'],$second)['duplicate'],'post con stessa didascalia e foto proprie non collassano in un duplicato');
    $video['id']='video';$video['caption']='Video del luogo';
    $v=Ingest::url($user,$video['url'],$video);$videoPost=PostMedia::hydrate(DB::$posts[$v['id']]);
    mediaCheck(PostMedia::localExists($videoPost['media_url']) && str_contains(PostMedia::render($videoPost),'poster='),'file video e poster scaricati e riproducibili');
    $fallback=PostMedia::render(['media_type'=>'video','media_url'=>$preview['url'],'poster_url'=>$preview['poster_url'],'source_url'=>$preview['url']]);
    mediaCheck(str_contains($fallback,'Guarda il video originale') && !str_contains($fallback,'<video'),'Facebook senza file mostra anteprima e collegamento, non player rotto');
    mediaCheck(PostMedia::url('javascript:alert(1)')==='' && !str_contains(PostMedia::render(['media_url'=>'javascript:alert(1)','media_type'=>'image']),'<img'),'URL eseguibili esclusi dai media');
} finally {
    foreach(DB::$posts as $post) {
        $data=PostMedia::read($user,$post['id']);
        foreach($data['cache'] ?? [] as $url) { $path=__DIR__.'/../public/media/'.basename((string)parse_url($url,PHP_URL_PATH)); if(is_file($path))unlink($path); }
        $path=__DIR__.'/../public/media/.metadata/'.$user.'_'.$post['id'].'.json'; if(is_file($path))unlink($path);
    }
}
