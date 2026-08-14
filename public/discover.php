<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$base = rtrim(BASE_URL, '/');
$q = trim((string)($_GET['q'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 24;

$hasVisibilityColumn = false;
try { foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) if (($column['Field'] ?? '') === 'search_visible') { $hasVisibilityColumn = true; break; } } catch (Throwable $e) {}

function h($value): string { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
function hubExcerpt($value, int $limit = 150): string {
    $plain = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)) ?? '');
    if ($plain === '') return 'Uno spazio della rete LinkSeoWeb.';
    return function_exists('mb_strimwidth') ? mb_strimwidth($plain, 0, $limit, '…', 'UTF-8') : substr($plain, 0, $limit);
}
function hubPlan($value): array {
    return match (strtolower(trim((string)$value))) {
        'agency' => ['Agency', 'agency'],
        'professional', 'pro' => ['Professional', 'professional'],
        default => ['Base', 'base'],
    };
}
function hubTokens(string $q): array {
    $q = mb_strtolower(trim($q), 'UTF-8');
    $parts = preg_split('/[^\pL\pN]+/u', $q, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $stop = ['di','del','della','dei','degli','e','a','da','in','con','per','su','il','lo','la','i','gli','le','un','una','uno'];
    return array_values(array_unique(array_filter($parts, fn($v) => mb_strlen($v,'UTF-8') >= 2 && !in_array($v,$stop,true))));
}
function pageUrl(int $page, string $q): string { $args=[]; if($q!=='')$args['q']=$q; if($page>1)$args['page']=$page; return '/scopri'.($args?'?'.http_build_query($args):''); }

// LEFT JOIN: un utente con slug deve entrare subito nell'Hub anche se il record sites e appena nato o incompleto.
$where = ['u.slug IS NOT NULL', "u.slug != ''"];
$params = [];
if ($hasVisibilityColumn) $where[] = '(s.search_visible = 1 OR s.search_visible IS NULL)';
$tokens = hubTokens($q);
if ($q !== '') {
    $searchParts = [];
    $needles = array_values(array_unique(array_merge([$q], $tokens)));
    foreach ($needles as $term) {
        $needle = '%' . $term . '%';
        $searchParts[] = '(u.name LIKE ? OR u.slug LIKE ? OR s.title LIKE ? OR s.bio LIKE ? OR s.profile_summary LIKE ? OR EXISTS (SELECT 1 FROM posts sp WHERE sp.user_id=u.id AND sp.published=1 AND (sp.generated_title LIKE ? OR sp.generated_excerpt LIKE ? OR sp.edited_title LIKE ? OR sp.edited_excerpt LIKE ? OR sp.tags LIKE ?)))';
        array_push($params,$needle,$needle,$needle,$needle,$needle,$needle,$needle,$needle,$needle,$needle);
    }
    // Ricerca tollerante: basta che uno dei termini significativi trovi un segnale, poi il ranking premia le corrispondenze migliori.
    $where[] = '(' . implode(' OR ', $searchParts) . ')';
}
$whereSql = implode(' AND ', $where);
$countRow = DB::fetch("SELECT COUNT(DISTINCT u.id) AS total FROM users u LEFT JOIN sites s ON s.user_id=u.id WHERE $whereSql", $params);
$totalProfiles = (int)($countRow['total'] ?? 0);
$totalPages = max(1, (int)ceil($totalProfiles / $perPage)); $page=min($page,$totalPages); $offset=($page-1)*$perPage;

$rankSql = '0'; $rankParams=[];
if ($q !== '') {
    $exact = mb_strtolower($q,'UTF-8');
    $rankSql = "(CASE WHEN LOWER(COALESCE(u.name,''))=? THEN 120 WHEN LOWER(COALESCE(s.title,''))=? THEN 115 WHEN LOWER(COALESCE(u.slug,''))=? THEN 110 ELSE 0 END + CASE WHEN u.name LIKE ? THEN 55 ELSE 0 END + CASE WHEN s.title LIKE ? THEN 50 ELSE 0 END + CASE WHEN u.slug LIKE ? THEN 45 ELSE 0 END + CASE WHEN s.bio LIKE ? OR s.profile_summary LIKE ? THEN 25 ELSE 0 END + CASE WHEN EXISTS (SELECT 1 FROM posts rp WHERE rp.user_id=u.id AND rp.published=1 AND (rp.generated_title LIKE ? OR rp.edited_title LIKE ? OR rp.generated_excerpt LIKE ? OR rp.tags LIKE ?)) THEN 15 ELSE 0 END)";
    $needle='%'.$q.'%';
    $rankParams=[$exact,$exact,$exact,$needle,$needle,$needle,$needle,$needle,$needle,$needle,$needle,$needle];
}
$queryParams=array_merge($rankParams,$params);
$profiles = DB::fetchAll(
    "SELECT u.id,u.slug,u.plan,u.name,
            COALESCE(NULLIF(s.title,''),NULLIF(u.name,''),u.slug) AS title,
            COALESCE(NULLIF(s.bio,''),NULLIF(s.profile_summary,''),'') AS description,
            COALESCE(s.logo_url,'') AS logo_url,s.last_sync,COALESCE(pc.post_count,0) AS post_count,
            $rankSql AS relevance
       FROM users u LEFT JOIN sites s ON s.user_id=u.id
       LEFT JOIN (SELECT user_id,COUNT(*) AS post_count,MAX(COALESCE(published_at,imported_at)) AS latest_post FROM posts WHERE published=1 GROUP BY user_id) pc ON pc.user_id=u.id
      WHERE $whereSql
      ORDER BY " . ($q!=='' ? 'relevance DESC,' : '') . " COALESCE(pc.latest_post,s.last_sync,s.created_at,u.created_at) DESC,u.id DESC
      LIMIT $perPage OFFSET $offset", $queryParams
);

$latestArticles = DB::fetchAll("SELECT u.slug AS site_slug,COALESCE(NULLIF(s.title,''),NULLIF(u.name,''),u.slug) AS site_title,p.slug,p.generated_title AS title,p.generated_excerpt AS excerpt,COALESCE(p.published_at,p.imported_at) AS published_at FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN sites s ON s.user_id=u.id WHERE p.published=1 AND p.slug IS NOT NULL AND p.slug!=''".($hasVisibilityColumn?' AND (s.search_visible=1 OR s.search_visible IS NULL)':'')." ORDER BY COALESCE(p.published_at,p.imported_at) DESC,p.id DESC LIMIT 12");
$network = DB::fetch("SELECT (SELECT COUNT(*) FROM users WHERE slug IS NOT NULL AND slug!='') AS users_count,(SELECT COUNT(*) FROM posts WHERE published=1) AS articles_count") ?: ['users_count'=>0,'articles_count'=>0];

if (($_GET['action'] ?? '') === 'sitemap') { header('Content-Type: application/xml; charset=utf-8'); echo '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'; echo '<url><loc>'.htmlspecialchars($base.'/scopri',ENT_XML1,'UTF-8').'</loc></url>\n'; foreach(DB::fetchAll("SELECT slug FROM users WHERE slug IS NOT NULL AND slug!='' ORDER BY id ASC") as $row) echo '<url><loc>'.htmlspecialchars($base.'/'.rawurlencode($row['slug']),ENT_XML1,'UTF-8').'</loc></url>\n'; echo '</urlset>'; exit; }

header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
?><!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hub LinkSeoWeb | Trova professionisti, attivita e contenuti</title><meta name="description" content="Cerca nell'Hub LinkSeoWeb persone, professionisti, attività, competenze e contenuti."><link rel="canonical" href="<?=h($base.'/scopri')?>"><style>
:root{--ink:#17132c;--muted:#716b82;--line:#e7e3ef;--paper:#f7f6fa;--card:#fff;--brand:#6947ed;--soft:#eee9ff;--shadow:0 18px 48px rgba(31,24,61,.09)}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}a{color:inherit}.wrap{width:min(1280px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;z-index:20;height:68px;background:rgba(255,255,255,.95);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}.top .wrap{height:100%;display:flex;align-items:center;justify-content:space-between}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:900;font-size:20px}.brand img{width:36px;height:36px}.brand b{color:var(--brand)}.topnav{display:flex;gap:8px}.topnav a{text-decoration:none;padding:9px 13px;border-radius:999px;font-size:13px;font-weight:800}.topnav .cta{background:var(--ink);color:#fff}.hero{background:radial-gradient(circle at 75% 0,#7859f5 0,transparent 34%),linear-gradient(135deg,#17122e,#282052);color:#fff;padding:64px 0 74px}.eyebrow{text-transform:uppercase;letter-spacing:.15em;font-size:11px;font-weight:900;color:#c9bff8}.hero h1{font-size:clamp(40px,6vw,72px);letter-spacing:-.055em;line-height:1;margin:12px 0 16px;max-width:920px}.hero p{max-width:790px;color:#dad5e9;font-size:18px;line-height:1.55}.stats{display:flex;gap:9px;flex-wrap:wrap;margin-top:25px}.stat{padding:9px 13px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(255,255,255,.07);font-size:13px}.searchbar{margin-top:-31px;position:relative;z-index:4}.searchbox{background:#fff;border:1px solid var(--line);box-shadow:var(--shadow);border-radius:19px;padding:10px;display:flex;gap:8px}.searchbox input{flex:1;min-width:0;border:0;outline:0;padding:13px 15px;font:inherit;font-size:17px}.searchbox button{border:0;border-radius:12px;padding:0 24px;background:var(--brand);color:#fff;font-weight:850}.hint{margin:12px 4px 0;color:var(--muted);font-size:13px}.section{padding:42px 0}.sectionhead{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:18px}.sectionhead h2{font-size:29px;letter-spacing:-.035em;margin:0}.sectionhead p{color:var(--muted);margin:5px 0 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:15px}.profile{background:#fff;border:1px solid var(--line);border-radius:19px;padding:19px;text-decoration:none;box-shadow:0 4px 16px rgba(31,24,61,.025);display:flex;flex-direction:column;min-height:225px;transition:.18s}.profile:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:#d8cff9}.profiletop{display:flex;justify-content:space-between;gap:12px}.avatar{width:58px;height:58px;border-radius:16px;background:var(--soft);display:grid;place-items:center;overflow:hidden;font-weight:900;font-size:22px;color:var(--brand)}.avatar img{width:100%;height:100%;object-fit:cover}.badge{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;padding:6px 9px;border-radius:999px;height:max-content}.badge.base{background:#f0eef5;color:#716b80}.badge.professional{background:#ede9fe;color:#5b35d5}.badge.agency{background:#17132f;color:#fff}.profile h3{margin:16px 0 7px;font-size:20px;letter-spacing:-.025em}.profile p{margin:0;color:var(--muted);font-size:14px;line-height:1.52;flex:1}.meta{margin-top:17px;padding-top:13px;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:var(--muted);font-size:12px;font-weight:750}.empty{background:#fff;border:1px dashed #d6d0e0;border-radius:18px;padding:46px;text-align:center;color:var(--muted)}.articles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.article{background:#fff;border:1px solid var(--line);border-radius:17px;padding:17px;text-decoration:none}.article small{color:var(--brand);font-weight:850}.article h3{margin:8px 0;font-size:17px}.article p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}.pager{display:flex;justify-content:center;gap:7px;margin-top:27px}.pager a,.pager span{padding:8px 12px;border:1px solid var(--line);background:#fff;border-radius:9px;text-decoration:none;font-weight:800;font-size:13px}.pager .current{background:var(--ink);color:#fff}.footer{padding:32px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}@media(max-width:650px){.topnav a:not(.cta){display:none}.hero{padding:50px 0 68px}.searchbox{flex-direction:column}.searchbox button{height:46px}.sectionhead{display:block}.grid,.articles{grid-template-columns:1fr}}
</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/"><img src="/logo.png" alt=""><span>LinkSeo<b>Web</b></span></a><nav class="topnav"><a href="/scopri">Hub</a><a class="cta" href="/">Accedi / Crea spazio</a></nav></div></header><section class="hero"><div class="wrap"><div class="eyebrow">Hub LinkSeoWeb</div><h1>Trova la persona, l'attività o il contenuto che stai cercando.</h1><p>La ricerca legge nome, profilo, competenze e contenuti pubblicati. Puoi cercare anche per argomento o servizio, non soltanto per nome esatto.</p><div class="stats"><div class="stat"><strong><?=number_format((int)$network['users_count'],0,',','.')?></strong> spazi</div><div class="stat"><strong><?=number_format((int)$network['articles_count'],0,',','.')?></strong> contenuti</div><div class="stat">Piani <strong>Base · Professional · Agency</strong></div></div></div></section><div class="searchbar"><div class="wrap"><form class="searchbox" method="get" action="/scopri"><input type="search" name="q" value="<?=h($q)?>" placeholder="Es. Maurizio Bottino, psicologo, SEO, Roma…" autocomplete="off"><button>Cerca</button></form><div class="hint">Suggerimento: puoi cercare anche parole presenti negli articoli e negli argomenti trattati.</div></div></div><main><section class="section"><div class="wrap"><div class="sectionhead"><div><h2><?=$q!==''?'Risultati più pertinenti per “'.h($q).'”':'Spazi aggiornati di recente'?></h2><p><?=number_format($totalProfiles,0,',','.')?> profili disponibili · i nuovi spazi compaiono subito</p></div><?php if($q!==''):?><a href="/scopri">Azzera ricerca</a><?php endif;?></div><?php if(!$profiles):?><div class="empty"><h3>Nessun risultato preciso</h3><p>Prova con una parte del nome, una professione, un servizio o un argomento.</p></div><?php else:?><div class="grid"><?php foreach($profiles as $profile):[$planLabel,$planClass]=hubPlan($profile['plan']??'base');$initial=function_exists('mb_substr')?mb_substr($profile['title'],0,1,'UTF-8'):substr($profile['title'],0,1);?><a class="profile" href="/<?=rawurlencode($profile['slug'])?>"><div class="profiletop"><div class="avatar"><?php if(!empty($profile['logo_url'])):?><img src="<?=h($profile['logo_url'])?>" alt="" loading="lazy"><?php else:?><?=h(strtoupper($initial))?><?php endif;?></div><span class="badge <?=h($planClass)?>"><?=h($planLabel)?></span></div><h3><?=h($profile['title'])?></h3><p><?=h(hubExcerpt($profile['description']))?></p><div class="meta"><span><?=(int)$profile['post_count']?> contenuti</span><span>Apri →</span></div></a><?php endforeach;?></div><?php if($totalPages>1):?><nav class="pager"><?php if($page>1):?><a href="<?=h(pageUrl($page-1,$q))?>">←</a><?php endif;?><?php for($p=max(1,$page-2);$p<=min($totalPages,$page+2);$p++):?><?=$p===$page?'<span class="current">'.$p.'</span>':'<a href="'.h(pageUrl($p,$q)).'">'.$p.'</a>'?><?php endfor;?><?php if($page<$totalPages):?><a href="<?=h(pageUrl($page+1,$q))?>">→</a><?php endif;?></nav><?php endif;?><?php endif;?></div></section><?php if($q===''&&!empty($latestArticles)):?><section class="section" style="padding-top:0"><div class="wrap"><div class="sectionhead"><div><h2>Ultimi contenuti pubblicati</h2><p>Novità dalla rete, sempre in ordine cronologico.</p></div></div><div class="articles"><?php foreach($latestArticles as $article):?><a class="article" href="/<?=rawurlencode($article['site_slug'])?>/<?=rawurlencode($article['slug'])?>"><small><?=h($article['site_title'])?></small><h3><?=h($article['title']?:'Contenuto')?></h3><p><?=h(hubExcerpt($article['excerpt'],120))?></p></a><?php endforeach;?></div></div></section><?php endif;?></main><footer class="footer"><div class="wrap">LinkSeoWeb Hub · scoperta intelligente della rete</div></footer></body></html>