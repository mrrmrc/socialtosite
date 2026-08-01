<?php
// public/site.php — Pagina pubblica HTML del sito generato
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$slug   = $_GET['slug']   ?? '';
$action = $_GET['action'] ?? 'site';

if (!$slug) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$user = DB::fetch('SELECT * FROM users WHERE slug=?', [$slug]);
if (!$user) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$user['id']]);
if (!$site) $site = []; // Fallback sicuro: evita crash su array access
$sources = DB::fetchAll(
    'SELECT platform, label, url FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
    [$user['id']]
);
$posts = DB::fetchAll(
    'SELECT * FROM posts WHERE user_id=? AND published=1 ORDER BY featured DESC, published_at DESC',
    [$user['id']]
);
foreach ($posts as &$p) {
    $decoded = json_decode($p['tags'] ?? '[]', true);
    if (!is_array($decoded)) {
        $decoded = is_string($p['tags']) ? explode(',', $p['tags']) : [];
    }
    $p['tags'] = array_filter(array_map('trim', $decoded));
}
unset($p);

$activeTag = strtolower(trim($_GET['tag'] ?? ''));
if ($activeTag) {
    $filtered = [];
    foreach ($posts as $p) {
        $pTags = array_map('strtolower', $p['tags'] ?? []);
        if (in_array($activeTag, $pTags, true)) {
            $filtered[] = $p;
        }
    }
    $posts = $filtered;
}

$postSlug = $_GET['post'] ?? '';
$single   = null;
if ($postSlug) {
    foreach ($posts as $p) { if (($p['slug'] ?? '') === $postSlug) { $single = $p; break; } }
}

// ── Sitemap XML ─────────────────────────────────────────────────────────────
if ($action === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    $base = BASE_URL . '/' . $slug;
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo "  <url><loc>$base</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n";
    
    // Tag/Categories
    $tagCounts = [];
    foreach ($posts as $p) {
        foreach ($p['tags'] ?? [] as $t) {
            $key = strtolower(trim($t));
            if ($key !== '') $tagCounts[$key] = ($tagCounts[$key] ?? 0) + 1;
        }
    }
    $validTags = array_keys($tagCounts);
    foreach ($validTags as $t) {
        $loc = "$base/?tag=" . urlencode($t);
        echo "  <url><loc>" . htmlspecialchars($loc, ENT_XML1, 'UTF-8') . "</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n";
    }

    // Posts
    foreach ($posts as $p) {
        $loc = "$base/{$p['slug']}";
        $mod = substr($p['published_at'] ?? $p['imported_at'] ?? '', 0, 10);
        echo "  <url><loc>$loc</loc><lastmod>$mod</lastmod><priority>0.8</priority></url>\n";
    }
    echo '</urlset>';
    exit;
}

// ── RSS / Atom Feed ─────────────────────────────────────────────────────────
if ($action === 'feed') {
    header('Content-Type: application/atom+xml; charset=utf-8');
    $base = BASE_URL . '/' . $slug;
    $titleXml = htmlspecialchars($site['title'] ?? $user['name'] ?? '', ENT_XML1, 'UTF-8');
    $bioXml = htmlspecialchars($site['profile_summary'] ?: ($site['bio'] ?? ''), ENT_XML1, 'UTF-8');
    $updated = !empty($posts) ? date(DATE_ATOM, strtotime($posts[0]['published_at'] ?? 'now')) : date(DATE_ATOM);
    
    echo '<?xml version="1.0" encoding="utf-8"?>' . "\n";
    echo '<feed xmlns="http://www.w3.org/2005/Atom">' . "\n";
    echo "  <title>$titleXml</title>\n";
    echo "  <subtitle>$bioXml</subtitle>\n";
    echo "  <link href=\"$base/feed.xml\" rel=\"self\" />\n";
    echo "  <link href=\"$base\" />\n";
    echo "  <id>$base/</id>\n";
    echo "  <updated>$updated</updated>\n";
    
    $count = 0;
    foreach ($posts as $p) {
        if ($count++ >= 50) break;
        $pUrl = "$base/{$p['slug']}";
        $pTitle = htmlspecialchars($p['edited_title'] ?: ($p['generated_title'] ?: 'Post'), ENT_XML1, 'UTF-8');
        $pDate = date(DATE_ATOM, strtotime($p['published_at'] ?? 'now'));
        $pExcerpt = htmlspecialchars($p['edited_excerpt'] ?: ($p['generated_excerpt'] ?: ''), ENT_XML1, 'UTF-8');
        $pBody = htmlspecialchars($p['edited_body'] ?: ($p['generated_body'] ?: ($p['transcript'] ?: $p['raw_content'] ?? '')), ENT_XML1, 'UTF-8');
        
        echo "  <entry>\n";
        echo "    <title>$pTitle</title>\n";
        echo "    <link href=\"$pUrl\" />\n";
        echo "    <id>$pUrl</id>\n";
        echo "    <updated>$pDate</updated>\n";
        echo "    <summary>$pExcerpt</summary>\n";
        echo "    <content type=\"html\"><![CDATA[" . nl2br($pBody) . "]]></content>\n";
        if (!empty($p['media_url'])) {
            $mUrl = htmlspecialchars($p['media_url'], ENT_XML1, 'UTF-8');
            $mType = strtolower($p['media_type'] ?? '') === 'video' ? 'video/mp4' : 'image/jpeg';
            echo "    <link rel=\"enclosure\" href=\"$mUrl\" type=\"$mType\" />\n";
        }
        echo "  </entry>\n";
    }
    echo '</feed>';
    exit;
}

// ── llms.txt (AI Discoverability) ───────────────────────────────────────────
if ($action === 'llms') {
    header('Content-Type: text/plain; charset=utf-8');
    $base = BASE_URL . '/' . $slug;
    $titlePlain = $site['title'] ?? $user['name'] ?? '';
    $bioPlain = $site['profile_summary'] ?: ($site['bio'] ?? '');
    
    echo "# $titlePlain\n\n";
    if ($bioPlain) echo "> $bioPlain\n\n";
    echo "This is a curated personal website aggregating content from various social platforms.\n\n";
    
    echo "## Categories (Tags)\n";
    $tagCounts = [];
    foreach ($posts as $p) {
        foreach ($p['tags'] ?? [] as $t) {
            $key = strtolower(trim($t));
            if ($key !== '') $tagCounts[$key] = ($tagCounts[$key] ?? 0) + 1;
        }
    }
    arsort($tagCounts);
    foreach (array_slice(array_keys($tagCounts), 0, 10) as $t) {
        echo "- [$t]($base/?tag=" . urlencode($t) . ")\n";
    }
    echo "\n## Recent Content\n";
    $count = 0;
    foreach ($posts as $p) {
        if ($count++ >= 30) break;
        $pUrl = "$base/{$p['slug']}";
        $pTitle = $p['edited_title'] ?: ($p['generated_title'] ?: 'Post');
        $pExcerpt = $p['edited_excerpt'] ?: ($p['generated_excerpt'] ?: '');
        $pDate = $p['published_at'] ? substr($p['published_at'], 0, 10) : '';
        echo "- [$pTitle]($pUrl)";
        if ($pDate) echo " ($pDate)";
        echo "\n";
        if ($pExcerpt) echo "  $pExcerpt\n";
    }
    exit;
}

// ── Variabili base ───────────────────────────────────────────────────────────
function h(?string $s): string { return htmlspecialchars(html_entity_decode((string)$s, ENT_QUOTES, 'UTF-8'), ENT_QUOTES, 'UTF-8'); }

function normalizeMediaUrl(?string $url): string {
    $url = trim((string)$url);
    if ($url === '') return '';
    if (strpos($url, '/public/media/') !== false) {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $name = basename($path);
        if ($name === '' || $name === '.' || $name === '..') return '';
        $localPath = __DIR__ . '/media/' . $name;
        if (!file_exists($localPath)) return '';
        return rtrim(BASE_URL, '/') . '/public/media/' . $name;
    }
    return $url;
}

$title      = h($site['title'] ?? $user['name'] ?? '');
$bio        = h(($site['profile_summary'] ?? '') ?: ($site['bio'] ?? ''));
$siteUrl    = BASE_URL . '/' . $slug;
$validThemes = ['classic', 'authority', 'portfolio', 'magazine', 'brutalist', 'ecommerce', 'wedding', 'fitness', 'restaurant', 'agency', 'zen', 'vaporwave', 'realestate', 'blogger', 'darkphoto', 'medical', 'education', 'gamer', 'startup', 'lawyer'];
$theme      = $site['theme'] ?? 'classic';
if (!in_array($theme, $validThemes, true)) {
    $theme = 'classic';
}
$archetype  = $site['design_archetype'] ?? $theme;

$icons      = ['instagram' => '📸', 'tiktok' => '🎵', 'youtube' => '▶️', 'facebook' => '📘', 'website' => '🌐'];

$menuLinks    = !empty($site['menu_links']) ? json_decode($site['menu_links'], true) : [];
$accentColor  = $site['accent_color'] ?? '';
$accentSecondary = $site['accent_secondary'] ?? $site['accent_color'] ?? '';
$logoUrl      = normalizeMediaUrl($site['logo_url'] ?? '');
$coverUrl     = normalizeMediaUrl($site['cover_url'] ?? '');

foreach ($posts as &$p) {
    $p['media_url'] = normalizeMediaUrl($p['media_url'] ?? '');
}
unset($p);
if ($single) {
    $single['media_url'] = normalizeMediaUrl($single['media_url'] ?? '');
}

// ── Raccogli tutti i tag reali dei post pubblicati (con conteggio) ───────
$tagCounts = [];
foreach ($posts as $p) {
    foreach ($p['tags'] ?? [] as $t) {
        $key = strtolower(trim($t));
        if ($key !== '') $tagCounts[$key] = ($tagCounts[$key] ?? 0) + 1;
    }
}
$validMenuTags = array_keys($tagCounts);

// ── Sicurezza Menu: rimuovi link rotti che non puntano a nulla ──────────
$safeMenuLinks = [];
if (is_array($menuLinks)) {
    foreach ($menuLinks as $link) {
        $url = trim($link['url'] ?? '');
        if ($url === '/' || $url === '') { $safeMenuLinks[] = $link; continue; }
        if (preg_match('/[?&]tag=([^&]+)/i', $url, $m)) {
            $tagVal = strtolower(trim(urldecode($m[1])));
            if (in_array($tagVal, $validMenuTags, true)) $safeMenuLinks[] = $link;
            continue;
        }
        if (preg_match('/^https?:\/\//i', $url)) { $safeMenuLinks[] = $link; continue; }
    }
}
$menuLinks = $safeMenuLinks;

// ── FALLBACK: se il menu è vuoto, genera automaticamente dai top tag ────
if (empty($menuLinks) && !empty($tagCounts)) {
    $menuLinks = [['label' => 'Home', 'url' => '/']];
    arsort($tagCounts);
    $topTags = array_slice(array_keys($tagCounts), 0, 4);
    foreach ($topTags as $tag) {
        $menuLinks[] = ['label' => ucfirst($tag), 'url' => '/?tag=' . urlencode($tag)];
    }
}
$footerText   = $site['footer_text'] ?? '';
$customCss    = $site['custom_css'] ?? '';
$heroTagline  = h($site['hero_tagline'] ?? '');
$ctaText      = h(($site['cta_text'] ?? '') ?: 'Scopri i contenuti');

