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

$postSlug = $_GET['post'] ?? '';
$single   = null;
if ($postSlug) {
    foreach ($posts as $p) { if (($p['slug'] ?? '') === $postSlug) { $single = $p; break; } }
}

// ── Sitemap XML ─────────────────────────────────────────────────────────────
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

// ── Variabili base ───────────────────────────────────────────────────────────
function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$title      = h($site['title'] ?? $user['name'] ?? '');
$bio        = h($site['profile_summary'] ?: ($site['bio'] ?? ''));
$siteUrl    = BASE_URL . '/s/' . $slug;
$validThemes = ['classic', 'journal', 'authority', 'portfolio', 'magazine', 'minimal', 'studio', 'local', 'academy', 'bottega'];
$theme      = in_array($site['theme'] ?? '', $validThemes, true) ? $site['theme'] : 'classic';
$icons      = ['instagram' => '📸', 'tiktok' => '🎵', 'youtube' => '▶️', 'facebook' => '📘', 'website' => '🌐'];

$menuLinks    = !empty($site['menu_links']) ? json_decode($site['menu_links'], true) : [];
$accentColor  = $site['accent_color'] ?? '';
$accentSecondary = $site['accent_secondary'] ?? '';
$logoUrl      = $site['logo_url'] ?? '';
$coverUrl     = $site['cover_url'] ?? '';
$footerText   = $site['footer_text'] ?? '';
$customCss    = $site['custom_css'] ?? '';
$heroTagline  = h($site['hero_tagline'] ?? '');
$ctaText      = h($site['cta_text'] ?? 'Scopri i contenuti');

// ── Override per Anteprima (preview_theme oppure preview_index) ──────────────
if (isset($_GET['preview_theme']) && in_array($_GET['preview_theme'], $validThemes, true)) {
    $theme = $_GET['preview_theme'];
    // Reset custom_css per vedere il tema puro
    $customCss = '';
    $accentColor = '';
}
if (isset($_GET['preview_index']) && !empty($site['generated_layouts'])) {
    $idx = (int)$_GET['preview_index'];
    $layouts = json_decode($site['generated_layouts'], true);
    if (is_array($layouts) && isset($layouts[$idx])) {
        $p2 = $layouts[$idx];
        if (in_array($p2['theme'] ?? '', $validThemes, true)) $theme = $p2['theme'];
        $accentColor  = $p2['accent_color'] ?? $accentColor;
        $customCss    = $p2['custom_css'] ?? $customCss;
    }
}

