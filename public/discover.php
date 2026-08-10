<?php
// Wall editoriale pubblico: organizza la rete per argomenti e per attività.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$hasVisibilityColumn = false;
try {
    foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) {
        if (($column['Field'] ?? '') === 'search_visible') { $hasVisibilityColumn = true; break; }
    }
} catch (Throwable $e) { $hasVisibilityColumn = false; }
$visibilityFilter = $hasVisibilityColumn ? ' AND s.search_visible = 1' : '';

$profiles = DB::fetchAll(
    'SELECT u.slug, COALESCE(NULLIF(s.title, ""), u.name, u.slug) AS title,
            COALESCE(NULLIF(s.bio, ""), NULLIF(s.profile_summary, ""), "") AS description,
            s.logo_url, s.last_sync,
            (SELECT GROUP_CONCAT(DISTINCT sc.handle SEPARATOR "||")
               FROM social_connections sc WHERE sc.user_id=u.id AND sc.handle IS NOT NULL AND sc.handle != "") AS social_handles,
            (SELECT GROUP_CONCAT(DISTINCT CONCAT(COALESCE(ss.label, ""), "@@", ss.url) SEPARATOR "||")
               FROM social_sources ss WHERE ss.user_id=u.id) AS social_sources,
            (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id AND p.published=1 AND p.seo_score>0) AS post_count
       FROM users u
       JOIN sites s ON s.user_id=u.id
      WHERE u.slug IS NOT NULL AND u.slug != ""' . $visibilityFilter . '
      ORDER BY COALESCE(s.last_sync, s.created_at) DESC'
);

$articles = DB::fetchAll(
    'SELECT u.slug AS site_slug, COALESCE(NULLIF(s.title, ""), u.name, u.slug) AS site_title,
            p.slug, p.generated_title AS title, p.generated_excerpt AS excerpt,
            p.tags, p.media_url, p.published_at
       FROM posts p
       JOIN users u ON u.id=p.user_id
       JOIN sites s ON s.user_id=u.id
      WHERE p.published=1 AND p.seo_score>0 AND p.slug IS NOT NULL AND p.slug != ""' . $visibilityFilter . '
      ORDER BY p.published_at DESC, p.id DESC
      LIMIT 500'
);

$base = rtrim(BASE_URL, '/');

function discoverExcerpt(?string $value, int $limit = 150): string {
    $plain = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)) ?? '');
    if (function_exists('mb_strimwidth')) return mb_strimwidth($plain, 0, $limit, '…', 'UTF-8');
    return strlen($plain) > $limit ? substr($plain, 0, $limit - 3) . '...' : $plain;
}

function discoverSlug(string $value): string {
    $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
    $ascii = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) : $value;
    if (is_string($ascii) && $ascii !== '') $value = $ascii;
    $value = preg_replace('/[^a-z0-9]+/i', '-', $value);
    return trim((string)$value, '-');
}

function discoverDate(?string $value): string {
    if (!$value) return '';
    $timestamp = strtotime($value);
    if (!$timestamp) return '';
    $months = [1=>'gen',2=>'feb',3=>'mar',4=>'apr',5=>'mag',6=>'giu',7=>'lug',8=>'ago',9=>'set',10=>'ott',11=>'nov',12=>'dic'];
    return date('j', $timestamp) . ' ' . ($months[(int)date('n', $timestamp)] ?? '') . ' ' . date('Y', $timestamp);
}

function discoverImage(?string $value): string {
    $url = trim((string)$value);
    return preg_match('#^https?://#i', $url) ? $url : '';
}

function discoverBalanced(array $items, int $limit, int $perProfile = 2): array {
    $result = [];
    $seen = [];
    foreach ($items as $item) {
        $key = (string)($item['site_slug'] ?? '');
        if (($seen[$key] ?? 0) >= $perProfile) continue;
        $result[] = $item;
        $seen[$key] = ($seen[$key] ?? 0) + 1;
        if (count($result) >= $limit) break;
    }
    return $result;
}

function discoverIsIdentityTopic(string $topicSlug, array $identitySlugs): bool {
    $topicKey = str_replace('-', '', $topicSlug);
    foreach ($identitySlugs as $identitySlug => $_) {
        $identityKey = str_replace('-', '', (string)$identitySlug);
        if ($topicKey === $identityKey) return true;
        if (strlen($topicKey) >= 4 && strlen($identityKey) >= 4
            && (str_contains($identityKey, $topicKey) || str_contains($topicKey, $identityKey))) return true;
    }
    return false;
}

