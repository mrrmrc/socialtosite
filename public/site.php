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
$title = htmlspecialchars((string)($site['title'] ?? $user['name'] ?? ''));
$bio   = htmlspecialchars((string)($site['profile_summary'] ?: ($site['bio'] ?? '')));
$seoScore = $site['seo_score'] ?? 0;
$siteUrl  = BASE_URL . '/s/' . $slug;
$theme = $site['theme'] ?? 'classic';
$validThemes = ['classic', 'journal', 'authority', 'portfolio', 'magazine', 'minimal', 'studio', 'local', 'academy', 'timeline', 'bottega'];
if (!in_array($theme, $validThemes, true)) $theme = 'classic';
$icons = ['instagram' => '📸', 'tiktok' => '🎵', 'youtube' => '▶️', 'facebook' => '📘', 'website' => '🌐'];
$deployInfo = [];
$deployInfoPath = __DIR__ . '/../deploy-info.json';
if (is_file($deployInfoPath)) {
    $deployInfo = json_decode((string) file_get_contents($deployInfoPath), true) ?: [];
}

// Layout Advanced
$menuLinks = !empty($site['menu_links']) ? json_decode($site['menu_links'], true) : [];
$headerLayout = $site['header_layout'] ?? 'standard';
$accentColor = $site['accent_color'] ?? '';
$logoUrl = $site['logo_url'] ?? '';
$coverUrl = $site['cover_url'] ?? '';
$footerText = $site['footer_text'] ?? '';
$customCss = $site['custom_css'] ?? '';

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

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
function bodyHtml(?string $b): string {
    $b = trim((string)$b);
    if ($b === '') return '';
    $out = '';
    foreach (preg_split('/\n{2,}/', $b) as $para) {
        $para = trim($para);
        if ($para !== '') $out .= '<p>' . nl2br(h($para)) . '</p>';
    }
    return $out;
}
function renderPostHtml(array $p, string $siteUrl, array $icons): string {
    $purl = $siteUrl . '/' . h($p['slug'] ?? '');
    $ptagString = '';
    if (!empty($p['tags'])) {
        $ptagString = implode(' ', array_map(function($t) { return 'tag-' . strtolower(trim($t)); }, $p['tags']));
    }
    
    $out = '<article class="post" itemscope itemtype="https://schema.org/Article" data-platform="platform-' . h($p['platform']) . '" data-tags="' . h($ptagString) . '">' . "\n";
    $out .= '  <div class="meta">' . "\n";
    $out .= '    <span>' . ($icons[$p['platform']] ?? '📄') . ' ' . h($p['platform']) . '</span>' . "\n";
    $out .= '    <span>' . ($p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '') . '</span>' . "\n";
    if (strtoupper($p['media_type'] ?? '') === 'VIDEO') {
        $out .= '    <span class="badge">Video → Testo</span>' . "\n";
    }
    $out .= '  </div>' . "\n";
    $out .= '  ' . mediaHtml($p) . "\n";
    $out .= '  <h2 itemprop="headline"><a href="' . $purl . '">' . h($p['generated_title'] ?: mb_substr($p['raw_content'] ?? '', 0, 80)) . '</a></h2>' . "\n";
    $out .= '  <p class="excerpt" itemprop="description">' . h($p['generated_excerpt'] ?: mb_substr($p['generated_body'] ?? '', 0, 200)) . '</p>' . "\n";
    
    if (!empty($p['source_url'])) {
        $out .= '  <a class="source-link" href="' . h($p['source_url']) . '" target="_blank" rel="noopener">Vedi il contenuto originale su ' . h($p['platform']) . '</a>' . "\n";
    }
    if (!empty($p['tags'])) {
        $out .= '  <div class="tags">';
        foreach ($p['tags'] as $tag) {
            $out .= '<span class="tag">' . h($tag) . '</span>';
        }
        $out .= '</div>' . "\n";
    }
    $out .= '  <meta itemprop="datePublished" content="' . h($p['published_at'] ?? '') . '">' . "\n";
    $out .= '</article>' . "\n";
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
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
    :root {
      --accent: <?= $accentColor ?: '#7F77DD' ?>;
      --bg: #FAFAFA;
      --text: #1a1a24;
      --card-bg: rgba(255, 255, 255, 0.85);
      --border: rgba(0, 0, 0, 0.05);
      --font-main: 'Outfit', system-ui, -apple-system, sans-serif;
    }
    <?= $customCss ?>
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-main); background: var(--bg); color: var(--text); line-height: 1.6; overflow-x: hidden; }
    a { color: var(--accent); text-decoration: none; transition: all 0.3s ease; }
    
    /* NAV / HEADER */
    .navbar { position: sticky; top: 0; z-index: 1000; background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); transition: all 0.3s ease; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
    .nav-brand { display: flex; align-items: center; gap: 1rem; font-weight: 700; font-size: 1.25rem; color: var(--text); letter-spacing: -0.5px;}
    .nav-brand img { height: 40px; border-radius: 8px; }
    .nav-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: bold; }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--text); font-weight: 500; font-size: 0.95rem; }
    .nav-links a:hover { color: var(--accent); }
    
    /* HERO */
    .hero { position: relative; width: 100%; min-height: 50vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4rem 1rem; overflow: hidden; }
    .hero-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -2; background: linear-gradient(135deg, rgba(127,119,221,0.08) 0%, rgba(250,250,250,1) 100%); }
    <?php if ($coverUrl): ?>
    .hero-bg { background: url('<?= h($coverUrl) ?>') center/cover no-repeat; }
    .hero-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background: linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(250,250,250,1)); }
    .hero { color: #fff; }
    .hero .bio, .hero .mission { color: rgba(255,255,255,0.9); }
    <?php else: ?>
    .hero-blob { position: absolute; top: -50%; left: -10%; width: 50vw; height: 50vw; border-radius: 50%; background: var(--accent); opacity: 0.08; filter: blur(80px); z-index: -1; animation: float 10s infinite ease-in-out alternate; }
    .hero-blob2 { position: absolute; bottom: -50%; right: -10%; width: 40vw; height: 40vw; border-radius: 50%; background: var(--accent); opacity: 0.06; filter: blur(60px); z-index: -1; animation: float 8s infinite ease-in-out alternate-reverse; }
    <?php endif; ?>
    @keyframes float { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(30px, 50px) scale(1.1); } }
    
    .hero-content { max-width: 800px; z-index: 1; animation: fadeInUp 1s cubic-bezier(0.16, 1, 0.3, 1); }
    .hero h1 { font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 700; margin-bottom: 1rem; line-height: 1.1; letter-spacing: -0.02em; }
    .hero .bio { font-size: 1.25rem; margin-bottom: 1rem; font-weight: 300; opacity: 0.9; }
    .hero .mission { font-size: 1rem; max-width: 600px; margin: 0 auto; opacity: 0.8; }
    
    /* SOCIALS */
    .socials { display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 2rem; }
    .social-link { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; border-radius: 50px; background: rgba(255,255,255,0.5); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.5); color: var(--text); font-weight: 500; font-size: 0.9rem; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
    .social-link:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); background: #fff; }
    <?php if ($coverUrl): ?>
    .social-link { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2); color: #fff; }
    .social-link:hover { background: var(--accent); border-color: var(--accent); color: #fff; }
    <?php endif; ?>

    /* CONTAINER */
    .container { max-width: 1000px; margin: 0 auto; padding: 4rem 1.5rem; }
    
    /* FILTERS */
    .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 3rem; justify-content: center; }
    .filter-btn { background: transparent; border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 50px; font-size: 0.9rem; font-weight: 500; cursor: pointer; color: var(--text); transition: all 0.3s ease; font-family: var(--font-main); }
    .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
    .filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); box-shadow: 0 4px 15px rgba(0,0,0,0.15); }
    
    /* GRID */
    .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem; }
    .theme-journal .post-grid { grid-template-columns: 1fr; max-width: 760px; margin: 0 auto; }
    
    /* POST CARD */
    .post { background: var(--card-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); opacity: 0; transform: translateY(30px); }
    .post.visible { opacity: 1; transform: translateY(0); }
    .post:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.1); }
    .post h2 { font-size: 1.35rem; font-weight: 600; margin-bottom: 0.75rem; line-height: 1.3; }
    .post h2 a { color: var(--text); }
    .post h2 a:hover { color: var(--accent); }
    
    .meta { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; font-size: 0.85rem; color: #777; font-weight: 500; }
    .badge { background: rgba(127,119,221,0.1); color: var(--accent); padding: 0.2rem 0.8rem; border-radius: 50px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .excerpt { color: #555; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    
    /* MEDIA */
    .media { margin: -1.5rem -1.5rem 1.5rem -1.5rem; overflow: hidden; border-radius: 20px 20px 0 0; }
    .theme-journal .media { margin: 1.5rem 0; border-radius: 12px; }
    .media img, .media video { width: 100%; display: block; object-fit: cover; aspect-ratio: 16/9; transition: transform 0.5s ease; }
    .post:hover .media img { transform: scale(1.03); }
    .media iframe { width: 100%; aspect-ratio: 16/9; border: 0; display: block; }
    
    /* TAGS */
    .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: auto; }
    .tag { font-size: 0.75rem; font-weight: 500; color: #666; background: rgba(0,0,0,0.04); padding: 0.3rem 0.8rem; border-radius: 50px; transition: all 0.2s; }
    .tag:hover { background: rgba(0,0,0,0.08); }
    
    .source-link { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; font-size: 0.9rem; font-weight: 600; }
    .source-link::after { content: '→'; transition: transform 0.2s; }
    .source-link:hover::after { transform: translateX(4px); }
    
    /* SINGLE POST */
    .single-post { max-width: 800px; margin: 0 auto; background: var(--card-bg); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 24px; padding: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.03); animation: fadeInUp 0.8s ease forwards; }
    .single-post .media { margin: -3rem -3rem 2rem -3rem; border-radius: 24px 24px 0 0; }
    .single-post h1 { font-size: 2.5rem; margin-bottom: 1.5rem; line-height: 1.2; }
    .body-content { font-size: 1.1rem; color: #444; line-height: 1.8; }
    .body-content p { margin-bottom: 1.5rem; }
    .back-btn { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem; font-weight: 600; color: #666; }
    .back-btn:hover { color: var(--accent); }
    
    /* FOOTER */
    .footer { background: #111; color: #fff; padding: 5rem 1.5rem 3rem; margin-top: 4rem; text-align: center; }
    .footer-content { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2rem; }
    .footer-logo { font-size: 1.5rem; font-weight: 700; color: #fff; }
    .footer-text { max-width: 500px; color: #999; font-size: 0.95rem; }
    .footer-socials { display: flex; gap: 1rem; }
    .footer-socials a { color: #fff; background: rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s; text-decoration: none;}
    .footer-socials a:hover { background: var(--accent); transform: translateY(-3px); }
    .footer-bottom { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.1); color: #666; font-size: 0.85rem; width: 100%; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; }
    .footer-bottom a { color: #999; }
    .footer-bottom a:hover { color: #fff; }
    
    /* ANIMATIONS */
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    .post.hidden { display: none !important; }
    
    @media (max-width: 768px) {
      .hero { min-height: 40vh; padding: 3rem 1rem; }
      .hero h1 { font-size: 2.2rem; }
      .single-post { padding: 1.5rem; }
      .single-post .media { margin: -1.5rem -1.5rem 1.5rem -1.5rem; }
      .nav-links { display: none; /* simple mobile approach for now */ }
      .footer-bottom { flex-direction: column; gap: 1rem; text-align: center; }
    }
  </style>
</head>
<body class="theme-<?= h($theme) ?>">

<!-- NAVBAR -->
<nav class="navbar">
  <a href="<?= $siteUrl ?>" class="nav-brand">
    <?php if ($logoUrl): ?>
      <img src="<?= h($logoUrl) ?>" alt="Logo">
    <?php else: ?>
      <div class="nav-avatar"><?= mb_strtoupper(mb_substr($title, 0, 1)) ?></div>
      <?= h($title) ?>
    <?php endif; ?>
  </a>
  <?php if ($menuLinks): ?>
  <div class="nav-links">
    <?php foreach ($menuLinks as $link): ?>
      <a href="<?= h($link['url']) ?>"><?= h($link['label']) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</nav>

<!-- HERO -->
<?php if (!$single): ?>
<header class="hero">
  <div class="hero-bg"></div>
  <?php if ($coverUrl): ?><div class="hero-overlay"></div><?php else: ?>
  <div class="hero-blob"></div><div class="hero-blob2"></div>
  <?php endif; ?>
  
  <div class="hero-content">
    <h1><?= $title ?></h1>
    <?php if ($bio): ?><p class="bio"><?= $bio ?></p><?php endif; ?>
    <?php if (!empty($site['role_mission'])): ?><p class="mission"><?= h($site['role_mission']) ?></p><?php endif; ?>
    
    <?php if ($sources): ?>
    <div class="socials">
      <?php foreach ($sources as $source): ?>
        <a class="social-link" href="<?= h($source['url']) ?>" target="_blank" rel="noopener">
          <?= $icons[$source['platform']] ?? '🔗' ?> <?= h($source['label'] ?: ucfirst($source['platform'])) ?>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
  </div>
</header>
<?php endif; ?>

<main class="container">
  <?php if ($single): $p = $single; ?>
  <a class="back-btn" href="<?= $siteUrl ?>">← Torna ai contenuti</a>
  <article class="single-post" itemscope itemtype="https://schema.org/Article">
    <?= mediaHtml($p) ?>
    <div class="meta">
      <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
      <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
      <?php if (strtoupper($p['media_type']) === 'VIDEO'): ?><span class="badge">Video → Testo</span><?php endif; ?>
    </div>
    <h1 itemprop="headline"><?= h($p['generated_title'] ?: mb_substr($p['raw_content'] ?? '', 0, 80)) ?></h1>
    
    <div class="body-content" itemprop="articleBody">
      <?= bodyHtml($p['generated_body'] ?: ($p['transcript'] ?: $p['raw_content'] ?? '')) ?>
    </div>
    
    <?php if (!empty($p['source_url'])): ?>
    <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">
      Vedi il post originale su <?= h($p['platform']) ?>
    </a>
    <?php endif; ?>
    
    <?php if ($p['tags']): ?>
    <div class="tags" style="margin-top:2rem;">
      <?php foreach ($p['tags'] as $tag): ?><span class="tag">#<?= h($tag) ?></span><?php endforeach; ?>
    </div>
    <?php endif; ?>
  </article>

  <?php else: ?>
  
  <?php
    $allPlatforms = array_unique(array_column($posts, 'platform'));
    $allTags = [];
    foreach ($posts as $p) {
        if (!empty($p['tags'])) {
            foreach ($p['tags'] as $t) { $allTags[] = strtolower(trim($t)); }
        }
    }
    $allTags = array_unique($allTags);
    sort($allPlatforms); sort($allTags);
  ?>
  
  <?php if ($posts): ?>
  <div class="filters" id="post-filters">
    <button class="filter-btn active" data-filter="all">Tutti</button>
    <?php foreach ($allPlatforms as $pf): ?>
      <button class="filter-btn" data-filter="platform-<?= h($pf) ?>"><?= $icons[$pf] ?? '' ?> <?= h(ucfirst($pf)) ?></button>
    <?php endforeach; ?>
    <?php foreach ($allTags as $tag): ?>
      <button class="filter-btn" data-filter="tag-<?= h($tag) ?>">#<?= h($tag) ?></button>
    <?php endforeach; ?>
  </div>
  
  <section class="post-grid" aria-label="Contenuti pubblicati">
    <?php foreach ($posts as $p): echo renderPostHtml($p, $siteUrl, $icons); endforeach; ?>
  </section>
  <?php else: ?>
  <div style="text-align:center;color:#999;padding:5rem 1rem;">
    <div style="font-size:4rem;margin-bottom:1rem;opacity:0.5;">✨</div>
    <p style="font-size:1.2rem;">Il sito è pronto. In attesa di pubblicare nuovi contenuti.</p>
  </div>
  <?php endif; ?>
  
  <?php endif; ?>
</main>

<footer class="footer">
  <div class="footer-content">
    <div class="footer-logo"><?= $logoUrl ? '<img src="'.h($logoUrl).'" height="40" alt="Logo">' : h($title) ?></div>
    
    <?php if ($footerText): ?>
      <p class="footer-text"><?= h($footerText) ?></p>
    <?php else: ?>
      <p class="footer-text"><?= h($site['role_mission'] ?? $bio) ?></p>
    <?php endif; ?>
    
    <?php if ($sources): ?>
    <div class="footer-socials">
      <?php foreach ($sources as $source): ?>
        <a href="<?= h($source['url']) ?>" target="_blank" aria-label="<?= h($source['platform']) ?>" title="<?= h($source['platform']) ?>">
          <?= $icons[$source['platform']] ?? '🔗' ?>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
    
    <div class="footer-bottom">
      <div>
        &copy; <?= date('Y') ?> <?= h($title) ?>. Tutti i diritti riservati. <br>
        <span style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem; display: block;">
          Creato magicamente con <a href="<?= BASE_URL ?>" style="color:var(--accent); font-weight:600;">SocialToSite</a>
        </span>
      </div>
      <div>
        <a href="<?= $siteUrl ?>/sitemap.xml">Sitemap XML</a>
      </div>
    </div>
  </div>
</footer>

<script>
document.addEventListener('DOMContentLoaded', () => {
  // Intersection Observer per animazioni fluide allo scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });
  
  document.querySelectorAll('.post').forEach(post => {
    observer.observe(post);
  });

  // Filtri
  const filters = document.getElementById('post-filters');
  if (filters) {
    const btns = filters.querySelectorAll('.filter-btn');
    const posts = document.querySelectorAll('.post-grid .post');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.getAttribute('data-filter');
        posts.forEach(post => {
          if (filter === 'all') {
            post.classList.remove('hidden');
          } else if (filter.startsWith('platform-')) {
            post.classList.toggle('hidden', post.getAttribute('data-platform') !== filter);
          } else if (filter.startsWith('tag-')) {
            const tags = post.getAttribute('data-tags').split(' ');
            post.classList.toggle('hidden', !tags.includes(filter));
          }
          // Ritriggera l'animazione se diviene visibile
          if (!post.classList.contains('hidden')) {
            post.classList.remove('visible');
            setTimeout(() => post.classList.add('visible'), 50);
          }
        });
      });
    });
  }
});
</script>
</body>
</html>
