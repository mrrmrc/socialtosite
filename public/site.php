<?php
// public/site.php — Pagina pubblica HTML del sito generato
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$slug   = $_GET['slug']   ?? '';
$action = $_GET['action'] ?? 'site';

if (!$slug) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$user = DB::fetch('SELECT * FROM users WHERE slug=?', [$slug]);
if (!$user) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$user['id']]);
$sources = DB::fetchAll(
    'SELECT platform, label, url FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
    [$user['id']]
);
$posts = DB::fetchAll(
    'SELECT * FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC',
    [$user['id']]
);
foreach ($posts as &$p) { $p['tags'] = json_decode($p['tags'] ?? '[]', true); }
unset($p);

// Eventuale pagina singola del contenuto
$postSlug = $_GET['post'] ?? '';
$single   = null;
if ($postSlug) {
    foreach ($posts as $p) { if (($p['slug'] ?? '') === $postSlug) { $single = $p; break; } }
}

// ── Sitemap XML ────────────────────────────────────────────────────────────
if ($action === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    $base = BASE_URL . '/s/' . $slug;
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo "  <url><loc>$base</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n";
    foreach ($posts as $p) {
        $loc = "$base/{$p['slug']}";
        $mod = substr($p['published_at'] ?? $p['imported_at'] ?? '', 0, 10);
        echo "  <url><loc>$loc</loc><lastmod>$mod</lastmod><priority>0.8</priority></url>\n";
    }
    echo '</urlset>';
    exit;
}

// ── Pagina HTML pubblica ───────────────────────────────────────────────────
$title = htmlspecialchars($site['title'] ?? $user['name']);
$bio   = htmlspecialchars($site['profile_summary'] ?: ($site['bio'] ?? ''));
$seoScore = $site['seo_score'] ?? 0;
$siteUrl  = BASE_URL . '/s/' . $slug;
$icons = ['instagram' => '📸', 'tiktok' => '🎵', 'youtube' => '▶️', 'facebook' => '📘'];

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

// Media del contenuto: embed YouTube, <video> o <img>
function mediaHtml(array $p): string {
    $u = $p['media_url'] ?? '';
    if (!$u) return '';
    $type = strtolower($p['media_type'] ?? '');
    if (preg_match('~(?:youtube\.com|youtu\.be)~i', $u) &&
        preg_match('~(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})~', $u, $m)) {
        return '<div class="media"><iframe src="https://www.youtube.com/embed/' . $m[1] .
               '" allowfullscreen loading="lazy"></iframe></div>';
    }
    if ($type === 'image' || preg_match('~\.(jpg|jpeg|png|webp)(\?|$)~i', $u)) {
        return '<div class="media"><img src="' . h($u) . '" alt="" loading="lazy"></div>';
    }
    if ($type === 'video' || preg_match('~\.(mp4|mov|webm)(\?|$)~i', $u)) {
        return '<div class="media"><video controls preload="metadata"><source src="' . h($u) . '"></video></div>';
    }
    return '';
}