// ── Dati AI dinamici (site_ai_data) ───────────
$aiData = !empty($site['site_ai_data']) ? json_decode($site['site_ai_data'], true) : [];
if (!is_array($aiData)) $aiData = [];
$fontHeading = $aiData['font_heading'] ?? 'Inter';
$fontBody    = $aiData['font_body'] ?? 'Inter';
$palette     = $aiData['color_palette'] ?? [];
$uiStyle     = $aiData['ui_style'] ?? [];
$layoutRecipe = $aiData['layout_recipe'] ?? [];
$baseModels   = $aiData['base_models'] ?? [];
if (!is_array($palette)) $palette = [];
if (!is_array($uiStyle)) $uiStyle = [];
if (!is_array($layoutRecipe)) $layoutRecipe = [];
if (!is_array($baseModels)) $baseModels = is_string($baseModels) && $baseModels !== '' ? [$baseModels] : [];
if (!isset($palette['background']) && isset($palette['bg'])) $palette['background'] = $palette['bg'];
if (!isset($palette['secondary']) && isset($palette['surface'])) $palette['secondary'] = $palette['surface'];

$palPrimary   = $palette['primary']   ?? $accentColor ?: '#7F77DD';
$palSecondary = $palette['secondary'] ?? '#5C54C4';
$palBg        = $palette['background']?? '#FAFAFA';
$palSurface   = $palette['surface']   ?? '#FFFFFF';
$palText      = $palette['text']      ?? '#1a1a24';

// ── Override per Anteprima (preview_theme oppure preview_index) ──────────────
if (isset($_GET['preview_theme'])) {
    $archetype = $_GET['preview_theme'];
    $customCss = '';
    $accentColor = '';
}
if (isset($_GET['preview_index']) && !empty($site['generated_layouts'])) {
    $idx = (int)$_GET['preview_index'];
    $layouts = json_decode($site['generated_layouts'], true);
    if (is_array($layouts) && isset($layouts[$idx])) {
        $p2 = $layouts[$idx];
        $archetype    = $p2['design_archetype'] ?? $archetype;
        $accentColor  = $p2['color_palette']['primary'] ?? $p2['accent_color'] ?? $accentColor;
        $customCss    = $p2['custom_css'] ?? $customCss;
        if (isset($p2['font_heading'])) $fontHeading = $p2['font_heading'];
        if (isset($p2['font_body'])) $fontBody = $p2['font_body'];
        if (isset($p2['color_palette'])) $palette = $p2['color_palette'];
        if (isset($p2['ui_style']) && is_array($p2['ui_style'])) $uiStyle = $p2['ui_style'];
        if (isset($p2['layout_recipe']) && is_array($p2['layout_recipe'])) $layoutRecipe = $p2['layout_recipe'];
        if (isset($p2['base_models'])) $baseModels = is_array($p2['base_models']) ? $p2['base_models'] : [$p2['base_models']];
        if (!isset($palette['background']) && isset($palette['bg'])) $palette['background'] = $palette['bg'];
        if (!isset($palette['secondary']) && isset($palette['surface'])) $palette['secondary'] = $palette['surface'];
    }
}

$palPrimary   = $palette['primary']   ?? $accentColor ?: '#7F77DD';
$palSecondary = $palette['secondary'] ?? '#5C54C4';
$palBg        = $palette['background']?? '#FAFAFA';
$palSurface   = $palette['surface']   ?? '#FFFFFF';
$palText      = $palette['text']      ?? '#1a1a24';
$heroMode     = $layoutRecipe['hero'] ?? '';
$navMode      = $layoutRecipe['nav'] ?? '';
$cardsMode    = $layoutRecipe['cards'] ?? '';
$densityMode  = $layoutRecipe['density'] ?? '';
$primaryModel = $baseModels[0] ?? '';
$secondaryModel = $baseModels[1] ?? '';

if ($heroMode === '' || $navMode === '' || $cardsMode === '' || $densityMode === '') {
    switch ($primaryModel) {
        case 'neo-brutal-pop':
            $heroMode = $heroMode ?: 'split';
            $navMode = $navMode ?: 'solid';
            $cardsMode = $cardsMode ?: 'bold';
            $densityMode = $densityMode ?: 'balanced';
            break;
        case 'dark-cinematic':
            $heroMode = $heroMode ?: 'immersive';
            $navMode = $navMode ?: 'transparent';
            $cardsMode = $cardsMode ?: 'cinematic';
            $densityMode = $densityMode ?: 'airy';
            break;
        case 'warm-humanist':
            $heroMode = $heroMode ?: 'human';
            $navMode = $navMode ?: 'floating';
            $cardsMode = $cardsMode ?: 'soft';
            $densityMode = $densityMode ?: 'airy';
            break;
        case 'tech-clarity':
            $heroMode = $heroMode ?: 'product';
            $navMode = $navMode ?: 'solid';
            $cardsMode = $cardsMode ?: 'product';
            $densityMode = $densityMode ?: 'balanced';
            break;
        default:
            $heroMode = $heroMode ?: 'editorial';
            $navMode = $navMode ?: 'transparent';
            $cardsMode = $cardsMode ?: 'editorial';
            $densityMode = $densityMode ?: 'airy';
            break;
    }
}

$radius = $uiStyle['radius'] ?? ($primaryModel === 'neo-brutal-pop' ? '8px' : ($primaryModel === 'warm-humanist' ? '24px' : '18px'));
$cardShadow = $uiStyle['card_shadow'] ?? ($primaryModel === 'dark-cinematic' ? '0 20px 60px rgba(0,0,0,0.28)' : '0 12px 40px rgba(0,0,0,0.08)');
$glassmorphism = !empty($uiStyle['glassmorphism']);
$contentWidth = $densityMode === 'compact' ? '1040px' : ($densityMode === 'balanced' ? '1160px' : '1240px');
$heroPadding = $densityMode === 'compact' ? '6rem 1.5rem 4rem' : ($densityMode === 'balanced' ? '7rem 1.5rem 5rem' : '9rem 1.5rem 6rem');
$gridMin = $cardsMode === 'cinematic' ? '360px' : ($cardsMode === 'product' ? '300px' : '320px');

// ── Post per lo Slider (Top 3) ───────────────────────────────────────────────
$sliderPosts = [];
// 1. Prendi i featured (fino a 3)
foreach ($posts as $p) {
    if (!empty($p['featured']) && count($sliderPosts) < 3) $sliderPosts[] = $p;
}
// 2. Riempi con quelli che hanno media (fino a 3 totali)
foreach ($posts as $p) {
    if (count($sliderPosts) >= 3) break;
    if (empty($p['featured']) && !empty($p['media_url'])) $sliderPosts[] = $p;
}
// 3. Fallback: post recenti senza media
if (count($sliderPosts) === 0) {
    $sliderPosts = array_slice($posts, 0, 3);
}

$sliderIds = array_column($sliderPosts, 'id');

// ── Topic (Categorie per Home Page) ──────────────────────────────────────────
$topTags = array_slice(array_keys($tagCounts), 0, 4); // Prendi i primi 4 tag
$postsByTopic = [];
$usedPostIds = $sliderIds; // non duplicare i post dello slider

foreach ($topTags as $tag) {
    $topicPosts = [];
    foreach ($posts as $p) {
        if (!in_array($p['id'], $usedPostIds) && in_array(strtolower(trim($tag)), array_map('strtolower', $p['tags'] ?? []))) {
            $topicPosts[] = $p;
            $usedPostIds[] = $p['id'];
            if (count($topicPosts) >= 4) break; // Max 4 post per topic in home
        }
    }
    if (count($topicPosts) > 0) {
        $postsByTopic[$tag] = $topicPosts;
    }
}

// ── Gli altri post (Ultimi Arrivi) ──────────────────────────────────────────
$recentPosts = [];
foreach ($posts as $p) {
    if (!in_array($p['id'], $usedPostIds)) {
        $recentPosts[] = $p;
    }
}

// Helper per titolo/body effettivi (usa edited_ se presente)
function postTitle(array $p): string {
    return $p['edited_title'] ?: ($p['generated_title'] ?: mb_substr($p['raw_content'] ?? '', 0, 80));
}
function postExcerpt(array $p): string {
    return $p['edited_excerpt'] ?: ($p['generated_excerpt'] ?: mb_substr($p['generated_body'] ?? '', 0, 200));
}
function postBody(array $p): string {
    return $p['edited_body'] ?: ($p['generated_body'] ?: ($p['transcript'] ?: $p['raw_content'] ?? ''));
}

// ── Media embed ──────────────────────────────────────────────────────────────
function mediaHtml(array $p): string {
    $u = $p['media_url'] ?? '';
    if (!$u) return '';
    if (preg_match('~(?:youtube\.com|youtu\.be)~i', $u) &&
        preg_match('~(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})~', $u, $m)) {
        return '<div class="media"><iframe src="https://www.youtube.com/embed/' . $m[1] . '" allowfullscreen loading="lazy"></iframe></div>';
    }
    $type = strtolower($p['media_type'] ?? '');
    if ($type === 'image' || preg_match('~\.(jpg|jpeg|png|webp)(\?|$)~i', $u))
        return '<div class="media"><img src="' . h($u) . '" alt="" loading="lazy"></div>';
    if ($type === 'video' || preg_match('~\.(mp4|mov|webm)(\?|$)~i', $u))
        return '<div class="media"><video controls preload="metadata"><source src="' . h($u) . '"></video></div>';
    return '';
}

function bodyHtml(?string $b): string {
    $b = trim((string)$b);
    if ($b === '') return '';
    // Se il testo contiene tag HTML comuni (p, br, table, div, strong, h2, h3), lo riteniamo HTML pre-formattato
    if (preg_match('/<(p|br|table|tr|td|th|div|strong|em|h2|h3|h4|ul|ol|li)[^>]*>/i', $b)) {
        return $b;
    }
    $out = '';
    foreach (preg_split('/\n{2,}/', $b) as $para) {
        $para = trim($para);
        if ($para !== '') $out .= '<p>' . nl2br(h($para)) . '</p>';
    }
    return $out;
}

// ── CSS temi ─────────────────────────────────────────────────────────────────
$accent = $accentColor ?: '#7F77DD';
$accent2 = $accentSecondary ?: '';

