<?php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$base = rtrim(BASE_URL, '/');
$q = trim((string)($_GET['q'] ?? ''));
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 24;

$hasVisibilityColumn = false;
try {
    foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) {
        if (($column['Field'] ?? '') === 'search_visible') { $hasVisibilityColumn = true; break; }
    }
} catch (Throwable $e) {}

$where = ['u.slug IS NOT NULL', "u.slug != ''"];
$params = [];
if ($hasVisibilityColumn) $where[] = 's.search_visible = 1';
if ($q !== '') {
    $where[] = '(u.name LIKE ? OR u.slug LIKE ? OR s.title LIKE ? OR s.bio LIKE ? OR s.profile_summary LIKE ?)';
    $needle = '%' . $q . '%';
    $params = [$needle, $needle, $needle, $needle, $needle];
}
$whereSql = implode(' AND ', $where);
$countRow = DB::fetch("SELECT COUNT(*) AS total FROM users u JOIN sites s ON s.user_id=u.id WHERE $whereSql", $params);
$totalProfiles = (int)($countRow['total'] ?? 0);
$totalPages = max(1, (int)ceil($totalProfiles / $perPage));
$page = min($page, $totalPages);
$offset = ($page - 1) * $perPage;

$profiles = DB::fetchAll(
    "SELECT u.id, u.slug, u.plan,
            COALESCE(NULLIF(s.title,''), NULLIF(u.name,''), u.slug) AS title,
            COALESCE(NULLIF(s.bio,''), NULLIF(s.profile_summary,''), '') AS description,
            s.logo_url, s.last_sync, COALESCE(pc.post_count,0) AS post_count
       FROM users u
       JOIN sites s ON s.user_id=u.id
       LEFT JOIN (
           SELECT user_id, COUNT(*) AS post_count FROM posts
            WHERE published=1 AND seo_score>0 GROUP BY user_id
       ) pc ON pc.user_id=u.id
      WHERE $whereSql
      ORDER BY CASE LOWER(COALESCE(u.plan,'base')) WHEN 'agency' THEN 0 WHEN 'pro' THEN 1 ELSE 2 END,
               COALESCE(s.last_sync, s.created_at) DESC, u.id DESC
      LIMIT $perPage OFFSET $offset",
    $params
);

$latestArticles = DB::fetchAll(
    "SELECT u.slug AS site_slug,
            COALESCE(NULLIF(s.title,''), NULLIF(u.name,''), u.slug) AS site_title,
            p.slug, p.generated_title AS title, p.generated_excerpt AS excerpt, p.published_at
       FROM posts p
       JOIN users u ON u.id=p.user_id
       JOIN sites s ON s.user_id=u.id
      WHERE p.published=1 AND p.seo_score>0 AND p.slug IS NOT NULL AND p.slug!=''" .
      ($hasVisibilityColumn ? ' AND s.search_visible=1' : '') . "
      ORDER BY p.published_at DESC, p.id DESC LIMIT 12"
);

$network = DB::fetch(
    "SELECT (SELECT COUNT(*) FROM users WHERE slug IS NOT NULL AND slug!='') AS users_count,
            (SELECT COUNT(*) FROM posts WHERE published=1 AND seo_score>0) AS articles_count"
) ?: ['users_count'=>0,'articles_count'=>0];

if (($_GET['action'] ?? '') === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '<url><loc>' . htmlspecialchars($base . '/scopri', ENT_XML1, 'UTF-8') . '</loc></url>' . "\n";
    foreach (DB::fetchAll("SELECT slug FROM users WHERE slug IS NOT NULL AND slug!='' ORDER BY id ASC") as $row) {
        echo '<url><loc>' . htmlspecialchars($base . '/' . rawurlencode($row['slug']), ENT_XML1, 'UTF-8') . '</loc></url>' . "\n";
    }
    echo '</urlset>';
    exit;
}