// Corpo articolo in paragrafi
function bodyHtml(string $b): string {
    $b = trim($b);
    if ($b === '') return '';
    $out = '';
    foreach (preg_split('/\n{2,}/', $b) as $para) {
        $para = trim($para);
        if ($para !== '') $out .= '<p>' . nl2br(h($para)) . '</p>';
    }
    return $out;
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= $title ?></title>
  <meta name="description" content="<?= $bio ?>">
  <meta property="og:title" content="<?= $title ?>">
  <meta property="og:description" content="<?= $bio ?>">
  <link rel="canonical" href="<?= $siteUrl ?>">
  <link rel="sitemap" type="application/xml" href="<?= $siteUrl ?>/sitemap.xml">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "name": "<?= addslashes($title) ?>",
    "description": "<?= addslashes($bio) ?>",
    "url": "<?= $siteUrl ?>"
  }
  </script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f8f8f6;color:#1a1a1a;line-height:1.65}
    a{color:#7F77DD;text-decoration:none}
    .header{background:#fff;border-bottom:1px solid #eee;padding:2.5rem 1rem;text-align:center}
    .avatar{width:80px;height:80px;border-radius:50%;background:#7F77DD;color:#fff;font-size:2rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem}
    h1{font-size:1.8rem;font-weight:700;margin-bottom:.25rem}
    .bio{color:#666;max-width:480px;margin:.5rem auto 0}
    .socials{display:flex;justify-content:center;gap:.5rem;flex-wrap:wrap;margin:1rem auto 0;max-width:620px}
    .social-link{border:1px solid #ddd;border-radius:999px;padding:.35rem .75rem;color:#333;background:#fff;font-size:.85rem}
    .container{max-width:700px;margin:2rem auto;padding:0 1rem}
    .post{background:#fff;border:1px solid #eee;border-radius:12px;padding:1.5rem;margin-bottom:1rem}
    .meta{font-size:.8rem;color:#999;display:flex;gap:.75rem;align-items:center;margin-bottom:.5rem;flex-wrap:wrap}
    .badge{background:#EEEDFE;color:#534AB7;font-size:.7rem;padding:2px 8px;border-radius:20px;font-weight:500}
    h2{font-size:1.1rem;font-weight:600;margin-bottom:.4rem}
    .excerpt{color:#555;font-size:.93rem}
    .tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:.75rem}
    .tag{font-size:.72rem;background:#f1f0ff;color:#534AB7;padding:3px 9px;border-radius:20px}
    .footer{text-align:center;padding:2rem 1rem;font-size:.8rem;color:#bbb;border-top:1px solid #eee;margin-top:2rem}
    .media{margin:.75rem 0}
    .media iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:10px}
    .media img,.media video{max-width:100%;border-radius:10px;display:block}
    .body p{margin:.65rem 0;color:#333;font-size:.96rem}
    .post h2 a{color:inherit}
    .back{display:inline-block;margin:0 0 1rem;font-size:.9rem}
    .source-link{display:inline-block;margin-top:.75rem;font-size:.86rem}
    @media(max-width:600px){.post{padding:1rem}}
  </style>
</head>
<body>
<header class="header">
  <div class="avatar"><?= mb_strtoupper(mb_substr($title, 0, 1)) ?></div>
  <h1><?= $title ?></h1>
  <?php if ($bio): ?><p class="bio"><?= $bio ?></p><?php endif; ?>
  <?php if ($sources): ?>
  <nav class="socials" aria-label="Profili social">
    <?php foreach ($sources as $source): ?>
      <a class="social-link" href="<?= h($source['url']) ?>" target="_blank" rel="noopener">
        <?= $icons[$source['platform']] ?? 'ðŸ”—' ?> <?= h($source['label'] ?: ucfirst($source['platform'])) ?>
      </a>
    <?php endforeach; ?>
  </nav>
  <?php endif; ?>
</header>

<main class="container">
  <?php if ($single): $p = $single; ?>
  <a class="back" href="<?= $siteUrl ?>">← Tutti i contenuti</a>
  <article class="post" itemscope itemtype="https://schema.org/Article">
    <div class="meta">
      <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
      <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
      <?php if (strtoupper($p['media_type']) === 'VIDEO'): ?><span class="badge">Video → Testo</span><?php endif; ?>
    </div>
    <h2 itemprop="headline"><?= h($p['generated_title'] ?: mb_substr($p['raw_content'] ?? '', 0, 80)) ?></h2>
    <?= mediaHtml($p) ?>
    <div class="body" itemprop="articleBody">
      <?= bodyHtml($p['generated_body'] ?: ($p['transcript'] ?: $p['raw_content'] ?? '')) ?>
    </div>
    <?php if (!empty($p['source_url'])): ?>
    <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">
      Vedi il contenuto originale su <?= h($p['platform']) ?>
    </a>
    <?php endif; ?>
    <?php if ($p['tags']): ?>
    <div class="tags"><?php foreach ($p['tags'] as $tag): ?><span class="tag"><?= h($tag) ?></span><?php endforeach; ?></div>
    <?php endif; ?>
    <meta itemprop="datePublished" content="<?= h($p['published_at'] ?? '') ?>">
  </article>

  <?php else: ?>
  <?php foreach ($posts as $p): $purl = $siteUrl . '/' . h($p['slug'] ?? ''); ?>
  <article class="post" itemscope itemtype="https://schema.org/Article">
    <div class="meta">
      <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
      <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
      <?php if (strtoupper($p['media_type']) === 'VIDEO'): ?><span class="badge">Video → Testo</span><?php endif; ?>
    </div>
    <?= mediaHtml($p) ?>
    <h2 itemprop="headline"><a href="<?= $purl ?>"><?= h($p['generated_title'] ?: mb_substr($p['raw_content'] ?? '', 0, 80)) ?></a></h2>
    <p class="excerpt" itemprop="description">
      <?= h($p['generated_excerpt'] ?: mb_substr($p['generated_body'] ?? '', 0, 200)) ?>
    </p>
    <?php if (!empty($p['source_url'])): ?>
    <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">
      Vedi il contenuto originale su <?= h($p['platform']) ?>
    </a>
    <?php endif; ?>
    <?php if ($p['tags']): ?>
    <div class="tags"><?php foreach ($p['tags'] as $tag): ?><span class="tag"><?= h($tag) ?></span><?php endforeach; ?></div>
    <?php endif; ?>
    <meta itemprop="datePublished" content="<?= h($p['published_at'] ?? '') ?>">
  </article>
  <?php endforeach; ?>

  <?php if (!$posts): ?>
  <div style="text-align:center;color:#aaa;padding:3rem">
    <div style="font-size:3rem;margin-bottom:1rem">📭</div>
    <p>Nessun contenuto ancora pubblicato.</p>
  </div>
  <?php endif; ?>
  <?php endif; ?>
</main>

<footer class="footer">
  Creato automaticamente con <a href="<?= BASE_URL ?>">SocialToSite</a>
  · SEO Score <?= $seoScore ?>/100
  · <a href="<?= $siteUrl ?>/sitemap.xml">Sitemap</a>
</footer>
</body>
</html>