// I nomi di attività/account non devono finire tra gli argomenti.
$identitySlugs = [];
foreach ($profiles as $profile) {
    $identitySlugs[discoverSlug((string)$profile['slug'])] = true;
    $identitySlugs[discoverSlug((string)$profile['title'])] = true;
    foreach (explode('||', (string)($profile['social_handles'] ?? '')) as $handle) {
        $handleSlug = discoverSlug(ltrim(trim($handle), '@'));
        if ($handleSlug !== '') $identitySlugs[$handleSlug] = true;
    }
    foreach (explode('||', (string)($profile['social_sources'] ?? '')) as $source) {
        [$label, $url] = array_pad(explode('@@', $source, 2), 2, '');
        $labelSlug = discoverSlug($label);
        if ($labelSlug !== '') $identitySlugs[$labelSlug] = true;
        $path = trim((string)parse_url($url, PHP_URL_PATH), '/');
        $handle = $path !== '' ? basename($path) : '';
        $handleSlug = discoverSlug(ltrim($handle, '@'));
        if ($handleSlug !== '') $identitySlugs[$handleSlug] = true;
    }
}
$genericTopics = array_fill_keys(['social','instagram','facebook','tiktok','youtube','reel','reels','post','video','foto','italia','italy'], true);
$topics = [];
$articlesByProfile = [];

foreach ($articles as &$article) {
    $articlesByProfile[$article['site_slug']][] = $article;
    $decodedTags = json_decode($article['tags'] ?? '[]', true);
    if (!is_array($decodedTags)) $decodedTags = explode(',', (string)($article['tags'] ?? ''));
    $article['_topics'] = [];
    foreach (array_unique(array_filter(array_map('trim', $decodedTags))) as $tag) {
        $topicSlug = discoverSlug($tag);
        if ($topicSlug === '' || strlen($topicSlug) < 3 || discoverIsIdentityTopic($topicSlug, $identitySlugs) || isset($genericTopics[$topicSlug])) continue;
        $article['_topics'][] = $topicSlug;
        if (!isset($topics[$topicSlug])) $topics[$topicSlug] = ['slug'=>$topicSlug, 'label'=>$tag, 'count'=>0, 'articles'=>[]];
        $topics[$topicSlug]['count']++;
        if (count($topics[$topicSlug]['articles']) < 8) $topics[$topicSlug]['articles'][] = $article;
    }
}
unset($article);
uasort($topics, static function ($a, $b) {
    return ($b['count'] <=> $a['count']) ?: strcasecmp($a['label'], $b['label']);
});

$featuredTopics = array_filter($topics, fn($topic) => $topic['count'] >= 2);
if (count($featuredTopics) < 6) $featuredTopics = $topics;
$featuredTopics = array_slice($featuredTopics, 0, 10, true);

$activeTopic = discoverSlug((string)($_GET['topic'] ?? ''));
$activeTopicData = $activeTopic !== '' ? ($topics[$activeTopic] ?? null) : null;
if ($activeTopic !== '' && !$activeTopicData) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="it"><meta charset="utf-8"><title>Argomento non trovato</title><body><main><h1>Argomento non trovato</h1><p><a href="/scopri">Torna alla rete AllSocialToWeb</a></p></main></body></html>';
    exit;
}

$visibleArticles = $activeTopicData
    ? array_values(array_filter($articles, fn($article) => in_array($activeTopic, $article['_topics'] ?? [], true)))
    : $articles;
$visibleSiteSlugs = array_flip(array_unique(array_column($visibleArticles, 'site_slug')));
$visibleProfiles = $activeTopicData
    ? array_values(array_filter($profiles, fn($profile) => isset($visibleSiteSlugs[$profile['slug']])))
    : $profiles;
$wallProfiles = array_slice(array_values(array_filter($visibleProfiles, fn($profile) => !empty($articlesByProfile[$profile['slug']]))), 0, 12);
$focusedArticles = discoverBalanced($visibleArticles, 18, 3);
$profileWallArticles = $articlesByProfile;
if ($activeTopicData) {
    $profileWallArticles = [];
    foreach ($visibleArticles as $article) $profileWallArticles[$article['site_slug']][] = $article;
}