function h($value): string { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
function hubExcerpt($value, int $limit = 150): string {
    $plain = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)) ?? '');
    if ($plain === '') return 'Uno spazio della rete LinkSeoWeb.';
    return function_exists('mb_strimwidth') ? mb_strimwidth($plain, 0, $limit, '…', 'UTF-8') : substr($plain, 0, $limit);
}
function hubPlan($value): array {
    return match (strtolower(trim((string)$value))) {
        'agency' => ['Agency', 'agency'],
        'pro' => ['Pro', 'pro'],
        default => ['Base', 'base'],
    };
}
function pageUrl(int $page, string $q): string {
    $args = [];
    if ($q !== '') $args['q'] = $q;
    if ($page > 1) $args['page'] = $page;
    return '/scopri' . ($args ? '?' . http_build_query($args) : '');
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=180');
?>
<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hub LinkSeoWeb | Attività, professionisti e contenuti</title>
<meta name="description" content="Esplora l'Hub LinkSeoWeb: attività, professionisti e contenuti organizzati in una rete semplice da cercare e navigare.">
<link rel="canonical" href="<?= h($base . '/scopri') ?>">
<style>
:root{--ink:#161329;--muted:#6e6980;--line:#e8e5ef;--paper:#f6f5fa;--card:#fff;--brand:#6947ed;--brand2:#ef4d87;--night:#1f183d;--shadow:0 16px 40px rgba(31,24,61,.08)}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}a{color:inherit}.wrap{width:min(1260px,calc(100% - 32px));margin:auto}.top{position:sticky;top:0;z-index:20;height:70px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}.top .wrap{height:100%;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:900;letter-spacing:-.04em;font-size:21px}.brand img{width:38px;height:38px;object-fit:contain}.brand b{color:var(--brand)}.topnav{display:flex;gap:8px;align-items:center}.topnav a{text-decoration:none;padding:9px 14px;border-radius:999px;font-size:13px;font-weight:800}.topnav .cta{background:var(--ink);color:white}.hero{background:radial-gradient(circle at 80% 0,#7350ef 0,transparent 34%),linear-gradient(135deg,#17122e,#27204d);color:#fff;padding:70px 0 58px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;font-weight:900;color:#c8bdf8}.hero h1{font-size:clamp(40px,6vw,76px);letter-spacing:-.06em;line-height:.98;margin:14px 0 18px;max-width:900px}.hero p{color:#d8d3e8;font-size:18px;line-height:1.6;max-width:760px}.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.stat{padding:10px 14px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(255,255,255,.08);font-size:13px}.stat strong{font-size:18px;margin-right:6px}.searchbar{margin-top:-28px;position:relative;z-index:3}.searchbox{background:white;border:1px solid var(--line);box-shadow:var(--shadow);border-radius:20px;padding:12px;display:flex;gap:10px}.searchbox input{flex:1;min-width:0;border:0;outline:0;padding:11px 14px;font:inherit;font-size:16px}.searchbox button{border:0;border-radius:13px;padding:0 22px;background:var(--brand);color:white;font-weight:850;cursor:pointer}.section{padding:46px 0}.sectionhead{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.sectionhead h2{font-size:30px;letter-spacing:-.04em;margin:0}.sectionhead p{color:var(--muted);margin:6px 0 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px}.profile{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:20px;text-decoration:none;box-shadow:0 4px 18px rgba(31,24,61,.03);transition:.18s ease;display:flex;flex-direction:column;min-height:230px}.profile:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:#d8d0fa}.profiletop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.avatar{width:58px;height:58px;border-radius:16px;background:linear-gradient(135deg,#ede9fe,#fce7f3);display:grid;place-items:center;overflow:hidden;font-weight:900;font-size:22px;color:var(--brand)}.avatar img{width:100%;height:100%;object-fit:cover}.badge{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;padding:6px 9px;border-radius:999px}.badge.base{background:#f0eef5;color:#716b80}.badge.pro{background:#ede9fe;color:#5b35d5}.badge.agency{background:#17132f;color:#fff}.profile h3{margin:17px 0 8px;font-size:20px;letter-spacing:-.03em}.profile p{margin:0;color:var(--muted);font-size:14px;line-height:1.55;flex:1}.meta{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:var(--muted);font-size:12px;font-weight:700}.empty{background:white;border:1px dashed #d8d3e2;border-radius:20px;padding:50px 24px;text-align:center;color:var(--muted)}.articles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.article{background:white;border:1px solid var(--line);border-radius:18px;padding:18px;text-decoration:none}.article small{color:var(--brand);font-weight:850}.article h3{margin:9px 0 8px;font-size:17px;line-height:1.3}.article p{color:var(--muted);font-size:13px;line-height:1.5;margin:0}.pager{display:flex;justify-content:center;gap:8px;margin-top:28px}.pager a,.pager span{padding:9px 13px;border-radius:10px;background:white;border:1px solid var(--line);text-decoration:none;font-size:13px;font-weight:800}.pager .current{background:var(--ink);color:white}.footer{margin-top:24px;padding:34px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}.footrow{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}@media(max-width:650px){.topnav a:not(.cta){display:none}.hero{padding:52px 0}.searchbox{flex-direction:column}.searchbox button{height:46px}.sectionhead{align-items:flex-start;flex-direction:column}.grid,.articles{grid-template-columns:1fr}}
</style></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><img src="/logo.png" alt=""><span>LinkSeo<b>Web</b></span></a><nav class="topnav"><a href="/scopri">Hub</a><a class="cta" href="/">Accedi / Crea il tuo spazio</a></nav></div></header>
<section class="hero"><div class="wrap"><div class="eyebrow">Hub LinkSeoWeb</div><h1>Una rete di attività che puoi davvero esplorare.</h1><p>Cerca per nome, professione o argomento. Ogni spazio raccoglie contenuti, identità e competenze in una struttura pensata per funzionare anche con migliaia di profili.</p><div class="stats"><div class="stat"><strong><?= number_format((int)$network['users_count'],0,',','.') ?></strong> spazi</div><div class="stat"><strong><?= number_format((int)$network['articles_count'],0,',','.') ?></strong> articoli pubblicati</div><div class="stat">Piani <strong>Base · Pro · Agency</strong></div></div></div></section>
<div class="searchbar"><div class="wrap"><form class="searchbox" method="get" action="/scopri"><input type="search" name="q" value="<?= h($q) ?>" placeholder="Cerca attività, professionisti, servizi…" autocomplete="off"><button type="submit">Cerca nell'Hub</button></form></div></div>
<main><section class="section"><div class="wrap"><div class="sectionhead"><div><h2><?= $q !== '' ? 'Risultati per “' . h($q) . '”' : 'Esplora gli spazi' ?></h2><p><?= number_format($totalProfiles,0,',','.') ?> profili trovati · <?= $perPage ?> per pagina</p></div><?php if($q!==''): ?><a href="/scopri">Azzera ricerca</a><?php endif; ?></div>
<?php if(!$profiles): ?><div class="empty"><h3>Nessun risultato</h3><p>Prova con un nome, un servizio o una parola più generale.</p></div><?php else: ?><div class="grid">
<?php foreach($profiles as $profile): [$planLabel,$planClass]=hubPlan($profile['plan'] ?? 'base'); $initial=function_exists('mb_substr')?mb_substr($profile['title'],0,1,'UTF-8'):substr($profile['title'],0,1); ?><a class="profile" href="/<?= rawurlencode($profile['slug']) ?>"><div class="profiletop"><div class="avatar"><?php if(!empty($profile['logo_url'])): ?><img src="<?= h($profile['logo_url']) ?>" alt=""><?php else: ?><?= h(strtoupper($initial)) ?><?php endif; ?></div><span class="badge <?= h($planClass) ?>"><?= h($planLabel) ?></span></div><h3><?= h($profile['title']) ?></h3><p><?= h(hubExcerpt($profile['description'])) ?></p><div class="meta"><span><?= (int)$profile['post_count'] ?> articoli</span><span>Apri spazio →</span></div></a><?php endforeach; ?></div>
<?php if($totalPages>1): ?><nav class="pager" aria-label="Pagine Hub"><?php if($page>1): ?><a href="<?= h(pageUrl($page-1,$q)) ?>">←</a><?php endif; ?><?php $from=max(1,$page-2);$to=min($totalPages,$page+2);for($p=$from;$p<=$to;$p++): ?><?php if($p===$page): ?><span class="current"><?= $p ?></span><?php else: ?><a href="<?= h(pageUrl($p,$q)) ?>"><?= $p ?></a><?php endif; ?><?php endfor; ?><?php if($page<$totalPages): ?><a href="<?= h(pageUrl($page+1,$q)) ?>">→</a><?php endif; ?></nav><?php endif; ?><?php endif; ?></div></section>
<?php if($q==='' && $latestArticles): ?><section class="section" style="padding-top:10px"><div class="wrap"><div class="sectionhead"><div><h2>Dal network, adesso</h2><p>Gli ultimi contenuti pubblicati dagli spazi LinkSeoWeb.</p></div></div><div class="articles"><?php foreach($latestArticles as $article): ?><a class="article" href="/<?= rawurlencode($article['site_slug']) ?>/<?= rawurlencode($article['slug']) ?>"><small><?= h($article['site_title']) ?></small><h3><?= h($article['title']) ?></h3><p><?= h(hubExcerpt($article['excerpt'],120)) ?></p></a><?php endforeach; ?></div></div></section><?php endif; ?></main>
<footer class="footer"><div class="wrap footrow"><strong>Hub LinkSeoWeb</strong><span>Una rete navigabile, non un elenco infinito.</span></div></footer></body></html>