$themeCSS = [

'classic' => "
  /* CORPORATE / APPLE-LIKE */
  :root { --accent:#$accent; --bg:#FBFBFD; --text:#1D1D1F; --card-bg:#FFFFFF; --border:rgba(0,0,0,0.04); --radius:24px; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); letter-spacing:-0.01em; }
  .navbar { background:rgba(251,251,253,0.8); backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px); border-bottom:1px solid var(--border); padding:1rem 2rem; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; transition:all 0.3s; }
  .nav-brand { font-weight:700; font-size:1.2rem; color:var(--text); display:flex; align-items:center; gap:0.75rem; letter-spacing:-0.03em; }
  .nav-links { display:flex; gap:2rem; } .nav-links a { color:#515154; font-size:0.9rem; font-weight:500; transition:color 0.2s; }
  .nav-links a:hover { color:var(--text); }
  .hero { padding:8rem 1.5rem 6rem; text-align:center; background:radial-gradient(ellipse at top, #FFFFFF 0%, #FBFBFD 80%); }
  .hero h1 { font-size:clamp(3rem,6vw,5rem); font-weight:700; letter-spacing:-0.04em; margin-bottom:1.5rem; line-height:1.05; }
  .hero .bio { font-size:1.25rem; color:#86868B; max-width:650px; margin:0 auto; line-height:1.6; font-weight:400; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:2rem; padding:2rem 0; }
  .post { background:var(--card-bg); border-radius:var(--radius); padding:2rem; transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow:0 10px 40px rgba(0,0,0,0.03); border:1px solid rgba(0,0,0,0.02); display:flex; flex-direction:column; }
  .post:hover { transform:scale(1.02) translateY(-5px); box-shadow:0 20px 60px rgba(0,0,0,0.08); }
  .post h2 { font-size:1.4rem; font-weight:600; line-height:1.3; margin-bottom:0.75rem; letter-spacing:-0.02em; }
  .post h2 a { color:var(--text); transition:color 0.2s; } .post h2 a:hover { color:var(--accent); }
  .post .media { margin:-2rem -2rem 1.5rem -2rem; border-radius:var(--radius) var(--radius) 0 0; overflow:hidden; }
  .post .media img { width:100%; height:240px; object-fit:cover; transition:transform 0.5s ease; }
  .post:hover .media img { transform:scale(1.05); }
",

'authority' => "
  /* TECH / NEON */
  :root { --accent:#$accent; --bg:#09090B; --text:#FAFAFA; --card-bg:rgba(255,255,255,0.03); --border:rgba(255,255,255,0.08); --radius:16px; }
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  body { font-family:'Plus Jakarta Sans',sans-serif; background:var(--bg); color:var(--text); overflow-x:hidden; }
  .navbar { background:rgba(9,9,11,0.7); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border-bottom:1px solid var(--border); padding:1.25rem 2rem; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; }
  .nav-brand { font-weight:800; font-size:1.2rem; color:#fff; letter-spacing:-0.03em; }
  .hero { padding:9rem 1.5rem 6rem; text-align:center; position:relative; }
  .hero::before { content:''; position:absolute; top:-20%; left:50%; transform:translateX(-50%); width:600px; height:600px; background:radial-gradient(circle, var(--accent) 0%, transparent 60%); opacity:0.15; filter:blur(60px); z-index:-1; }
  .hero h1 { font-size:clamp(3rem,7vw,6rem); font-weight:800; letter-spacing:-0.04em; background:linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.5) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:1.5rem; line-height:1; }
  .hero .bio { font-size:1.2rem; color:rgba(255,255,255,0.6); max-width:640px; margin:0 auto; line-height:1.6; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(350px,1fr)); gap:1.5rem; padding:2rem 0; }
  .post { background:var(--card-bg); border:1px solid var(--border); border-radius:var(--radius); padding:2rem; backdrop-filter:blur(10px); transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position:relative; overflow:hidden; }
  .post::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--accent); opacity:0; transition:opacity 0.3s; }
  .post:hover { border-color:rgba(255,255,255,0.2); transform:translateY(-5px); box-shadow:0 20px 40px rgba(0,0,0,0.5); }
  .post:hover::before { opacity:1; }
  .post h2 { font-size:1.5rem; font-weight:700; margin-bottom:1rem; line-height:1.3; letter-spacing:-0.02em; }
  .post h2 a { color:#fff; } .post h2 a:hover { color:var(--accent); }
  .post .media { margin:-2rem -2rem 1.5rem -2rem; }
  .post .media img { width:100%; height:220px; object-fit:cover; filter:brightness(0.85); transition:filter 0.3s; }
  .post:hover .media img { filter:brightness(1); }
",

'portfolio' => "
  /* CREATIVE PORTFOLIO (Masonry-like) */
  :root { --accent:#$accent; --bg:#FAF9F6; --text:#1C1C1E; --card-bg:#FFFFFF; --border:rgba(0,0,0,0.06); --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500&display=swap');
  body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { padding:2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Syne',sans-serif; font-size:1.6rem; font-weight:800; text-transform:uppercase; letter-spacing:-0.04em; }
  .hero { padding:8rem 2rem 5rem; max-width:900px; }
  .hero h1 { font-family:'Syne',sans-serif; font-size:clamp(3.5rem,8vw,6.5rem); font-weight:800; line-height:0.95; letter-spacing:-0.05em; margin-bottom:2rem; text-transform:uppercase; }
  .hero .bio { font-size:1.4rem; color:#555; line-height:1.5; font-weight:400; max-width:600px; }
  .post-grid { display: block; column-count:3; column-gap:1.5rem; padding:0 1rem; }
  @media(max-width:1024px){.post-grid{column-count:2;}}
  @media(max-width:600px){.post-grid{column-count:1;}}
  .post { break-inside:avoid; margin-bottom:1.5rem; background:var(--card-bg); border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.03); transition:transform 0.4s, box-shadow 0.4s; }
  .post:hover { transform:translateY(-8px); box-shadow:0 20px 40px rgba(0,0,0,0.08); }
  .post-body { padding:1.5rem; }
  .post .media { margin:0; border-radius:0; }
  .post .media img { width:100%; height:auto; display:block; }
  .post h2 { font-family:'Syne',sans-serif; font-size:1.4rem; font-weight:700; letter-spacing:-0.02em; line-height:1.2; margin-bottom:0.75rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
",

'magazine' => "
  /* MAGAZINE PREMIUM */
  :root { --accent:#$accent; --bg:#FFFFFF; --text:#000000; --card-bg:#FFFFFF; --border:#EAEAEA; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Manrope:wght@400;500;700&display=swap');
  body { font-family:'Manrope',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { border-bottom:1px solid var(--text); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:#fff; z-index:100; }
  .nav-brand { font-family:'Cormorant Garamond',serif; font-size:2rem; font-weight:700; letter-spacing:-0.02em; text-transform:uppercase; }
  .nav-links a { font-weight:700; text-transform:uppercase; font-size:0.8rem; letter-spacing:0.05em; color:var(--text); }
  .hero { padding:4rem 2rem 3rem; text-align:center; border-bottom:1px solid var(--border); }
  .hero h1 { font-family:'Cormorant Garamond',serif; font-size:clamp(3rem,6vw,4.5rem); font-weight:700; line-height:1; }
  .hero .bio { font-size:1.1rem; color:#666; margin-top:1.5rem; max-width:600px; margin-left:auto; margin-right:auto; }
  .post-grid { display:grid; grid-template-columns:repeat(12,1fr); gap:2rem; padding:3rem 0; }
  .post { border-bottom:1px solid var(--border); padding-bottom:1.5rem; display:flex; flex-direction:column; }
  .post:nth-child(1) { grid-column:span 8; border:none; border-right:1px solid var(--border); padding-right:2rem; }
  .post:nth-child(2), .post:nth-child(3) { grid-column:span 4; }
  .post:nth-child(n+4) { grid-column:span 4; border-top:1px solid var(--border); padding-top:1.5rem; }
  @media(max-width:1024px){
    .post:nth-child(1) { grid-column:span 12; border-right:none; padding-right:0; border-bottom:1px solid var(--border); }
    .post:nth-child(2), .post:nth-child(3), .post:nth-child(n+4) { grid-column:span 6; }
  }
  @media(max-width:600px){ .post { grid-column:span 12 !important; } }
  .post h2 { font-family:'Cormorant Garamond',serif; font-size:1.8rem; font-weight:700; line-height:1.1; margin-bottom:0.75rem; }
  .post:nth-child(1) h2 { font-size:3rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .media { margin-bottom:1rem; }
  .post .media img { width:100%; height:100%; max-height:400px; object-fit:cover; filter:grayscale(20%); transition:filter 0.3s; }
  .post:hover .media img { filter:grayscale(0%); }
",

'brutalist' => "
  /* BOLD & BRUTALIST */
  :root { --accent:#$accent; --bg:#FFF300; --text:#000000; --card-bg:#FFFFFF; --border:#000000; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Space+Mono&display=swap');
  body { font-family:'Space Mono',monospace; background:var(--bg); color:var(--text); }
  .navbar { border-bottom:4px solid var(--border); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; background:#fff; }
  .nav-brand { font-family:'Anton',sans-serif; font-size:2.5rem; text-transform:uppercase; letter-spacing:1px; line-height:1; }
  .hero { padding:8rem 2rem; text-align:center; background:var(--text); color:var(--bg); border-bottom:8px solid var(--accent); }
  .hero h1 { font-family:'Anton',sans-serif; font-size:clamp(4rem,10vw,8rem); text-transform:uppercase; line-height:0.9; margin-bottom:2rem; letter-spacing:2px; }
  .hero .bio { font-size:1.5rem; max-width:800px; margin:0 auto; line-height:1.4; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:2rem; padding:3rem 1.5rem; }
  .post { background:var(--card-bg); border:4px solid var(--border); box-shadow:8px 8px 0 var(--border); padding:2rem; transition:transform 0.1s, box-shadow 0.1s; }
  .post:hover { transform:translate(4px,4px); box-shadow:4px 4px 0 var(--border); }
  .post h2 { font-family:'Anton',sans-serif; font-size:2.2rem; text-transform:uppercase; line-height:1; margin-bottom:1rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .media img { filter:contrast(150%) grayscale(100%); border:4px solid var(--border); }
",

'ecommerce' => "
  /* E-COMMERCE VIBE */
  :root { --accent:#$accent; --bg:#F4F5F7; --text:#172B4D; --card-bg:#FFFFFF; --border:rgba(9,30,66,0.13); --radius:8px; }
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
  body { font-family:'Roboto',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#fff; border-bottom:1px solid var(--border); padding:1.2rem 2rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 4px rgba(0,0,0,0.02); }
  .nav-brand { font-weight:700; font-size:1.4rem; color:var(--accent); }
  .hero { padding:4rem 2rem; text-align:center; background:#fff; margin-bottom:2rem; border-bottom:1px solid var(--border); }
  .hero h1 { font-size:clamp(2rem,4vw,3rem); font-weight:700; margin-bottom:1rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1.5rem; padding:0 1.5rem; }
  .post { background:var(--card-bg); border-radius:var(--radius); border:1px solid var(--border); overflow:hidden; transition:box-shadow 0.2s; display:flex; flex-direction:column; }
  .post:hover { box-shadow:0 8px 16px rgba(9,30,66,0.1); }
  .post .media { margin:0; border-radius:0; height:200px; }
  .post .media img { height:100%; object-fit:cover; }
  .post-body { padding:1.2rem; flex:1; display:flex; flex-direction:column; }
  .post h2 { font-size:1.1rem; font-weight:500; line-height:1.4; margin-bottom:0.5rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .excerpt { font-size:0.9rem; color:#5E6C84; margin-bottom:1rem; flex:1; }
  .post::after { content:'SCOPRI DI PIÙ'; display:block; text-align:center; background:var(--accent); color:#fff; padding:0.8rem; font-weight:700; font-size:0.85rem; margin-top:auto; cursor:pointer; }
",

'wedding' => "
  /* WEDDING / ELEGANT */
  :root { --accent:#$accent; --bg:#FDFBFA; --text:#4A403A; --card-bg:transparent; --border:rgba(74,64,58,0.1); --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@300;400&display=swap');
  body { font-family:'Montserrat',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { padding:2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Great Vibes',cursive; font-size:2.5rem; color:var(--accent); }
  .nav-links a { text-transform:uppercase; font-size:0.8rem; letter-spacing:0.1em; color:var(--text); }
  .hero { padding:6rem 2rem; text-align:center; }
  .hero h1 { font-family:'Great Vibes',cursive; font-size:clamp(4rem,8vw,6rem); color:var(--accent); margin-bottom:1rem; font-weight:400; }
  .hero .bio { font-size:1.1rem; font-weight:300; letter-spacing:0.05em; max-width:600px; margin:0 auto; line-height:1.8; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:3rem; padding:3rem 2rem; }
  .post { text-align:center; }
  .post .media img { border-radius:100rem 100rem 0 0; aspect-ratio:2/3; object-fit:cover; margin-bottom:1.5rem; border:8px solid #fff; box-shadow:0 10px 30px rgba(0,0,0,0.05); }
  .post h2 { font-family:'Great Vibes',cursive; font-size:2.2rem; font-weight:400; margin-bottom:0.5rem; }
  .post h2 a { color:var(--text); }
  .post .excerpt { font-size:0.9rem; font-weight:300; line-height:1.6; }
",

'fitness' => "
  /* FITNESS / AGGRESSIVE */
  :root { --accent:#$accent; --bg:#111111; --text:#FFFFFF; --card-bg:#1A1A1A; --border:#333333; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Barlow:wght@400;600&display=swap');
  body { font-family:'Barlow',sans-serif; background:var(--bg); color:var(--text); text-transform:uppercase; }
  .navbar { background:#000; padding:1rem 2rem; border-bottom:2px solid var(--accent); display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Oswald',sans-serif; font-size:2rem; font-weight:700; font-style:italic; color:var(--accent); letter-spacing:2px; }
  .hero { padding:8rem 2rem; text-align:center; background:linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMTExIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMzMzMiPjwvcmVjdD4KPC9zdmc+'); }
  .hero h1 { font-family:'Oswald',sans-serif; font-size:clamp(4rem,8vw,7rem); font-weight:700; font-style:italic; line-height:0.9; margin-bottom:1.5rem; color:#fff; text-shadow:4px 4px 0 var(--accent); }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:2rem; padding:3rem 1.5rem; }
  .post { background:var(--card-bg); position:relative; overflow:hidden; border-left:4px solid var(--accent); transition:transform 0.2s; }
  .post:hover { transform:skewX(-2deg) scale(1.02); }
  .post .media { margin:0; }
  .post .media img { filter:contrast(1.2) saturate(0.8); }
  .post-body { padding:1.5rem; }
  .post h2 { font-family:'Oswald',sans-serif; font-size:1.6rem; font-weight:700; margin-bottom:0.5rem; }
  .post h2 a { color:#fff; } .post h2 a:hover { color:var(--accent); }
",

'restaurant' => "
  /* RESTAURANT / FOOD */
  :root { --accent:#$accent; --bg:#FBF8F1; --text:#2D312E; --card-bg:#FFFFFF; --border:rgba(0,0,0,0.05); --radius:12px; }
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,700;1,400&family=Poppins:wght@300;400&display=swap');
  body { font-family:'Poppins',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { padding:1.5rem 2rem; display:flex; justify-content:space-between; align-items:center; background:var(--bg); }
  .nav-brand { font-family:'Lora',serif; font-size:1.8rem; font-weight:700; color:var(--accent); }
  .hero { padding:6rem 2rem; text-align:center; }
  .hero h1 { font-family:'Lora',serif; font-size:clamp(3rem,6vw,4.5rem); font-weight:700; color:#1A1D1A; margin-bottom:1rem; }
  .hero .bio { font-size:1.1rem; color:#555; max-width:600px; margin:0 auto; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(350px,1fr)); gap:2.5rem; padding:2rem; }
  .post { display:flex; gap:1.5rem; align-items:center; background:transparent; padding:0; border:none; }
  .post .media { width:120px; height:120px; flex-shrink:0; border-radius:50%; overflow:hidden; box-shadow:0 8px 16px rgba(0,0,0,0.1); margin:0; }
  .post .media img { width:100%; height:100%; object-fit:cover; }
  .post-body { flex:1; }
  .post h2 { font-family:'Lora',serif; font-size:1.3rem; font-weight:700; margin-bottom:0.5rem; border-bottom:1px dotted var(--accent); padding-bottom:0.25rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .excerpt { font-size:0.9rem; line-height:1.5; color:#666; }
",

'agency' => "
  /* AGENCY / STUDIO */
  :root { --accent:#$accent; --bg:#000000; --text:#FFFFFF; --card-bg:#111111; --border:#333333; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;800&display=swap');
  body { font-family:'Epilogue',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { padding:2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-weight:800; font-size:1.5rem; letter-spacing:-0.05em; }
  .hero { padding:8rem 2rem; max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:4rem; align-items:center; }
  @media(max-width:768px){.hero{grid-template-columns:1fr; padding:4rem 1.5rem;}}
  .hero h1 { font-size:clamp(3rem,6vw,5rem); font-weight:800; line-height:1; letter-spacing:-0.03em; }
  .hero .bio { font-size:1.2rem; color:#AAA; line-height:1.6; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:2px; background:var(--border); padding:2px; }
  .post { background:var(--card-bg); padding:3rem; transition:background 0.3s; }
  .post:hover { background:#1A1A1A; }
  .post h2 { font-size:1.8rem; font-weight:600; margin-bottom:1rem; letter-spacing:-0.02em; }
  .post h2 a { color:#FFF; } .post h2 a:hover { color:var(--accent); }
  .post .media { margin:-3rem -3rem 2rem -3rem; }
  .post .media img { filter:grayscale(100%); transition:filter 0.5s; }
  .post:hover .media img { filter:grayscale(0%); }
",

'zen' => "
  /* MINIMAL ZEN */
  :root { --accent:#$accent; --bg:#EBEBEB; --text:#222222; --card-bg:transparent; --border:transparent; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif:wght@300;400&family=Noto+Sans:wght@300;400&display=swap');
  body { font-family:'Noto Sans',sans-serif; background:var(--bg); color:var(--text); font-weight:300; }
  .navbar { padding:2rem 3rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Noto Serif',serif; font-size:1.2rem; letter-spacing:0.2em; text-transform:uppercase; }
  .hero { padding:10rem 2rem 6rem; text-align:center; }
  .hero h1 { font-family:'Noto Serif',serif; font-size:clamp(2rem,4vw,3.5rem); font-weight:300; letter-spacing:0.1em; margin-bottom:2rem; }
  .hero .bio { font-size:1rem; max-width:500px; margin:0 auto; line-height:2; opacity:0.7; }
  .post-grid { display:grid; grid-template-columns:1fr; max-width:800px; margin:0 auto; gap:6rem; padding:4rem 1.5rem; }
  .post { text-align:center; }
  .post .media { margin-bottom:2rem; }
  .post .media img { width:70%; margin:0 auto; box-shadow:0 20px 40px rgba(0,0,0,0.05); }
  .post h2 { font-family:'Noto Serif',serif; font-size:1.8rem; font-weight:400; margin-bottom:1rem; }
  .post h2 a { color:var(--text); }
  .post .excerpt { opacity:0.6; line-height:1.8; max-width:600px; margin:0 auto; }
",

'vaporwave' => "
  /* RETRO 90S / VAPORWAVE */
  :root { --accent:#FF71CE; --bg:#01CDFE; --text:#05FFA1; --card-bg:#B967FF; --border:#FFFB96; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
  body { font-family:'VT323',monospace; background:var(--bg); color:var(--text); font-size:20px; }
  .navbar { background:var(--card-bg); border-bottom:4px solid var(--border); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 4px 0 rgba(0,0,0,0.2); }
  .nav-brand { font-family:'Press Start 2P',cursive; font-size:1rem; color:var(--border); text-shadow:2px 2px 0 #000; }
  .hero { padding:4rem 2rem; text-align:center; background:linear-gradient(180deg, var(--bg) 0%, #B967FF 100%); }
  .hero h1 { font-family:'Press Start 2P',cursive; font-size:clamp(1.5rem,4vw,3rem); color:var(--accent); text-shadow:4px 4px 0 var(--border), 8px 8px 0 #000; margin-bottom:2rem; line-height:1.4; }
  .hero .bio { font-size:1.5rem; color:#fff; text-shadow:2px 2px 0 #000; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:2rem; padding:2rem; }
  .post { background:#000; border:4px solid var(--border); padding:1rem; box-shadow:8px 8px 0 var(--accent); }
  .post h2 { font-family:'Press Start 2P',cursive; font-size:1rem; color:var(--text); line-height:1.5; margin-bottom:1rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .media img { filter:hue-rotate(90deg) contrast(150%); border:2px solid var(--accent); }
",

'realestate' => "
  /* MODERN REAL ESTATE */
  :root { --accent:#$accent; --bg:#F4F4F4; --text:#2B2B2B; --card-bg:#FFFFFF; --border:rgba(0,0,0,0.08); --radius:4px; }
  @import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap');
  body { font-family:'Lato',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#fff; border-bottom:1px solid var(--border); padding:1.5rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-weight:900; font-size:1.5rem; letter-spacing:1px; text-transform:uppercase; color:var(--accent); }
  .hero { padding:8rem 2rem; text-align:center; background:url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80') center/cover; position:relative; }
  .hero::before { content:''; position:absolute; inset:0; background:rgba(0,0,0,0.5); }
  .hero > * { position:relative; z-index:1; color:#fff; }
  .hero h1 { font-size:clamp(2.5rem,5vw,4rem); font-weight:900; text-transform:uppercase; margin-bottom:1rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(350px,1fr)); gap:2rem; padding:3rem 1.5rem; max-width:1200px; margin:-4rem auto 0; position:relative; z-index:10; }
  .post { background:var(--card-bg); border-radius:var(--radius); overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.1); }
  .post .media { margin:0; height:250px; }
  .post .media img { height:100%; object-fit:cover; transition:transform 0.5s; }
  .post:hover .media img { transform:scale(1.1); }
  .post-body { padding:1.5rem; }
  .post h2 { font-size:1.3rem; font-weight:700; margin-bottom:0.5rem; }
  .post h2 a { color:var(--text); }
  .post .excerpt { color:#666; font-size:0.95rem; }
",

'blogger' => "
  /* BLOGGER CHIC */
  :root { --accent:#$accent; --bg:#FEFBFB; --text:#333333; --card-bg:#FFFFFF; --border:#F2E9E9; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Karla:wght@300;400&display=swap');
  body { font-family:'Karla',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { padding:2rem 0; text-align:center; border-bottom:1px solid var(--border); background:#fff; }
  .nav-brand { font-family:'Playfair Display',serif; font-size:2.5rem; font-weight:700; letter-spacing:2px; text-transform:uppercase; display:block; margin-bottom:1rem; }
  .nav-links { justify-content:center; }
  .hero { display:none; /* Nascondiamo l'hero per concentrarci sui post */ }
  .post-grid { display:grid; grid-template-columns:1fr; max-width:800px; margin:3rem auto; gap:4rem; padding:0 1.5rem; }
  .post { text-align:center; }
  .post .media { margin-bottom:1.5rem; }
  .post h2 { font-family:'Playfair Display',serif; font-size:2rem; font-weight:700; margin-bottom:1rem; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
  .post .meta { justify-content:center; font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:1.5rem; color:#999; }
  .post .excerpt { font-size:1.05rem; line-height:1.8; color:#555; }
",

'darkphoto' => "
  /* DARK PHOTOGRAPHY */
  :root { --accent:#$accent; --bg:#050505; --text:#E0E0E0; --card-bg:transparent; --border:#1A1A1A; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;600&display=swap');
  body { font-family:'Work Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:transparent; padding:2rem; position:absolute; top:0; width:100%; z-index:100; }
  .nav-brand { font-weight:600; font-size:1.2rem; letter-spacing:2px; text-transform:uppercase; color:#fff; }
  .hero { padding:15rem 2rem 5rem; text-align:left; background:linear-gradient(to bottom, rgba(0,0,0,0.8), #050505); }
  .hero h1 { font-size:clamp(3rem,6vw,5rem); font-weight:300; color:#fff; margin-bottom:1rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:1rem; padding:1rem; }
  .post { position:relative; overflow:hidden; aspect-ratio:4/3; }
  .post .media { height:100%; margin:0; }
  .post .media img { height:100%; object-fit:cover; transition:transform 0.8s, filter 0.8s; filter:brightness(0.7); }
  .post:hover .media img { transform:scale(1.05); filter:brightness(1); }
  .post-body { position:absolute; bottom:0; left:0; right:0; padding:2rem; background:linear-gradient(transparent, rgba(0,0,0,0.9)); transform:translateY(20px); opacity:0; transition:all 0.4s; }
  .post:hover .post-body { transform:translateY(0); opacity:1; }
  .post h2 { font-size:1.5rem; font-weight:400; color:#fff; margin:0; }
  .post h2 a { color:#fff; }
  .post .excerpt { display:none; }
",

'medical' => "
  /* MEDICAL / CLEAN */
  :root { --accent:#$accent; --bg:#F0F8FA; --text:#2C3E50; --card-bg:#FFFFFF; --border:rgba(44,62,80,0.1); --radius:8px; }
  @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700&display=swap');
  body { font-family:'Nunito Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#fff; padding:1rem 2rem; border-bottom:3px solid var(--accent); display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 10px rgba(0,0,0,0.05); }
  .nav-brand { font-weight:700; font-size:1.5rem; color:var(--accent); display:flex; align-items:center; gap:0.5rem; }
  .hero { padding:6rem 2rem; text-align:center; background:linear-gradient(135deg, #fff 0%, var(--bg) 100%); }
  .hero h1 { font-size:clamp(2.5rem,5vw,3.5rem); font-weight:700; color:#1A252F; margin-bottom:1rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:2rem; padding:2rem 1.5rem; max-width:1100px; margin:0 auto; }
  .post { background:var(--card-bg); border-radius:var(--radius); padding:2rem; box-shadow:0 4px 15px rgba(0,0,0,0.03); border:1px solid var(--border); text-align:center; transition:transform 0.3s; }
  .post:hover { transform:translateY(-5px); }
  .post .media { width:80px; height:80px; margin:0 auto 1.5rem; border-radius:50%; overflow:hidden; border:3px solid var(--accent); }
  .post .media img { width:100%; height:100%; object-fit:cover; }
  .post h2 { font-size:1.2rem; font-weight:700; color:#1A252F; margin-bottom:0.75rem; }
  .post h2 a { color:inherit; } .post h2 a:hover { color:var(--accent); }
",

'education' => "
  /* EDUCATION / UNIVERSITY */
  :root { --accent:#$accent; --bg:#FFFFFF; --text:#333333; --card-bg:#F9F9F9; --border:#E0E0E0; --radius:4px; }
  @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
  body { font-family:'Open Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#0A2540; padding:1.2rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Merriweather',serif; font-size:1.4rem; font-weight:700; color:#fff; }
  .nav-links a { color:#D0D6DC; font-weight:600; } .nav-links a:hover { color:#fff; }
  .hero { padding:6rem 2rem; text-align:center; background:#0A2540; color:#fff; border-bottom:5px solid var(--accent); }
  .hero h1 { font-family:'Merriweather',serif; font-size:clamp(2.5rem,5vw,4rem); margin-bottom:1.5rem; }
  .hero .bio { font-size:1.1rem; color:#A6B0B9; max-width:700px; margin:0 auto; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:2rem; padding:3rem 1.5rem; max-width:1100px; margin:0 auto; }
  .post { background:var(--card-bg); border:1px solid var(--border); border-top:4px solid #0A2540; padding:1.5rem; }
  .post h2 { font-family:'Merriweather',serif; font-size:1.3rem; margin-bottom:0.75rem; line-height:1.4; }
  .post h2 a { color:#0A2540; } .post h2 a:hover { color:var(--accent); }
",

'gamer' => "
  /* GAMER / STREAMER */
  :root { --accent:#$accent; --bg:#0F0F1A; --text:#E2E8F0; --card-bg:rgba(255,255,255,0.05); --border:rgba(255,255,255,0.1); --radius:12px; }
  @import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;700&family=Rajdhani:wght@500;600&display=swap');
  body { font-family:'Rajdhani',sans-serif; background:var(--bg); color:var(--text); font-size:18px; }
  .navbar { background:#0F0F1A; border-bottom:1px solid var(--border); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Teko',sans-serif; font-size:2.5rem; font-weight:700; color:var(--accent); line-height:1; text-transform:uppercase; letter-spacing:1px; text-shadow:0 0 10px var(--accent); }
  .hero { padding:6rem 2rem; text-align:center; background:radial-gradient(circle at 50% 0%, rgba(139,92,246,0.2) 0%, transparent 60%); }
  .hero h1 { font-family:'Teko',sans-serif; font-size:clamp(4rem,8vw,6rem); font-weight:700; text-transform:uppercase; line-height:0.9; margin-bottom:1rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:2rem; padding:2rem 1.5rem; }
  .post { background:var(--card-bg); backdrop-filter:blur(10px); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem; transition:all 0.3s; }
  .post:hover { border-color:var(--accent); box-shadow:0 0 20px rgba(139,92,246,0.3); transform:translateY(-5px); }
  .post h2 { font-family:'Teko',sans-serif; font-size:2rem; line-height:1; margin-bottom:0.5rem; text-transform:uppercase; }
  .post h2 a { color:#fff; } .post h2 a:hover { color:var(--accent); }
",

'startup' => "
  /* START-UP SAAS */
  :root { --accent:#$accent; --bg:#F8FAFC; --text:#334155; --card-bg:#FFFFFF; --border:#E2E8F0; --radius:16px; }
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
  body { font-family:'Outfit',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:rgba(248,250,252,0.9); backdrop-filter:blur(10px); padding:1.25rem 2rem; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; }
  .nav-brand { font-weight:700; font-size:1.5rem; color:#0F172A; }
  .hero { padding:8rem 2rem; text-align:center; }
  .hero h1 { font-size:clamp(2.5rem,5vw,4rem); font-weight:700; color:#0F172A; letter-spacing:-0.03em; margin-bottom:1.5rem; }
  .hero .bio { font-size:1.2rem; color:#64748B; max-width:600px; margin:0 auto; line-height:1.6; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:2rem; padding:2rem 1.5rem; max-width:1200px; margin:0 auto; }
  .post { background:var(--card-bg); border-radius:var(--radius); border:1px solid var(--border); padding:2rem; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); transition:transform 0.2s, box-shadow 0.2s; }
  .post:hover { transform:translateY(-4px); box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); }
  .post .media { border-radius:8px; overflow:hidden; margin-bottom:1.5rem; }
  .post h2 { font-size:1.4rem; font-weight:600; color:#0F172A; margin-bottom:0.75rem; }
  .post h2 a { color:inherit; } .post h2 a:hover { color:var(--accent); }
",

'lawyer' => "
  /* LAWYER / TRUST */
  :root { --accent:#$accent; --bg:#FFFFFF; --text:#2C3135; --card-bg:#F9F9F9; --border:#EAEAEA; --radius:0px; }
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Lato:wght@300;400&display=swap');
  body { font-family:'Lato',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#1A232C; padding:1.5rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Cinzel',serif; font-size:1.8rem; color:#D4AF37; } /* Oro scuro per il logo */
  .nav-links a { color:#fff; text-transform:uppercase; font-size:0.85rem; letter-spacing:1px; }
  .hero { padding:7rem 2rem; text-align:center; background:#1A232C; color:#fff; border-bottom:4px solid #D4AF37; }
  .hero h1 { font-family:'Cinzel',serif; font-size:clamp(2.5rem,5vw,4rem); margin-bottom:1.5rem; color:#D4AF37; }
  .hero .bio { font-size:1.1rem; color:#CCC; max-width:700px; margin:0 auto; line-height:1.8; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:2.5rem; padding:4rem 1.5rem; max-width:1100px; margin:0 auto; }
  .post { background:var(--card-bg); padding:2.5rem; border:1px solid var(--border); border-top:3px solid #1A232C; transition:box-shadow 0.3s; }
  .post:hover { box-shadow:0 10px 30px rgba(0,0,0,0.05); }
  .post h2 { font-family:'Cinzel',serif; font-size:1.5rem; color:#1A232C; margin-bottom:1rem; }
  .post h2 a { color:inherit; } .post h2 a:hover { color:#D4AF37; }
  .post .excerpt { color:#555; line-height:1.7; }
"
];

// Se abbiamo dati AI (fonts dinamici), sovrascriviamo il CSS di base
$fontHeadingUrl = urlencode($fontHeading);
$fontBodyUrl = urlencode($fontBody);
$navCss = '';
if ($navMode === 'solid') {
    $navCss = ".navbar { background: {$palSurface} !important; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: 0 6px 24px rgba(0,0,0,0.06); }";
} elseif ($navMode === 'floating') {
    $navCss = ".navbar { width: min(calc(100% - 24px), 1180px); margin: 14px auto 0; border-radius: 999px; background: rgba(255,255,255,0.72) !important; box-shadow: 0 14px 45px rgba(0,0,0,0.08); }";
}

$heroCss = '';
if ($heroMode === 'split') {
    $heroCss = ".hero { padding: {$heroPadding}; text-align: left; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr); gap: 2rem; align-items: end; }
      .hero h1, .hero .bio, .hero .hero-cta { max-width: 720px; margin-left: 0; }
      .hero::after { content: ''; justify-self: end; width: min(32vw, 360px); height: min(32vw, 360px); border-radius: 28px; background: {$palette['primary_gradient']}; opacity: 0.18; filter: blur(8px); }";
} elseif ($heroMode === 'immersive') {
    $heroCss = ".hero { padding: 11rem 1.5rem 7rem; text-align: left; background:
        radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 26%),
        linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12));
      border-bottom: 1px solid rgba(255,255,255,0.08); }
      .hero::before { background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 55%); animation: none; }
      .hero h1, .hero .bio, .hero .hero-cta { max-width: 760px; margin-left: 0; }";
} elseif ($heroMode === 'human') {
    $heroCss = ".hero { padding: {$heroPadding}; text-align: left; }
      .hero h1, .hero .bio, .hero .hero-cta { max-width: 760px; margin-left: 0; }
      .hero::before { background: radial-gradient(circle, rgba(61,139,109,0.10) 0%, transparent 58%); }";
} elseif ($heroMode === 'product') {
    $heroCss = ".hero { padding: {$heroPadding}; text-align: center; }
      .hero h1 { max-width: 900px; margin-left: auto; margin-right: auto; }
      .hero .bio { max-width: 720px; }";
} else {
    $heroCss = ".hero { padding: {$heroPadding}; text-align: left; }
      .hero h1, .hero .bio, .hero .hero-cta { max-width: 720px; margin-left: 0; }";
}

$cardsCss = '';
if ($cardsMode === 'bold') {
    $cardsCss = ".post-grid { grid-template-columns: repeat(auto-fill, minmax({$gridMin}, 1fr)); gap: 1.4rem; max-width: {$contentWidth}; margin: 0 auto; }
      .post { background: {$palSurface}; border: 2px solid {$palText}; border-radius: {$radius}; box-shadow: 8px 8px 0 {$palPrimary}; }
      .post:hover { transform: translateY(-6px); box-shadow: 12px 12px 0 {$palPrimary}; }
      .post h2 { text-transform: uppercase; letter-spacing: -0.03em; }";
} elseif ($cardsMode === 'cinematic') {
    $cardsCss = ".post-grid { grid-template-columns: repeat(auto-fit, minmax({$gridMin}, 1fr)); gap: 1.25rem; max-width: {$contentWidth}; margin: 0 auto; }
      .post { background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.05)); border-radius: {$radius}; overflow: hidden; padding: 0; min-height: 420px; display: flex; flex-direction: column; justify-content: flex-end; box-shadow: {$cardShadow}; }
      .post .media { margin: 0; height: 240px; }
      .post .media img, .post .media video { height: 100%; object-fit: cover; }
      .post-body { padding: 1.5rem; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.65)); }";
} elseif ($cardsMode === 'soft') {
    $cardsCss = ".post-grid { grid-template-columns: repeat(auto-fill, minmax({$gridMin}, 1fr)); gap: 1.8rem; max-width: {$contentWidth}; margin: 0 auto; }
      .post { background: {$palSurface}; border-radius: {$radius}; box-shadow: {$cardShadow}; border: 1px solid rgba(0,0,0,0.04); }
      .post:hover { transform: translateY(-4px); }";
} elseif ($cardsMode === 'product') {
    $cardsCss = ".post-grid { grid-template-columns: repeat(auto-fill, minmax({$gridMin}, 1fr)); gap: 1.6rem; max-width: {$contentWidth}; margin: 0 auto; }
      .post { background: {$palSurface}; border-radius: {$radius}; box-shadow: {$cardShadow}; border: 1px solid rgba(15,23,42,0.08); }
      .post .meta { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.78rem; }";
} else {
    $cardsCss = ".post-grid { grid-template-columns: repeat(auto-fill, minmax({$gridMin}, 1fr)); gap: 2rem; max-width: {$contentWidth}; margin: 0 auto; }
      .post { background: {$palSurface}; border-radius: {$radius}; box-shadow: {$cardShadow}; border: 1px solid rgba(0,0,0,0.05); }";
}

$modelBlendCss = '';
if ($secondaryModel === 'editorial-luxe') {
    $modelBlendCss .= ".hero h1, .post h2, .nav-brand { font-family: '{$fontHeading}', serif; }";
}
if ($secondaryModel === 'neo-brutal-pop') {
    $modelBlendCss .= ".btn, .chip, .cta, .hero .hero-cta a { border-width: 2px; text-transform: uppercase; }";
}
if ($secondaryModel === 'dark-cinematic') {
    $modelBlendCss .= ".hero::before { opacity: 0.9; } .post .media img { filter: saturate(0.96) contrast(1.04); }";
}
if ($secondaryModel === 'warm-humanist') {
    $modelBlendCss .= ".hero .bio, .post .excerpt { line-height: 1.75; }";
}
if ($secondaryModel === 'tech-clarity') {
    $modelBlendCss .= ".nav-links a, .post .meta { font-weight: 600; }";
}

$dynamicBaseCss = "
  :root { 
      --accent: {$palPrimary}; 
      --accent-secondary: {$palSecondary}; 
      --bg: {$palBg}; 
      --text: {$palText}; 
      --card-bg: {$palSurface}; 
      --border: rgba(0,0,0,0.05); 
      --radius: {$radius}; 
  }
  @import url('https://fonts.googleapis.com/css2?family={$fontHeadingUrl}:wght@400;600;700;800&family={$fontBodyUrl}:wght@300;400;500;600&display=swap');
  
  body { font-family: '{$fontBody}', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }
  h1, h2, h3, h4, h5, h6, .nav-brand { font-family: '{$fontHeading}', sans-serif; }
  
  .navbar { background: rgba(255, 255, 255, " . ($glassmorphism ? "0.6" : "0.92") . "); backdrop-filter: " . ($glassmorphism ? "blur(24px)" : "none") . "; -webkit-backdrop-filter: " . ($glassmorphism ? "blur(24px)" : "none") . "; border-bottom: 1px solid rgba(0,0,0,0.05); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; transition: all 0.3s ease; }
  .nav-brand { font-weight: 800; font-size: 1.25rem; color: var(--text); display: flex; align-items: center; gap: 0.75rem; letter-spacing: -0.02em; }
  .nav-links { display: flex; gap: 2rem; } .nav-links a { color: var(--text); opacity: 0.7; font-size: 0.95rem; font-weight: 600; transition: opacity 0.3s; position: relative; }
  .nav-links a:hover { opacity: 1; color: var(--accent); }
  
  .hero { padding: {$heroPadding}; text-align: center; border-bottom: 1px solid var(--border); position: relative; overflow: hidden; max-width: {$contentWidth}; margin: 0 auto; }
  .hero::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(127,119,221,0.05) 0%, transparent 60%); z-index: -1; animation: rotate 30s linear infinite; }
  @keyframes rotate { 100% { transform: rotate(360deg); } }
  .hero h1 { font-size: clamp(3rem, 6vw, 5rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 1.2rem; color: var(--text); line-height: 1.1; }
  .hero .bio { font-size: 1.25rem; color: var(--text); opacity: 0.75; max-width: 680px; margin: 0 auto 2rem; line-height: 1.6; }
  
  .post-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax({$gridMin}, 1fr)); gap: 2rem; align-items: start; }
  .post { background: var(--card-bg); backdrop-filter: " . ($glassmorphism ? "blur(12px)" : "none") . "; -webkit-backdrop-filter: " . ($glassmorphism ? "blur(12px)" : "none") . "; border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: {$cardShadow}; }
  .post:hover { transform: translateY(-8px) scale(1.02); box-shadow: {$cardShadow}; border-color: var(--accent); z-index: 2; }
  .post h2 { font-size: 1.5rem; margin-bottom: 0.75rem; font-weight: 800; line-height: 1.3; letter-spacing: -0.01em; }
  .post h2 a { color: var(--text); transition: color 0.3s; } .post h2 a:hover { color: var(--accent); }
  .post .media img { border-radius: 12px; transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1); }
  .post:hover .media img { transform: scale(1.05); }
  {$navCss}
  {$heroCss}
  {$cardsCss}
  {$modelBlendCss}
";

// Selezione CSS tema + inject accent color
// Se stiamo usando un tema legacy, usa il CSS legacy, altrimenti usa la base dinamica
$activeCss = isset($themeCSS[$archetype]) ? $themeCSS[$archetype] : $dynamicBaseCss;
if (!isset($themeCSS[$archetype]) || !empty($site['site_ai_data'])) {
    // Forza CSS dinamico se l'AI ha generato il sito (o se l'archetipo non e' nei fallback)
    $activeCss = $dynamicBaseCss;
}

// Sostituisce eventuali tag $accent nel CSS per sicurezza
$activeCss = str_replace('#$accent', $accent, $activeCss);

// HTTP Link headers per sitemap e feed
header('Link: <' . $siteUrl . '/sitemap.xml>; rel="sitemap"');
header('Link: <' . $siteUrl . '/feed.xml>; rel="alternate"; type="application/atom+xml"');

?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php 
    if (!empty($site['gsc_verification'])): 
      $gsc = trim($site['gsc_verification']);
      if (preg_match('/content="([^"]+)"/i', $gsc, $m)) $gsc = $m[1];
      else if (stripos($gsc, 'google-site-verification=') === 0) $gsc = substr($gsc, 25);
  ?>
    <meta name="google-site-verification" content="<?= h($gsc) ?>" />
  <?php endif; ?>
  <?php if ($single): ?>
    <title><?= h(postTitle($single)) ?> - <?= $title ?></title>
    <meta name="description" content="<?= h(postExcerpt($single)) ?>">
    <meta property="og:title" content="<?= h(postTitle($single)) ?>">
    <meta property="og:description" content="<?= h(postExcerpt($single)) ?>">
    <meta property="og:type" content="article">
    <meta property="article:published_time" content="<?= date(DATE_ATOM, strtotime($single['published_at'] ?? 'now')) ?>">
    <?php if ($single['media_url'] && strtolower($single['media_type']) !== 'video'): ?>
      <meta property="og:image" content="<?= h($single['media_url']) ?>">
    <?php elseif ($coverUrl): ?>
      <meta property="og:image" content="<?= h($coverUrl) ?>">
    <?php endif; ?>
    <link rel="canonical" href="<?= $siteUrl . '/' . h($single['slug']) ?>">
  <?php else: ?>
    <title><?= $title ?><?= $activeTag ? ' - ' . ucfirst($activeTag) : '' ?></title>
    <meta name="description" content="<?= $bio ?>">
    <meta property="og:title" content="<?= $title ?>">
    <meta property="og:description" content="<?= $bio ?>">
    <meta property="og:type" content="website">
    <?php if ($coverUrl): ?><meta property="og:image" content="<?= h($coverUrl) ?>"><?php endif; ?>
    <link rel="canonical" href="<?= $siteUrl ?><?= $activeTag ? '?tag=' . urlencode($activeTag) : '' ?>">
  <?php endif; ?>
  
  <meta property="og:site_name" content="<?= $title ?>">
  <link rel="sitemap" type="application/xml" href="<?= $siteUrl ?>/sitemap.xml">
  <link rel="alternate" type="application/atom+xml" title="RSS Feed" href="<?= $siteUrl ?>/feed.xml">
  
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "<?= addslashes($site['title'] ?? $user['name'] ?? '') ?>",
    "url": "<?= $siteUrl ?>",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "<?= $siteUrl ?>/?tag={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  </script>
  
  <?php if ($single): ?>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [{
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "<?= $siteUrl ?>"
    },{
      "@type": "ListItem",
      "position": 2,
      "name": "<?= addslashes(postTitle($single)) ?>"
    }]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "<?= addslashes(postTitle($single)) ?>",
    "image": "<?= addslashes($single['media_url'] ?? $coverUrl ?? '') ?>",
    "datePublished": "<?= date(DATE_ATOM, strtotime($single['published_at'] ?? 'now')) ?>",
    "dateModified": "<?= date(DATE_ATOM, strtotime($single['published_at'] ?? 'now')) ?>",
    "author": [{
        "@type": "Person",
        "name": "<?= addslashes($site['title'] ?? $user['name'] ?? '') ?>",
        "url": "<?= $siteUrl ?>"
      }]
  }
  </script>
  <?php else: ?>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "name": "<?= addslashes($site['title'] ?? $user['name'] ?? '') ?>",
    "description": "<?= addslashes($site['bio'] ?? '') ?>",
    "url": "<?= $siteUrl ?>",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": [
        <?php $scount = 0; foreach ($posts as $i => $p): if ($scount++ >= 50) break; ?>
        {
          "@type": "ListItem",
          "position": <?= $i + 1 ?>,
          "url": "<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"
        }<?= ($i < count($posts) - 1 && $scount < 50) ? ',' : '' ?>
        <?php endforeach; ?>
      ]
    }
  }
  </script>
  <?php endif; ?>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    /* ─── TEMA: <?= $theme ?> ─── */
    <?= $activeCss ?>

    
    /* ─── MACRO LAYOUTS STRUTTURALI ─── */
    .layout-wrapper { display: flex; min-height: 100vh; background: var(--bg); }
    .layout-sidebar-col { flex-shrink: 0; background: var(--card-bg, #fff); border-right: 1px solid var(--border); display: flex; flex-direction: column; z-index: 50; }
    .layout-content-col { flex: 1; display: flex; flex-direction: column; overflow-x: hidden; }
    
    /* VARIABILE: SPLIT */
    .layout-split-wrapper .layout-sidebar-col { width: 350px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    .layout-split-wrapper .navbar { padding: 2rem; display: flex; flex-direction: column; align-items: flex-start; gap: 2rem; background: transparent; }
    .layout-split-wrapper .nav-links { flex-direction: column; gap: 1rem; width: 100%; }
    .layout-split-wrapper .nav-links a { font-size: 1.2rem; display: block; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    .split-hero { flex-shrink: 0; min-height: 60vh; }
    
    /* VARIABILE: SIDEBAR */
    .layout-sidebar-wrapper .layout-sidebar-col { width: 280px; position: sticky; top: 0; height: 100vh; padding: 2rem; justify-content: space-between; }
    .layout-sidebar-wrapper .navbar { display: flex; flex-direction: column; align-items: flex-start; gap: 2rem; background: transparent; padding:0; }
    .layout-sidebar-wrapper .nav-links { flex-direction: column; gap: 1rem; }
    .footer-sidebar { margin-top: auto; padding-top: 2rem; font-size: 0.8rem; opacity: 0.7; border-top: 1px solid var(--border); }
    
    @media (max-width: 992px) {
      .layout-wrapper { flex-direction: column; }
      .layout-sidebar-col { width: 100% !important; height: auto !important; position: static !important; border-right: none; border-bottom: 1px solid var(--border); }
      .layout-split-wrapper .navbar, .layout-sidebar-wrapper .navbar { flex-direction: row; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; }
      .layout-split-wrapper .nav-links, .layout-sidebar-wrapper .nav-links { display: none; } /* Vengono gestiti dall'hamburger .nav-links.open */
      .layout-split-wrapper .nav-links.open, .layout-sidebar-wrapper .nav-links.open { display: flex; position: fixed; right: 0; width: 280px; height: 100vh; padding: 5rem 2rem 2rem; border: none; }
      .footer-sidebar { display: none; } /* Nascondi footer laterale su mobile */
    }
    
    /* REGOLE BASE (Classic / Magazine) */
    body:not([class*="layout-split"]):not([class*="layout-sidebar"]) .navbar {
       display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 2rem; background: var(--bg);
    }
    .placeholder-hero { padding: 8rem 2rem; }
    
    /* ─── STILI COMUNI (non sovrascrivibili dal tema) ─── */

    a { text-decoration: none; transition: color 0.2s; }
    .nav-links { display: flex; gap: 1.5rem; }
    .nav-links a { transition: color 0.2s; }
    .nav-links a:hover { color: var(--accent, #7F77DD); }
    /* ─── Hamburger Mobile ─── */
    .nav-toggle { display: none; background: none; border: none; cursor: pointer; padding: 0.5rem; z-index: 110; }
     .nav-toggle span { display: block; width: 24px; height: 2px; background: var(--text, #111); margin: 5px 0; transition: all 0.3s ease; border-radius: 2px; }
    @media (max-width: 768px) {
      .nav-toggle { display: block; }
      .nav-links { position: fixed; top: 0; right: -100%; width: 280px; height: 100vh; flex-direction: column; background: var(--bg, #fff); padding: 5rem 2rem 2rem; gap: 1.25rem; box-shadow: -4px 0 30px rgba(0,0,0,0.15); transition: right 0.35s cubic-bezier(0.4,0,0.2,1); z-index: 105; }
      .nav-links.open { right: 0; }
      .nav-links a { font-size: 1.1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border, rgba(0,0,0,0.06)); }
      .nav-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100; }
      .nav-overlay.open { display: block; }
      .nav-toggle.open span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
      .nav-toggle.open span:nth-child(2) { opacity: 0; }
      .nav-toggle.open span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
    }
    .socials { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; justify-content: center; }
    .social-link { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem; border-radius: 50px; border: 1px solid var(--border, rgba(0,0,0,0.1)); font-size: 0.9rem; font-weight: 500; color: var(--text, #111); transition: all 0.25s; }
    .social-link:hover { background: var(--accent, #7F77DD); color: #fff; border-color: var(--accent, #7F77DD); transform: translateY(-2px); }
    .container { max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem; }
    .filters { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 2.5rem; justify-content: center; }
    .filter-btn { border: 1px solid var(--border, rgba(0,0,0,0.1)); padding: 0.5rem 1.1rem; border-radius: 50px; font-size: 0.85rem; font-weight: 500; cursor: pointer; background: transparent; color: var(--text, #111); font-family: inherit; transition: all 0.2s; }
    .filter-btn:hover, .filter-btn.active { background: var(--accent, #7F77DD); color: #fff; border-color: var(--accent, #7F77DD); }
    .post { opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease, transform 0.5s ease; }
    .post.visible { opacity: 1; transform: translateY(0); }
    .post.hidden { display: none !important; }
    .post-body { flex: 1; }
    .meta { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; font-size: 0.8rem; opacity: 0.6; flex-wrap: wrap; }
    .badge { background: var(--accent, #7F77DD); color: #fff; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600; opacity: 0.9; }
    .excerpt { font-size: 0.95rem; line-height: 1.6; opacity: 0.7; margin-top: 0.5rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 1rem; }
    .tag { font-size: 0.75rem; padding: 0.25rem 0.7rem; border-radius: 20px; background: rgba(127,119,221,0.1); color: var(--accent, #7F77DD); }
    .media { overflow: hidden; border-radius: 12px; margin-bottom: 1rem; }
    .media img, .media video { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; transition: transform 0.5s; }
    .post:hover .media img { transform: scale(1.04); }
    .media iframe { width: 100%; aspect-ratio: 16/9; border: 0; display: block; }
    .source-link { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem; font-size: 0.85rem; font-weight: 600; color: var(--accent, #7F77DD); }
    .source-link::after { content: '→'; transition: transform 0.2s; }
    .source-link:hover::after { transform: translateX(4px); }
    /* Post in evidenza */
    .featured-post { background: var(--accent, #7F77DD); color: #fff; border-radius: 20px; padding: 2.5rem; margin-bottom: 3rem; display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
    @media(max-width:700px){ .featured-post { grid-template-columns: 1fr; } }
    .featured-post h2 { font-size: 1.8rem; font-weight: 700; line-height: 1.2; margin-bottom: 0.75rem; }
    .featured-post h2 a { color: #fff; }
    .featured-post .excerpt { opacity: 0.85; color: #fff; }
    .featured-label { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; margin-bottom: 0.75rem; }
    .featured-cta { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; background: rgba(255,255,255,0.2); color: #fff; padding: 0.65rem 1.4rem; border-radius: 50px; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
    .featured-cta:hover { background: rgba(255,255,255,0.35); }
    /* Single post */
    .single-post { max-width: 820px; margin: 0 auto; background: var(--card-bg, #fff); border-radius: 20px; padding: 3rem; box-shadow: 0 4px 30px rgba(0,0,0,0.06); }
    .single-post h1 { font-size: 2.2rem; margin-bottom: 1.5rem; line-height: 1.25; }
    .body-content { font-size: 1.05rem; line-height: 1.85; opacity: 0.85; }
    .body-content p { margin-bottom: 1.5rem; }
    .pro-tip {
        background: linear-gradient(135deg, rgba(127,119,221,0.08) 0%, rgba(127,119,221,0.03) 100%);
        border-left: 4px solid var(--accent, #7F77DD);
        padding: 1.25rem 1.5rem;
        border-radius: 8px;
        margin: 2rem 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: var(--text, #111);
    }
    .pro-tip strong {
        color: var(--accent, #7F77DD);
        display: block;
        margin-bottom: 0.25rem;
        text-transform: uppercase;
        font-size: 0.85rem;
        letter-spacing: 0.05em;
    }
    .body-content table {
        width: 100%;
        border-collapse: collapse;
        margin: 2rem 0;
        font-size: 0.95rem;
    }
    .body-content th {
        background: rgba(0,0,0,0.02);
        font-weight: 700;
        text-align: left;
        padding: 12px 16px;
        border-bottom: 2px solid rgba(0,0,0,0.06);
    }
    .body-content td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0,0,0,0.04);
        line-height: 1.5;
    }
    .body-content tr:hover td {
        background: rgba(0,0,0,0.01);
    }
    .back-btn { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem; font-weight: 600; color: var(--accent, #7F77DD); }
    /* Footer */
    /* Footer Premium */
    .footer { margin-top: 5rem; padding: 5rem 2rem 3rem; background: var(--text, #0D1117); color: #fff; text-align: center; border-radius: 40px 40px 0 0; }
    .footer-logo { font-size: 1.8rem; font-weight: 800; margin-bottom: 1.5rem; color: #fff; letter-spacing: -0.02em; }
    .footer-text { color: rgba(255,255,255,0.7); font-size: 1rem; max-width: 600px; margin: 0 auto 2rem; line-height: 1.6; }
    .footer-socials { display: flex; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
    .footer-socials a { color: #fff; background: rgba(255,255,255,0.08); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); }
    .footer-socials a:hover { background: var(--accent, #7F77DD); border-color: var(--accent, #7F77DD); transform: translateY(-4px) scale(1.05); }
    .footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-top: 1.5rem; }
    .footer-bottom a { color: rgba(255,255,255,0.5); }
    /* Breadcrumb */
    .breadcrumb { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text, #111); opacity: 0.6; flex-wrap: wrap; }
    .breadcrumb a { color: var(--accent, #7F77DD); }
    .breadcrumb span.sep { opacity: 0.4; }
    /* ─── Layout Editoriale Nuovo ─── */
    .slider-container { position: relative; width: 100%; margin: 0 auto 3rem; overflow: hidden; border-radius: 0 0 20px 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); background: #000; }
    .slider-track { display: flex; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
    .slider-slide { min-width: 100%; position: relative; }
    .slider-slide img, .slider-slide video { width: 100%; height: 55vh; max-height: 600px; min-height: 400px; object-fit: cover; display: block; opacity: 0.8; }
    .slider-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 6rem 2rem 3rem; background: linear-gradient(transparent, rgba(0,0,0,0.9)); color: #fff; }
    .slider-content .meta { color: rgba(255,255,255,0.8); margin-bottom: 0.5rem; }
    .slider-content h2 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 0.5rem; line-height: 1.1; letter-spacing: -0.02em; }
    .slider-content h2 a { color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
    .slider-content h2 a:hover { color: var(--accent, #ccc); }
    .slider-content .excerpt { opacity: 0.9; font-size: 1.15rem; max-width: 800px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
    .slider-nav { position: absolute; bottom: 1.5rem; right: 2rem; display: flex; gap: 0.6rem; z-index: 10; }
    .slider-dot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.4); border: 2px solid transparent; cursor: pointer; transition: all 0.3s; padding: 0; }
    .slider-dot.active { background: #fff; transform: scale(1.3); }
    
    .topic-section { margin-bottom: 4rem; }
    .topic-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    .topic-header h2 { font-size: 1.8rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
    .topic-header h2::before { content: ''; display: block; width: 6px; height: 24px; background: var(--accent); border-radius: 3px; }
    .topic-header a { font-size: 0.9rem; font-weight: 600; color: var(--accent); padding: 0.4rem 1.2rem; border-radius: 20px; background: rgba(127,119,221,0.1); transition: all 0.2s; white-space: nowrap; }
    .topic-header a:hover { background: var(--accent); color: #fff; }
    
    .horizontal-scroll { display: flex; gap: 1.5rem; overflow-x: auto; padding-bottom: 1.5rem; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
    .horizontal-scroll::-webkit-scrollbar { height: 6px; }
    .horizontal-scroll::-webkit-scrollbar-track { background: var(--border); border-radius: 3px; }
    .horizontal-scroll::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 3px; }
    .horizontal-scroll .post { min-width: 320px; max-width: 380px; flex: 0 0 auto; scroll-snap-align: start; }
    
    .recent-header { font-size: 2rem; font-weight: 800; margin-bottom: 2rem; text-align: center; }

    <?= $customCss ?>
    @media (max-width: 768px) {
      .slider-slide img, .slider-slide video { height: 45vh; min-height: 350px; }
      .slider-content { padding: 4rem 1.5rem 2.5rem; }
      .topic-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; border-bottom: none; }
      .topic-header h2 { font-size: 1.5rem; }
      .horizontal-scroll .post { min-width: 280px; }
      .container { padding: 2rem 1rem; }
      .single-post { padding: 1.5rem; border-radius: 12px; }
    }
  </style>
</head>
<?php
  $layoutVariant = 'classic';
  if (in_array($archetype, ['agency', 'fitness', 'brutalist', 'darkphoto', 'gamer'])) { $layoutVariant = 'split'; }
  elseif (in_array($archetype, ['zen', 'blogger', 'portfolio', 'vaporwave'])) { $layoutVariant = 'sidebar'; }
  elseif (in_array($archetype, ['magazine', 'authority', 'ecommerce', 'education'])) { $layoutVariant = 'magazine'; }
  
  // Unsplash Placeholder
  $unsplashKeyword = $archetype;
  if ($archetype === 'classic') $unsplashKeyword = 'corporate,office';
  if ($archetype === 'realestate') $unsplashKeyword = 'house,interior';
  if ($archetype === 'wedding') $unsplashKeyword = 'wedding,flowers';
  if ($archetype === 'restaurant') $unsplashKeyword = 'food,restaurant';
  $placeholderImage = "https://images.unsplash.com/photo-1542314831-c53cd4b85ca4?auto=format&fit=crop&w=1600&q=80";
  if (in_array($archetype, ['wedding', 'realestate', 'restaurant', 'fitness', 'darkphoto', 'medical', 'agency', 'startup', 'lawyer'])) {
      $placeholderImage = "https://source.unsplash.com/1600x900/?" . urlencode($unsplashKeyword);
  }
?>
<body class="theme-<?= h($archetype) ?> layout-<?= $layoutVariant ?>">

<?php
ob_start();
?>
  <a href="<?= $siteUrl ?>" class="nav-brand">
    <?php if ($logoUrl): ?><img src="<?= h($logoUrl) ?>" alt="<?= $title ?> - Logo" style="height:40px;border-radius:8px;">
    <?php else: ?><?= $title ?><?php endif; ?>
  </a>
  <?php if ($menuLinks): ?>
  <button class="nav-toggle" aria-label="Apri menu" aria-expanded="false" id="nav-toggle">
    <span></span><span></span><span></span>
  </button>
  <div class="nav-overlay" id="nav-overlay"></div>
  <div class="nav-links" id="nav-links" role="menubar">
    <?php foreach ($menuLinks as $link): 
        $href = trim($link['url'] ?? '');
        if ($href === '/' || $href === '') { $href = $siteUrl; }
        elseif (preg_match('/[?&]tag=([^&]+)/i', $href, $m)) { $href = $siteUrl . '?tag=' . $m[1]; }
        else { $href = h($href); }
    ?>
      <a href="<?= $href ?>" role="menuitem"><?= h($link['label']) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
<?php
$menuHtml = ob_get_clean();

ob_start();
?>
  <div class="footer-logo"><?= $title ?></div>
  <p class="footer-text"><?= $footerText ? h($footerText) : h($site['role_mission'] ?? $site['bio'] ?? '') ?></p>
  <?php if ($sources): ?>
  <div class="footer-socials">
    <?php foreach ($sources as $source): ?>
      <a href="<?= h($source['url']) ?>" target="_blank" aria-label="<?= h($source['platform']) ?>" title="<?= h($source['platform']) ?>"><?= $icons[$source['platform']] ?? '🔗' ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
  <div class="footer-bottom">
    <span>&copy; <?= date('Y') ?> <?= $title ?>. Creato con <a href="<?= BASE_URL ?>">SocialToSite</a>.</span>
    <a href="<?= $siteUrl ?>/sitemap.xml">Sitemap</a>
  </div>
<?php
$footerHtml = ob_get_clean();

ob_start();
?>
<?php if ($single): $p = $single; ?>
  <a class="back-btn" href="<?= $siteUrl ?>">← Torna ai contenuti</a>
  <article class="single-post" itemscope itemtype="https://schema.org/Article">
    <?= mediaHtml($p) ?>
    <div class="meta">
      <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
      <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
      <?php if (strtoupper($p['media_type'] ?? '') === 'VIDEO'): ?><span class="badge">Video → Testo</span><?php endif; ?>
    </div>
    <h1 itemprop="headline"><?= h(postTitle($p)) ?></h1>
    <div class="body-content" itemprop="articleBody"><?= bodyHtml(postBody($p)) ?></div>
    <?php if (!empty($p['source_url'])): ?>
    <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">Originale su <?= h($p['platform']) ?></a>
    <?php endif; ?>
    <?php if ($p['tags']): ?>
    <div class="tags" style="margin-top:2rem;">
      <?php foreach ($p['tags'] as $tag): ?><span class="tag">#<?= h($tag) ?></span><?php endforeach; ?>
    </div>
    <?php endif; ?>
  </article>

<?php else: ?>

  <?php if ($activeTag): ?>
  <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--card-bg); border-radius: var(--radius); border-left: 4px solid var(--accent);">
    <h2 style="margin:0;">Categoria: <strong><?= h(ucfirst($activeTag)) ?></strong></h2>
    <p style="margin-top: 0.5rem; color: var(--text-muted);"><a href="<?= $siteUrl ?>">← Torna a tutti i contenuti</a></p>
  </div>
  <!-- GRIGLIA STANDARD PER CATEGORIA -->
  <section class="post-grid" aria-label="Contenuti per categoria">
    <?php foreach ($posts as $p):
      $purl = $siteUrl . '/' . h($p['slug'] ?? '');
    ?>
    <article class="post">
      <?= mediaHtml($p) ?>
      <div class="post-body">
        <div class="meta">
          <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
          <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
        </div>
        <h2><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h2>
        <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
      </div>
    </article>
    <?php endforeach; ?>
  </section>

  <?php else: ?>

  <!-- SEZIONI PER ARGOMENTI (HOME) -->
  <?php foreach ($postsByTopic as $topic => $topicPosts): ?>
  <section class="topic-section">
    <div class="topic-header">
      <h2><?= h(ucfirst($topic)) ?></h2>
      <a href="<?= $siteUrl ?>?tag=<?= urlencode($topic) ?>">Vedi tutti →</a>
    </div>
    <div class="horizontal-scroll">
      <?php foreach ($topicPosts as $p):
        $purl = $siteUrl . '/' . h($p['slug'] ?? '');
      ?>
      <article class="post">
        <?= mediaHtml($p) ?>
        <div class="post-body">
          <div class="meta">
            <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
          </div>
          <h2><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h2>
          <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endforeach; ?>

  <!-- ULTIMI ARRIVI (HOME) -->
  <?php if (!empty($recentPosts)): ?>
  <h2 class="recent-header">Ultimi Arrivi</h2>
  <section class="post-grid" aria-label="Ultimi contenuti pubblicati">
    <?php foreach ($recentPosts as $p):
      $purl = $siteUrl . '/' . h($p['slug'] ?? '');
    ?>
    <article class="post">
      <?= mediaHtml($p) ?>
      <div class="post-body">
        <div class="meta">
          <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
          <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
        </div>
        <h2><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h2>
        <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
      </div>
    </article>
    <?php endforeach; ?>
  </section>
  <?php endif; ?>

  <?php if (empty($posts)): ?>
  <div style="text-align:center;padding:5rem 1rem;opacity:0.5;">
    <div style="font-size:4rem;margin-bottom:1rem;">✨</div>
    <p style="font-size:1.2rem;">Il sito è pronto. In attesa di nuovi contenuti.</p>
  </div>
  <?php endif; ?>

  <?php endif; ?>

<?php endif; ?>
<?php
$mainContentHtml = ob_get_clean();

ob_start();
?>
<?php if (!$single && count($sliderPosts) > 0): ?>
<!-- SLIDER HERO -->
<div class="slider-container" id="hero-slider">
  <div class="slider-track" id="slider-track">
    <?php foreach ($sliderPosts as $i => $p): 
        $pUrl = $siteUrl . '/' . h($p['slug'] ?? '');
        $u = $p['media_url'] ?? '';
        $media = '';
        if ($u) {
            $type = strtolower($p['media_type'] ?? '');
            if (preg_match('~(?:youtube\.com|youtu\.be)~i', $u) && preg_match('~(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})~', $u, $m)) {
                $ytThumb = 'https://img.youtube.com/vi/' . $m[1] . '/maxresdefault.jpg';
                $media = '<img src="' . h($ytThumb) . '" alt="" loading="eager">';
            } else if ($type === 'video' || preg_match('~\.(mp4|mov|webm)(\?|$)~i', $u)) {
                $media = '<video autoplay muted loop playsinline><source src="' . h($u) . '"></video>';
            } else {
                $media = '<img src="' . h($u) . '" alt="" loading="eager">';
            }
        } else if ($coverUrl) {
            $media = '<img src="' . h($coverUrl) . '" alt="" loading="eager">';
        } else {
            $media = '<img src="' . $placeholderImage . '" alt="" loading="eager">';
        }
    ?>
    <div class="slider-slide" data-index="<?= $i ?>">
      <?= $media ?>
      <div class="slider-content">
        <div class="container" style="padding:0;">
          <div class="meta">
            <span class="badge" style="margin-right:8px;">In Evidenza</span>
            <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
          </div>
          <h2><a href="<?= $pUrl ?>"><?= h(postTitle($p)) ?></a></h2>
          <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
        </div>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
  <?php if (count($sliderPosts) > 1): ?>
  <div class="slider-nav">
    <?php foreach ($sliderPosts as $i => $p): ?>
      <button class="slider-dot <?= $i === 0 ? 'active' : '' ?>" data-index="<?= $i ?>" aria-label="Vai alla slide <?= $i + 1 ?>"></button>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</div>
<?php elseif (!$single): ?>
<!-- HERO PLACEHOLDER SE NON CI SONO SLIDER -->
<div class="hero placeholder-hero" style="background: url('<?= $coverUrl ?: $placeholderImage ?>') center/cover; position:relative;">
  <div style="position:absolute; inset:0; background:rgba(0,0,0,0.6);"></div>
  <div class="container" style="position:relative; z-index:1; color:#fff; text-align:center;">
    <h1 style="font-size:clamp(3rem, 6vw, 5rem); margin-bottom:1.5rem; color:#fff; font-weight:800; letter-spacing:-0.03em;"><?= h($title) ?></h1>
    <p style="font-size:1.25rem; max-width:800px; margin:0 auto; line-height:1.6; opacity:0.9;"><?= h($bio) ?></p>
  </div>
</div>
<?php endif; ?>
<?php
$heroHtml = ob_get_clean();
?>

<!-- RENDER LAYOUT -->
<?php if ($layoutVariant === 'split' || $layoutVariant === 'sidebar'): ?>
  <div class="layout-wrapper layout-<?= $layoutVariant ?>-wrapper">
    <aside class="layout-sidebar-col">
      <nav class="navbar" role="navigation">
        <?= $menuHtml ?>
      </nav>
      <?php if ($layoutVariant === 'sidebar'): ?>
        <footer class="footer-sidebar">
          <?= $footerHtml ?>
        </footer>
      <?php endif; ?>
    </aside>
    <main class="layout-content-col">
       <?php if ($layoutVariant === 'split' && !$single): ?>
         <div class="split-hero" style="background: url('<?= $coverUrl ?: $placeholderImage ?>') center/cover; position:relative; overflow:hidden;">
            <div style="position:absolute; inset:0; background:linear-gradient(to right, rgba(0,0,0,0.9), transparent);"></div>
            <div style="position:relative; z-index:1; padding:4rem; color:#fff; display:flex; flex-direction:column; justify-content:center; height:100%;">
              <h1 style="font-size:4rem; color:#fff; margin-bottom:1rem;"><?= h($title) ?></h1>
              <p style="font-size:1.2rem; max-width:600px; opacity:0.9; line-height:1.6;"><?= h($bio) ?></p>
            </div>
         </div>
       <?php else: ?>
         <?= $heroHtml ?>
       <?php endif; ?>
       
       <div class="container">
          <?= $mainContentHtml ?>
       </div>

       <?php if ($layoutVariant === 'split'): ?>
         <footer class="footer">
           <?= $footerHtml ?>
         </footer>
       <?php endif; ?>
    </main>
  </div>
<?php else: ?>
  <nav class="navbar" role="navigation">
    <?= $menuHtml ?>
  </nav>

  <?= $heroHtml ?>

  <main class="container">
     <?= $mainContentHtml ?>
  </main>

  <footer class="footer">
    <?= $footerHtml ?>
  </footer>
<?php endif; ?>

<script>
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const navOverlay = document.getElementById('nav-overlay');
  
  if (navToggle && navLinks && navOverlay) {
    const toggleMenu = () => {
      const isOpen = navLinks.classList.contains('open');
      navLinks.classList.toggle('open');
      navOverlay.classList.toggle('open');
      navToggle.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', !isOpen);
    };
    navToggle.addEventListener('click', toggleMenu);
    navOverlay.addEventListener('click', toggleMenu);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.post').forEach(p => observer.observe(p));

  const track = document.getElementById('slider-track');
  if (track) {
    const dots = document.querySelectorAll('.slider-dot');
    let currentSlide = 0;
    const maxSlides = dots.length;
    const goToSlide = (idx) => {
      if (maxSlides <= 1) return;
      currentSlide = idx;
      track.style.transform = `translateX(-${currentSlide * 100}%)`;
      dots.forEach(d => d.classList.remove('active'));
      dots[currentSlide].classList.add('active');
    };
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        clearInterval(autoSlide);
        goToSlide(parseInt(dot.getAttribute('data-index')));
      });
    });
    let autoSlide = setInterval(() => {
      if (maxSlides > 1) {
        goToSlide((currentSlide + 1) % maxSlides);
      }
    }, 6000);
  }
});
</script>
</body>
</html>