if (($_GET['action'] ?? '') === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '  <url><loc>' . htmlspecialchars($base . '/scopri', ENT_XML1, 'UTF-8') . '</loc></url>' . "\n";
    foreach ($featuredTopics as $topic) {
        echo '  <url><loc>' . htmlspecialchars($base . '/scopri/tema/' . rawurlencode($topic['slug']), ENT_XML1, 'UTF-8') . '</loc></url>' . "\n";
    }
    foreach ($articles as $article) {
        $url = $base . '/' . rawurlencode($article['site_slug']) . '/' . rawurlencode($article['slug']);
        echo '  <url><loc>' . htmlspecialchars($url, ENT_XML1, 'UTF-8') . '</loc>';
        if (!empty($article['published_at'])) echo '<lastmod>' . substr($article['published_at'], 0, 10) . '</lastmod>';
        echo "</url>\n";
    }
    echo '</urlset>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=900');
$schemaItems = [];
foreach (array_slice($focusedArticles, 0, 18) as $index => $article) {
    $schemaItems[] = ['@type'=>'ListItem','position'=>$index + 1,'name'=>$article['title'],'url'=>$base . '/' . $article['site_slug'] . '/' . $article['slug']];
}
?><!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title><?= $activeTopicData ? htmlspecialchars($activeTopicData['label'], ENT_QUOTES, 'UTF-8') . ' | ' : '' ?>Scopri attività e storie | AllSocialToWeb</title>
  <meta name="description" content="<?= $activeTopicData ? 'Contenuti e attività su ' . htmlspecialchars($activeTopicData['label'], ENT_QUOTES, 'UTF-8') . ' nella rete AllSocialToWeb.' : 'Esplora contenuti, attività e professionisti della rete AllSocialToWeb per argomento o per nome.' ?>">
  <link rel="canonical" href="<?= htmlspecialchars($base . ($activeTopicData ? '/scopri/tema/' . $activeTopicData['slug'] : '/scopri'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="sitemap" type="application/xml" href="<?= htmlspecialchars($base . '/scopri/sitemap.xml', ENT_QUOTES, 'UTF-8') ?>">
  <script type="application/ld+json"><?= json_encode(['@context'=>'https://schema.org','@type'=>'ItemList','name'=>'Contenuti dalla rete AllSocialToWeb','itemListElement'=>$schemaItems], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
  <style>
    :root{color-scheme:light;--ink:#17132f;--muted:#69657c;--line:#e8e5f0;--brand:#6947ed;--brand2:#ee4f86;--paper:#f5f3fa;--card:#fff;--night:#211942}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper)}a{color:inherit}.wrap{width:min(1220px,calc(100% - 40px));margin:auto}.topbar{height:70px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20;backdrop-filter:blur(14px)}.topbar .wrap{height:100%;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{text-decoration:none;font-weight:900;letter-spacing:-.04em;font-size:20px}.brand i{font-style:normal;color:var(--brand)}.toplinks{display:flex;align-items:center;gap:8px}.toplinks a{text-decoration:none;font-size:13px;font-weight:750;padding:9px 13px;border-radius:999px}.toplinks .cta{color:#fff;background:var(--ink)}
    .hero{background:var(--night);color:#fff;padding:54px 0 42px;overflow:hidden;position:relative}.hero:after{content:"";position:absolute;width:430px;height:430px;border-radius:50%;right:-120px;top:-260px;background:radial-gradient(circle,#744af7,transparent 68%);opacity:.75}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:850;color:#bdb0fa}.hero h1{font-size:clamp(38px,5.5vw,70px);line-height:.98;letter-spacing:-.055em;max-width:920px;margin:13px 0 18px}.hero p{font-size:17px;line-height:1.6;color:#d4cee8;max-width:720px;margin:0}.switcher{display:flex;gap:8px;margin-top:28px;position:relative;z-index:2}.switcher button,.switcher a{appearance:none;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;text-decoration:none;padding:11px 16px;border-radius:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.switcher .active{background:#fff;color:var(--night)}
    .toolbar{background:#fff;border-bottom:1px solid var(--line);padding:16px 0;position:sticky;top:70px;z-index:15}.toolbar-row{display:flex;align-items:center;gap:12px}.search{position:relative;flex:1}.search span{position:absolute;left:16px;top:12px;color:var(--muted)}.search input{width:100%;height:44px;border:1px solid var(--line);border-radius:13px;padding:0 16px 0 42px;font:inherit;background:#faf9fc}.search input:focus{outline:2px solid #cfc4ff;border-color:var(--brand)}.result-note{font-size:12px;font-weight:750;color:var(--muted);white-space:nowrap}
    .section{padding:42px 0}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.section-head h2{font-size:clamp(26px,4vw,38px);letter-spacing:-.04em;margin:0}.section-head p{color:var(--muted);margin:7px 0 0;line-height:1.5}.section-head .count{font-size:12px;font-weight:800;color:var(--brand);background:#ebe6ff;padding:8px 11px;border-radius:999px;white-space:nowrap}.panel[hidden]{display:none}.topic-wall{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.topic-block{grid-column:span 6;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:0 10px 32px rgba(31,24,60,.045)}.topic-block:nth-child(3n+1){grid-column:span 7}.topic-block:nth-child(3n+2){grid-column:span 5}.topic-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.topic-header a{text-decoration:none}.topic-header h3{font-size:22px;letter-spacing:-.03em;margin:0}.topic-count{font-size:11px;font-weight:850;color:var(--brand);background:#eeeaff;padding:7px 9px;border-radius:999px}.story-list{display:grid;gap:3px}.story-row{display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:13px;text-decoration:none;padding:10px;border-radius:14px}.story-row:hover{background:#f6f3ff}.thumb{width:62px;height:54px;border-radius:11px;object-fit:cover;background:linear-gradient(135deg,#ddd5ff,#ffdbe6)}.thumb-fallback{display:grid;place-items:center;font-size:22px;font-weight:900;color:var(--brand)}.story-copy{min-width:0}.story-copy strong{font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.story-copy small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.arrow{font-size:18px;color:#a7a1b7}.more{display:inline-flex;margin-top:12px;color:var(--brand);font-size:12px;font-weight:850;text-decoration:none}
    .name-wall{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.profile-block{background:#fff;border:1px solid var(--line);border-radius:24px;overflow:hidden;display:flex;flex-direction:column}.profile-top{padding:20px;display:flex;align-items:center;gap:13px;border-bottom:1px solid var(--line)}.avatar{width:46px;height:46px;border-radius:14px;object-fit:cover;background:linear-gradient(135deg,#6947ed,#ee4f86);color:#fff;display:grid;place-items:center;font-size:19px;font-weight:900}.profile-top div{min-width:0}.profile-top h3{margin:0;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile-top small{color:var(--muted);font-size:11px}.profile-stories{padding:8px 13px;flex:1}.profile-story{display:block;text-decoration:none;padding:11px 7px;border-bottom:1px solid #f0edf5}.profile-story:last-child{border:0}.profile-story strong{font-size:13px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.profile-story span{display:block;color:var(--muted);font-size:10px;margin-top:5px}.profile-link{text-decoration:none;color:var(--brand);font-size:12px;font-weight:850;padding:15px 20px;border-top:1px solid var(--line)}
    .focus-wall{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.focus-card{min-height:240px;border-radius:23px;padding:22px;text-decoration:none;background:#fff;border:1px solid var(--line);display:flex;flex-direction:column;justify-content:flex-end;position:relative;overflow:hidden}.focus-card.has-image{color:#fff;background-size:cover;background-position:center}.focus-card.has-image:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,11,36,.08),rgba(16,11,36,.9))}.focus-card>*{position:relative}.focus-card h3{font-size:20px;letter-spacing:-.025em;margin:8px 0}.focus-card p{font-size:13px;line-height:1.5;color:var(--muted);margin:0}.focus-card.has-image p,.focus-card.has-image small{color:#ded9ed}.focus-card small{font-size:11px;color:var(--brand);font-weight:800}.empty{padding:50px;text-align:center;background:#fff;border:1px dashed var(--line);border-radius:20px;color:var(--muted)}.is-filtered{display:none!important}footer{padding:35px 0;border-top:1px solid var(--line);background:#fff;color:var(--muted);font-size:12px}footer .wrap{display:flex;justify-content:space-between;gap:20px}
    @media(max-width:900px){.topic-block,.topic-block:nth-child(n){grid-column:span 12}.name-wall,.focus-wall{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.wrap{width:min(100% - 24px,1220px)}.topbar{height:60px}.toolbar{top:60px}.toplinks a:not(.cta){display:none}.hero{padding:38px 0 32px}.hero h1{font-size:39px}.hero p{font-size:15px}.switcher{overflow:auto;padding-bottom:3px}.switcher button,.switcher a{white-space:nowrap}.toolbar-row{align-items:stretch;flex-direction:column}.result-note{padding-left:3px}.section{padding:32px 0}.section-head{align-items:flex-start}.name-wall,.focus-wall{grid-template-columns:1fr}.topic-block{padding:16px;border-radius:19px}.story-row{grid-template-columns:52px 1fr}.thumb{width:52px;height:48px}.arrow{display:none}.section-head .count{display:none}footer .wrap{flex-direction:column}}
  </style>
</head>
<body>
<header class="topbar"><div class="wrap"><a class="brand" href="/">AllSocialTo<i>Web</i></a><nav class="toplinks" aria-label="Navigazione principale"><a href="#argomenti">Esplora</a><a class="cta" href="/">Crea il tuo spazio</a></nav></div></header>
<main>
  <section class="hero"><div class="wrap">
    <div class="eyebrow"><?= $activeTopicData ? 'Raccolta tematica' : 'Il wall della rete' ?></div>
    <h1><?= $activeTopicData ? htmlspecialchars($activeTopicData['label'], ENT_QUOTES, 'UTF-8') : 'Trova ciò che ti interessa. Non tutto il resto.' ?></h1>
    <p><?= $activeTopicData ? 'Una selezione di storie sul tema, distribuita tra attività diverse per offrirti più punti di vista.' : 'Contenuti recenti organizzati per argomento e per nome. Ogni sezione mostra solo una selezione: niente flussi infiniti, niente profili che occupano tutto.' ?></p>
    <?php if (!$activeTopicData): ?><div class="switcher" role="tablist" aria-label="Modalità di esplorazione"><button class="active" type="button" role="tab" aria-selected="true" data-panel="topics">Per argomento</button><button type="button" role="tab" aria-selected="false" data-panel="names">Per nome</button></div><?php else: ?><div class="switcher"><a class="active" href="/scopri">← Tutti gli argomenti</a><a href="#nomi">Attività nel tema</a></div><?php endif; ?>
  </div></section>

  <div class="toolbar"><div class="wrap toolbar-row"><label class="search"><span aria-hidden="true">⌕</span><input id="wall-search" type="search" placeholder="Cerca un argomento o un nome…" autocomplete="off" aria-label="Cerca nel wall"></label><div class="result-note" id="result-note">Esplora una selezione aggiornata</div></div></div>

  <?php if ($activeTopicData): ?>
    <section class="section"><div class="wrap"><div class="section-head"><div><h2>Ultimi contenuti</h2><p>Massimo tre contenuti per attività, per un wall più vario.</p></div><span class="count"><?= count($visibleArticles) ?> nel tema</span></div>
      <div class="focus-wall" data-wall>
        <?php foreach ($focusedArticles as $article): $image = discoverImage($article['media_url'] ?? ''); ?>
          <a class="focus-card<?= $image ? ' has-image' : '' ?>" data-search="<?= htmlspecialchars($article['site_title'] . ' ' . $article['title'], ENT_QUOTES, 'UTF-8') ?>" href="/<?= rawurlencode($article['site_slug']) ?>/<?= rawurlencode($article['slug']) ?>"<?= $image ? ' style="background-image:url(\'' . htmlspecialchars($image, ENT_QUOTES, 'UTF-8') . '\')"' : '' ?>>
            <small><?= htmlspecialchars($article['site_title'], ENT_QUOTES, 'UTF-8') ?> · <?= htmlspecialchars(discoverDate($article['published_at']), ENT_QUOTES, 'UTF-8') ?></small><h3><?= htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8') ?></h3><p><?= htmlspecialchars(discoverExcerpt($article['excerpt'] ?? '', 125), ENT_QUOTES, 'UTF-8') ?></p>
          </a>
        <?php endforeach; ?>
      </div>
    </div></section>
    <section class="section" id="nomi"><div class="wrap"><div class="section-head"><div><h2>Chi ne parla</h2><p>Le attività presenti in questo argomento.</p></div></div><?php include __FILE__ . '.profiles.inc'; ?></div></section>
  <?php else: ?>
    <section class="section panel" id="argomenti" data-panel-content="topics"><div class="wrap"><div class="section-head"><div><h2>Wall per argomento</h2><p>Una selezione degli ultimi contenuti, raccolta per tema.</p></div><span class="count"><?= count($featuredTopics) ?> argomenti in evidenza</span></div>
      <div class="topic-wall" data-wall>
        <?php foreach ($featuredTopics as $topic): $topicArticles = discoverBalanced($topic['articles'], 4, 2); $topicSearch = $topic['label'] . ' ' . implode(' ', array_column($topicArticles, 'site_title')) . ' ' . implode(' ', array_column($topicArticles, 'title')); ?>
          <article class="topic-block" data-search="<?= htmlspecialchars($topicSearch, ENT_QUOTES, 'UTF-8') ?>">
            <div class="topic-header"><a href="/scopri/tema/<?= rawurlencode($topic['slug']) ?>"><h3>#<?= htmlspecialchars($topic['label'], ENT_QUOTES, 'UTF-8') ?></h3></a><span class="topic-count"><?= (int)$topic['count'] ?> storie</span></div>
            <div class="story-list">
              <?php foreach ($topicArticles as $article): $image = discoverImage($article['media_url'] ?? ''); ?>
                <a class="story-row" href="/<?= rawurlencode($article['site_slug']) ?>/<?= rawurlencode($article['slug']) ?>">
                  <?php if ($image): ?><img class="thumb" src="<?= htmlspecialchars($image, ENT_QUOTES, 'UTF-8') ?>" alt="" loading="lazy"><?php else: ?><span class="thumb thumb-fallback" aria-hidden="true"><?= htmlspecialchars(strtoupper(substr($article['site_title'], 0, 1)), ENT_QUOTES, 'UTF-8') ?></span><?php endif; ?>
                  <span class="story-copy"><strong><?= htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8') ?></strong><small><?= htmlspecialchars($article['site_title'], ENT_QUOTES, 'UTF-8') ?> · <?= htmlspecialchars(discoverDate($article['published_at']), ENT_QUOTES, 'UTF-8') ?></small></span><span class="arrow">→</span>
                </a>
              <?php endforeach; ?>
            </div><a class="more" href="/scopri/tema/<?= rawurlencode($topic['slug']) ?>">Apri il tema →</a>
          </article>
        <?php endforeach; ?>
      </div>
    </div></section>
    <section class="section panel" id="nomi" data-panel-content="names" hidden><div class="wrap"><div class="section-head"><div><h2>Wall per nome</h2><p>Scegli un’attività e guarda subito i suoi tre contenuti più recenti.</p></div><span class="count"><?= count($wallProfiles) ?> attività aggiornate</span></div><?php include __FILE__ . '.profiles.inc'; ?></div></section>
  <?php endif; ?>
</main>
<footer><div class="wrap"><span>AllSocialToWeb · Contenuti organizzati, non sommati.</span><span><a href="/">Crea il tuo spazio</a> · <a href="/scopri/sitemap.xml">Mappa XML</a></span></div></footer>
<script>
(() => {
  const tabs = [...document.querySelectorAll('[data-panel]')];
  const panels = [...document.querySelectorAll('[data-panel-content]')];
  const input = document.getElementById('wall-search');
  const note = document.getElementById('result-note');
  const activate = name => {
    tabs.forEach(tab => { const on = tab.dataset.panel === name; tab.classList.toggle('active', on); tab.setAttribute('aria-selected', on ? 'true' : 'false'); });
    panels.forEach(panel => { panel.hidden = panel.dataset.panelContent !== name; });
    if (input) { input.value = ''; filter(); }
  };
  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.panel)));
  function filter() {
    const query = (input?.value || '').trim().toLocaleLowerCase('it');
    const panel = panels.find(item => !item.hidden) || document;
    const cards = [...panel.querySelectorAll('[data-search]')];
    let visible = 0;
    cards.forEach(card => { const show = !query || (card.dataset.search || '').toLocaleLowerCase('it').includes(query); card.classList.toggle('is-filtered', !show); if (show) visible++; });
    if (note) note.textContent = query ? `${visible} risultati nel wall` : 'Esplora una selezione aggiornata';
  }
  input?.addEventListener('input', filter);
})();
</script>
</body></html>