// ── Post in evidenza ─────────────────────────────────────────────────────────
$featuredPost = null;
foreach ($posts as $p) { if (!empty($p['featured'])) { $featuredPost = $p; break; } }

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
  :root { --accent:#$accent; --bg:#FAFAFA; --text:#1a1a24; --card-bg:#fff; --border:rgba(0,0,0,0.06); --radius:16px; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  body { font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:rgba(255,255,255,0.85); backdrop-filter:blur(16px); border-bottom:1px solid var(--border); padding:1rem 2rem; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; }
  .nav-brand { font-weight:700; font-size:1.1rem; color:var(--text); display:flex; align-items:center; gap:0.75rem; }
  .nav-links { display:flex; gap:1.5rem; } .nav-links a { color:#666; font-size:0.9rem; font-weight:500; }
  .hero { padding:5rem 1.5rem; text-align:center; background:linear-gradient(160deg,rgba(127,119,221,0.06) 0%,#FAFAFA 60%); }
  .hero h1 { font-size:clamp(2rem,5vw,3.5rem); font-weight:700; letter-spacing:-0.03em; margin-bottom:1rem; }
  .hero .bio { font-size:1.1rem; color:#555; max-width:600px; margin:0 auto 1.5rem; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1.5rem; }
  .post { background:var(--card-bg); border:1px solid var(--border); border-radius:var(--radius); padding:1.5rem; transition:transform 0.3s,box-shadow 0.3s; }
  .post:hover { transform:translateY(-4px); box-shadow:0 12px 30px rgba(0,0,0,0.07); }
",

'journal' => "
  :root { --accent:#$accent; --bg:#FDF6EE; --text:#2C1A0E; --card-bg:#fff; --border:rgba(0,0,0,0.08); }
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:wght@300;400&display=swap');
  body { font-family:'Source Serif 4',Georgia,serif; background:var(--bg); color:var(--text); }
  .navbar { background:var(--bg); border-bottom:2px solid var(--text); padding:1rem 2rem; display:flex; align-items:center; justify-content:space-between; }
  .nav-brand { font-family:'Playfair Display',serif; font-size:1.4rem; font-weight:700; color:var(--text); }
  .hero { padding:5rem 1.5rem 3rem; text-align:center; border-bottom:1px solid rgba(0,0,0,0.1); }
  .hero h1 { font-family:'Playfair Display',serif; font-size:clamp(2.5rem,5vw,4rem); font-weight:700; margin-bottom:1rem; line-height:1.15; }
  .hero .bio { font-size:1.15rem; color:#5a3e2b; max-width:580px; margin:0 auto; font-style:italic; }
  .post-grid { display:grid; grid-template-columns:1fr; max-width:760px; margin:0 auto; gap:0; }
  .post { border-bottom:1px solid rgba(0,0,0,0.1); padding:2rem 0; background:transparent; }
  .post h2 { font-family:'Playfair Display',serif; font-size:1.6rem; font-weight:600; margin-bottom:0.5rem; line-height:1.25; }
  .post h2 a { color:var(--text); } .post h2 a:hover { color:var(--accent); }
",

'authority' => "
  :root { --accent:#$accent; --bg:#0D1117; --text:#E6EDF3; --card-bg:#161B22; --border:rgba(255,255,255,0.08); }
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  body { font-family:'Space Grotesk',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:rgba(13,17,23,0.9); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:100; }
  .nav-brand { font-weight:700; font-size:1.1rem; color:#fff; }
  .hero { padding:7rem 1.5rem; text-align:center; background:radial-gradient(ellipse at 50% 0%,rgba(127,119,221,0.15) 0%,transparent 70%); }
  .hero h1 { font-size:clamp(2.5rem,6vw,5rem); font-weight:700; letter-spacing:-0.04em; background:linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.7) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  .hero .bio { font-size:1.1rem; color:rgba(255,255,255,0.6); max-width:600px; margin:1rem auto; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:1.5rem; }
  .post { background:var(--card-bg); border:1px solid var(--border); border-radius:12px; padding:1.75rem; transition:border-color 0.3s,box-shadow 0.3s; }
  .post:hover { border-color:var(--accent); box-shadow:0 0 30px rgba(127,119,221,0.15); }
  .post h2 a { color:#E6EDF3; } .post h2 a:hover { color:var(--accent); }
  .meta { color:rgba(255,255,255,0.4); } .excerpt { color:rgba(255,255,255,0.6); }
  .footer { background:#010409; }
",

'portfolio' => "
  :root { --accent:#$accent; --bg:#F5F0EB; --text:#1C1C1C; --card-bg:#fff; --border:rgba(0,0,0,0.06); }
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Serif+Display&display=swap');
  body { font-family:'DM Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:var(--bg); border-bottom:1px solid rgba(0,0,0,0.08); padding:1.25rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'DM Serif Display',serif; font-size:1.3rem; }
  .hero { display:grid; grid-template-columns:1fr 1fr; min-height:60vh; align-items:center; padding:4rem 2rem; gap:3rem; }
  @media(max-width:768px){.hero{grid-template-columns:1fr;}}
  .hero h1 { font-family:'DM Serif Display',serif; font-size:clamp(2.5rem,4vw,4rem); line-height:1.1; margin-bottom:1rem; }
  .hero .bio { font-size:1.05rem; color:#555; line-height:1.7; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.5rem; }
  .post { background:var(--card-bg); border-radius:20px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.04); transition:transform 0.3s,box-shadow 0.3s; padding:0; }
  .post:hover { transform:translateY(-6px); box-shadow:0 16px 40px rgba(0,0,0,0.1); }
  .post-body { padding:1.5rem; }
  .post h2 { font-family:'DM Serif Display',serif; font-size:1.3rem; } .post h2 a { color:var(--text); }
",

'magazine' => "
  :root { --accent:#$accent; --bg:#fff; --text:#111; --card-bg:#fff; --border:rgba(0,0,0,0.1); }
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
  body { font-family:'Open Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#fff; border-bottom:3px solid var(--text); padding:0.75rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Libre Baskerville',serif; font-size:1.6rem; font-weight:700; letter-spacing:-1px; }
  .hero { padding:3rem 1.5rem 2rem; border-bottom:1px solid rgba(0,0,0,0.1); text-align:center; }
  .hero h1 { font-family:'Libre Baskerville',serif; font-size:clamp(2rem,4vw,3rem); font-weight:700; }
  .hero .bio { color:#444; margin-top:0.75rem; }
  .post-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.5rem; }
  @media(max-width:900px){.post-grid{grid-template-columns:1fr 1fr;}}
  @media(max-width:600px){.post-grid{grid-template-columns:1fr;}}
  .post { background:#fff; border:1px solid rgba(0,0,0,0.1); border-radius:4px; padding:1.25rem; }
  .post h2 { font-family:'Libre Baskerville',serif; font-size:1.15rem; line-height:1.3; } .post h2 a { color:var(--text); }
  .post h2 a:hover { color:var(--accent); }
",

'minimal' => "
  :root { --accent:#$accent; --bg:#ffffff; --text:#0A0A0A; --card-bg:#fff; --border:rgba(0,0,0,0.06); }
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
  body { font-family:'Outfit',sans-serif; background:var(--bg); color:var(--text); font-weight:300; }
  .navbar { padding:2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-size:0.95rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; }
  .hero { padding:8rem 1.5rem; text-align:left; max-width:700px; margin:0 auto; }
  .hero h1 { font-size:clamp(2rem,5vw,3.5rem); font-weight:300; letter-spacing:-0.02em; line-height:1.2; margin-bottom:1.5rem; }
  .hero .bio { font-size:1rem; color:#666; line-height:1.8; }
  .post-grid { display:grid; grid-template-columns:1fr; max-width:700px; margin:0 auto; gap:0; }
  .post { border-top:1px solid rgba(0,0,0,0.08); padding:2rem 0; background:transparent; }
  .post:last-child { border-bottom:1px solid rgba(0,0,0,0.08); }
  .post h2 { font-size:1.25rem; font-weight:400; margin-bottom:0.5rem; } .post h2 a { color:var(--text); }
  .post h2 a:hover { color:var(--accent); }
  .meta { font-size:0.8rem; color:#aaa; letter-spacing:0.05em; text-transform:uppercase; }
",

'studio' => "
  :root { --accent:#$accent; --bg:#F7F5F2; --text:#1A1A1A; --card-bg:#fff; --border:rgba(0,0,0,0.06); }
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  body { font-family:'Plus Jakarta Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:var(--text); color:#fff; padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { color:#fff; font-weight:800; font-size:1rem; letter-spacing:-0.02em; }
  .nav-links a { color:rgba(255,255,255,0.7); font-size:0.85rem; }
  .hero { padding:6rem 2rem; background:var(--text); color:#fff; }
  .hero h1 { font-size:clamp(2.5rem,5vw,4.5rem); font-weight:800; letter-spacing:-0.04em; line-height:1.05; margin-bottom:1.5rem; }
  .hero .bio { font-size:1.1rem; color:rgba(255,255,255,0.65); max-width:580px; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:1.25rem; }
  .post { background:var(--card-bg); border-radius:16px; padding:1.75rem; transition:transform 0.25s; }
  .post:hover { transform:scale(1.02); }
  .post h2 { font-size:1.2rem; font-weight:700; } .post h2 a { color:var(--text); }
",

'local' => "
  :root { --accent:#$accent; --bg:#FFFDF5; --text:#1A1200; --card-bg:#fff; --border:rgba(0,0,0,0.08); }
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
  body { font-family:'Nunito',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:#fff; border-bottom:2px solid rgba(0,0,0,0.06); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-weight:800; font-size:1.2rem; color:var(--accent); }
  .hero { padding:5rem 1.5rem; text-align:center; background:linear-gradient(180deg,#FFFDF5 0%,#FFF8E1 100%); }
  .hero h1 { font-size:clamp(2rem,5vw,3.5rem); font-weight:800; margin-bottom:1rem; }
  .hero .bio { font-size:1.05rem; color:#5C4A00; max-width:560px; margin:0 auto; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.5rem; }
  .post { background:#fff; border:2px solid rgba(0,0,0,0.06); border-radius:20px; padding:1.5rem; transition:border-color 0.2s,transform 0.2s; }
  .post:hover { border-color:var(--accent); transform:translateY(-3px); }
  .post h2 { font-size:1.15rem; font-weight:700; } .post h2 a { color:var(--text); }
",

'academy' => "
  :root { --accent:#$accent; --bg:#F0F4FF; --text:#0F1B3D; --card-bg:#fff; --border:rgba(0,0,0,0.06); }
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap');
  body { font-family:'IBM Plex Sans',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:var(--text); padding:1rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { color:#fff; font-weight:700; font-size:1.05rem; }
  .nav-links a { color:rgba(255,255,255,0.75); font-size:0.9rem; }
  .hero { padding:5rem 1.5rem; background:var(--text); color:#fff; text-align:center; }
  .hero h1 { font-family:'IBM Plex Serif',serif; font-size:clamp(2rem,4vw,3.5rem); margin-bottom:1rem; }
  .hero .bio { color:rgba(255,255,255,0.7); max-width:580px; margin:0 auto; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:1.5rem; }
  .post { background:var(--card-bg); border-left:4px solid var(--accent); border-radius:0 12px 12px 0; padding:1.5rem; transition:box-shadow 0.3s; }
  .post:hover { box-shadow:0 8px 24px rgba(15,27,61,0.1); }
  .post h2 { font-family:'IBM Plex Serif',serif; font-size:1.2rem; } .post h2 a { color:var(--text); }
",

'bottega' => "
  :root { --accent:#$accent; --bg:#FAF7F2; --text:#2D1F0E; --card-bg:#FFF8EF; --border:rgba(92,58,20,0.12); }
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500&display=swap');
  body { font-family:'Jost',sans-serif; background:var(--bg); color:var(--text); }
  .navbar { background:var(--text); padding:1.25rem 2rem; display:flex; justify-content:space-between; align-items:center; }
  .nav-brand { font-family:'Cormorant Garamond',serif; color:#F5DEB3; font-size:1.4rem; font-weight:600; letter-spacing:0.02em; }
  .nav-links a { color:rgba(245,222,179,0.75); font-size:0.85rem; letter-spacing:0.05em; }
  .hero { padding:6rem 1.5rem; text-align:center; background:linear-gradient(180deg,#FAF7F2 0%,#F5EDD8 100%); }
  .hero h1 { font-family:'Cormorant Garamond',serif; font-size:clamp(2.5rem,6vw,5rem); font-weight:600; line-height:1.1; letter-spacing:-0.01em; margin-bottom:1rem; }
  .hero .bio { font-size:1rem; color:#6B4A22; max-width:560px; margin:0 auto; letter-spacing:0.02em; }
  .post-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.75rem; }
  .post { background:var(--card-bg); border:1px solid var(--border); border-radius:8px; padding:1.5rem; transition:box-shadow 0.3s; }
  .post:hover { box-shadow:0 8px 30px rgba(92,58,20,0.1); }
  .post h2 { font-family:'Cormorant Garamond',serif; font-size:1.4rem; font-weight:600; } .post h2 a { color:var(--text); }
",
];

// Selezione CSS tema + inject accent color
$activeCss = $themeCSS[$theme] ?? $themeCSS['classic'];
// Sostituisce #$accent con il valore reale
$activeCss = str_replace('#$accent', $accent, $activeCss);

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
    "name": "<?= addslashes($site['title'] ?? $user['name'] ?? '') ?>",
    "description": "<?= addslashes($site['bio'] ?? '') ?>",
    "url": "<?= $siteUrl ?>"
  }
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    /* ─── TEMA: <?= $theme ?> ─── */
    <?= $activeCss ?>

    /* ─── STILI COMUNI (non sovrascrivibili dal tema) ─── */
    a { text-decoration: none; transition: color 0.2s; }
    .nav-links a { transition: color 0.2s; }
    .nav-links a:hover { color: var(--accent, #7F77DD); }
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
    /* Custom CSS iniettato dall'AI */
    <?= $customCss ?>
    @media (max-width: 768px) {
      .hero { padding: 3.5rem 1rem; }
      .container { padding: 2rem 1rem; }
      .single-post { padding: 1.5rem; border-radius: 12px; }
    }
  </style>
</head>
<body class="theme-<?= h($theme) ?>">

<!-- NAVBAR -->
<nav class="navbar">
  <a href="<?= $siteUrl ?>" class="nav-brand">
    <?php if ($logoUrl): ?><img src="<?= h($logoUrl) ?>" alt="Logo" style="height:40px;border-radius:8px;">
    <?php else: ?><?= $title ?><?php endif; ?>
  </a>
  <?php if ($menuLinks): ?>
  <div class="nav-links">
    <?php foreach ($menuLinks as $link): ?>
      <a href="<?= h($link['url']) ?>"><?= h($link['label']) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</nav>

<?php if (!$single): ?>
<!-- HERO -->
<?php 
$heroStyle = '';
if ($coverUrl) {
    $heroStyle = 'background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url(' . h($coverUrl) . ') center/cover no-repeat; color: #fff; padding: 8rem 2rem; border-radius: 0 0 40px 40px;';
}
?>
<header class="hero" style="<?= $heroStyle ?>">
  <h1 style="<?= $coverUrl ? 'color:#fff;' : '' ?>"><?= $title ?></h1>
  <?php if ($heroTagline): ?><p class="hero-tagline" style="font-size: clamp(1.2rem, 3vw, 1.6rem); font-weight: 600; margin-bottom: 1rem; <?= $coverUrl ? 'color:rgba(255,255,255,0.9);' : 'color:var(--accent);' ?>"><?= $heroTagline ?></p><?php endif; ?>
  <?php if ($bio): ?><p class="bio" style="<?= $coverUrl ? 'color:rgba(255,255,255,0.7);' : '' ?>"><?= $bio ?></p><?php endif; ?>

  <?php if ($sources): ?>
  <div class="socials">
    <?php foreach ($sources as $source): ?>
      <a class="social-link" href="<?= h($source['url']) ?>" target="_blank" rel="noopener">
        <?= $icons[$source['platform']] ?? '🔗' ?> <?= h($source['label'] ?: ucfirst($source['platform'])) ?>
      </a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
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

  <!-- POST IN EVIDENZA -->
  <?php if ($featuredPost): $fp = $featuredPost; $fpUrl = $siteUrl . '/' . h($fp['slug'] ?? ''); ?>
  <div class="featured-post">
    <div>
      <div class="featured-label">⭐ In evidenza</div>
      <h2><a href="<?= $fpUrl ?>"><?= h(postTitle($fp)) ?></a></h2>
      <p class="excerpt"><?= h(postExcerpt($fp)) ?></p>
      <a class="featured-cta" href="<?= $fpUrl ?>"><?= $ctaText ?> →</a>
    </div>
    <?= mediaHtml($fp) ?>
  </div>
  <?php endif; ?>

  <!-- FILTRI -->
  <?php
  $allPlatforms = array_unique(array_column($posts, 'platform'));
  $allTags = [];
  foreach ($posts as $p) { if (!empty($p['tags'])) foreach ($p['tags'] as $t) { $allTags[] = strtolower(trim($t)); } }
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
    <?php foreach ($posts as $p): if (!empty($p['featured'])) continue; // Il featured è già mostrato sopra
      $purl = $siteUrl . '/' . h($p['slug'] ?? '');
      $ptagStr = implode(' ', array_map(fn($t) => 'tag-' . strtolower(trim($t)), $p['tags'] ?? []));
    ?>
    <article class="post" data-platform="platform-<?= h($p['platform']) ?>" data-tags="<?= h($ptagStr) ?>">
      <?= mediaHtml($p) ?>
      <div class="post-body">
        <div class="meta">
          <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
          <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
          <?php if (strtoupper($p['media_type'] ?? '') === 'VIDEO'): ?><span class="badge">Video</span><?php endif; ?>
        </div>
        <h2><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h2>
        <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
        <?php if (!empty($p['source_url'])): ?>
          <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">Originale</a>
        <?php endif; ?>
        <?php if (!empty($p['tags'])): ?>
        <div class="tags">
          <?php foreach ($p['tags'] as $tag): ?><span class="tag">#<?= h($tag) ?></span><?php endforeach; ?>
        </div>
        <?php endif; ?>
      </div>
    </article>
    <?php endforeach; ?>
  </section>
  <?php else: ?>
  <div style="text-align:center;padding:5rem 1rem;opacity:0.5;">
    <div style="font-size:4rem;margin-bottom:1rem;">✨</div>
    <p style="font-size:1.2rem;">Il sito è pronto. In attesa di nuovi contenuti.</p>
  </div>
  <?php endif; ?>

<?php endif; ?>
</main>

<footer class="footer">
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
    <span>© <?= date('Y') ?> <?= $title ?>. Creato con <a href="<?= BASE_URL ?>">SocialToSite</a>.</span>
    <a href="<?= $siteUrl ?>/sitemap.xml">Sitemap</a>
  </div>
</footer>

<script>
document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.post').forEach(p => observer.observe(p));

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
          const show = filter === 'all'
            || (filter.startsWith('platform-') && post.getAttribute('data-platform') === filter)
            || (filter.startsWith('tag-') && post.getAttribute('data-tags').split(' ').includes(filter));
          post.classList.toggle('hidden', !show);
          if (show) { post.classList.remove('visible'); setTimeout(() => post.classList.add('visible'), 50); }
        });
      });
    });
  }
});
</script>
</body>
</html>
