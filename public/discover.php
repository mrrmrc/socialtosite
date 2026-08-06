<?php
// Hub editoriale del dominio padre: crea collegamenti HTML reali verso profili e articoli.
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$profiles = DB::fetchAll(
    'SELECT u.slug, COALESCE(NULLIF(s.title, ""), u.name, u.slug) AS title,
            COALESCE(NULLIF(s.bio, ""), NULLIF(s.profile_summary, ""), "") AS description,
            s.logo_url, s.last_sync,
            (SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id AND p.published=1 AND p.seo_score>0) AS post_count
       FROM users u
       JOIN sites s ON s.user_id=u.id
      WHERE u.slug IS NOT NULL AND u.slug != ""
      ORDER BY COALESCE(s.last_sync, s.created_at) DESC'
);

$articles = DB::fetchAll(
    'SELECT u.slug AS site_slug, COALESCE(NULLIF(s.title, ""), u.name, u.slug) AS site_title,
            p.slug, p.generated_title AS title, p.generated_excerpt AS excerpt,
            p.media_url, p.published_at
       FROM posts p
       JOIN users u ON u.id=p.user_id
       JOIN sites s ON s.user_id=u.id
      WHERE p.published=1 AND p.seo_score>0 AND p.slug IS NOT NULL AND p.slug != ""
      ORDER BY p.published_at DESC, p.id DESC
      LIMIT 120'
);

$base = rtrim(BASE_URL, '/');
function discoverExcerpt(?string $value, int $limit = 180): string {
    $plain = trim(strip_tags((string)$value));
    if (function_exists('mb_strimwidth')) return mb_strimwidth($plain, 0, $limit, '…', 'UTF-8');
    return strlen($plain) > $limit ? substr($plain, 0, $limit - 3) . '...' : $plain;
}

if (($_GET['action'] ?? '') === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '  <url><loc>' . htmlspecialchars($base . '/scopri', ENT_XML1, 'UTF-8') . '</loc></url>' . "\n";
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
foreach (array_slice($articles, 0, 30) as $index => $article) {
    $schemaItems[] = [
        '@type' => 'ListItem',
        'position' => $index + 1,
        'name' => $article['title'],
        'url' => $base . '/' . $article['site_slug'] . '/' . $article['slug'],
    ];
}
?><!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Attività, professionisti e storie | AllSocialToWeb</title>
  <meta name="description" content="Scopri attività, professionisti e contenuti nati dai loro canali social e organizzati in pagine web consultabili.">
  <link rel="canonical" href="<?= htmlspecialchars($base . '/scopri', ENT_QUOTES, 'UTF-8') ?>">
  <link rel="sitemap" type="application/xml" href="<?= htmlspecialchars($base . '/scopri/sitemap.xml', ENT_QUOTES, 'UTF-8') ?>">
  <script type="application/ld+json"><?= json_encode(['@context'=>'https://schema.org','@type'=>'ItemList','name'=>'Contenuti dalla rete AllSocialToWeb','itemListElement'=>$schemaItems], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
  <style>
    :root{color-scheme:light;--ink:#172033;--muted:#667085;--line:#e6e9f0;--brand:#5b5ce2;--soft:#f6f7fb}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;color:var(--ink);background:#fff}a{color:inherit}.wrap{width:min(1120px,calc(100% - 36px));margin:auto}header{padding:22px 0;border-bottom:1px solid var(--line)}header a{text-decoration:none;font-weight:850}.hero{padding:64px 0 40px;background:linear-gradient(135deg,#f4f2ff,#eef9ff)}h1{font-size:clamp(34px,6vw,66px);line-height:1.02;max-width:850px;margin:0 0 18px}.hero p{font-size:18px;line-height:1.7;color:var(--muted);max-width:760px}.section{padding:48px 0}.section h2{font-size:28px;margin:0 0 22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}.card{border:1px solid var(--line);border-radius:18px;padding:20px;text-decoration:none;display:block;background:#fff}.card:hover{border-color:var(--brand);box-shadow:0 12px 35px rgba(42,46,88,.09)}.card h3{margin:0 0 9px;font-size:18px}.card p{color:var(--muted);line-height:1.55;margin:0}.meta{font-size:12px;color:var(--brand);font-weight:750;margin-top:14px}.articles{background:var(--soft)}footer{padding:35px 0;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
  </style>
</head>
<body>
<header><div class="wrap"><a href="/">AllSocialToWeb</a></div></header>
<main>
  <section class="hero"><div class="wrap"><h1>Le attività dietro i social, finalmente sul web.</h1><p>Una rete pubblica che collega contenuti, competenze e storie delle attività presenti su AllSocialToWeb. Ogni scheda conduce al sito e agli articoli originali dell’attività.</p></div></section>
  <section class="section"><div class="wrap"><h2>Attività da scoprire</h2><div class="grid">
    <?php foreach ($profiles as $profile): ?>
      <a class="card" href="/<?= rawurlencode($profile['slug']) ?>">
        <h3><?= htmlspecialchars($profile['title'], ENT_QUOTES, 'UTF-8') ?></h3>
        <p><?= htmlspecialchars(discoverExcerpt($profile['description']), ENT_QUOTES, 'UTF-8') ?></p>
        <div class="meta"><?= (int)$profile['post_count'] ?> contenuti pubblicati →</div>
      </a>
    <?php endforeach; ?>
  </div></div></section>
  <section class="section articles"><div class="wrap"><h2>Ultime storie pubblicate</h2><div class="grid">
    <?php foreach (array_slice($articles, 0, 36) as $article): ?>
      <a class="card" href="/<?= rawurlencode($article['site_slug']) ?>/<?= rawurlencode($article['slug']) ?>">
        <div class="meta" style="margin:0 0 10px"><?= htmlspecialchars($article['site_title'], ENT_QUOTES, 'UTF-8') ?></div>
        <h3><?= htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8') ?></h3>
        <p><?= htmlspecialchars(discoverExcerpt($article['excerpt'] ?? '', 170), ENT_QUOTES, 'UTF-8') ?></p>
      </a>
    <?php endforeach; ?>
  </div></div></section>
</main>
<footer><div class="wrap">AllSocialToWeb · <a href="/">Crea il tuo spazio</a> · <a href="/sitemap.xml">Mappa XML</a></div></footer>
</body></html>
