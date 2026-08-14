<?php
// Renderer pubblico personalizzabile per piani Professional / Agency.
// I siti Base continuano ad usare public/site.php.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';

$slug = trim((string)($_GET['slug'] ?? ''));
if ($slug === '') { http_response_code(404); echo 'Sito non trovato'; exit; }

$user = DB::fetch('SELECT * FROM users WHERE slug=?', [$slug]);
if (!$user) { http_response_code(404); echo 'Sito non trovato'; exit; }
$plan = strtolower(trim((string)($user['plan'] ?? 'base')));
if (!in_array($plan, ['professional', 'pro', 'agency'], true)) {
    require __DIR__ . '/site.php';
    exit;
}

$site = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$user['id']]) ?: [];
$posts = DB::fetchAll('SELECT * FROM posts WHERE user_id=? AND published=1 ORDER BY featured DESC, published_at DESC, id DESC', [$user['id']]);

function ph($value): string { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
function pmedia($value): string {
    $url = trim((string)$value);
    if ($url === '') return '';
    if (str_starts_with($url, '/public/media/')) return $url;
    if (filter_var($url, FILTER_VALIDATE_URL) && preg_match('/^https?:\/\//i', $url)) return $url;
    return '';
}
function ptext($value): string {
    $text = html_entity_decode(strip_tags((string)$value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/', ' ', $text));
}
function pbody($value): string {
    $text = html_entity_decode(strip_tags((string)$value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return nl2br(ph(trim($text)));
}
function pslug($value): string {
    $value = strtolower(trim((string)$value));
    $value = preg_replace('/[^a-z0-9]+/i', '-', $value);
    return trim($value, '-');
}

$style = [];
if (!empty($site['site_ai_data'])) {
    $decoded = json_decode((string)$site['site_ai_data'], true);
    if (is_array($decoded)) $style = $decoded;
}

// Anteprima live del builder: sovrascrive solo in memoria, non salva nulla.
if (!empty($_GET['preview_data'])) {
    $encoded = strtr((string)$_GET['preview_data'], '-_', '+/');
    $pad = strlen($encoded) % 4;
    if ($pad) $encoded .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode($encoded, true);
    if ($decoded !== false) {
        $preview = json_decode($decoded, true);
        if (is_array($preview)) $style = array_replace_recursive($style, $preview);
    }
}

$palette = is_array($style['color_palette'] ?? null) ? $style['color_palette'] : [];
$ui = is_array($style['ui_style'] ?? null) ? $style['ui_style'] : [];
$layout = is_array($style['layout_recipe'] ?? null) ? $style['layout_recipe'] : [];

$bg = $palette['background'] ?? '#f6f7fb';
$surface = $palette['surface'] ?? '#ffffff';
$text = $palette['text'] ?? '#182033';
$muted = $palette['text_muted'] ?? '#667085';
$primary = $palette['primary'] ?? ($site['accent_color'] ?? '#5b5ce2');
$secondary = $palette['secondary'] ?? '#e8e9ff';
$fontHeading = $style['font_heading'] ?? 'Inter';
$fontBody = $style['font_body'] ?? 'Inter';
$radius = $ui['radius'] ?? '18px';
$shadow = $ui['card_shadow'] ?? '0 12px 36px rgba(24,32,51,.08)';
$glass = !empty($ui['glassmorphism']);
$hero = $layout['hero'] ?? 'product';
$nav = $layout['nav'] ?? 'floating';
$cards = $layout['cards'] ?? 'product';
$density = $layout['density'] ?? 'balanced';

$allowedHero = ['product','split','editorial','immersive','human'];
$allowedNav = ['solid','transparent','floating'];
$allowedCards = ['product','editorial','bold','cinematic','soft'];
$allowedDensity = ['compact','balanced','airy'];
if (!in_array($hero, $allowedHero, true)) $hero = 'product';
if (!in_array($nav, $allowedNav, true)) $nav = 'floating';
if (!in_array($cards, $allowedCards, true)) $cards = 'product';
if (!in_array($density, $allowedDensity, true)) $density = 'balanced';

$title = trim((string)($site['title'] ?? $user['name'] ?? $slug));
$bio = trim((string)(($site['profile_summary'] ?? '') ?: ($site['bio'] ?? '')));
$heroTagline = trim((string)($site['hero_tagline'] ?? ''));
$cover = pmedia($site['cover_url'] ?? '');
$logo = pmedia($site['logo_url'] ?? '');
$footer = trim((string)($site['footer_text'] ?? ''));
$customCss = (string)($style['custom_css'] ?? $site['custom_css'] ?? '');
$postSlug = trim((string)($_GET['post'] ?? ''), '/');
$activeTag = strtolower(trim((string)($_GET['tag'] ?? '')));

$tags = [];
foreach ($posts as $post) {
    $decodedTags = json_decode((string)($post['tags'] ?? '[]'), true);
    if (!is_array($decodedTags)) $decodedTags = [];
    foreach ($decodedTags as $tag) {
        $label = trim((string)$tag);
        if ($label !== '') $tags[strtolower($label)] = $label;
    }
}

if ($activeTag !== '') {
    $posts = array_values(array_filter($posts, function($post) use ($activeTag) {
        $decodedTags = json_decode((string)($post['tags'] ?? '[]'), true);
        if (!is_array($decodedTags)) return false;
        foreach ($decodedTags as $tag) if (pslug($tag) === pslug($activeTag)) return true;
        return false;
    }));
}

$single = null;
if ($postSlug !== '') {
    foreach ($posts as $post) {
        if (trim((string)($post['slug'] ?? '')) === $postSlug) { $single = $post; break; }
    }
    if (!$single) { http_response_code(404); }
}

$base = '/' . rawurlencode($slug);
$homeUrl = $base;
$contentsUrl = $base . '#contenuti';
$contactUrl = $base . '#contatti';

$heroClass = 'hero-' . $hero;
$navClass = 'nav-' . $nav;
$cardsClass = 'cards-' . $cards;
$densityClass = 'density-' . $density;
?><!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=ph($single ? (($single['edited_title'] ?? '') ?: ($single['generated_title'] ?? $title)) : $title)?></title>
<meta name="description" content="<?=ph($single ? ptext(($single['edited_excerpt'] ?? '') ?: ($single['generated_excerpt'] ?? '')) : $bio)?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:<?=ph($bg)?>;--surface:<?=ph($surface)?>;--text:<?=ph($text)?>;--muted:<?=ph($muted)?>;--primary:<?=ph($primary)?>;--secondary:<?=ph($secondary)?>;--radius:<?=ph($radius)?>;--shadow:<?=ph($shadow)?>;--fh:'<?=ph($fontHeading)?>',sans-serif;--fb:'<?=ph($fontBody)?>',sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:var(--fb);line-height:1.6}a{color:inherit}img{max-width:100%;display:block}.wrap{width:min(1180px,calc(100% - 40px));margin:auto}.density-compact .wrap{width:min(1040px,calc(100% - 32px))}.density-airy .wrap{width:min(1260px,calc(100% - 48px))}
.site-nav{z-index:20;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:15px 22px}.nav-solid{position:sticky;top:0;background:color-mix(in srgb,var(--surface) 96%,transparent);border-bottom:1px solid color-mix(in srgb,var(--text) 10%,transparent)}.nav-floating{position:sticky;top:14px;width:min(1100px,calc(100% - 32px));margin:14px auto -74px;border:1px solid color-mix(in srgb,var(--text) 10%,transparent);border-radius:999px;background:color-mix(in srgb,var(--surface) 88%,transparent);box-shadow:var(--shadow);backdrop-filter:blur(18px)}.nav-transparent{position:absolute;top:0;left:0;right:0;background:transparent;color:inherit}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--fh);font-weight:800}.brand img{width:36px;height:36px;object-fit:cover;border-radius:10px}.menu{display:flex;align-items:center;gap:20px;font-size:14px;font-weight:650}.menu a{text-decoration:none;opacity:.72}.menu a:hover{opacity:1;color:var(--primary)}
.hero{position:relative;overflow:hidden;padding:130px 0 82px}.density-compact .hero{padding-top:105px;padding-bottom:58px}.density-airy .hero{padding-top:160px;padding-bottom:110px}.hero h1{font-family:var(--fh);font-size:clamp(44px,7vw,88px);line-height:.98;letter-spacing:-.045em;margin:0 0 22px}.hero p{font-size:clamp(18px,2vw,23px);max-width:760px;color:var(--muted);margin:0}.hero-inner{position:relative;z-index:2}.hero-product .hero-inner,.hero-editorial .hero-inner{text-align:center}.hero-product p,.hero-editorial p{margin-left:auto;margin-right:auto}.hero-editorial h1{font-family:var(--fh);font-weight:500;max-width:950px;margin-left:auto;margin-right:auto}.hero-split .hero-inner,.hero-human .hero-inner{display:grid;grid-template-columns:1.1fr .9fr;gap:54px;align-items:center}.hero-media{min-height:370px;border-radius:calc(var(--radius) * 1.25);background:linear-gradient(135deg,var(--secondary),var(--primary));box-shadow:var(--shadow);overflow:hidden}.hero-media img{width:100%;height:100%;min-height:370px;object-fit:cover}.hero-human .hero-media{border-radius:50%;aspect-ratio:1;max-width:430px;justify-self:end}.hero-immersive{min-height:78vh;display:flex;align-items:flex-end;color:#fff;background:#131827}.hero-immersive:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.72)),var(--hero-image,linear-gradient(135deg,#171d31,#343b68));background-size:cover;background-position:center}.hero-immersive p{color:rgba(255,255,255,.78)}
.kicker{display:inline-flex;padding:7px 11px;border-radius:999px;background:color-mix(in srgb,var(--primary) 13%,transparent);color:var(--primary);font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px}.section{padding:74px 0}.density-compact .section{padding:48px 0}.density-airy .section{padding:96px 0}.section-head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:28px}.section h2{font-family:var(--fh);font-size:clamp(30px,4vw,48px);line-height:1.05;letter-spacing:-.035em;margin:0}.section-head p{max-width:540px;margin:0;color:var(--muted)}
.posts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px}.card{background:var(--surface);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);border:1px solid color-mix(in srgb,var(--text) 8%,transparent)}.card-media{aspect-ratio:16/10;background:var(--secondary);overflow:hidden}.card-media img{width:100%;height:100%;object-fit:cover;transition:transform .35s}.card:hover .card-media img{transform:scale(1.035)}.card-body{padding:22px}.card h3{font-family:var(--fh);font-size:22px;line-height:1.15;margin:0 0 10px}.card p{margin:0;color:var(--muted);font-size:14px}.card a{text-decoration:none}.cards-editorial .posts{grid-template-columns:1.35fr .65fr}.cards-editorial .card:first-child{grid-row:span 2}.cards-editorial .card:first-child .card-media{aspect-ratio:16/12}.cards-editorial .card:first-child h3{font-size:32px}.cards-cinematic .posts{grid-template-columns:repeat(2,minmax(0,1fr))}.cards-cinematic .card-media{aspect-ratio:16/11}.cards-cinematic .card h3{font-size:27px}.cards-bold .posts{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.cards-bold .card-body{padding:16px}.cards-bold .card h3{font-size:17px}.cards-soft .card{box-shadow:none;border-color:color-mix(in srgb,var(--text) 7%,transparent)}
.tags{display:flex;gap:9px;flex-wrap:wrap}.tag{display:inline-flex;padding:8px 13px;border-radius:999px;text-decoration:none;background:var(--surface);border:1px solid color-mix(in srgb,var(--text) 10%,transparent);font-size:13px}.tag:hover{border-color:var(--primary);color:var(--primary)}.post-page{padding:125px 0 90px}.article{width:min(820px,calc(100% - 40px));margin:auto}.article h1{font-family:var(--fh);font-size:clamp(40px,6vw,70px);line-height:1.02;letter-spacing:-.045em}.article .lead{font-size:20px;color:var(--muted)}.article .body{font-size:18px;line-height:1.8;margin-top:34px}.article img{border-radius:var(--radius);margin:28px 0;box-shadow:var(--shadow)}footer{padding:42px 0;border-top:1px solid color-mix(in srgb,var(--text) 10%,transparent);color:var(--muted);font-size:13px}.contact-box{padding:30px;background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow)}
<?php if ($glass): ?>.card,.contact-box,.nav-floating{background:color-mix(in srgb,var(--surface) 74%,transparent);backdrop-filter:blur(20px)}<?php endif; ?>
<?= $customCss ?>
@media(max-width:850px){.menu{display:none}.hero-split .hero-inner,.hero-human .hero-inner{grid-template-columns:1fr}.hero-human .hero-media{justify-self:start}.posts,.cards-editorial .posts,.cards-cinematic .posts,.cards-bold .posts{grid-template-columns:1fr}.nav-floating{top:8px}.hero{padding-top:115px}.wrap{width:min(100% - 28px,1180px)}}
</style>
</head>
<body class="<?=$densityClass?> <?=$cardsClass?>">
<nav class="site-nav <?=$navClass?>">
  <a class="brand" href="<?=ph($homeUrl)?>"><?php if($logo):?><img src="<?=ph($logo)?>" alt=""><?php endif;?><span><?=ph($title)?></span></a>
  <div class="menu"><a href="<?=ph($homeUrl)?>">Home</a><a href="<?=ph($contentsUrl)?>">Contenuti</a><?php if($tags):?><a href="<?=$base?>#argomenti">Argomenti</a><?php endif;?><a href="<?=ph($contactUrl)?>">Contatti</a></div>
</nav>

<?php if ($single): ?>
<main class="post-page">
  <article class="article">
    <a href="<?=ph($homeUrl)?>" style="text-decoration:none;color:var(--primary);font-weight:700">← Torna al sito</a>
    <h1><?=ph(($single['edited_title'] ?? '') ?: ($single['generated_title'] ?? 'Contenuto'))?></h1>
    <?php $lead=(($single['edited_excerpt'] ?? '') ?: ($single['generated_excerpt'] ?? '')); if($lead):?><p class="lead"><?=ph(ptext($lead))?></p><?php endif;?>
    <?php $m=pmedia($single['media_url'] ?? ''); if($m):?><img src="<?=ph($m)?>" alt=""><?php endif;?>
    <div class="body"><?=pbody(($single['edited_body'] ?? '') ?: ($single['generated_body'] ?? ($single['raw_content'] ?? '')))?></div>
  </article>
</main>
<?php else: ?>
<header class="hero <?=$heroClass?>" <?php if($hero==='immersive' && $cover):?>style="--hero-image:url('<?=ph($cover)?>')"<?php endif;?>>
  <div class="wrap hero-inner">
    <div>
      <span class="kicker"><?=ph($plan==='agency'?'Agency':'Professional')?></span>
      <h1><?=ph($title)?></h1>
      <?php if($heroTagline || $bio):?><p><?=ph($heroTagline ?: $bio)?></p><?php endif;?>
    </div>
    <?php if(in_array($hero,['split','human'],true)):?><div class="hero-media"><?php if($cover || $logo):?><img src="<?=ph($cover ?: $logo)?>" alt="<?=ph($title)?>"><?php endif;?></div><?php endif;?>
  </div>
</header>

<?php if($bio):?><section class="section"><div class="wrap"><div class="section-head"><h2>In breve</h2><p><?=ph($bio)?></p></div></div></section><?php endif;?>

<section class="section" id="contenuti"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Aggiornamenti</span><h2>Contenuti</h2></div><p>Articoli, approfondimenti e aggiornamenti pubblicati recentemente.</p></div>
  <?php if($posts):?><div class="posts">
  <?php foreach($posts as $post): $pt=(($post['edited_title'] ?? '') ?: ($post['generated_title'] ?? 'Contenuto')); $pe=(($post['edited_excerpt'] ?? '') ?: ($post['generated_excerpt'] ?? '')); $pm=pmedia($post['media_url'] ?? ''); ?>
    <article class="card"><a href="<?=$base?>/<?=rawurlencode((string)($post['slug'] ?? ''))?>"><?php if($pm):?><div class="card-media"><img src="<?=ph($pm)?>" alt="<?=ph($pt)?>"></div><?php endif;?><div class="card-body"><h3><?=ph($pt)?></h3><?php if($pe):?><p><?=ph(mb_substr(ptext($pe),0,180))?></p><?php endif;?></div></a></article>
  <?php endforeach;?></div><?php else:?><p style="color:var(--muted)">Nessun contenuto pubblicato.</p><?php endif;?>
</div></section>

<?php if($tags):?><section class="section" id="argomenti"><div class="wrap"><div class="section-head"><h2>Argomenti</h2><p>Esplora i contenuti per tema.</p></div><div class="tags"><?php foreach($tags as $tag):?><a class="tag" href="<?=$base?>/categoria/<?=rawurlencode(pslug($tag))?>"><?=ph($tag)?></a><?php endforeach;?></div></div></section><?php endif;?>

<section class="section" id="contatti"><div class="wrap"><div class="contact-box"><span class="kicker">Contatti</span><h2 style="font-family:var(--fh);margin:0 0 10px">Segui <?=ph($title)?></h2><p style="margin:0;color:var(--muted)">Consulta i canali ufficiali e gli aggiornamenti pubblicati dal profilo.</p></div></div></section>
<?php endif;?>
<footer><div class="wrap"><?=ph($footer ?: ('© ' . date('Y') . ' ' . $title))?></div></footer>
</body></html>
