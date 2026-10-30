<?php
if (PHP_SAPI !== 'cli') exit;
if (($argv[1] ?? '') === '--render') {
    $scenario = $argv[2];
    require_once __DIR__ . '/../api/services/post_media.php';
    function app_base_url(): string { return 'https://platform.example'; }
    function app_public_user_sql($alias): string { return ''; }
    class ReachabilityNetwork {
        public static function decode($value): array { return []; }
        public static function normalize($value): array { return []; }
    }
    class SeoFoundation {
        public static function cachedOrFallback(...$args): array { return ['pages'=>[['slug'=>'chi-siamo']]]; }
    }
    class DB {
        public static function fetch($sql,$params=[]) {
            global $scenario;
            if (str_contains($sql,'FROM users')) return ['id'=>1, 'slug'=>'cliente', 'name'=>'Cliente'];
            return ['title'=>'Cliente', 'search_visible'=>$scenario === 'hidden' ? 0 : 1, 'profile_summary'=>'Servizi per le famiglie'];
        }
        public static function fetchAll($sql,$params=[]) {
            global $scenario;
            if (str_contains($sql,'SHOW COLUMNS')) return [['Field'=>'search_visible']];
            if (str_contains($sql,'JOIN sites')) return [['slug'=>'cliente', 'last_sync'=>'2026-10-30 10:00:00']];
            if (str_contains($sql,'social_sources')) return [];
            return [
                ['id'=>1,'slug'=>'primo-articolo','tags'=>'["Viaggi"]','generated_title'=>'Viaggi & famiglie','generated_body'=>'<p>Testo</p>','published_at'=>'2026-10-30 10:00:00','media_url'=>'https://images.example/a.jpg?x=1&y=2','media_type'=>'IMAGE','edited_title'=>''],
                ['id'=>2,'slug'=>'articolo-privato','tags'=>'[]','noindex'=>1,'published_at'=>'2026-10-29 10:00:00'],
                ['id'=>3,'slug'=>'','tags'=>'[]','published_at'=>'2026-10-29 10:00:00'],
            ];
        }
    }
    $_GET = ['slug'=>'cliente','action'=>'sitemap'];
    $file = __DIR__ . '/../public/' . ($scenario === 'index' ? 'sitemap.php' : 'site.php');
    $source = file_get_contents($file);
    $source = preg_replace('/^require_once .*;\R/m', '', $source);
    $source = str_replace('__DIR__', var_export(dirname(realpath($file)), true), $source);
    eval(substr($source,5));
    exit;
}
foreach (['index','visible','hidden'] as $scenario) {
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__) . ' --render ' . $scenario;
    $xml = shell_exec($command);
    $document = simplexml_load_string($xml);
    if (!$document) throw new RuntimeException('Sitemap non valida: ' . $scenario);
    $locs = $document->xpath('//*[local-name()="loc"]');
    foreach ($locs as $loc) if (!filter_var((string)$loc,FILTER_VALIDATE_URL)) throw new RuntimeException('URL non assoluto');
    if ($scenario==='index' && !str_contains($xml,'/cliente/sitemap.xml')) throw new RuntimeException('Sitemap utente mancante');
    if ($scenario==='visible' && (!str_contains($xml,'primo-articolo') || str_contains($xml,'articolo-privato') || !str_contains($xml,'&amp;y=2'))) throw new RuntimeException('Contenuti, noindex o immagini non corretti');
    if ($scenario==='hidden' && count($locs)!==0) throw new RuntimeException('Sito nascosto presente in sitemap');
    echo "OK sitemap XML $scenario: URL assoluti, contenuti e visibilità\n";
}
// Exercise the real URL resolver without loading a configuration or database.
$source = file_get_contents(__DIR__ . '/../config/db.php');
$start = strpos($source, 'function app_base_url()'); $end = strpos($source, '/**', $start);
$function = substr($source,$start,$end-$start);
$function = str_replace(" && PHP_SAPI !== 'cli'", '', $function);
eval($function);
$_SERVER['HTTP_HOST']='45.138.202.132:8088';
if (app_base_url()!=='http://45.138.202.132:8088') throw new RuntimeException('Base staging errata');
$_SERVER['HTTP_HOST']="evil.example/path";
if (app_base_url()!=='') throw new RuntimeException('Host malformato accettato');
echo "OK base URL staging include schema e porta; host malformati esclusi\n";
