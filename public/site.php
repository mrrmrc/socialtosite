<?php
// public/site.php — Pagina pubblica HTML del sito generato
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// ── Content Security Policy ────────────────────────────────────────────────
// Seconda linea di difesa dietro la sanitizzazione di bodyHtml(): anche se un
// tag pericoloso passasse il filtro, il browser rifiuterebbe di eseguirlo.
// Gli script inline legittimi di questa pagina portano la nonce; uno script
// iniettato in un articolo non può conoscerla, quindi non viene eseguito.
$cspNonce = base64_encode(random_bytes(16));
header(
    "Content-Security-Policy: "
    . "default-src 'self'; "
    . "script-src 'self' 'nonce-$cspNonce'; "
    // Gli attributi style="" inline sono usati in tutto il layout e non sono
    // coprribili da nonce; la sanitizzazione li rimuove comunque dagli articoli.
    . "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    . "font-src 'self' https://fonts.gstatic.com data:; "
    // Le immagini arrivano dalle CDN dei social, non elencabili a priori.
    . "img-src 'self' https: data:; "
    . "media-src 'self' https:; "
    . "connect-src 'self'; "
    . "object-src 'none'; "
    . "base-uri 'none'; "
    . "form-action 'self'; "
    . "frame-ancestors 'self'"
);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../api/services/seo_foundation.php';
require_once __DIR__ . '/../api/services/reachability.php';

$slug   = $_GET['slug']   ?? '';
$action = $_GET['action'] ?? 'site';
$view   = $_GET['view']   ?? '';

if (!$slug) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$user = DB::fetch('SELECT * FROM users WHERE slug=?', [$slug]);
if (!$user) { http_response_code(404); echo '<h1>Sito non trovato</h1>'; exit; }

$site  = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$user['id']]);
if (!$site) $site = []; // Fallback sicuro: evita crash su array access
$allowedLivingModes = ['pulse', 'stories', 'constellation', 'timeline', 'compass', 'mixer', 'cinema', 'answers', 'atlas', 'adaptive'];
$livingSpaceMode = strtolower(trim((string)($site['living_space_mode'] ?? 'pulse')));
if (!in_array($livingSpaceMode, $allowedLivingModes, true)) $livingSpaceMode = 'pulse';
$livingModeNames = ['pulse'=>'Pulse Wall','stories'=>'Storie','constellation'=>'Costellazione','timeline'=>'Memoria','compass'=>'Bussola','mixer'=>'Mixer','cinema'=>'Cinema','answers'=>'Risposte','atlas'=>'Atlante','adaptive'=>'Adesso'];
$livingModeName = $livingModeNames[$livingSpaceMode] ?? 'Spazio Vivo';
$reachabilityProfile = ReachabilityNetwork::normalize(ReachabilityNetwork::decode($site['reachability_profile'] ?? null));
$sources = DB::fetchAll(
    'SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id DESC',
    [$user['id']]
);
$officialSiteUrl = trim((string)($reachabilityProfile['official_site_url'] ?? ''));
if ($officialSiteUrl === '') {
    foreach ($sources as $source) {
        if (strtolower((string)($source['platform'] ?? '')) !== 'website') continue;
        $fallbackProfile = ReachabilityNetwork::normalize(['official_site_url' => $source['url'] ?? '']);
        $officialSiteUrl = $fallbackProfile['official_site_url'];
        if ($officialSiteUrl !== '') break;
    }
}
$businessProfileUrl = trim((string)($reachabilityProfile['business_profile_url'] ?? ''));
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

$allPosts = $posts;
$chronologicalPosts = $allPosts;
usort($chronologicalPosts, static function (array $a, array $b): int {
    return strtotime((string)($b['published_at'] ?? $b['imported_at'] ?? '1970-01-01'))
        <=> strtotime((string)($a['published_at'] ?? $a['imported_at'] ?? '1970-01-01'));
});
$understandingForSeo = !empty($site['site_understanding']) ? json_decode($site['site_understanding'], true) : [];
if (!is_array($understandingForSeo)) $understandingForSeo = [];
$seoFoundation = SeoFoundation::cachedOrFallback((int)$user['id'], $site, $sources, $allPosts);
$foundationPagesBySlug = [];
foreach (($seoFoundation['pages'] ?? []) as $page) {
    $pageSlug = strtolower(trim((string)($page['slug'] ?? '')));
    if ($pageSlug !== '') $foundationPagesBySlug[$pageSlug] = $page;
}
if ($allPosts) {
    $foundationPagesBySlug['contenuti'] = [
        'slug' => 'contenuti',
        'title' => 'Contenuti e aggiornamenti',
        'meta_description' => 'Esperienze, approfondimenti e aggiornamenti pubblicati direttamente da ' . ($site['title'] ?? $user['name'] ?? $slug) . '.',
        'intro' => 'Una raccolta ordinata dei contenuti pubblicati dall’attività, con collegamenti alle fonti social originali.',
        'sections' => [],
        'faq' => [],
        'page_type' => 'archive',
    ];
}
if ($sources) {
    $foundationPagesBySlug['contatti'] = [
        'slug' => 'contatti',
        'title' => 'Contatti e canali ufficiali',
        'meta_description' => 'Canali social e riferimenti ufficiali di ' . ($site['title'] ?? $user['name'] ?? $slug) . '.',
        'intro' => 'Per informazioni aggiornate e richieste dirette utilizza uno dei canali ufficiali verificati qui sotto.',
        'sections' => [],
        'faq' => [],
        'page_type' => 'contacts',
    ];
}

$activeTag = strtolower(trim($_GET['tag'] ?? ''));
if ($activeTag) {
    $filtered = [];
    foreach ($allPosts as $p) {
        $pTags = array_map('strtolower', $p['tags'] ?? []);
        $pTagSlugs = array_map('networkTopicSlug', $p['tags'] ?? []);
        if (in_array($activeTag, $pTags, true) || in_array($activeTag, $pTagSlugs, true)) {
            $filtered[] = $p;
        }
    }
    $posts = $filtered;
}

$postSlug = trim((string)($_GET['post'] ?? ''), '/');
$foundationPage = $postSlug !== '' ? ($foundationPagesBySlug[strtolower($postSlug)] ?? null) : null;
$single   = null;
if ($postSlug && !$foundationPage) {
    foreach ($allPosts as $p) { if (($p['slug'] ?? '') === $postSlug) { $single = $p; break; } }
}
if ($postSlug !== '' && !$foundationPage && !$single && $action === 'site') {
    http_response_code(404);
    echo '<!doctype html><html lang="it"><meta charset="utf-8"><title>Pagina non trovata</title><body><main><h1>Pagina non trovata</h1><p><a href="/' . htmlspecialchars($slug, ENT_QUOTES, 'UTF-8') . '">Torna al sito</a></p></main></body></html>';
    exit;
}
// ── Interruttore di sito: "Fatti trovare da Google" ────────────────────────
// Quando è spento il sito resta perfettamente raggiungibile da chi ha il link,
// ma chiede ai motori di non indicizzarlo. Serve a chi sta ancora preparando i
// contenuti: un sito vuoto finito nell'indice è un danno che poi va rimediato.
// Il valore predefinito è "acceso": nessun sito già online si spegne da solo.
$searchVisible = !array_key_exists('search_visible', $site) || !empty($site['search_visible']);

if (!$searchVisible) {
    // nofollow oltre a noindex: se il sito non deve essere trovato, non ha
    // senso far consumare a Google il budget di scansione sui link interni.
    header('X-Robots-Tag: noindex, nofollow', true);
} elseif ($single && !empty($single['noindex'])) {
    // Esclusione del singolo articolo: la pagina esce dall'indice ma i link
    // continuano a trasmettere valore al resto del sito.
    header('X-Robots-Tag: noindex, follow', true);
}

// ── Sitemap XML ─────────────────────────────────────────────────────────────
if ($action === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    $base = app_base_url() . '/' . $slug;
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
    // Sito non visibile: sitemap valida ma vuota. Proporre a Google gli URL di
    // pagine marcate noindex sarebbe un segnale contraddittorio.
    if (!$searchVisible) { echo '</urlset>'; exit; }
    $latestSiteDate = '';
    foreach ($chronologicalPosts as $chronologicalPost) {
        $candidateDate = $chronologicalPost['updated_at'] ?? $chronologicalPost['published_at'] ?? $chronologicalPost['imported_at'] ?? '';
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$candidateDate, $candidateMatch)) {
            if ($candidateMatch[0] > $latestSiteDate) $latestSiteDate = $candidateMatch[0];
        }
    }
    $homeLastmod = $latestSiteDate !== '' ? "<lastmod>$latestSiteDate</lastmod>" : '';
    echo "  <url><loc>$base</loc>$homeLastmod<changefreq>daily</changefreq><priority>1.0</priority></url>\n";
    foreach ($foundationPagesBySlug as $page) {
        $pageUrl = $base . '/' . rawurlencode($page['slug']);
        $foundationLastmod = !empty($site['seo_foundation_updated_at']) ? '<lastmod>' . substr($site['seo_foundation_updated_at'], 0, 10) . '</lastmod>' : '';
        echo "  <url><loc>" . htmlspecialchars($pageUrl, ENT_XML1, 'UTF-8') . "</loc>" . $foundationLastmod . "<changefreq>weekly</changefreq><priority>0.8</priority></url>\n";
    }
    $sitemapTags = [];
    foreach ($allPosts as $sitemapPost) {
        foreach ($sitemapPost['tags'] ?? [] as $sitemapTag) {
            $tagSlug = networkTopicSlug((string)$sitemapTag);
            if ($tagSlug === '') continue;
            $candidateDate = $sitemapPost['updated_at'] ?? $sitemapPost['published_at'] ?? $sitemapPost['imported_at'] ?? '';
            $tagDate = preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$candidateDate, $tagDateMatch) ? $tagDateMatch[0] : '';
            if (!isset($sitemapTags[$tagSlug]) || $tagDate > $sitemapTags[$tagSlug]) $sitemapTags[$tagSlug] = $tagDate;
        }
    }
    foreach ($sitemapTags as $tagSlug => $tagDate) {
        $categoryUrl = $base . '/categoria/' . rawurlencode($tagSlug);
        $tagLastmod = $tagDate !== '' ? "<lastmod>$tagDate</lastmod>" : '';
        echo "  <url><loc>" . htmlspecialchars($categoryUrl, ENT_XML1, 'UTF-8') . "</loc>$tagLastmod<changefreq>weekly</changefreq><priority>0.6</priority></url>\n";
    }
    
    // Posts
    foreach ($allPosts as $p) {
        if (!empty($p['noindex'])) continue;
        $loc = "$base/{$p['slug']}";
        $modSource = $p['updated_at'] ?? $p['published_at'] ?? $p['imported_at'] ?? '';
        $mod = preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$modSource, $modMatch) ? $modMatch[0] : '';
        $lastmodXml = $mod !== '' ? "<lastmod>$mod</lastmod>" : '';
        $locXml = htmlspecialchars($loc, ENT_XML1, 'UTF-8');
        $imageXml = '';
        if (!empty($p['media_url']) && strtolower((string)($p['media_type'] ?? '')) !== 'video') {
            $normalizedSitemapMedia = normalizeMediaUrl((string)$p['media_url']);
            if ($normalizedSitemapMedia !== '') {
                $mediaXml = htmlspecialchars($normalizedSitemapMedia, ENT_XML1, 'UTF-8');
                $captionXml = htmlspecialchars(postTitle($p), ENT_XML1, 'UTF-8');
                $imageXml = "<image:image><image:loc>$mediaXml</image:loc><image:caption>$captionXml</image:caption></image:image>";
            }
        }
        echo "  <url><loc>$locXml</loc>$lastmodXml$imageXml<priority>0.8</priority></url>\n";
    }
    echo '</urlset>';
    exit;
}

// ── RSS / Atom Feed ─────────────────────────────────────────────────────────
if ($action === 'feed') {
    header('Content-Type: application/atom+xml; charset=utf-8');
    $base = app_base_url() . '/' . $slug;
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
    $base = app_base_url() . '/' . $slug;
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
        echo "- [$t]($base/categoria/" . rawurlencode(networkTopicSlug($t)) . ")\n";
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
function networkTopicSlug(string $value): string {
    $value = trim(function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value));
    $ascii = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) : $value;
    if (is_string($ascii) && $ascii !== '') $value = $ascii;
    return trim((string)preg_replace('/[^a-z0-9]+/i', '-', $value), '-');
}

function isBadSiteIdentity(?string $value): bool {
    $value = mb_strtolower(trim((string)$value));
    if ($value === '' || mb_strlen($value) < 3) return true;
    foreach (['error', 'errore', 'facebook', 'login', 'sign in', 'sign up', 'not found', 'page not found', 'access denied'] as $needle) {
        if ($value === $needle || str_contains($value, $needle)) return true;
    }
    return false;
}

function prettySourceIdentity(array $sources, array $site = []): string {
    $siteTitle = trim((string)($site['title'] ?? ''));
    if (!isBadSiteIdentity($siteTitle)) return $siteTitle;

    foreach ($sources as $source) {
        $label = trim((string)($source['label'] ?? ''));
        if ($label !== '') {
            $label = preg_replace('/\b(facebook|instagram|youtube|tiktok|official|ufficiale)\b/i', ' ', $label);
            $label = preg_replace('/[_\-]+/', ' ', $label);
            $label = preg_replace('/(?<=\p{Ll})(?=\p{Lu})/u', ' ', $label);
            $label = preg_replace('/\s+/', ' ', $label);
            $label = ucwords(mb_strtolower(trim($label)));
            if (!isBadSiteIdentity($label)) return $label;
        }

        $url = trim((string)($source['url'] ?? ''));
        if ($url !== '') {
            $path = trim((string)(parse_url($url, PHP_URL_PATH) ?: ''), '/');
            if ($path !== '') {
                $segments = array_values(array_filter(explode('/', $path)));
                $candidate = $segments[0] ?? '';
                if ($candidate !== '') {
                    $candidate = preg_replace('/[_\-]+/', ' ', $candidate);
                    $candidate = preg_replace('/(?<=\p{Ll})(?=\p{Lu})/u', ' ', $candidate);
                    $candidate = preg_replace('/\s+/', ' ', $candidate);
                    $candidate = ucwords(mb_strtolower(trim($candidate)));
                    if (!isBadSiteIdentity($candidate)) return $candidate;
                }
            }
        }
    }

    return trim((string)($site['title'] ?? ''));
}

function humanizeDisplayName(?string $value): string {
    $value = trim((string)$value);
    if ($value === '') return '';
    $value = preg_replace('/(?<=\p{Ll})(?=\p{Lu})/u', ' ', $value);
    $value = preg_replace('/([a-z])([A-Z])/', '$1 $2', $value);
    $value = preg_replace('/([A-Za-z])(\d)/', '$1 $2', $value);
    $value = preg_replace('/[_\-]+/', ' ', $value);
    $value = preg_replace('/\s+/', ' ', $value);
    $value = trim($value);

    if (preg_match('/^\p{Lu}{2}\p{Ll}+/u', $value)) {
        $value = mb_strtoupper(mb_substr($value, 0, 1)) . mb_strtolower(mb_substr($value, 1));
    }

    if (preg_match('/^[a-z0-9 ]+$/', $value)) {
        $value = ucwords(mb_strtolower($value));
    }

    $value = preg_replace('/\bAgriturismo ?Sangermano\b/ui', 'Agriturismo San Germano', $value);
    return $value;
}

function normalizeMediaUrl(?string $url): string {
    $url = trim((string)$url);
    if ($url === '') return '';
    if (strpos($url, '/public/media/') !== false) {
        $path = parse_url($url, PHP_URL_PATH) ?: '';
        $name = basename($path);
        if ($name === '' || $name === '.' || $name === '..') return '';
        $localPath = __DIR__ . '/media/' . $name;
        if (!file_exists($localPath)) {
            return 'https://allsocialtoweb.com/public/media/' . $name;
        }
        return app_base_url() . '/public/media/' . $name;
    }
    return $url;
}

$rawTitle   = prettySourceIdentity($sources, $site);
if (isBadSiteIdentity($rawTitle)) {
    $rawTitle = trim((string)($user['name'] ?? ''));
}
$displayTitle = humanizeDisplayName($rawTitle);
$title      = h($displayTitle);
$bio        = h(($site['profile_summary'] ?? '') ?: ($site['bio'] ?? ''));
$siteUrl    = app_base_url() . '/' . $slug;
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
$brandVisualMode = ($site['brand_visual_mode'] ?? 'logo') === 'cover' ? 'cover' : 'logo';
if (str_contains($logoUrl, 'profile_logo_fallback_')) $logoUrl = '';

foreach ($allPosts as &$p) {
    $p['media_url'] = normalizeMediaUrl($p['media_url'] ?? '');
}
unset($p);
if ($activeTag) {
    $posts = array_values(array_filter($allPosts, static function ($p) use ($activeTag) {
        $pTags = array_map('strtolower', $p['tags'] ?? []);
        $pTagSlugs = array_map('networkTopicSlug', $p['tags'] ?? []);
        return in_array($activeTag, $pTags, true) || in_array($activeTag, $pTagSlugs, true);
    }));
} else {
    $posts = $allPosts;
}
if ($single) {
    $single['media_url'] = normalizeMediaUrl($single['media_url'] ?? '');
}

// ── Raccogli tutti i tag reali dei post pubblicati (con conteggio) ───────
$tagCounts = [];
foreach ($allPosts as $p) {
    foreach ($p['tags'] ?? [] as $t) {
        $key = strtolower(trim($t));
        if ($key !== '') $tagCounts[$key] = ($tagCounts[$key] ?? 0) + 1;
    }
}
$validMenuTags = array_keys($tagCounts);
$activeTagLabel = $activeTag;
if ($activeTag !== '') {
    foreach (array_keys($tagCounts) as $knownTag) {
        if (strtolower($knownTag) === $activeTag || networkTopicSlug($knownTag) === $activeTag) {
            $activeTagLabel = $knownTag;
            break;
        }
    }
}

// ── Sicurezza Menu: rimuovi link rotti che non puntano a nulla ──────────
$safeMenuLinks = [];
if (is_array($menuLinks)) {
    foreach ($menuLinks as $link) {
        $url = trim($link['url'] ?? '');
        if ($url === '/' || $url === '') { $safeMenuLinks[] = $link; continue; }
        if (preg_match('/[?&]view=media/i', $url)) { $safeMenuLinks[] = $link; continue; }
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
$existingMenuUrls = [];
foreach ($menuLinks as $link) {
    $existingMenuUrls[] = strtolower(trim((string)($link['url'] ?? '')));
}
if (empty($menuLinks)) {
    $menuLinks[] = ['label' => 'Home', 'url' => '/'];
    $existingMenuUrls[] = '/';
}
if (count($menuLinks) < 5 && !empty($tagCounts)) {
    arsort($tagCounts);
    foreach (array_keys($tagCounts) as $tag) {
        $url = '/?tag=' . urlencode($tag);
        if (in_array(strtolower($url), $existingMenuUrls, true)) continue;
        $menuLinks[] = ['label' => ucfirst($tag), 'url' => $url];
        $existingMenuUrls[] = strtolower($url);
        if (count($menuLinks) >= 5) break;
    }
}
$mediaPosts = array_values(array_filter($allPosts, static function ($p) {
    return !empty($p['media_url']);
}));
if (!empty($mediaPosts)) {
    $hasMediaCenter = false;
    foreach ($menuLinks as $link) {
        if (strtolower(trim((string)($link['url'] ?? ''))) === '/?view=media') {
            $hasMediaCenter = true;
            break;
        }
    }
    if (!$hasMediaCenter) {
        $menuLinks[] = ['label' => 'Media Center', 'url' => '/?view=media'];
    }
}

// Tutti i siti della rete condividono una navigazione stabile e crawlable.
// Le vecchie scelte grafiche restano nei dati, ma non governano piu il sito pubblico.
$menuLinks = [
    ['label' => 'Home', 'url' => '/'],
];
if (!empty($chronologicalPosts)) {
    $menuLinks[] = ['label' => 'Articoli', 'url' => count($chronologicalPosts) > 1 ? '/#ultimi' : '/#in-evidenza'];
}
if (!empty($tagCounts)) {
    $menuLinks[] = ['label' => 'Argomenti', 'url' => '/#categorie'];
}
// Decodifica anticipata e isolata di site_ai_data, solo per esporre in nav
// le sezioni personalizzate della homepage (il parsing completo avviene piu
// avanti in $aiData, dopo gli override di preview).
$navAiData = !empty($site['site_ai_data']) ? json_decode($site['site_ai_data'], true) : [];
if (!is_array($navAiData)) $navAiData = [];
$navCustomSections = isset($navAiData['custom_sections']) && is_array($navAiData['custom_sections']) ? $navAiData['custom_sections'] : [];
$navHiddenSections = isset($navAiData['layout_recipe']['hidden_sections']) && is_array($navAiData['layout_recipe']['hidden_sections']) ? $navAiData['layout_recipe']['hidden_sections'] : [];
foreach ($navCustomSections as $csEntry) {
    if (count($menuLinks) >= 5) break;
    if (!is_array($csEntry)) continue;
    $csId = strtolower(trim((string)($csEntry['id'] ?? '')));
    $csTitle = trim((string)($csEntry['title'] ?? ''));
    if ($csId === '' || $csTitle === '' || !preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $csId)) continue;
    if (in_array($csId, ['hero', 'latest', 'topics', 'info'], true)) continue;
    if (in_array($csId, $navHiddenSections, true)) continue;
    $menuLinks[] = ['label' => $csTitle, 'url' => '/#' . $csId];
}
$preferredFoundationPages = [
    'cosa-offriamo' => 'Cosa offriamo',
    'chi-siamo' => 'Chi siamo',
    'per-chi' => 'Per chi',
    'contenuti' => 'Contenuti',
    'domande-frequenti' => 'FAQ',
    'contatti' => 'Contatti',
];
$primaryFoundationNavigation = ['cosa-offriamo', 'chi-siamo', 'contatti'];
foreach ($primaryFoundationNavigation as $pageSlug) {
    if (isset($foundationPagesBySlug[$pageSlug])) {
        $menuLinks[] = ['label' => $preferredFoundationPages[$pageSlug], 'url' => '/' . $pageSlug];
        if (count($menuLinks) >= 5) break;
    }
}
$footerText   = $site['footer_text'] ?? '';
$customCss    = $site['custom_css'] ?? '';
$heroTagline  = h($site['hero_tagline'] ?? '');
$ctaText      = h(($site['cta_text'] ?? '') ?: 'Scopri i contenuti');

// ── Dati AI dinamici (site_ai_data) ───────────
$aiData = !empty($site['site_ai_data']) ? json_decode($site['site_ai_data'], true) : [];
if (!is_array($aiData)) $aiData = [];
$understanding = !empty($site['site_understanding']) ? json_decode($site['site_understanding'], true) : [];
if (!is_array($understanding)) $understanding = [];
$coverUrl     = $coverUrl ?: normalizeMediaUrl($aiData['cover_url'] ?? '');
$brandVisualUrl = $brandVisualMode === 'cover' ? ($coverUrl ?: $logoUrl) : ($logoUrl ?: $coverUrl);
$heroTagline  = $heroTagline ?: h($aiData['hero_tagline'] ?? '');
$ctaText      = $ctaText ?: h($aiData['cta_text'] ?? '');
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

$verticalSlug = strtolower(trim((string)($understanding['vertical_slug'] ?? '')));
if ($verticalSlug === '') {
    $verticalText = mb_strtolower(trim(($site['profile_summary'] ?? '') . ' ' . ($site['role_mission'] ?? '') . ' ' . ($site['content_strategy'] ?? '')));
    if (preg_match('/\b(agriturismo|ospitalit|hospitality|b&b|bed and breakfast|resort|tenuta|country house|camere|ristorante|ristorazione|cucina)\b/u', $verticalText)) {
        $verticalSlug = 'hospitality';
    } elseif (preg_match('/\b(food|chef|ristorante|trattoria|pizzeria|cantina)\b/u', $verticalText)) {
        $verticalSlug = 'food';
    }
}
$isHospitalitySite = in_array($verticalSlug, ['hospitality', 'food'], true);
if (empty($baseModels)) {
    $baseModels = $isHospitalitySite ? ['editorial-luxe', 'warm-humanist'] : ['tech-clarity'];
}

$palPrimary   = $palette['primary']   ?? $accentColor ?: '#7F77DD';
$palSecondary = $palette['secondary'] ?? '#5C54C4';
$palBg        = $palette['background']?? '#FAFAFA';
$palSurface   = $palette['surface']   ?? '#FFFFFF';
$palText      = $palette['text']      ?? '#1a1a24';
$palTextMuted = $palette['text_muted'] ?? '#667085';

// ── Override per Anteprima (preview_theme oppure preview_index) ──────────────
if (isset($_GET['preview_theme'])) {
    $archetype = $_GET['preview_theme'];
    $customCss = '';
    $accentColor = '';
}
if (!empty($_POST['preview_data']) || !empty($_GET['preview_data'])) {
    $rawPreviewData = $_POST['preview_data'] ?? $_GET['preview_data'];
    $encodedPreview = strtr((string)$rawPreviewData, '-_', '+/');
    $padding = strlen($encodedPreview) % 4;
    if ($padding > 0) $encodedPreview .= str_repeat('=', 4 - $padding);
    $decodedPreview = base64_decode($encodedPreview, true);
    if ($decodedPreview !== false) {
        $previewData = json_decode($decodedPreview, true);
        if (is_array($previewData)) {
            if (isset($previewData['title'])) {
                $displayTitle = humanizeDisplayName((string)$previewData['title']);
                $title = h($displayTitle);
            }
            if (isset($previewData['bio'])) $bio = h((string)$previewData['bio']);
            if (isset($previewData['hero_tagline'])) $heroTagline = h((string)$previewData['hero_tagline']);
            $archetype = $previewData['design_archetype'] ?? $previewData['theme'] ?? $archetype;
            $accentColor = $previewData['color_palette']['primary'] ?? $previewData['accent_color'] ?? $accentColor;
            $customCss = $previewData['custom_css'] ?? $customCss;
            if (isset($previewData['font_heading'])) $fontHeading = $previewData['font_heading'];
            if (isset($previewData['font_body'])) $fontBody = $previewData['font_body'];
            if (isset($previewData['color_palette']) && is_array($previewData['color_palette'])) $palette = $previewData['color_palette'];
            if (isset($previewData['ui_style']) && is_array($previewData['ui_style'])) $uiStyle = $previewData['ui_style'];
            if (isset($previewData['layout_recipe']) && is_array($previewData['layout_recipe'])) $layoutRecipe = $previewData['layout_recipe'];
            if (isset($previewData['base_models'])) $baseModels = is_array($previewData['base_models']) ? $previewData['base_models'] : [$previewData['base_models']];
            if (!isset($palette['background']) && isset($palette['bg'])) $palette['background'] = $palette['bg'];
            if (!isset($palette['secondary']) && isset($palette['surface'])) $palette['secondary'] = $palette['surface'];
        }
    }
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
$palTextMuted = $palette['text_muted'] ?? '#667085';
$layoutVariant = $layoutRecipe['structure'] ?? 'classic';
$heroMode     = $layoutRecipe['hero'] ?? '';
$navMode      = $layoutRecipe['nav'] ?? '';
$cardsMode    = $layoutRecipe['cards'] ?? '';
$densityMode  = $layoutRecipe['density'] ?? '';
// ── Sezioni personalizzate della homepage (custom_sections) ────────────
$rawCustomSections = isset($aiData['custom_sections']) && is_array($aiData['custom_sections']) ? $aiData['custom_sections'] : [];
$reservedSectionIds = ['hero', 'latest', 'topics', 'info'];
$customSections = [];
foreach ($rawCustomSections as $entry) {
    if (!is_array($entry)) continue;
    $csId = strtolower(trim((string)($entry['id'] ?? '')));
    if ($csId === '' || !preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $csId)) continue;
    if (in_array($csId, $reservedSectionIds, true)) continue;
    $csTitle = trim((string)($entry['title'] ?? ''));
    if ($csTitle === '') continue;
    $customSections[$csId] = [
        'id' => $csId,
        'title' => $csTitle,
        'body' => (string)($entry['body'] ?? ''),
        'image_url' => normalizeMediaUrl((string)($entry['image_url'] ?? '')),
    ];
}

$defaultSectionOrder = ['hero', 'latest', 'topics', 'info'];
$knownSectionIds = array_merge($defaultSectionOrder, array_keys($customSections));
$requestedSectionOrder = isset($layoutRecipe['section_order']) && is_array($layoutRecipe['section_order']) ? $layoutRecipe['section_order'] : [];
$sectionOrder = array_values(array_unique(array_merge(array_values(array_intersect($requestedSectionOrder, $knownSectionIds)), $defaultSectionOrder, array_keys($customSections))));
$hiddenSections = isset($layoutRecipe['hidden_sections']) && is_array($layoutRecipe['hidden_sections']) ? array_values(array_intersect($layoutRecipe['hidden_sections'], $knownSectionIds)) : [];
$sectionPosition = static function (string $key) use ($sectionOrder): int {
    $position = array_search($key, $sectionOrder, true);
    return $position === false ? 99 : (int)$position;
};
$sectionHiddenClass = static fn(string $key): string => in_array($key, $hiddenSections, true) ? ' studio-section-hidden' : '';
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
// La sezione "Ultimi contenuti" deve essere realmente cronologica e completa:
// i post in evidenza non devono nascondere gli aggiornamenti piu freschi.
$recentPosts = $chronologicalPosts;

$hospitalityEventPosts = [];
$hospitalityFoodPosts = [];
$hospitalityNaturePosts = [];
foreach ($allPosts as $postItem) {
    $haystack = mb_strtolower(trim(
        ($postItem['edited_title'] ?? '') . ' ' .
        ($postItem['generated_title'] ?? '') . ' ' .
        ($postItem['edited_excerpt'] ?? '') . ' ' .
        ($postItem['generated_excerpt'] ?? '')
    ));
    $tagsHaystack = mb_strtolower(implode(' ', $postItem['tags'] ?? []));
    $fullText = $haystack . ' ' . $tagsHaystack;

    if (count($hospitalityEventPosts) < 3 && preg_match('/\b(event|evento|ferragosto|serata|apericena|pilates|pranzo|cena|degustazione)\b/u', $fullText)) {
        $hospitalityEventPosts[] = $postItem;
    }
    if (count($hospitalityFoodPosts) < 3 && preg_match('/\b(menu|menù|cucina|sapori|orto|orzotto|grigliata|piatto|ristorante|vino)\b/u', $fullText)) {
        $hospitalityFoodPosts[] = $postItem;
    }
    if (count($hospitalityNaturePosts) < 3 && preg_match('/\b(natura|ulivi|papaveri|paesaggio|relax|benessere|tramonto|campagna|pace)\b/u', $fullText)) {
        $hospitalityNaturePosts[] = $postItem;
    }
}

$hospitalityHighlights = [
    ['title' => 'Natura e quiete', 'text' => 'Un luogo dove rallentare, respirare e vivere la campagna come esperienza, non solo come sfondo.'],
    ['title' => 'Cucina autentica', 'text' => 'Piatti stagionali, convivialità e sapori veri raccontati come parte centrale dell’esperienza.'],
    ['title' => 'Eventi da vivere', 'text' => 'Pranzi, serate speciali e momenti sotto gli ulivi pensati per trasformare una visita in ricordo.'],
];
if (!empty($understanding['editorial_direction']['content_pillars']) && is_array($understanding['editorial_direction']['content_pillars'])) {
    $customPillars = array_slice(array_values(array_filter($understanding['editorial_direction']['content_pillars'])), 0, 3);
    foreach ($customPillars as $idx => $pillar) {
        if (!isset($hospitalityHighlights[$idx])) break;
        $hospitalityHighlights[$idx]['title'] = humanizeDisplayName((string)$pillar);
    }
}

$hospitalityPrimaryCtaUrl = !empty($sources[0]['url']) ? $sources[0]['url'] : $siteUrl;
$hospitalityPrimaryCtaLabel = $ctaText !== '' ? html_entity_decode($ctaText, ENT_QUOTES, 'UTF-8') : 'Prenota la tua esperienza';
$hospitalitySecondaryCtaUrl = $siteUrl . '?view=media';
$hospitalitySecondaryCtaLabel = 'Guarda gli spazi';
$hospitalityIdentityText = mb_strtolower(implode(' ', [
    $title,
    (string)($understanding['vertical_label'] ?? ''),
    (string)($understanding['business_model'] ?? ''),
    implode(' ', (array)($understanding['declared_strategy']['priority_services'] ?? [])),
]));
$useHospitalityLanding = str_starts_with($archetype, 'hospitality-story');
$hospitalityHeroImage = normalizeMediaUrl($mediaPosts[0]['media_url'] ?? '') ?: $coverUrl;
$hospitalityHeroCopy = trim((string)($heroTagline ?: $bio));
if (mb_strlen($hospitalityHeroCopy) > 280) {
    $shortCopy = mb_substr($hospitalityHeroCopy, 0, 280);
    $lastSpace = mb_strrpos($shortCopy, ' ');
    $hospitalityHeroCopy = rtrim($lastSpace !== false ? mb_substr($shortCopy, 0, $lastSpace) : $shortCopy, " ,.;:") . '…';
}
$hospitalityFacts = array_values(array_unique(array_filter(array_merge(
    [(string)($understanding['vertical_label'] ?? 'Ospitalità autentica')],
    array_slice((array)($understanding['declared_strategy']['priority_services'] ?? []), 0, 2),
    [(string)($understanding['declared_strategy']['geographic_area'] ?? '')]
))));

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
    $width = max(30, min(100, (int)($p['media_display_width'] ?? 100)));
    $alignment = in_array(($p['media_alignment'] ?? 'center'), ['left', 'center', 'right'], true) ? $p['media_alignment'] : 'center';
    $wrapper = '<div class="media media-sized media-align-' . $alignment . '" style="--media-display-width:' . $width . '%">';
    $mediaLabel = h(postTitle($p));
    if (preg_match('~(?:youtube\.com|youtu\.be)~i', $u) &&
        preg_match('~(?:v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})~', $u, $m)) {
        return $wrapper . '<iframe src="https://www.youtube.com/embed/' . $m[1] . '" title="Video: ' . $mediaLabel . '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>';
    }
    $type = strtolower($p['media_type'] ?? '');
    if ($type === 'image' || preg_match('~\.(jpg|jpeg|png|webp)(\?|$)~i', $u))
        return $wrapper . '<img src="' . h($u) . '" alt="' . $mediaLabel . '" loading="lazy" decoding="async"></div>';
    if ($type === 'video' || preg_match('~\.(mp4|mov|webm)(\?|$)~i', $u))
        return $wrapper . '<video controls preload="metadata" aria-label="Video: ' . $mediaLabel . '"><source src="' . h($u) . '"></video></div>';
    return '';
}

// ── Sanitizzazione HTML degli articoli ─────────────────────────────────────
// Il corpo di un articolo arriva da tre strade non fidate: la generazione AI,
// l'editor dell'utente e il webhook di ingestione esterna. Prima veniva
// restituito così com'era appena conteneva un tag comune: bastava un
// <img onerror=...> per eseguire codice sul sito pubblico.
// Tutti i siti condividono la stessa origine, quindi uno script iniettato nel
// sito di un cliente potrebbe leggere la sessione della dashboard di chiunque
// stia navigando: il filtro qui sotto è una difesa multi-tenant, non estetica.

/** Tag ammessi nel corpo di un articolo. */
const BODY_ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
];

/** Attributi ammessi, per tag. Nessun on*, nessuno style. */
const BODY_ALLOWED_ATTRS = [
    'a'   => ['href', 'title', 'target', 'rel'],
    'img' => ['src', 'alt', 'title', 'width', 'height', 'loading'],
    'td'  => ['colspan', 'rowspan'],
    'th'  => ['colspan', 'rowspan', 'scope'],
];

/** Consente solo URL navigabili: blocca javascript:, data:, vbscript:. */
function bodySafeUrl(string $url, bool $allowData = false): ?string {
    $url = trim(html_entity_decode($url, ENT_QUOTES, 'UTF-8'));
    // Rimuove caratteri di controllo usati per mascherare "java\0script:"
    $probe = strtolower(preg_replace('/[\x00-\x20]/', '', $url) ?? '');
    if ($probe === '') return null;
    if (str_starts_with($probe, 'javascript:') || str_starts_with($probe, 'vbscript:')) return null;
    if (str_starts_with($probe, 'data:')) {
        // Solo immagini inline, e solo dove ha senso (src di <img>)
        if (!$allowData || !preg_match('~^data:image/(png|jpe?g|gif|webp);base64,~i', $url)) return null;
    }
    return $url;
}

function bodySanitizeHtml(string $html): string {
    if (!class_exists('DOMDocument')) {
        // Senza ext-dom non si può filtrare in modo affidabile: meglio
        // degradare a testo semplice che servire HTML non verificato.
        return nl2br(h(strip_tags($html)));
    }

    $doc = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    // L'HTML degli articoli è un frammento: lo si incapsula per non farsi
    // aggiungere <html>/<body> impliciti, poi si estrae solo il contenuto.
    $doc->loadHTML(
        '<?xml encoding="UTF-8"><div id="sts-root">' . $html . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    $root = $doc->getElementById('sts-root');
    if (!$root) return nl2br(h(strip_tags($html)));

    // Visita in profondità raccogliendo prima i nodi, poi modifica: mutare
    // l'albero durante l'iterazione salterebbe dei nodi.
    $stack = [$root];
    $nodes = [];
    while ($stack) {
        $node = array_pop($stack);
        foreach ($node->childNodes as $child) {
            $nodes[] = $child;
            if ($child->nodeType === XML_ELEMENT_NODE) $stack[] = $child;
        }
    }

    foreach ($nodes as $node) {
        if ($node->nodeType === XML_ELEMENT_NODE) {
            $tag = strtolower($node->nodeName);
            if (!in_array($tag, BODY_ALLOWED_TAGS, true)) {
                // Tag non ammesso: per script/style/iframe si butta tutto il
                // contenuto, altrimenti si conserva il testo interno.
                if (in_array($tag, ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math'], true)) {
                    if ($node->parentNode) $node->parentNode->removeChild($node);
                } elseif ($node->parentNode) {
                    while ($node->firstChild) $node->parentNode->insertBefore($node->firstChild, $node);
                    $node->parentNode->removeChild($node);
                }
                continue;
            }

            $allowed = BODY_ALLOWED_ATTRS[$tag] ?? [];
            foreach (iterator_to_array($node->attributes ?? []) as $attr) {
                $name = strtolower($attr->nodeName);
                if (!in_array($name, $allowed, true)) { $node->removeAttribute($attr->nodeName); continue; }
                if ($name === 'href' || $name === 'src') {
                    $safe = bodySafeUrl((string)$attr->nodeValue, $name === 'src' && $tag === 'img');
                    if ($safe === null) { $node->removeAttribute($attr->nodeName); continue; }
                    $node->setAttribute($name, $safe);
                }
            }

            // I link esterni non devono poter manipolare la finestra di origine.
            if ($tag === 'a' && $node->getAttribute('target') !== '') {
                $node->setAttribute('rel', 'noopener noreferrer');
            }
        } elseif (!in_array($node->nodeType, [XML_TEXT_NODE, XML_CDATA_SECTION_NODE], true)) {
            // Commenti e istruzioni di elaborazione: via.
            if ($node->parentNode) $node->parentNode->removeChild($node);
        }
    }

    $out = '';
    foreach ($root->childNodes as $child) $out .= $doc->saveHTML($child);
    return $out;
}

/**
 * Articoli da proporre in fondo a una pagina-risposta.
 * Prima quelli che condividono più tag con l'articolo letto: chi ha appena
 * trovato una risposta utile è disposto a leggerne un'altra sullo stesso tema.
 * Se non c'è nessuna affinità si ripiega sui più recenti, così il fondo pagina
 * non resta mai un vicolo cieco.
 */
function relatedPosts(array $current, array $all, int $limit = 3): array {
    $currentSlug = (string)($current['slug'] ?? '');
    $currentTags = array_map('mb_strtolower', array_filter((array)($current['tags'] ?? [])));

    $scored = [];
    foreach ($all as $post) {
        if ((string)($post['slug'] ?? '') === $currentSlug) continue;
        if (!empty($post['noindex'])) continue;
        $tags = array_map('mb_strtolower', array_filter((array)($post['tags'] ?? [])));
        $scored[] = ['post' => $post, 'score' => count(array_intersect($currentTags, $tags))];
    }
    if (!$scored) return [];

    usort($scored, static function (array $a, array $b): int {
        if ($a['score'] !== $b['score']) return $b['score'] <=> $a['score'];
        $da = strtotime((string)($a['post']['published_at'] ?? $a['post']['imported_at'] ?? '1970-01-01'));
        $db = strtotime((string)($b['post']['published_at'] ?? $b['post']['imported_at'] ?? '1970-01-01'));
        return $db <=> $da;
    });

    return array_column(array_slice($scored, 0, $limit), 'post');
}

function bodyHtml(?string $b): string {
    $b = trim((string)$b);
    if ($b === '') return '';
    // Se il testo contiene tag HTML comuni (p, br, table, div, strong, h2, h3), lo riteniamo HTML pre-formattato
    if (preg_match('/<(p|br|table|tr|td|th|div|strong|em|h2|h3|h4|ul|ol|li)[^>]*>/i', $b)) {
        return bodySanitizeHtml($b);
    }
    $out = '';
    foreach (preg_split('/\n{2,}/', $b) as $para) {
        $para = trim($para);
        if ($para !== '') $out .= '<p>' . nl2br(h($para)) . '</p>';
    }
    return $out;
}

// ── Percorsi Vivi: trasforma i contenuti in esperienze guidate ─────────────
$declaredStrategy = is_array($understanding['declared_strategy'] ?? null) ? $understanding['declared_strategy'] : [];
$livingAudience = trim((string)($declaredStrategy['primary_audience'] ?? ''));
$livingArea = trim((string)($declaredStrategy['geographic_area'] ?? ''));
$livingDesiredAction = trim((string)($declaredStrategy['desired_action'] ?? ''));
$livingCustomerNeeds = trim((string)($declaredStrategy['customer_needs'] ?? ''));
$livingServices = array_values(array_filter(array_map('trim', (array)($declaredStrategy['priority_services'] ?? []))));
if (!$livingServices) $livingServices = array_values(array_filter(array_map('trim', (array)($understanding['editorial_direction']['content_pillars'] ?? []))));
if (!$livingServices) $livingServices = array_map(static fn($tag) => humanizeDisplayName((string)$tag), array_slice($topTags, 0, 3));

$livingCtaUrl = isset($foundationPagesBySlug['contatti']) ? $siteUrl . '/contatti' : (!empty($sources[0]['url']) ? $sources[0]['url'] : $siteUrl);
$livingCtaLabel = $livingDesiredAction !== '' ? $livingDesiredAction : 'Raccontaci cosa cerchi';
$livingPathSeeds = [[
    'key' => 'inizia',
    'label' => '✨ Da dove iniziare',
    'title' => 'Inizia da ciò che vuoi ottenere',
    'subtitle' => $livingAudience !== ''
        ? 'Un percorso costruito per ' . $livingAudience . ($livingArea !== '' ? ', con attenzione a ' . $livingArea : '') . '.'
        : 'Non cercare tra pagine e articoli: lasciati guidare dai contenuti più utili per capire, scegliere e agire.',
    'topic' => '',
]];
foreach (array_slice($livingServices, 0, 3) as $index => $service) {
    $livingPathSeeds[] = [
        'key' => 'percorso-' . ($index + 1),
        'label' => ['🌿 ', '💡 ', '🎯 '][$index] . humanizeDisplayName($service),
        'title' => 'Esplora ' . humanizeDisplayName($service),
        'subtitle' => 'Contenuti, prove e informazioni ufficiali organizzati come un percorso, non come un semplice archivio.',
        'topic' => $service,
    ];
}
$livingFallbackSeeds = [
    ['key'=>'scopri','label'=>'🌐 Scopri','title'=>'Scopri cosa rende unica questa attività','subtitle'=>'Una selezione guidata dei contenuti che spiegano identità, esperienza e valore.','topic'=>''],
    ['key'=>'scegli','label'=>'🧭 Scegli','title'=>'Trova ciò che fa davvero per te','subtitle'=>'Confronta possibilità e approfondimenti senza perderti tra post e menu.','topic'=>''],
    ['key'=>'agisci','label'=>'⚡ Agisci','title'=>'Dal contenuto al prossimo passo','subtitle'=>'Arriva al contatto con il contesto necessario per fare una richiesta più semplice e precisa.','topic'=>''],
];
foreach ($livingFallbackSeeds as $fallbackSeed) {
    if (count($livingPathSeeds) >= 4) break;
    $livingPathSeeds[] = $fallbackSeed;
}

$livingPaths = [];
$livingStepLabels = ['01 · Immagina', '02 · Esplora', '03 · Approfondisci', '04 · Scegli'];
foreach ($livingPathSeeds as $seedIndex => $seed) {
    $matchedPosts = [];
    $topicWords = array_values(array_filter(preg_split('/\s+/u', mb_strtolower((string)$seed['topic'])), static fn($word) => mb_strlen($word) >= 4));
    foreach ($allPosts as $postItem) {
        $haystack = mb_strtolower(postTitle($postItem) . ' ' . postExcerpt($postItem) . ' ' . implode(' ', $postItem['tags'] ?? []));
        if (!$topicWords || array_filter($topicWords, static fn($word) => str_contains($haystack, $word))) $matchedPosts[] = $postItem;
        if (count($matchedPosts) >= 4) break;
    }
    if (count($matchedPosts) < 4) {
        foreach ($allPosts as $postItem) {
            if (in_array((int)$postItem['id'], array_map(static fn($post) => (int)$post['id'], $matchedPosts), true)) continue;
            $matchedPosts[] = $postItem;
            if (count($matchedPosts) >= 4) break;
        }
    }
    $chapters = [];
    foreach (array_slice($matchedPosts, 0, 4) as $chapterIndex => $postItem) {
        $chapters[] = [
            'step' => $livingStepLabels[$chapterIndex] ?? ('0' . ($chapterIndex + 1)),
            'title' => postTitle($postItem),
            'excerpt' => mb_substr(trim(strip_tags(postExcerpt($postItem))), 0, 190),
            'url' => $siteUrl . '/' . ($postItem['slug'] ?? ''),
            'source' => ucfirst((string)($postItem['platform'] ?? 'Contenuto ufficiale')),
            'media_url' => normalizeMediaUrl($postItem['media_url'] ?? ''),
            'media_type' => strtolower((string)($postItem['media_type'] ?? '')),
        ];
    }
    if (!$chapters) {
        foreach (array_slice($foundationPagesBySlug, 0, 4) as $pageSlug => $page) {
            $chapters[] = [
                'step' => $livingStepLabels[count($chapters)] ?? 'Approfondisci',
                'title' => $page['title'] ?? humanizeDisplayName((string)$pageSlug),
                'excerpt' => mb_substr(trim(strip_tags((string)($page['intro'] ?? $page['meta_description'] ?? ''))), 0, 190),
                'url' => $siteUrl . '/' . $pageSlug,
                'source' => 'Informazioni ufficiali',
            ];
        }
    }
    $pathDisplayName = trim((string)preg_replace('/^[^\p{L}\p{N}]+/u', '', (string)$seed['label']));
    $livingPaths[] = $seed + [
        'path_name' => 'Percorso “' . ($pathDisplayName !== '' ? $pathDisplayName : 'Su misura') . '”',
        'question' => $livingCustomerNeeds !== '' ? $livingCustomerNeeds : 'Hai un’esigenza specifica? Il percorso può adattarsi a ciò che stai cercando.',
        'chapters' => $chapters,
    ];
}
// I percorsi AI restano disponibili nei dati, ma non sostituiscono piu
// archivio, categorie e contenuti recenti nella home pubblica.
$livingPaths = [];

// ── CSS temi ─────────────────────────────────────────────────────────────────
$accent = ltrim((string)($accentColor ?: '#7F77DD'), '#');
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

$primaryModelCss = '';
switch ($primaryModel) {
    case 'editorial-luxe':
        $primaryModelCss = "
          body { background: linear-gradient(180deg, {$palBg} 0%, #f7f0e7 100%); }
          .hero { max-width: 1280px; padding: 9rem 2rem 6rem; }
          .hero h1 { font-family: '{$fontHeading}', serif; font-size: clamp(3.6rem, 6vw, 5.8rem); letter-spacing: -0.04em; line-height: 0.98; max-width: 980px; }
          .hero .bio { font-size: 1.18rem; max-width: 760px; opacity: 0.82; }
          .post-grid { gap: 2.2rem; }
          .post { border-radius: 28px; padding: 2.35rem; border-color: rgba(32,26,23,0.08); box-shadow: 0 20px 50px rgba(32,26,23,0.08); }
          .post h2 { font-family: '{$fontHeading}', serif; font-size: 1.9rem; line-height: 1.08; }
          .topic-header h2, .recent-header, .slider-content h2 { font-family: '{$fontHeading}', serif; letter-spacing: -0.03em; }
          .navbar { background: rgba(255,253,249,0.86); border-bottom-color: rgba(32,26,23,0.08); }
        ";
        break;
    case 'neo-brutal-pop':
        $primaryModelCss = "
          body { background:
            radial-gradient(circle at 0% 0%, rgba(255,107,44,0.18), transparent 24%),
            linear-gradient(180deg, #fff8e7 0%, #fff3d7 100%); }
          .hero { max-width: 1280px; padding: 8rem 1.5rem 5rem; text-align: left; }
          .hero h1 { font-size: clamp(3.4rem, 7vw, 6rem); text-transform: uppercase; line-height: 0.92; letter-spacing: -0.05em; max-width: 900px; }
          .hero .bio { max-width: 700px; font-size: 1.08rem; }
          .post-grid { gap: 1.5rem; }
          .post { border: 2px solid #111111; border-radius: 14px; box-shadow: 10px 10px 0 rgba(17,17,17,0.14); }
          .post:hover { transform: translateY(-6px) rotate(-0.5deg); box-shadow: 16px 16px 0 rgba(17,17,17,0.14); }
          .post h2 { text-transform: uppercase; line-height: 0.98; font-size: 1.6rem; }
          .topic-header h2::before { width: 10px; border-radius: 0; }
          .navbar, .slider-container, .single-post { border: 2px solid #111111; }
        ";
        break;
    case 'dark-cinematic':
        $primaryModelCss = "
          body { background:
            radial-gradient(circle at 20% 20%, rgba(212,165,116,0.14), transparent 18%),
            linear-gradient(180deg, #09090d 0%, #111117 100%); color: #f5f5f0; }
          .layout-wrapper, .layout-content-col { background: transparent; }
          .hero { max-width: 100%; padding: 11rem 2rem 7rem; border-bottom-color: rgba(255,255,255,0.08); }
          .hero h1 { color: #f8f5ef; font-size: clamp(3.8rem, 7vw, 6rem); line-height: 0.96; max-width: 900px; }
          .hero .bio { color: rgba(245,245,240,0.72); max-width: 760px; }
          .post-grid { gap: 1.35rem; }
          .post { background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); border-color: rgba(255,255,255,0.08); }
          .post h2 a, .nav-brand, .topic-header h2, .recent-header { color: #f5f5f0; }
          .post .excerpt, .post .meta, .nav-links a { color: rgba(245,245,240,0.72); }
          .slider-container { border-radius: 0 0 28px 28px; box-shadow: 0 24px 80px rgba(0,0,0,0.45); }
        ";
        break;
    case 'warm-humanist':
        $primaryModelCss = "
          body { background:
            radial-gradient(circle at 100% 0%, rgba(61,139,109,0.10), transparent 24%),
            linear-gradient(180deg, #fcf7f0 0%, #f7efe3 100%); }
          .hero { max-width: 1240px; padding: 8rem 2rem 5.5rem; }
          .hero h1 { font-family: '{$fontHeading}', serif; font-size: clamp(3.2rem, 6vw, 5.2rem); line-height: 1.02; max-width: 860px; }
          .hero .bio { max-width: 760px; font-size: 1.14rem; opacity: 0.78; }
          .post { border-radius: 30px; border-color: rgba(36,48,40,0.06); box-shadow: 0 16px 38px rgba(36,48,40,0.08); }
          .post h2 { font-family: '{$fontHeading}', serif; font-size: 1.75rem; line-height: 1.12; }
          .topic-header h2::before { background: #3d8b6d; height: 28px; }
          .navbar { width: min(calc(100% - 24px), 1180px); margin: 14px auto 0; border-radius: 999px; background: rgba(255,253,248,0.82) !important; }
        ";
        break;
    case 'tech-clarity':
        $primaryModelCss = "
          body { background:
            radial-gradient(circle at 50% 0%, rgba(37,99,235,0.08), transparent 22%),
            linear-gradient(180deg, #f3f7fb 0%, #eef3fb 100%); }
          .hero { max-width: 1180px; padding: 7.5rem 1.5rem 5rem; }
          .hero h1 { font-size: clamp(3rem, 5.8vw, 4.8rem); line-height: 1; max-width: 920px; margin-left: auto; margin-right: auto; }
          .hero .bio { max-width: 720px; font-size: 1.08rem; }
          .post-grid { gap: 1.5rem; }
          .post { border-radius: 18px; border-color: rgba(22,32,42,0.08); box-shadow: 0 16px 38px rgba(15,23,42,0.08); }
          .post h2 { font-size: 1.45rem; line-height: 1.18; }
          .post .meta { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.76rem; }
          .navbar { background: rgba(255,255,255,0.88); box-shadow: 0 8px 30px rgba(15,23,42,0.06); }
        ";
        break;
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
      --text-muted: {$palTextMuted};
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
  {$primaryModelCss}
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

$sameAs = array_values(array_unique(array_filter(array_merge(
    array_map(static fn($source) => trim((string)($source['url'] ?? '')), $sources),
    [$officialSiteUrl, $businessProfileUrl]
))));
$businessSchemaType = (string)($seoFoundation['business_type'] ?? 'Organization');
if (!in_array($businessSchemaType, ['Organization', 'LocalBusiness', 'LodgingBusiness', 'Restaurant', 'ProfessionalService', 'Person'], true)) $businessSchemaType = 'Organization';
$identityText = mb_strtolower($displayTitle . ' ' . html_entity_decode($bio, ENT_QUOTES, 'UTF-8') . ' ' . ($understanding['vertical_label'] ?? '') . ' ' . ($understanding['vertical_slug'] ?? ''));
if ($businessSchemaType === 'Organization' && preg_match('/agritur|hospital|hotel|b&b|resort|country house|alloggi|camere/u', $identityText)) $businessSchemaType = 'LodgingBusiness';
elseif ($businessSchemaType === 'Organization' && preg_match('/ristor|trattoria|pizzer|osteria/u', $identityText)) $businessSchemaType = 'Restaurant';
$businessSchema = ['@context'=>'https://schema.org','@type'=>$businessSchemaType,'@id'=>$siteUrl . '#identity','name'=>$displayTitle,'url'=>$officialSiteUrl ?: $siteUrl,'mainEntityOfPage'=>$siteUrl,'description'=>html_entity_decode($bio, ENT_QUOTES, 'UTF-8'),'sameAs'=>$sameAs];
if ($logoUrl !== '') $businessSchema['logo'] = $logoUrl;
if ($coverUrl !== '') $businessSchema['image'] = $coverUrl;
if (!empty($reachabilityProfile['primary_topic'])) $businessSchema['knowsAbout'] = $reachabilityProfile['primary_topic'];
if (!empty($reachabilityProfile['service_areas'])) $businessSchema['areaServed'] = array_map(static fn($area) => ['@type'=>'Place','name'=>$area], $reachabilityProfile['service_areas']);
$jsonLdFlags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT;
$websiteSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'WebSite',
    '@id' => $siteUrl . '#website',
    'name' => $displayTitle,
    'url' => $siteUrl,
    'inLanguage' => 'it-IT',
    'publisher' => ['@id' => $siteUrl . '#identity'],
];
$collectionItems = [];
$collectionSource = $activeTag ? $posts : $chronologicalPosts;
if ($activeTag) {
    usort($collectionSource, static function (array $a, array $b): int {
        return strtotime((string)($b['published_at'] ?? $b['imported_at'] ?? '1970-01-01'))
            <=> strtotime((string)($a['published_at'] ?? $a['imported_at'] ?? '1970-01-01'));
    });
}
foreach (array_slice($collectionSource, 0, 50) as $itemIndex => $itemPost) {
    $collectionItems[] = [
        '@type' => 'ListItem',
        'position' => $itemIndex + 1,
        'url' => $siteUrl . '/' . ($itemPost['slug'] ?? ''),
        'name' => postTitle($itemPost),
    ];
}
$collectionUrl = $activeTag ? $siteUrl . '/categoria/' . rawurlencode(networkTopicSlug($activeTagLabel)) : $siteUrl;
$collectionSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'CollectionPage',
    '@id' => $collectionUrl . '#collection',
    'name' => $activeTag ? humanizeDisplayName($activeTagLabel) . ' - ' . $displayTitle : $displayTitle,
    'description' => $activeTag ? 'Articoli e aggiornamenti su ' . humanizeDisplayName($activeTagLabel) . ' pubblicati da ' . $displayTitle . '.' : html_entity_decode($bio, ENT_QUOTES, 'UTF-8'),
    'url' => $collectionUrl,
    'isPartOf' => ['@id' => $siteUrl . '#website'],
    'about' => ['@id' => $siteUrl . '#identity'],
    'mainEntity' => ['@type' => 'ItemList', 'itemListElement' => $collectionItems],
];
$articleSchema = null;
if ($single) {
    $articleUrl = $siteUrl . '/' . ($single['slug'] ?? '');
    $articleSchema = [
        '@context' => 'https://schema.org',
        '@type' => 'BlogPosting',
        '@id' => $articleUrl . '#article',
        'headline' => postTitle($single),
        'description' => postExcerpt($single),
        'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $articleUrl],
        'datePublished' => date(DATE_ATOM, strtotime($single['published_at'] ?? $single['imported_at'] ?? 'now')),
        'dateModified' => date(DATE_ATOM, strtotime($single['updated_at'] ?? $single['published_at'] ?? $single['imported_at'] ?? 'now')),
        'author' => ['@id' => $siteUrl . '#identity'],
        'publisher' => [
            '@type' => 'Organization',
            '@id' => app_base_url() . '#organization',
            'name' => 'All Social To Web',
            'url' => app_base_url(),
            'logo' => ['@type' => 'ImageObject', 'url' => app_base_url() . '/logo-cropped.png?v=2'],
        ],
        'isAccessibleForFree' => true,
        'inLanguage' => 'it-IT',
    ];
    if (!empty($single['media_url'])) $articleSchema['image'] = [$single['media_url']];
    if (!empty($single['tags'])) $articleSchema['articleSection'] = array_values($single['tags']);
}

// HTTP Link headers per sitemap e feed
header('Link: <' . $siteUrl . '/sitemap.xml>; rel="sitemap"');
header('Link: <' . $siteUrl . '/feed.xml>; rel="alternate"; type="application/atom+xml"');

?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php if (!$searchVisible): ?>
    <?php /* Interruttore "Fatti trovare da Google" spento: vale per ogni tipo
             di pagina del sito, non solo per gli articoli. */ ?>
    <meta name="robots" content="noindex, nofollow">
  <?php endif; ?>
  <?php
    if (!empty($site['gsc_verification'])):
      $gsc = trim($site['gsc_verification']);
      if (preg_match('/content="([^"]+)"/i', $gsc, $m)) $gsc = $m[1];
      else if (stripos($gsc, 'google-site-verification=') === 0) $gsc = substr($gsc, 25);
  ?>
    <meta name="google-site-verification" content="<?= h($gsc) ?>" />
  <?php endif; ?>
  <?php if ($foundationPage): ?>
    <title><?= h($foundationPage['title']) ?> - <?= $title ?></title>
    <meta name="description" content="<?= h($foundationPage['meta_description'] ?? $foundationPage['intro'] ?? '') ?>">
    <meta property="og:title" content="<?= h($foundationPage['title']) ?> - <?= $title ?>">
    <meta property="og:description" content="<?= h($foundationPage['meta_description'] ?? $foundationPage['intro'] ?? '') ?>">
    <meta property="og:type" content="website">
    <link rel="canonical" href="<?= $siteUrl . '/' . rawurlencode($foundationPage['slug']) ?>">
  <?php elseif ($single): ?>
    <title><?= h(postTitle($single)) ?> - <?= $title ?></title>
    <meta name="description" content="<?= h(postExcerpt($single)) ?>">
    <?php if ($searchVisible && !empty($single['noindex'])): ?><meta name="robots" content="noindex, follow"><?php endif; ?>
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
    <title><?= $title ?><?= $activeTag ? ' - ' . h(humanizeDisplayName($activeTagLabel)) : '' ?></title>
    <meta name="description" content="<?= $activeTag ? h('Articoli e aggiornamenti su ' . humanizeDisplayName($activeTagLabel) . ' pubblicati da ' . $displayTitle . '.') : $bio ?>">
    <meta property="og:title" content="<?= $title ?>">
    <meta property="og:description" content="<?= $bio ?>">
    <meta property="og:type" content="website">
    <?php if ($coverUrl): ?><meta property="og:image" content="<?= h($coverUrl) ?>"><?php endif; ?>
    <link rel="canonical" href="<?= $activeTag ? $siteUrl . '/categoria/' . rawurlencode(networkTopicSlug($activeTagLabel)) : $siteUrl ?>">
  <?php endif; ?>
  <meta property="og:site_name" content="<?= $title ?>">
  <link rel="sitemap" type="application/xml" href="<?= $siteUrl ?>/sitemap.xml">
  <link rel="alternate" type="application/atom+xml" title="RSS Feed" href="<?= $siteUrl ?>/feed.xml">
  
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($websiteSchema, $jsonLdFlags) ?></script>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($businessSchema, $jsonLdFlags) ?></script>
  <?php if ($useHospitalityLanding): ?>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>">
  {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "name": "<?= addslashes($displayTitle) ?>",
    "url": "<?= $siteUrl ?>",
    "description": "<?= addslashes(html_entity_decode($bio, ENT_QUOTES, 'UTF-8')) ?>",
    <?php if ($coverUrl): ?>"image": "<?= addslashes($coverUrl) ?>",<?php endif; ?>
    "sameAs": [<?= implode(',', array_map(fn($source) => '"' . addslashes($source['url']) . '"', array_slice($sources, 0, 6))) ?>]
  }
  </script>
  <?php endif; ?>
  
  <?php if ($foundationPage):
    $foundationUrl = $siteUrl . '/' . rawurlencode($foundationPage['slug']);
    $webPageSchema = ['@context'=>'https://schema.org','@type'=>'WebPage','name'=>$foundationPage['title'],'description'=>$foundationPage['meta_description'] ?? $foundationPage['intro'] ?? '','url'=>$foundationUrl,'isPartOf'=>['@id'=>$siteUrl]];
    $breadcrumbSchema = ['@context'=>'https://schema.org','@type'=>'BreadcrumbList','itemListElement'=>[['@type'=>'ListItem','position'=>1,'name'=>'Home','item'=>$siteUrl],['@type'=>'ListItem','position'=>2,'name'=>$foundationPage['title'],'item'=>$foundationUrl]]];
  ?>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($webPageSchema, $jsonLdFlags) ?></script>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($breadcrumbSchema, $jsonLdFlags) ?></script>
  <?php if (!empty($foundationPage['faq'])):
    $faqSchema = ['@context'=>'https://schema.org','@type'=>'FAQPage','mainEntity'=>array_map(static fn($item) => ['@type'=>'Question','name'=>$item['question'],'acceptedAnswer'=>['@type'=>'Answer','text'=>$item['answer']]], $foundationPage['faq'])];
  ?>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($faqSchema, $jsonLdFlags) ?></script>
  <?php endif; ?>
  <?php elseif ($single): ?>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>">
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
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($articleSchema, $jsonLdFlags) ?></script>
  <?php else: ?>
  <script type="application/ld+json" nonce="<?= h($cspNonce) ?>"><?= json_encode($collectionSchema, $jsonLdFlags) ?></script>
  <?php endif; ?>
  <style nonce="<?= h($cspNonce) ?>">
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
      .nav-links { display:none; position: fixed; top: 0; right: 0; width: min(280px, 86vw); height: 100vh; flex-direction: column; background: var(--bg, #fff); padding: 5rem 2rem 2rem; gap: 1.25rem; box-shadow: -4px 0 30px rgba(0,0,0,0.15); z-index: 105; }
      .nav-links.open { display:flex; }
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

    /* ── Dopo la risposta: azione, autore, contenuti collegati ───────────── */
    .answer-cta, .answer-author, .answer-related {
      max-width: 820px; margin: 1.25rem auto 0;
      padding: 1.75rem; border-radius: var(--radius);
      background: var(--card-bg); border: 1px solid var(--border);
    }
    .answer-cta { border-left: 4px solid var(--accent); }
    .answer-cta h2 { margin: 0 0 .5rem; font-size: 1.3rem; line-height: 1.3; }
    .answer-cta p { margin: 0 0 1.25rem; opacity: .8; line-height: 1.6; }
    .answer-cta-actions { display: flex; flex-wrap: wrap; gap: .65rem; }
    .answer-btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: .8rem 1.35rem; border-radius: 999px; text-decoration: none;
      font-weight: 700; font-size: .95rem;
      border: 1px solid var(--accent); color: var(--accent); background: transparent;
      transition: background .15s ease, color .15s ease;
    }
    .answer-btn:hover { background: var(--accent); color: var(--card-bg); }
    .answer-btn--primary { background: var(--accent); color: var(--card-bg); }
    .answer-btn--primary:hover { filter: brightness(1.1); }

    .answer-author { display: flex; gap: 1.15rem; align-items: flex-start; }
    .answer-author img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .answer-author-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .1em; opacity: .6; margin-bottom: .2rem; }
    .answer-author strong { display: block; font-size: 1.1rem; margin-bottom: .4rem; }
    .answer-author p { margin: 0 0 .6rem; opacity: .8; line-height: 1.6; font-size: .95rem; }
    .answer-author a { color: var(--accent); font-weight: 600; }

    .answer-related h2 { margin: 0 0 1.15rem; font-size: 1.15rem; }
    .answer-related-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .answer-related-grid a {
      display: flex; flex-direction: column; gap: .6rem; text-decoration: none;
      color: inherit; padding: .85rem; border-radius: calc(var(--radius) / 1.5);
      border: 1px solid var(--border); transition: border-color .15s ease;
    }
    .answer-related-grid a:hover { border-color: var(--accent); }
    .answer-related-grid img { width: 100%; aspect-ratio: 16/10; object-fit: cover; border-radius: calc(var(--radius) / 2); }
    .answer-related-grid span { font-weight: 650; line-height: 1.4; font-size: .95rem; }

    .answer-source {
      max-width: 820px; margin: 1.25rem auto 0; padding: 0 1.75rem;
      font-size: .82rem; line-height: 1.6; opacity: .62;
    }
    .answer-source a { color: inherit; text-decoration: underline; }

    @media (max-width: 560px) {
      .answer-cta, .answer-author, .answer-related { padding: 1.25rem; }
      .answer-cta-actions .answer-btn { flex: 1 1 100%; }
      .answer-author { flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) { .answer-btn, .answer-related-grid a { transition: none; } }

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
      .hospitality-hero { padding: 7rem 1.25rem 5rem; }
      .hospitality-hero-inner { padding: 2rem; }
      .hospitality-hero-actions, .hospitality-cta-actions { flex-direction: column; align-items: stretch; }
      .hospitality-media-strip { grid-template-columns: 1fr 1fr; }
      .hospitality-split-band { grid-template-columns: 1fr; }
    }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 0.78rem; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 800; color: var(--accent); margin-bottom: 0.9rem; }
    .hospitality-hero { max-width: 100%; min-height: 72vh; display: flex; align-items: flex-end; padding: 9rem 2rem 5.5rem; border-bottom: none; }
    .hospitality-hero-inner { width: min(100%, 1100px); margin: 0 auto; color: #fff; padding: 2.5rem; border-radius: 32px; background: linear-gradient(180deg, rgba(17,17,17,0.16), rgba(17,17,17,0.34)); backdrop-filter: blur(8px); }
    .hospitality-hero h1 { color: #fff !important; font-size: clamp(3.2rem, 6vw, 5.6rem); max-width: 860px; line-height: 0.95; margin-bottom: 1rem; }
    .hospitality-hero .bio { color: rgba(255,255,255,0.88) !important; font-size: 1.18rem; max-width: 720px; margin: 0 0 1.5rem; }
    .hospitality-hero-actions, .hospitality-cta-actions { display: flex; gap: 0.9rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .hospitality-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0.9rem 1.35rem; border-radius: 999px; font-weight: 700; }
    .hospitality-cta-primary { background: var(--accent); color: #fff; box-shadow: 0 16px 38px rgba(0,0,0,0.18); }
    .hospitality-cta-secondary { background: rgba(255,255,255,0.14); color: #fff; border: 1px solid rgba(255,255,255,0.22); }
    .hospitality-hero-facts { display: flex; gap: 0.7rem; flex-wrap: wrap; }
    .hospitality-hero-facts span { padding: 0.55rem 0.8rem; border-radius: 999px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.86); font-size: 0.86rem; }
    .hospitality-section { width: min(100%, 1180px); margin: 0 auto 4rem; }
    .hospitality-section-head { margin-bottom: 1.4rem; max-width: 820px; }
    .hospitality-section-head h2 { font-size: clamp(2rem, 4vw, 3.3rem); line-height: 1.02; margin-bottom: 0.65rem; }
    .hospitality-section-head p { font-size: 1.04rem; line-height: 1.7; opacity: 0.78; }
    .hospitality-pillars { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .hospitality-pillar, .hospitality-mini-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 24px; padding: 1.4rem; box-shadow: 0 18px 40px rgba(0,0,0,0.06); }
    .hospitality-pillar h3, .hospitality-mini-card strong { display: block; margin-bottom: 0.5rem; font-size: 1.15rem; }
    .hospitality-pillar p, .hospitality-mini-card p { opacity: 0.76; line-height: 1.7; }
    .hospitality-grid { max-width: none; margin: 0; }
    .hospitality-grid-3 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    .hospitality-card { overflow: hidden; }
    .hospitality-split-band { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr); gap: 1.2rem; align-items: start; }
    .hospitality-media-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .hospitality-media-item { display: block; background: var(--card-bg); border-radius: 24px; overflow: hidden; box-shadow: 0 18px 40px rgba(0,0,0,0.08); color: var(--text); }
    .hospitality-media-item img { width: 100%; aspect-ratio: 4/5; object-fit: cover; display: block; }
    .hospitality-media-item span { display: block; padding: 0.95rem 1rem 1.1rem; font-weight: 600; line-height: 1.35; }
    .hospitality-cta-band { display: flex; justify-content: space-between; gap: 1.2rem; align-items: center; padding: 2rem; border-radius: 32px; background: linear-gradient(135deg, rgba(160,106,66,0.12), rgba(61,139,109,0.10)); border: 1px solid rgba(0,0,0,0.05); }

    /* Identita unica della rete All Social To Web */
    :root { --accent:#5B5CE2; --bg:#F6F7FB; --card-bg:#fff; --text:#182033; --border:#E3E6EF; --radius:18px; }
    body.theme-network-standard { background:#F6F7FB; color:#182033; overflow-x:clip; }
    .network-bar { background:linear-gradient(110deg,#151A2D 0%,#252058 58%,#5B2FA8 100%); color:#fff; padding:.65rem 1.25rem; font-size:.78rem; letter-spacing:.02em; }
    .network-signature { width:min(100%,1160px); margin:0 auto; display:flex; align-items:center; gap:.75rem; }
    .network-signature-brand { display:inline-flex; align-items:center; gap:.55rem; color:#fff; font-weight:800; }
    .network-signature-brand img { width:28px; height:28px; object-fit:contain; filter:drop-shadow(0 3px 8px rgba(0,0,0,.2)); }
    .network-product-name { display:inline-flex; align-items:center; min-height:30px; padding:.35rem .75rem; border:1px solid rgba(255,255,255,.22); border-radius:999px; background:rgba(255,255,255,.11); font-weight:800; }
    .network-trust { margin-left:auto; color:rgba(255,255,255,.76); }
    .theme-network-standard .navbar { background:rgba(255,255,255,.96)!important; border-bottom:1px solid #E3E6EF; padding:1rem max(1.25rem,calc((100vw - 1160px)/2))!important; }
    .theme-network-standard .nav-brand { color:#182033; }
    .theme-network-standard .nav-brand-image { width:44px; height:44px; border-radius:10px; object-fit:contain; background:#fff; }
    .theme-network-standard .nav-brand-image.is-cover { width:64px; object-fit:cover; }
    .nav-brand-fallback { display:none; }
    .theme-network-standard .container { width:min(100%,1160px); }
    .content-archive { width:min(100%,1160px); margin:2rem auto 4rem; }
    .archive-intro { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:1rem 2rem; align-items:end; margin-bottom:1.25rem; padding:clamp(1.5rem,4vw,3rem); border-radius:26px; background:linear-gradient(135deg,#182033 0%,#29255F 68%,#5B2FA8 100%); color:#fff; }
    .archive-intro .network-kicker { grid-column:1/-1; color:#CFCBFF; }
    .archive-intro h1 { margin:0; color:#fff; font-size:clamp(2.35rem,5vw,4.6rem); line-height:.95; letter-spacing:-.055em; }
    .archive-intro > p { max-width:720px; margin:.75rem 0 0; color:rgba(255,255,255,.76); font-size:1.05rem; line-height:1.65; }
    .archive-stats { grid-column:2; grid-row:2/4; display:grid; grid-template-columns:repeat(3,minmax(92px,1fr)); gap:.6rem; }
    .archive-stats a { min-width:96px; padding:1rem; border:1px solid rgba(255,255,255,.15); border-radius:16px; background:rgba(255,255,255,.08); color:#fff; text-align:center; }
    .archive-stats strong,.archive-stats span { display:block; }
    .archive-stats strong { font-size:1.65rem; line-height:1; }
    .archive-stats span { margin-top:.35rem; color:rgba(255,255,255,.64); font-size:.7rem; font-weight:800; text-transform:uppercase; }
    .category-index,.media-preview { margin-bottom:2rem; padding:clamp(1.25rem,3vw,2rem); border:1px solid #E3E6EF; border-radius:22px; background:#fff; }
    .category-index { display:grid; grid-template-columns:minmax(180px,.35fr) minmax(0,1fr); gap:1.5rem; align-items:start; scroll-margin-top:110px; }
    .category-index h2,.section-heading-row h2 { margin:.25rem 0 0; font-size:clamp(1.65rem,3vw,2.35rem); line-height:1.05; }
    .category-chips { display:flex; flex-wrap:wrap; gap:.65rem; }
    .category-chips a { display:inline-flex; align-items:center; gap:.6rem; min-height:42px; padding:.55rem .7rem .55rem 1rem; border:1px solid #DDE2EE; border-radius:999px; background:#F8F9FD; color:#182033; font-weight:750; }
    .category-chips a:hover { border-color:#5B5CE2; color:#4038B7; }
    .category-chips strong { display:grid; min-width:26px; height:26px; place-items:center; padding:0 .35rem; border-radius:999px; background:#E9E8FF; color:#4038B7; font-size:.72rem; }
    .section-heading-row { display:flex; justify-content:space-between; gap:1rem; align-items:end; margin-bottom:1.25rem; scroll-margin-top:110px; }
    .section-heading-row > a { color:#4038B7; font-weight:800; }
    .section-heading-row .recent-header { margin:0; text-align:left; }
    .media-preview-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.8rem; }
    .media-preview-card { min-width:0; overflow:hidden; border:1px solid #E3E6EF; border-radius:16px; background:#F8F9FD; color:#182033; }
    .media-preview-card .media { height:170px; margin:0; border-radius:0; }
    .media-preview-card .media img,.media-preview-card .media video,.media-preview-card .media iframe { width:100%; height:100%; object-fit:cover; }
    .media-preview-card > span { display:-webkit-box; min-height:66px; padding:.85rem 1rem; overflow:hidden; font-weight:800; line-height:1.35; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    @media(max-width:768px) {
      .content-archive { margin-top:1rem; }
      .archive-intro { grid-template-columns:1fr; padding:1.35rem; border-radius:20px; }
      .archive-stats { grid-column:1; grid-row:auto; width:100%; grid-template-columns:repeat(3,minmax(0,1fr)); }
      .archive-stats a { min-width:0; padding:.8rem .35rem; }
      .category-index { grid-template-columns:1fr; }
      .media-preview-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .section-heading-row { align-items:flex-start; flex-direction:column; }
    }
    .foundation-directory { margin:0 0 4rem; padding:2rem; border-radius:24px; background:#fff; border:1px solid #E3E6EF; }
    .foundation-directory-head { max-width:720px; margin-bottom:1.4rem; }
    .foundation-directory-head h2 { font-size:clamp(1.8rem,4vw,3rem); margin:.25rem 0 .65rem; }
    .network-kicker { display:inline-block; color:#5B5CE2; font-size:.76rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    .foundation-card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
    .foundation-card { display:flex; flex-direction:column; gap:.7rem; padding:1.35rem; min-height:180px; color:#182033; background:#F8F9FD; border:1px solid #E3E6EF; border-radius:16px; }
    .foundation-card:hover { border-color:#5B5CE2; transform:translateY(-2px); }
    .foundation-card > span { font-size:1.15rem; font-weight:800; }
    .foundation-card p { color:#566078; line-height:1.55; flex:1; }
    .foundation-card strong { color:#5B5CE2; }
    .foundation-page { max-width:900px; margin:0 auto; }
    .foundation-header { padding:clamp(2rem,6vw,4.5rem); background:#182033; color:#fff; border-radius:28px; margin-bottom:1.5rem; }
    .foundation-header h1 { font-size:clamp(2.6rem,6vw,4.8rem); line-height:1; margin:.75rem 0 1.2rem; color:#fff; }
    .foundation-header p { max-width:720px; font-size:1.15rem; line-height:1.7; color:#E7E9F2; }
    .foundation-section,.official-channels,.content-method { background:#fff; border:1px solid #E3E6EF; border-radius:18px; padding:clamp(1.3rem,4vw,2.2rem); margin-bottom:1rem; }
    .foundation-section h2 { margin-bottom:.8rem; font-size:1.65rem; }
    .foundation-section p { line-height:1.75; color:#46506A; }
    .evidence-links { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:1.2rem; font-size:.85rem; }
    .evidence-links a { color:#4038B7; text-decoration:underline; }
    .foundation-section details { border-top:1px solid #E3E6EF; padding:1rem 0; }
    .foundation-section summary { font-weight:800; cursor:pointer; }
    .official-channels { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
    .official-channel { display:flex; flex-direction:column; gap:.5rem; padding:1.25rem; color:#182033; background:#F8F9FD; border-radius:14px; }
    .official-channel span { color:#5B5CE2; }
    .content-method { font-size:.9rem; line-height:1.65; color:#566078; border-left:4px solid #5B5CE2; }
    .theme-network-standard .footer { background:#182033; border-radius:0; }

    /* Layout universale: una gerarchia editoriale stabile per ogni profilo. */
    .skip-link { position:fixed; top:.75rem; left:.75rem; z-index:1000; padding:.75rem 1rem; border-radius:10px; background:#fff; color:#182033; font-weight:800; box-shadow:0 10px 30px rgba(0,0,0,.2); transform:translateY(-160%); }
    .skip-link:focus { transform:translateY(0); }
    :where(a,button,input,textarea,select,summary):focus-visible { outline:3px solid #FFB020; outline-offset:3px; }
    .universal-home { width:min(100%,1160px); margin:0 auto; }
    .universal-hero { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr); gap:clamp(2rem,5vw,5rem); align-items:center; padding:clamp(2.5rem,7vw,6rem) 0 clamp(3rem,7vw,5.5rem); }
    .universal-hero-copy { min-width:0; }
    .universal-eyebrow { display:inline-block; margin-bottom:.8rem; color:#4038B7; font-size:.76rem; font-weight:850; letter-spacing:.12em; text-transform:uppercase; }
    .universal-identity { display:flex; align-items:center; gap:.8rem; margin-bottom:1rem; color:#46506A; font-size:.9rem; font-weight:800; }
    .universal-identity img { width:56px; height:56px; border:1px solid #E3E6EF; border-radius:14px; object-fit:contain; background:#fff; }
    .universal-brand-cover { width:min(100%,520px); margin:0 0 1rem; overflow:hidden; border:1px solid #E3E6EF; border-radius:18px; background:#fff; }
    .universal-brand-cover img { display:block; width:100%; aspect-ratio:16/7; object-fit:cover; }
    .universal-hero h1 { max-width:760px; margin:0; color:#182033; font-size:clamp(2.7rem,6vw,5.6rem); line-height:.98; letter-spacing:-.055em; text-wrap:balance; }
    .universal-hero-copy > p { max-width:680px; margin:1.4rem 0 0; color:#46506A; font-size:clamp(1.05rem,2vw,1.25rem); line-height:1.7; }
    .universal-actions { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:1.7rem; }
    .universal-button { display:inline-flex; min-height:48px; align-items:center; justify-content:center; padding:.8rem 1.2rem; border:1px solid #C9CEDB; border-radius:12px; background:#fff; color:#182033; font-weight:800; }
    .universal-button:hover { border-color:#4038B7; color:#4038B7; }
    .universal-button-primary { border-color:#4038B7; background:#4038B7; color:#fff; }
    .universal-button-primary:hover { background:#2F298F; color:#fff; }
    .universal-stats { display:flex; flex-wrap:wrap; gap:1.5rem; margin-top:2rem; padding:0; list-style:none; }
    .universal-stats li { display:grid; gap:.15rem; min-width:92px; }
    .universal-stats strong { color:#182033; font-size:1.45rem; line-height:1; }
    .universal-stats span { color:#667085; font-size:.78rem; }
    .universal-lead { position:relative; display:flex; min-height:480px; overflow:hidden; border-radius:28px; background:#182033; color:#fff; box-shadow:0 28px 70px rgba(24,32,51,.18); isolation:isolate; scroll-margin-top:100px; }
    .universal-lead::after { content:''; position:absolute; inset:0; z-index:1; background:linear-gradient(0deg,rgba(11,16,30,.94),rgba(11,16,30,.06) 72%); }
    .universal-lead img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .universal-lead-body { position:relative; z-index:2; display:flex; align-self:flex-end; width:100%; flex-direction:column; gap:.7rem; padding:clamp(1.4rem,4vw,2.2rem); }
    .universal-lead-body small { color:#D9D6FF; font-size:.72rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .universal-lead-body strong { color:#fff; font-size:clamp(1.55rem,3vw,2.25rem); line-height:1.12; text-wrap:balance; }
    .universal-lead-body > span { display:-webkit-box; overflow:hidden; color:rgba(255,255,255,.78); line-height:1.6; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
    .universal-lead-body b { margin-top:.3rem; color:#fff; font-size:.9rem; }
    .universal-lead-no-image { background:linear-gradient(145deg,#182033,#332D72); }
    .universal-lead-empty { min-height:360px; }
    .universal-section { padding:clamp(2.5rem,6vw,4.5rem) 0; border-top:1px solid #E3E6EF; scroll-margin-top:100px; }
    .universal-section-heading { display:flex; justify-content:space-between; gap:1.5rem; align-items:end; margin-bottom:1.5rem; }
    .universal-section-heading h2 { margin:0; color:#182033; font-size:clamp(2rem,4vw,3.25rem); line-height:1.05; letter-spacing:-.04em; }
    .universal-section-heading > a { color:#4038B7; font-weight:800; }
    .universal-card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1.25rem; }
    .universal-card { display:flex; min-width:0; flex-direction:column; overflow:hidden; border:1px solid #E3E6EF; border-radius:18px; background:#fff; }
    .universal-card-media:empty { display:none; }
    .universal-card-media .media { width:100%!important; margin:0; border-radius:0; }
    .universal-card-media .media img,.universal-card-media .media video,.universal-card-media .media iframe { width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:0; }
    .universal-card-body { display:flex; flex:1; flex-direction:column; align-items:flex-start; padding:1.25rem; }
    .universal-meta { display:flex; width:100%; justify-content:space-between; gap:.75rem; margin-bottom:.8rem; color:#667085; font-size:.75rem; font-weight:700; }
    .universal-card h3 { margin:0; font-size:1.25rem; line-height:1.3; letter-spacing:-.02em; }
    .universal-card h3 a { color:#182033; }
    .universal-card h3 a:hover { color:#4038B7; }
    .universal-card p { display:-webkit-box; margin:.75rem 0 1rem; overflow:hidden; color:#566078; line-height:1.65; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
    .universal-read { margin-top:auto; color:#4038B7; font-size:.88rem; font-weight:850; }
    .universal-topic-list { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.75rem; }
    .universal-topic-list a { display:flex; min-height:54px; align-items:center; justify-content:space-between; gap:.75rem; padding:.8rem 1rem; border:1px solid #DDE2EE; border-radius:12px; background:#fff; color:#182033; font-weight:800; }
    .universal-topic-list a:hover { border-color:#4038B7; color:#4038B7; }
    .universal-topic-list strong { display:grid; min-width:28px; height:28px; place-items:center; border-radius:999px; background:#ECEBFF; color:#4038B7; font-size:.72rem; }
    .universal-info-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem; }
    .universal-info-grid a { display:flex; min-height:190px; flex-direction:column; padding:1.3rem; border-radius:16px; background:#182033; color:#fff; }
    .universal-info-grid a > span { color:#fff; font-size:1.15rem; font-weight:850; }
    .universal-info-grid p { margin:.7rem 0 1rem; color:#D7DBE7; font-size:.9rem; line-height:1.6; }
    .universal-info-grid strong { margin-top:auto; color:#D9D6FF; font-size:.85rem; }
    .universal-custom-media { margin:0 0 1.5rem; border-radius:16px; overflow:hidden; }
    .universal-custom-media img { display:block; width:100%; max-height:420px; object-fit:cover; }
    .theme-network-standard .single-post { max-width:780px; border:1px solid #E3E6EF; border-radius:18px; box-shadow:none; }
    .theme-network-standard .single-post h1 { font-size:clamp(2.1rem,5vw,3.8rem); line-height:1.08; letter-spacing:-.045em; text-wrap:balance; }
    .theme-network-standard .body-content { color:#263149; font-size:1.125rem; line-height:1.8; opacity:1; }
    .theme-network-standard .body-content :where(p,li) { max-width:72ch; }
    .theme-network-standard .body-content :where(h2,h3) { margin:2.2rem 0 .8rem; line-height:1.2; }
    .theme-network-standard .body-content { overflow-wrap:anywhere; }
    .theme-network-standard .body-content table { display:block; width:100%; overflow-x:auto; border-collapse:collapse; }
    .theme-network-standard .body-content :where(th,td) { padding:.65rem .8rem; border:1px solid #D8DDEA; text-align:left; }
    .theme-network-standard .body-content :where(img,video,iframe) { max-width:100%; }
    @media(max-width:900px){.universal-hero{grid-template-columns:1fr}.universal-lead{min-height:420px}.universal-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.universal-topic-list,.universal-info-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.universal-hero{padding:2rem 0 3.5rem}.universal-hero h1{font-size:clamp(2.45rem,13vw,4rem)}.universal-lead{min-height:360px;border-radius:20px}.universal-actions .universal-button{width:100%}.universal-stats{justify-content:space-between;gap:.75rem}.universal-card-grid,.universal-topic-list,.universal-info-grid{grid-template-columns:1fr}.universal-section-heading{align-items:flex-start;flex-direction:column}.theme-network-standard .single-post{padding:1.35rem}.theme-network-standard .body-content{font-size:1.05rem}.network-trust{display:none}}
    @media(prefers-reduced-motion:reduce){html:focus-within{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}.post{opacity:1;transform:none}}
    /* Spazio Vivo: portale visuale, non homepage tradizionale */
    .theme-network-standard .container { max-width:1440px; }
    .living-experience { position:relative; margin:0 0 3rem; padding:10px; border-radius:36px; background:#0C1020; color:#fff; overflow:hidden; box-shadow:0 38px 100px rgba(15,15,45,.24); }
    .living-portal { position:relative; min-height:min(76vh,760px); border-radius:28px; overflow:hidden; background:radial-gradient(circle at 73% 22%,rgba(123,92,255,.38),transparent 30%),linear-gradient(145deg,#12172B,#20194A 60%,#6B275E); isolation:isolate; }
    .living-portal::after { content:''; position:absolute; inset:0; z-index:1; background:linear-gradient(90deg,rgba(8,11,25,.92) 0%,rgba(8,11,25,.58) 42%,rgba(8,11,25,.08) 73%),linear-gradient(0deg,rgba(8,11,25,.78),transparent 42%); pointer-events:none; }
    .living-media-grid { position:absolute; inset:0; display:grid; grid-template-columns:1.15fr .85fr 1fr; grid-template-rows:1fr .7fr; gap:7px; transform:scale(1.035); }
    .living-media-item { position:relative; display:block; min-width:0; overflow:hidden; background:#252A40; color:#fff; }
    .living-media-position-0 { grid-column:1 / 3; grid-row:1 / 3; }
    .living-media-position-1 { grid-column:3; grid-row:1; }
    .living-media-position-2 { grid-column:3; grid-row:2; }
    .living-media-position-3,.living-media-position-4,.living-media-position-5,.living-media-position-6,.living-media-position-7 { display:none; }
    .living-media-item img,.living-media-item video { width:100%; height:100%; display:block; object-fit:cover; filter:saturate(.92) contrast(1.04); transition:transform .8s cubic-bezier(.2,.8,.2,1),filter .5s; }
    .living-media-item:hover img,.living-media-item:hover video { transform:scale(1.055); filter:saturate(1.15) contrast(1.02); }
    .living-media-item::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg,rgba(7,8,18,.74),transparent 48%); pointer-events:none; }
    .living-media-caption { position:absolute; z-index:2; left:1.2rem; right:1.2rem; bottom:1rem; display:flex; flex-direction:column; gap:.25rem; opacity:.82; }
    .living-media-caption small { color:#D8CDFF; font-size:.65rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    .living-media-caption strong { display:-webkit-box; overflow:hidden; color:#fff; font-size:.9rem; line-height:1.25; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .living-media-play { position:absolute; z-index:3; top:1rem; right:1rem; display:grid; width:2.5rem; height:2.5rem; place-items:center; border-radius:50%; background:#fff; color:#20194A; }
    .living-intro { position:absolute; z-index:3; left:clamp(1.4rem,5vw,5rem); bottom:clamp(2rem,7vw,5.5rem); width:min(700px,76%); }
    .living-kicker { display:inline-flex; color:#D9CEFF; font-size:.7rem; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
    .living-intro h1 { margin:.65rem 0 .9rem; color:#fff; font-size:clamp(3.2rem,7.8vw,7.7rem); line-height:.85; letter-spacing:-.072em; text-wrap:balance; }
    .living-intro p { max-width:630px; margin:0; color:rgba(255,255,255,.76); font-size:clamp(1rem,1.5vw,1.25rem); line-height:1.55; }
    .living-live-proof { display:flex; align-items:center; gap:.6rem; margin-top:1.2rem; color:rgba(255,255,255,.66); font-size:.75rem; }
    .living-live-proof i { width:8px; height:8px; border-radius:50%; background:#69F0C0; box-shadow:0 0 0 6px rgba(105,240,192,.12); animation:livingPulse 2s infinite; }
    @keyframes livingPulse { 50% { box-shadow:0 0 0 12px rgba(105,240,192,0); } }
    .living-portal-index { position:absolute; z-index:3; right:2rem; top:1.7rem; display:flex; align-items:flex-start; gap:.6rem; color:#fff; }
    .living-portal-index strong { font-size:2.4rem; line-height:.85; letter-spacing:-.08em; }
    .living-portal-index span { color:rgba(255,255,255,.58); font-size:.62rem; line-height:1.15; text-transform:uppercase; letter-spacing:.08em; }
    .living-command { display:grid; grid-template-columns:170px 1fr; gap:1rem; align-items:center; padding:1rem .5rem .4rem; }
    .living-command-label { padding-left:1rem; color:rgba(255,255,255,.5); font-size:.72rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    .living-intents { display:flex; gap:.45rem; margin:0; overflow-x:auto; scrollbar-width:none; }
    .living-intents::-webkit-scrollbar { display:none; }
    .living-intent { flex:0 0 auto; appearance:none; display:flex; align-items:center; gap:.6rem; border:1px solid rgba(255,255,255,.13); background:rgba(255,255,255,.055); color:rgba(255,255,255,.72); padding:.75rem .95rem; border-radius:12px; font:inherit; font-size:.78rem; font-weight:800; cursor:pointer; transition:.25s ease; }
    .living-intent span { color:rgba(255,255,255,.35); font-size:.62rem; }
    .living-intent:hover { transform:translateY(-2px); border-color:rgba(255,255,255,.42); color:#fff; }
    .living-intent[aria-pressed="true"] { background:#fff; color:#17152B; border-color:#fff; }
    .living-intent[aria-pressed="true"] span { color:#6B5BDE; }
    .living-layout { display:grid; grid-template-columns:280px minmax(0,1fr); gap:10px; padding-top:10px; align-items:stretch; }
    .living-compass { position:relative; padding:1.4rem; border:1px solid rgba(255,255,255,.1); border-radius:24px; background:linear-gradient(150deg,rgba(255,255,255,.1),rgba(255,255,255,.045)); color:#fff; box-shadow:none; }
    .living-console-kicker { color:#AFA3FF; font-size:.65rem; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
    .living-path-name { margin-top:.45rem; color:#fff; font-size:1.2rem; font-weight:900; line-height:1.15; }
    .living-progress { height:2px; margin:1rem 0; background:rgba(255,255,255,.13); overflow:hidden; }
    .living-progress span { display:block; width:64%; height:100%; background:linear-gradient(90deg,#8E7CFF,#F35C76); }
    .living-question { padding:0; margin:0 0 1.2rem; background:none; color:rgba(255,255,255,.64); line-height:1.55; font-size:.82rem; }
    .living-cta { display:flex; align-items:center; justify-content:center; width:100%; min-height:48px; padding:.75rem 1rem; border-radius:13px; background:#fff; color:#17152B; font-weight:900; text-align:center; }
    .living-cta:hover { background:#D9CEFF; color:#17152B; }
    .living-proof { margin-top:1rem; padding-top:.9rem; border-top:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.42); font-size:.69rem; line-height:1.5; }
    .living-stage { display:flex; gap:10px; min-width:0; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-color:#5B5CE2 transparent; padding:0 0 .55rem; }
    .living-stage::before { display:none; }
    .living-chapter { position:relative; flex:0 0 min(72%,560px); min-height:280px; display:flex; flex-direction:column; justify-content:flex-end; padding:clamp(1.25rem,3vw,2rem); margin:0; border:1px solid rgba(255,255,255,.1); border-radius:24px; background:radial-gradient(circle at 90% 10%,rgba(142,124,255,.3),transparent 30%),linear-gradient(145deg,#171C31,#252047); color:#fff; scroll-snap-align:start; overflow:hidden; transition:.25s ease; }
    .living-chapter:nth-child(2n) { background:radial-gradient(circle at 90% 10%,rgba(243,92,118,.26),transparent 30%),linear-gradient(145deg,#21172B,#3B203F); }
    .living-chapter:hover { transform:translateY(-3px); border-color:rgba(255,255,255,.34); box-shadow:none; }
    .living-chapter::before { content:attr(data-index); position:absolute; right:1rem; top:-1.3rem; width:auto; height:auto; border:0; background:none; color:rgba(255,255,255,.055); font-size:9rem; font-weight:900; letter-spacing:-.1em; }
    .living-step { display:block; margin-bottom:.7rem; color:#BEB4FF; font-size:.67rem; font-weight:900; letter-spacing:.1em; text-transform:uppercase; }
    .living-chapter strong { display:block; max-width:480px; margin-bottom:.55rem; color:#fff; font-size:clamp(1.35rem,2.4vw,2rem); line-height:1.08; letter-spacing:-.025em; }
    .living-chapter p { max-width:480px; margin:0; color:rgba(255,255,255,.62); line-height:1.5; font-size:.86rem; }
    .living-chapter-meta { display:flex; justify-content:space-between; gap:1rem; margin-top:1.2rem; padding-top:.85rem; border-top:1px solid rgba(255,255,255,.1); color:rgba(255,255,255,.48); font-size:.7rem; }
    .living-chapter-meta b { color:#fff; }
    .living-archive { margin:0 0 3rem; }
    .living-archive > summary { list-style:none; display:flex; justify-content:space-between; gap:1rem; padding:1rem 1.2rem; border:1px solid #DDE2EE; border-radius:16px; background:#fff; color:#182033; font-weight:800; cursor:pointer; }
    .living-archive > summary::-webkit-details-marker { display:none; }
    .living-archive > summary::after { content:'＋'; color:#5B5CE2; }
    .living-archive[open] > summary::after { content:'−'; }
    .living-archive-body { padding-top:2rem; }
    /* La home Spazio Vivo occupa davvero la pagina: niente colonna-sito centrata. */
    .has-living-home .container { width:100%; max-width:none; padding:0; }
    .has-living-home .living-experience { width:100%; margin:0; padding:10px; border-radius:0; box-shadow:none; }
    .has-living-home .living-portal { min-height:calc(100svh - 126px); border-radius:22px; }
    .has-living-home .living-command,.has-living-home .living-layout { width:min(100%,1600px); margin-left:auto; margin-right:auto; }
    .has-living-home .living-archive { width:min(1440px,calc(100% - 32px)); margin:2rem auto 3rem; }
    a:focus-visible,button:focus-visible,summary:focus-visible { outline:3px solid #FFBF47; outline-offset:3px; }
    @media(max-width:1050px) and (min-width:769px){.living-intro h1{font-size:clamp(3.5rem,9vw,6rem)}.living-layout{grid-template-columns:230px minmax(0,1fr)}.living-chapter{flex-basis:min(82%,520px)}.living-command{grid-template-columns:140px 1fr}}
    @media(max-width:768px){ .foundation-directory{padding:1.25rem}.foundation-header{border-radius:20px}.network-bar{font-size:.7rem;padding:.55rem .85rem}.network-signature{gap:.45rem}.network-signature-brand strong{display:none}.network-product-name{padding:.3rem .6rem}.network-trust{margin-left:auto;max-width:145px;text-align:right;line-height:1.25}.theme-network-standard .navbar{padding:.75rem 1rem!important}.theme-network-standard .container{padding:1rem .65rem}.has-living-home .container{padding:0}.has-living-home .living-experience{padding:0}.living-experience{padding:6px;border-radius:22px}.living-portal,.has-living-home .living-portal{min-height:calc(100svh - 112px);border-radius:0}.living-media-grid{grid-template-columns:1fr;grid-template-rows:1fr}.living-media-position-0{grid-column:1;grid-row:1}.living-media-position-1,.living-media-position-2{display:none}.living-portal::after{background:linear-gradient(0deg,rgba(8,11,25,.96) 0%,rgba(8,11,25,.5) 68%,rgba(8,11,25,.18) 100%)}.living-intro{left:1rem;right:1rem;bottom:1.35rem;width:auto}.living-intro h1{font-size:clamp(2.75rem,14vw,5rem);line-height:.9}.living-intro p{font-size:.92rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.living-kicker{font-size:.6rem}.living-portal-index{right:.85rem;top:.85rem}.living-portal-index strong{font-size:1.9rem}.living-command{display:block;padding:.85rem .7rem}.living-command-label{display:block;margin:0 0 .65rem;padding-left:.15rem}.living-intent{padding:.68rem .8rem}.living-layout{grid-template-columns:1fr;padding:0 .7rem .7rem}.living-compass{position:static;border-radius:18px}.living-chapter{flex-basis:88%;min-height:270px;border-radius:18px}.living-chapter::before{left:auto}.living-live-proof{align-items:flex-start}.living-live-proof i{flex:0 0 auto;margin-top:.3rem}.has-living-home .living-archive{width:calc(100% - 20px);margin:1rem auto 2rem} }

    /* Direzione premium: un vero sito editoriale, non una console. */
    .has-living-home{background:#F4F1EA;color:#191A1D}
    .has-living-home .network-bar{background:#191A1D;padding:.55rem 1.4rem}
    .has-living-home .navbar{position:sticky;top:0;z-index:30;background:rgba(244,241,234,.94)!important;border-color:rgba(25,26,29,.12);backdrop-filter:blur(18px);padding:1rem clamp(1.2rem,4vw,4.5rem)!important}
    .has-living-home .nav-brand{font-size:1.05rem;letter-spacing:-.02em}
    .has-living-home .living-experience{background:#F4F1EA;color:#191A1D}
    .has-living-home .living-portal{min-height:calc(100svh - 118px);border-radius:0;background:#202020}
    .has-living-home .living-portal::after{background:linear-gradient(90deg,rgba(12,13,15,.82) 0%,rgba(12,13,15,.46) 48%,rgba(12,13,15,.08) 76%),linear-gradient(0deg,rgba(12,13,15,.7),transparent 48%)}
    .has-living-home .living-media-grid{gap:2px;transform:none;grid-template-columns:1.55fr .65fr;grid-template-rows:1fr 1fr}
    .has-living-home .living-media-position-0{grid-column:1;grid-row:1/3}
    .has-living-home .living-media-position-1{grid-column:2;grid-row:1}
    .has-living-home .living-media-position-2{grid-column:2;grid-row:2}
    .has-living-home .living-media-caption{display:none}
    .living-brandmark{display:flex;align-items:center;gap:.8rem;margin-bottom:1.3rem;color:#fff;font-size:.85rem;font-weight:850;letter-spacing:.02em}
    .living-brandmark img{width:46px;height:46px;object-fit:contain;border-radius:50%;background:#fff;padding:3px}
    .has-living-home .living-intro{left:clamp(1.4rem,6vw,7rem);bottom:clamp(2rem,7vw,6rem);width:min(820px,80%)}
    .has-living-home .living-intro h1{font-size:clamp(3.6rem,7.2vw,8.4rem);line-height:.87;letter-spacing:-.075em;max-width:900px}
    .has-living-home .living-intro p{max-width:650px;color:rgba(255,255,255,.82);font-size:clamp(1rem,1.35vw,1.22rem)}
    .living-hero-cta{display:inline-flex;align-items:center;gap:1.2rem;margin-top:1.35rem;padding:.85rem 1.1rem;background:#fff;color:#191A1D;border-radius:999px;font-size:.8rem;font-weight:850}
    .living-hero-cta span{font-size:1rem}
    .has-living-home .living-portal-index{top:2rem;right:clamp(1.4rem,4vw,4rem)}
    .has-living-home .living-command{display:flex;align-items:center;gap:2rem;padding:2rem clamp(1.2rem,4vw,4rem);background:#F4F1EA;border-bottom:1px solid rgba(25,26,29,.13)}
    .has-living-home .living-command-label{flex:0 0 auto;padding:0;color:#191A1D;font-size:.72rem}
    .has-living-home .living-intents{gap:.6rem}
    .has-living-home .living-intent{border:1px solid rgba(25,26,29,.18);background:transparent;color:#55575D;border-radius:999px;padding:.75rem 1rem}
    .has-living-home .living-intent span{color:#8A8B91}
    .has-living-home .living-intent[aria-pressed="true"]{background:#191A1D;border-color:#191A1D;color:#fff}
    .has-living-home .living-layout{grid-template-columns:250px minmax(0,1fr);gap:2.5rem;padding:clamp(2rem,5vw,5rem) clamp(1.2rem,4vw,4rem)}
    .has-living-home .living-compass{padding:0;background:transparent;border:0;border-radius:0;color:#191A1D;box-shadow:none}
    .has-living-home .living-console-kicker{color:#777A80}
    .has-living-home .living-path-name{color:#191A1D;font-size:1.55rem;letter-spacing:-.04em}
    .has-living-home .living-progress{background:rgba(25,26,29,.15)}
    .has-living-home .living-progress span{background:#E55D3D}
    .has-living-home .living-question{color:#676970;font-size:.9rem}
    .has-living-home .living-cta{background:#E55D3D;color:#fff;border-radius:999px}
    .has-living-home .living-cta:hover{background:#191A1D;color:#fff}
    .has-living-home .living-proof{color:#898B90;border-color:rgba(25,26,29,.12)}
    .has-living-home .living-stage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem;overflow:visible;padding:0}
    .has-living-home .living-chapter{display:flex;min-height:0;padding:0;border:1px solid rgba(25,26,29,.12);border-radius:22px;background:#fff!important;color:#191A1D;overflow:hidden;box-shadow:0 18px 45px rgba(31,32,35,.07)}
    .has-living-home .living-chapter::before{display:none}
    .living-chapter-media{display:block;width:100%;height:clamp(190px,19vw,285px);overflow:hidden;background:#DDD9D1}
    .living-chapter-media img,.living-chapter-media video{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}
    .has-living-home .living-chapter:hover .living-chapter-media img{transform:scale(1.035)}
    .has-living-home .living-step{margin:1.15rem 1.25rem .55rem;color:#E55D3D}
    .has-living-home .living-chapter strong{margin:0 1.25rem .55rem;color:#191A1D;font-size:clamp(1.2rem,1.7vw,1.65rem);line-height:1.08}
    .has-living-home .living-chapter p{margin:0 1.25rem;color:#6B6D73;font-size:.86rem}
    .has-living-home .living-chapter-meta{margin:1.1rem 1.25rem 1.25rem;color:#84868B;border-color:rgba(25,26,29,.1)}
    .has-living-home .living-chapter-meta b{color:#191A1D}
    @media(max-width:900px){.has-living-home .living-media-grid{grid-template-columns:1fr}.has-living-home .living-media-position-0{grid-column:1;grid-row:1/3}.has-living-home .living-media-position-1,.has-living-home .living-media-position-2{display:none}.has-living-home .living-layout{grid-template-columns:1fr}.has-living-home .living-compass{display:grid;grid-template-columns:1fr auto;gap:.6rem 1rem;align-items:center;padding-bottom:1.5rem;border-bottom:1px solid rgba(25,26,29,.12)}.has-living-home .living-progress,.has-living-home .living-proof{display:none}.has-living-home .living-question{grid-column:1}.has-living-home .living-cta{grid-column:2;grid-row:1/3;width:auto}.has-living-home .living-stage{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){.has-living-home .network-trust{display:none}.has-living-home .living-portal{min-height:calc(100svh - 102px)}.has-living-home .living-intro{left:1.1rem;right:1.1rem;bottom:1.6rem;width:auto}.has-living-home .living-intro h1{font-size:clamp(3rem,15vw,5rem)}.living-brandmark{margin-bottom:.9rem}.has-living-home .living-command{display:block;padding:1.25rem 1rem}.has-living-home .living-command-label{display:block;margin-bottom:.75rem}.has-living-home .living-layout{padding:2rem 1rem;gap:1.5rem}.has-living-home .living-compass{display:block}.has-living-home .living-question{margin-bottom:1rem}.has-living-home .living-stage{grid-template-columns:1fr}.living-chapter-media{height:240px}.has-living-home .living-live-proof{display:none}}

    /* Social Intelligence Wall: il prodotto, prima del sito editoriale. */
    .social-pulse{--pulse-lime:#C8FF36;--pulse-violet:#8C6BFF;position:relative;width:100%;margin:0 0 3.5rem;padding:10px;background:#08090D;color:#fff;overflow:hidden}
    .social-pulse-hero{position:relative;min-height:max(860px,calc(100svh - 118px));display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(2rem,7vw,7rem);overflow:hidden;background:radial-gradient(circle at 83% 16%,rgba(140,107,255,.55),transparent 27%),radial-gradient(circle at 12% 90%,rgba(200,255,54,.18),transparent 30%),linear-gradient(135deg,#10111A 0%,#18142B 56%,#311D45 100%)}
    .social-pulse-hero::before{content:'LIVE';position:absolute;right:-.04em;top:-.18em;color:rgba(255,255,255,.035);font-size:clamp(11rem,35vw,36rem);font-weight:950;line-height:1;letter-spacing:-.12em;pointer-events:none}
    .social-pulse-hero::after{content:'';position:absolute;right:clamp(1.2rem,5vw,5rem);bottom:clamp(2rem,6vw,5rem);width:clamp(80px,13vw,180px);aspect-ratio:1;border:1px solid rgba(255,255,255,.25);border-radius:50%;box-shadow:0 0 0 22px rgba(255,255,255,.035),0 0 0 44px rgba(255,255,255,.025);animation:pulseOrbit 7s linear infinite}
    @keyframes pulseOrbit{50%{transform:scale(.92) rotate(180deg)}100%{transform:rotate(360deg)}}
    .social-pulse-brand{position:relative;z-index:1;display:flex;align-items:center;gap:.75rem;margin-bottom:2.5rem;font-size:.82rem;font-weight:850}
    .social-pulse-brand img{width:44px;height:44px;object-fit:contain;border-radius:50%;padding:3px;background:#fff}
    .social-pulse-kicker{position:relative;z-index:1;display:flex;align-items:center;gap:.65rem;margin-bottom:1rem;color:rgba(255,255,255,.65);font-size:.68rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
    .social-pulse-kicker i,.social-pulse-now i,.social-signal-meta i{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--pulse-lime);box-shadow:0 0 0 6px rgba(200,255,54,.1)}
    .social-pulse-hero h1{position:relative;z-index:1;max-width:1100px;margin:0;color:#fff;font-size:clamp(3.6rem,9vw,10rem);line-height:.78;letter-spacing:-.085em;text-wrap:balance}
    .social-pulse-hero h1 em{color:var(--pulse-lime);font-style:normal}
    .social-pulse-hero>p{position:relative;z-index:1;display:-webkit-box;max-width:680px;margin:1.6rem 0 0;overflow:hidden;color:rgba(255,255,255,.67);font-size:clamp(1rem,1.5vw,1.25rem);line-height:1.6;-webkit-line-clamp:3;-webkit-box-orient:vertical}
    .social-pulse-stats{position:relative;z-index:1;display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.5rem}
    .social-pulse-stats span{padding:.65rem .85rem;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.62);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
    .social-pulse-stats strong{color:#fff;font-size:.9rem}
    .social-pulse-scroll{position:relative;z-index:2;align-self:flex-start;display:inline-flex;align-items:center;gap:1.3rem;margin-top:1.35rem;padding:.9rem 1.2rem;border-radius:999px;background:#fff;color:#0B0C10;font-size:.78rem;font-weight:900}
    .social-pulse-scroll span{color:#6A44E5}
    .social-pulse-console{position:sticky;top:74px;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:1.2rem;padding:1rem clamp(1rem,4vw,4rem);border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);background:rgba(8,9,13,.9);backdrop-filter:blur(18px)}
    .social-pulse-console>div:first-child{display:flex;align-items:center;gap:1.2rem;min-width:0}
    .social-pulse-console-label{flex:0 0 auto;color:rgba(255,255,255,.42);font-size:.62rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .social-pulse-filters{display:flex;gap:.45rem;overflow-x:auto;scrollbar-width:none}
    .social-pulse-filters::-webkit-scrollbar{display:none}
    .social-pulse-filter{appearance:none;flex:0 0 auto;padding:.62rem .9rem;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:transparent;color:rgba(255,255,255,.64);font:inherit;font-size:.72rem;font-weight:800;cursor:pointer}
    .social-pulse-filter:hover,.social-pulse-filter.is-active{border-color:var(--pulse-lime);background:var(--pulse-lime);color:#101207}
    .social-pulse-now{display:flex;align-items:center;gap:.55rem;white-space:nowrap;color:rgba(255,255,255,.5);font-size:.68rem;text-transform:uppercase;letter-spacing:.07em}
    .social-pulse-now strong{color:#fff}
    .social-wall{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:dense;gap:8px;padding:8px 0;background:#08090D}
    .social-signal{position:relative;min-height:370px;overflow:hidden;background:#151722;transition:opacity .25s ease,transform .25s ease}
    .social-signal.is-hidden{display:none}
    .social-signal>a{position:absolute;inset:0;display:flex;flex-direction:column;color:#fff}
    .social-signal--lead{grid-column:span 2;grid-row:span 2;min-height:748px}
    .social-signal--text:nth-child(4n+2){background:linear-gradient(145deg,#422A68,#151722)}
    .social-signal--text:nth-child(4n+3){background:linear-gradient(145deg,#20383A,#10171A)}
    .social-signal .media{position:absolute;inset:0;margin:0!important;border-radius:0!important}
    .social-signal .media::after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,rgba(6,7,11,.96) 0%,rgba(6,7,11,.18) 74%)}
    .social-signal .media img,.social-signal .media video,.social-signal .media iframe{width:100%;height:100%;object-fit:cover;border:0;transition:transform .7s cubic-bezier(.2,.8,.2,1)}
    .social-signal:hover .media img,.social-signal:hover .media video{transform:scale(1.045)}
    .social-signal-body{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;height:100%;padding:clamp(1.1rem,2vw,1.8rem);background:linear-gradient(0deg,rgba(7,8,12,.94),transparent 70%)}
    .social-signal--text .social-signal-body{background:none}
    .social-signal-meta{display:flex;justify-content:space-between;gap:.7rem;align-items:center;margin-bottom:auto;color:rgba(255,255,255,.55);font-size:.62rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .social-signal-meta span{display:flex;align-items:center;gap:.55rem}
    .social-signal-meta i{width:6px;height:6px;box-shadow:none}
    .social-signal h2{margin:2.5rem 0 .65rem;color:#fff;font-size:clamp(1.35rem,2vw,2.15rem);line-height:1.02;letter-spacing:-.035em}
    .social-signal--lead h2{max-width:760px;font-size:clamp(2.5rem,5vw,5.8rem);line-height:.9}
    .social-signal p{display:-webkit-box;margin:0;color:rgba(255,255,255,.58);font-size:.82rem;line-height:1.5;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    .social-signal-open{display:flex;justify-content:space-between;align-items:center;margin-top:1.2rem;padding-top:.85rem;border-top:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-size:.68rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .social-signal-open b{color:var(--pulse-lime);font-size:1.1rem}
    .social-pulse-footer{display:flex;align-items:baseline;gap:.65rem;padding:clamp(1.5rem,4vw,3.5rem);background:var(--pulse-lime);color:#0B0D08}
    .social-pulse-footer span{font-size:clamp(1.4rem,3vw,3rem);font-weight:500;letter-spacing:-.04em}
    .social-pulse-footer strong{font-size:clamp(1.4rem,3vw,3rem);letter-spacing:-.05em}
    .social-pulse-footer a{margin-left:auto;color:#0B0D08;font-size:.76rem;font-weight:900;text-transform:uppercase;white-space:nowrap}
    @media(max-width:1050px){.social-wall{grid-template-columns:repeat(2,minmax(0,1fr))}.social-pulse-hero::after{display:none}.social-pulse-footer{align-items:flex-start;flex-direction:column}.social-pulse-footer a{margin:1rem 0 0}}
    @media(max-width:620px){.social-pulse{padding:0}.social-pulse-hero{min-height:max(720px,calc(100svh - 102px));padding:2rem 1rem}.social-pulse-brand{margin-bottom:2rem}.social-pulse-hero h1{font-size:clamp(3.4rem,18vw,5.4rem);line-height:.82}.social-pulse-hero>p{font-size:.94rem;-webkit-line-clamp:3}.social-pulse-stats span:nth-child(3){display:none}.social-pulse-console{top:64px;padding:.8rem}.social-pulse-console-label,.social-pulse-now{display:none}.social-wall{grid-template-columns:1fr;gap:5px}.social-signal,.social-signal--lead{grid-column:auto;grid-row:auto;min-height:72svh}.social-signal--text{min-height:430px}.social-signal--lead h2{font-size:clamp(2.5rem,12vw,4.2rem)}.social-pulse-footer{padding:2rem 1rem}}

    /* Le dieci modalita condividono contenuti e URL, ma cambiano il modo di entrarvi. */
    .living-mode-stories .social-pulse-hero{min-height:82svh}.living-mode-stories .social-wall{display:flex;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;gap:5px}.living-mode-stories .social-signal{flex:0 0 min(82vw,760px);min-height:78svh;scroll-snap-align:center}.living-mode-stories .social-signal h2{font-size:clamp(2.2rem,5vw,4.8rem)}
    .living-mode-constellation .social-pulse{background:radial-gradient(circle at 50% 55%,#1D3928,#08090D 55%)}.living-mode-constellation .social-wall{grid-template-columns:repeat(3,minmax(0,1fr));gap:2.5rem;padding:5rem}.living-mode-constellation .social-signal{min-height:330px;border:1px solid rgba(178,255,148,.22);border-radius:50%;overflow:hidden}.living-mode-constellation .social-signal:nth-child(3n+2){transform:translateY(4rem)}.living-mode-constellation .social-signal>a{border-radius:50%}.living-mode-constellation .social-signal-body{padding:2.5rem;text-align:center}.living-mode-constellation .social-signal-open{justify-content:center}
    .living-mode-timeline .social-pulse{background:#F3EFE5;color:#1D2820}.living-mode-timeline .social-pulse-hero{min-height:62svh;background:#203127}.living-mode-timeline .social-pulse-console{color:#fff;background:#203127}.living-mode-timeline .social-wall{display:block;max-width:920px;margin:auto;padding:5rem 2rem;background:transparent}.living-mode-timeline .social-signal{position:relative;min-height:260px;margin:0 0 0 110px;border-left:1px solid #829184;background:#fff;color:#1D2820}.living-mode-timeline .social-signal:before{content:'';position:absolute;left:-7px;top:2rem;width:13px;height:13px;border-radius:50%;background:#385D40}.living-mode-timeline .social-signal>a{display:grid;grid-template-columns:minmax(220px,.7fr) 1fr;color:inherit}.living-mode-timeline .social-signal .media{height:100%}.living-mode-timeline .social-signal-body{position:static;background:none}.living-mode-timeline .social-signal-meta,.living-mode-timeline .social-signal p{color:#68736A}
    .living-mode-compass .social-pulse-console{position:sticky;top:0;padding:1.5rem 3rem;background:#EAF0E5;color:#183020}.living-mode-compass .social-pulse-filters{gap:.7rem}.living-mode-compass .social-pulse-filter{padding:.9rem 1.3rem;border:1px solid #839486;border-radius:999px;color:#183020}.living-mode-compass .social-wall{grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;padding:3rem;background:#F3F0E7}.living-mode-compass .social-signal{min-height:480px;border-radius:20px;overflow:hidden}
    .living-mode-mixer .social-pulse-hero{min-height:58svh}.living-mode-mixer .social-wall{grid-template-columns:repeat(3,minmax(0,1fr));gap:1px}.living-mode-mixer .social-signal,.living-mode-mixer .social-signal--lead{grid-column:auto;grid-row:auto;min-height:420px}.living-mode-mixer .social-signal:nth-child(3n+2){background:#18251D}.living-mode-mixer .social-signal:nth-child(3n+3){background:#302B21}
    .living-mode-cinema .social-pulse-hero{min-height:94svh;background:linear-gradient(0deg,rgba(0,0,0,.8),rgba(0,0,0,.1)),var(--cover) center/cover}.living-mode-cinema .social-wall{display:flex;grid-template-columns:none;gap:10px;padding:18px;overflow-x:auto}.living-mode-cinema .social-signal{flex:0 0 min(72vw,900px);min-height:72svh}.living-mode-cinema .social-signal h2{font-size:clamp(2.3rem,5vw,5.2rem)}
    .living-mode-answers .social-pulse{background:#F1EFE8;color:#1B2920}.living-mode-answers .social-pulse-hero{min-height:55svh;background:#25372B}.living-mode-answers .social-wall{display:block;max-width:980px;margin:auto;padding:4rem 1rem;background:transparent}.living-mode-answers .social-signal,.living-mode-answers .social-signal--lead{min-height:0;margin-bottom:.75rem;border:1px solid #CBD2C8;border-radius:16px;background:#fff;color:#1B2920}.living-mode-answers .social-signal>a{display:grid;grid-template-columns:220px 1fr;color:inherit}.living-mode-answers .social-signal .media{height:100%;min-height:220px}.living-mode-answers .social-signal-body{position:static;background:none}.living-mode-answers .social-signal-body h2:before{content:'Una risposta dai contenuti';display:block;margin-bottom:.6rem;color:#497657;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase}.living-mode-answers .social-signal-meta,.living-mode-answers .social-signal p{color:#68736A}
    .living-mode-atlas .social-pulse{background:#E9EEE5;color:#1C2A21}.living-mode-atlas .social-pulse-hero{min-height:68svh;background:#2B4232}.living-mode-atlas .social-wall{grid-template-columns:repeat(3,minmax(0,1fr));gap:2rem;padding:4rem;background:radial-gradient(circle at 20% 30%,#D1DACB,transparent 26%),#E9EEE5}.living-mode-atlas .social-signal{min-height:380px;border-radius:32% 68% 42% 58%;overflow:hidden}.living-mode-atlas .social-signal:nth-child(even){border-radius:63% 37% 60% 40%}
    .living-mode-adaptive .social-pulse-hero{min-height:72svh}.living-mode-adaptive .social-wall{grid-template-columns:repeat(12,1fr);gap:10px;padding:10px;background:#ECEFE8}.living-mode-adaptive .social-signal{grid-column:span 4;min-height:380px}.living-mode-adaptive .social-signal:first-child{grid-column:span 8;grid-row:span 2;min-height:770px}.living-mode-adaptive .social-signal:nth-child(2),.living-mode-adaptive .social-signal:nth-child(3){grid-column:span 4}
    @media(max-width:760px){.living-mode-constellation .social-wall,.living-mode-atlas .social-wall{grid-template-columns:1fr;padding:1rem}.living-mode-constellation .social-signal{border-radius:24px;transform:none!important}.living-mode-timeline .social-wall{padding:2rem .7rem}.living-mode-timeline .social-signal{margin-left:20px}.living-mode-timeline .social-signal>a,.living-mode-answers .social-signal>a{grid-template-columns:1fr}.living-mode-compass .social-wall,.living-mode-mixer .social-wall{grid-template-columns:1fr;padding:5px}.living-mode-adaptive .social-wall{display:block;padding:5px}.living-mode-adaptive .social-signal,.living-mode-adaptive .social-signal:first-child{min-height:70svh;margin-bottom:5px}.living-mode-stories .social-signal,.living-mode-cinema .social-signal{flex-basis:92vw}}

    /* Esperienze native: la modalita confermata cambia il markup, non solo i colori. */
    .living-native{--native-ink:#172018;--native-cream:#F3F0E7;min-height:100svh;color:var(--native-ink);background:var(--native-cream)}
    .native-head{padding:clamp(3rem,8vw,8rem) clamp(1.2rem,6vw,7rem);background:#1C2B21;color:#fff}.native-head>span,.native-head small,.living-native small{font-size:.65rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.native-head h1{max-width:1100px;margin:.7rem 0;font-size:clamp(3.5rem,9vw,8.5rem);line-height:.87;letter-spacing:-.075em}.native-head p{max-width:720px;color:rgba(255,255,255,.72);font-size:clamp(1rem,1.7vw,1.25rem);line-height:1.6}.native-brand{display:flex;align-items:center;gap:.7rem;margin-bottom:3rem}.native-brand img{width:48px;height:48px;object-fit:contain;border-radius:10px;background:#fff}.living-native a{text-decoration:none}
    .native-stories{display:flex;gap:5px;padding:5px;overflow-x:auto;scroll-snap-type:x mandatory;background:#0C100D}.native-story{--native-image:none;position:relative;isolation:isolate;flex:0 0 min(82vw,820px);min-height:82svh;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(1.5rem,5vw,5rem);overflow:hidden;color:#fff;background:linear-gradient(0deg,rgba(5,8,6,.94),rgba(5,8,6,.08)),var(--native-image) center/cover,#26392C;scroll-snap-align:center}.native-story h2{max-width:680px;margin:.6rem 0;font-size:clamp(2.4rem,6vw,5.8rem);line-height:.92}.native-story p{max-width:580px;color:rgba(255,255,255,.72)}.native-story a,.native-cinema-lead>a,.native-adaptive-lead>a{align-self:flex-start;padding:.85rem 1rem;color:#142019;background:#D9FF80;font-weight:850}
    .native-constellation{position:relative;min-height:760px;overflow:hidden;color:#fff;background:radial-gradient(circle at center,#284732 0 10%,#16261D 11% 34%,#0D1510 35%)}.native-core{position:absolute;left:50%;top:50%;width:210px;transform:translate(-50%,-50%);text-align:center}.native-core strong{display:block;margin-top:.5rem;font-size:1.2rem}.native-node{position:absolute;display:grid;place-content:center;width:150px;height:150px;padding:1rem;border:1px solid #71917A;border-radius:50%;text-align:center;color:#fff;background:#23382A}.native-node small{color:#B7E68D}.native-node.node-1{left:12%;top:15%}.native-node.node-2{right:14%;top:12%}.native-node.node-3{left:7%;bottom:13%}.native-node.node-4{right:8%;bottom:12%}.native-node.node-5{left:29%;top:8%}.native-node.node-6{right:31%;bottom:5%}.native-related{display:grid;grid-template-columns:repeat(3,1fr);background:#0D1510}.native-related a{display:flex;justify-content:space-between;gap:1rem;padding:2rem;color:#fff;border:1px solid #314438}.native-related span{color:#B7E68D}
    .native-timeline{max-width:980px;margin:auto;padding:5rem 1rem}.native-timeline article{display:grid;grid-template-columns:120px 24px 1fr;gap:1rem}.native-timeline time{padding-top:1.5rem;text-align:right;color:#6C776E;font-size:.72rem}.native-timeline article>i{position:relative;border-left:1px solid #91A093}.native-timeline article>i:before{content:'';position:absolute;left:-7px;top:1.6rem;width:13px;height:13px;border-radius:50%;background:#34583C}.native-timeline article>div{min-height:220px;padding:1.2rem 0 3rem}.native-timeline img{float:right;width:280px;height:180px;margin-left:1.5rem;object-fit:cover}.native-timeline h2{font-size:clamp(1.6rem,3vw,2.8rem)}.native-timeline h2 a{color:inherit}.native-timeline p{color:#68736A}
    .native-intents{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#AEB9AE}.native-intents a{display:flex;justify-content:space-between;padding:2rem clamp(1.2rem,4vw,4rem);color:#183020;background:#E7ECE3;font-size:clamp(1.2rem,2.6vw,2.2rem);font-weight:750}.native-intents a:hover{color:#fff;background:#284331}.native-card-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;padding:clamp(1rem,4vw,4rem)}.native-card{min-height:440px;overflow:hidden;background:#fff}.native-card>.media{height:250px}.native-card>.media img,.native-card>.media video{width:100%;height:100%;object-fit:cover}.native-card>div{padding:1.5rem}.native-card h2 a{color:inherit}.native-card p{color:#667168}
    .native-mixer{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#AEB9AE}.native-mixer section{min-height:650px;padding:clamp(1.3rem,3vw,3rem);background:#F3F0E7}.native-mixer section:nth-child(2){background:#E4E9E0}.native-mixer section:nth-child(3){color:#fff;background:#26372C}.native-mixer section>span{color:#56805F}.native-mixer h2{font-size:clamp(2rem,4vw,4rem)}.native-mixer a{display:flex;justify-content:space-between;gap:1rem;padding:1.2rem 0;color:inherit;border-top:1px solid currentColor;font-weight:700}.native-mixer a i{font-style:normal}
    .native-cinema{color:#fff;background:#090B0A}.native-cinema .native-head{background:#090B0A}.native-cinema-lead{--native-image:none;min-height:85svh;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(1.5rem,6vw,6rem);background:linear-gradient(0deg,rgba(4,6,5,.92),rgba(4,6,5,.05)),var(--native-image) center/cover,#25362A}.native-cinema-lead h2{max-width:900px;margin:.6rem 0;font-size:clamp(3rem,8vw,8rem);line-height:.87}.native-cinema-lead p{max-width:620px;color:rgba(255,255,255,.72)}.native-filmstrip{display:flex;gap:10px;padding:15px;overflow-x:auto}.native-filmstrip a{--native-image:none;flex:0 0 260px;min-height:170px;display:flex;flex-direction:column;justify-content:flex-end;padding:1rem;color:#fff;background:linear-gradient(0deg,rgba(0,0,0,.9),transparent),var(--native-image) center/cover,#222}.native-filmstrip span{color:#C5F389;font-size:.7rem}
    .native-question{max-width:920px;margin:4rem auto 1rem;padding:1.3rem 1.5rem;border:1px solid #A9B4AA;background:#fff;font-size:clamp(1rem,2vw,1.4rem)}.native-question strong{margin-left:1rem}.native-answers{max-width:920px;margin:auto;padding:0 0 5rem}.native-answers details{margin-bottom:.7rem;border:1px solid #C8D0C6;background:#fff}.native-answers summary{display:flex;justify-content:space-between;gap:1rem;padding:1.5rem;cursor:pointer;font-size:clamp(1rem,2vw,1.35rem);font-weight:800}.native-answers details p,.native-answers details small,.native-answers details>a{display:block;margin:0 1.5rem 1rem}.native-answers details p{color:#657068;line-height:1.7}.native-answers details>a{color:#345B3D;font-weight:800}
    .native-atlas{position:relative;min-height:850px;background:radial-gradient(circle at 25% 25%,#CCD8C6,transparent 25%),radial-gradient(circle at 75% 70%,#D8DEC9,transparent 28%),#E9EEE5}.native-atlas a{position:absolute;display:flex;flex-direction:column;justify-content:center;width:230px;height:230px;padding:2rem;border:1px solid #7F927F;border-radius:48% 52% 61% 39%;color:#1B2B20;background:rgba(255,255,255,.62)}.native-atlas a:hover{color:#fff;background:#294331;transform:scale(1.06)}.native-atlas a>span{font-size:.7rem}.native-atlas a>strong{font-size:1.5rem}.native-atlas a>small{margin-top:.8rem}.native-atlas .region-1{left:8%;top:8%}.native-atlas .region-2{left:38%;top:4%}.native-atlas .region-3{right:7%;top:18%}.native-atlas .region-4{left:13%;bottom:10%}.native-atlas .region-5{left:43%;bottom:14%}.native-atlas .region-6{right:5%;bottom:4%}
    .native-adaptive{display:grid;grid-template-columns:1.4fr .8fr;gap:1rem;padding:clamp(1rem,4vw,4rem)}.native-adaptive-lead{--native-image:none;min-height:720px;display:flex;flex-direction:column;justify-content:flex-end;padding:clamp(1.5rem,4vw,4rem);color:#fff;background:linear-gradient(0deg,rgba(8,12,9,.92),transparent),var(--native-image) center/cover,#304735}.native-adaptive-lead h2{margin:.6rem 0;font-size:clamp(2.8rem,6vw,6rem);line-height:.9}.native-adaptive-lead p{color:rgba(255,255,255,.72)}.native-adaptive aside{padding:2rem;background:#fff}.native-adaptive aside>a{display:grid;grid-template-columns:28px 1fr auto;gap:.7rem;padding:1.3rem 0;color:inherit;border-top:1px solid #C8D0C6;font-weight:750}.native-adaptive aside>a span{color:#5B8062}.native-adaptive aside>a i{font-style:normal}
    @media(max-width:760px){.native-head{padding:4rem 1.1rem}.native-head h1{font-size:clamp(3.2rem,16vw,5.5rem)}.native-story{flex-basis:94vw}.native-constellation{min-height:680px}.native-node{width:105px;height:105px;font-size:.72rem}.native-node.node-5,.native-node.node-6{display:none}.native-related{grid-template-columns:1fr}.native-timeline article{grid-template-columns:70px 16px 1fr}.native-timeline img{float:none;width:100%;margin:0 0 1rem}.native-intents,.native-card-grid,.native-mixer,.native-adaptive{grid-template-columns:1fr}.native-card-grid{padding:.6rem}.native-mixer section{min-height:auto}.native-atlas{min-height:auto;display:grid;grid-template-columns:1fr 1fr;gap:.6rem;padding:1rem}.native-atlas a{position:static;width:auto;height:180px;padding:1rem}.native-adaptive{padding:.6rem}.native-adaptive-lead{min-height:72svh}.native-question,.native-answers{margin-left:.7rem;margin-right:.7rem}}

    /* Lo Spazio Vivo resta una pagina, non un canvas senza confini. */
    .has-living-home .living-native{width:min(1480px,calc(100% - 32px));min-height:0;margin:16px auto 0;overflow:hidden;border:1px solid rgba(24,35,28,.13);border-radius:24px;box-shadow:0 28px 70px rgba(19,28,22,.11)}
    .has-living-home .native-head{padding:clamp(3rem,6vw,6rem)}.has-living-home .native-head h1{font-size:clamp(3.4rem,7.2vw,7rem)}

    /* Identita persistente sulle pagine interne e sugli articoli. */
    .single-mode-kicker{display:flex;justify-content:space-between;gap:1rem;align-items:center;margin:-.5rem 0 2rem;padding-bottom:1rem;border-bottom:1px solid var(--mode-border,rgba(20,30,24,.14));font-size:.68rem;font-weight:850;letter-spacing:.09em;text-transform:uppercase}.single-mode-kicker span{color:var(--mode-accent,#3B6745)}.single-mode-kicker strong{color:var(--mode-muted,#6B756D)}
    body[class*="living-mode-"]{--mode-bg:#F3F0E7;--mode-surface:#FFFDF8;--mode-ink:#172018;--mode-muted:#68736A;--mode-accent:#345D3E;--mode-border:rgba(23,32,24,.14)}
    body[class*="living-mode-"]:not(.has-custom-theme){background:var(--mode-bg);color:var(--mode-ink)}
    body[class*="living-mode-"]:not(.has-living-home):not(.has-custom-theme) .navbar{background:color-mix(in srgb,var(--mode-surface) 92%,transparent)!important;border-color:var(--mode-border);backdrop-filter:blur(18px)}
    body[class*="living-mode-"]:not(.has-living-home):not(.has-custom-theme) .nav-brand,body[class*="living-mode-"]:not(.has-living-home):not(.has-custom-theme) .nav-links a{color:var(--mode-ink)}
    body[class*="living-mode-"]:not(.has-living-home) .container{width:min(100%,1180px);max-width:1180px;padding:clamp(1.2rem,4vw,4rem)}
    body[class*="living-mode-"] .back-btn{color:var(--mode-accent)}
    body[class*="living-mode-"]:not(.has-custom-theme) .single-post{max-width:920px;padding:clamp(1.4rem,4vw,3.8rem);color:var(--mode-ink);background:var(--mode-surface);border:1px solid var(--mode-border);border-radius:22px;box-shadow:0 24px 65px rgba(20,29,23,.08)}
    body[class*="living-mode-"]:not(.has-custom-theme) .single-post h1{color:var(--mode-ink);font-size:clamp(2.5rem,5vw,5rem);line-height:.98;letter-spacing:-.055em}
    body[class*="living-mode-"]:not(.has-custom-theme) .single-post .meta,body[class*="living-mode-"]:not(.has-custom-theme) .single-post .body-content{color:var(--mode-muted)}
    body[class*="living-mode-"] .single-post .body-content{font-size:1.08rem;line-height:1.78}
    body[class*="living-mode-"] .single-post>.media{margin:0 0 2.5rem;overflow:hidden;border-radius:16px}
    body[class*="living-mode-"] .single-post>.media img,body[class*="living-mode-"] .single-post>.media video{width:100%;max-height:620px;object-fit:cover}
    body[class*="living-mode-"]:not(.has-custom-theme) .content-archive{color:var(--mode-ink)}body[class*="living-mode-"]:not(.has-custom-theme) .archive-intro{background:linear-gradient(135deg,color-mix(in srgb,var(--mode-accent) 82%,#111),color-mix(in srgb,var(--mode-accent) 55%,#18251D));box-shadow:0 18px 50px color-mix(in srgb,var(--mode-accent) 16%,transparent)}body[class*="living-mode-"]:not(.has-custom-theme) .category-index,body[class*="living-mode-"]:not(.has-custom-theme) .media-preview,body[class*="living-mode-"]:not(.has-custom-theme) .foundation-directory,body[class*="living-mode-"]:not(.has-custom-theme) .foundation-card{color:var(--mode-ink);border-color:var(--mode-border);background:var(--mode-surface)}body[class*="living-mode-"]:not(.has-custom-theme) .category-chips a{color:var(--mode-ink);border-color:var(--mode-border);background:color-mix(in srgb,var(--mode-surface) 75%,var(--mode-bg))}body[class*="living-mode-"]:not(.has-custom-theme) .category-chips strong{color:var(--mode-accent);background:color-mix(in srgb,var(--mode-accent) 15%,var(--mode-surface))}body[class*="living-mode-"]:not(.has-custom-theme) .network-kicker,body[class*="living-mode-"]:not(.has-custom-theme) .section-heading-row>a,body[class*="living-mode-"]:not(.has-custom-theme) .topic-header>a{color:var(--mode-accent)}
    .living-mode-stories{--mode-bg:#111713;--mode-surface:#1D2820;--mode-ink:#F8F6EF;--mode-muted:#B5BDB7;--mode-accent:#D7FF7E;--mode-border:rgba(255,255,255,.13)}.living-mode-stories .single-post{max-width:1100px}.living-mode-stories .single-post>.media{margin:calc(clamp(1.4rem,4vw,3.8rem)*-1) calc(clamp(1.4rem,4vw,3.8rem)*-1) 3rem;border-radius:22px 22px 0 0}.living-mode-stories .single-post>.media img,.living-mode-stories .single-post>.media video{max-height:76svh}
    .living-mode-constellation{--mode-bg:#0D1510;--mode-surface:#17251C;--mode-ink:#F1F7F1;--mode-muted:#A8B7AC;--mode-accent:#B7E68D;--mode-border:rgba(183,230,141,.2)}.living-mode-constellation .single-post{position:relative;border-radius:46px}.living-mode-constellation .single-post:before,.living-mode-constellation .single-post:after{content:'';position:absolute;z-index:-1;border:1px solid var(--mode-border);border-radius:50%}.living-mode-constellation .single-post:before{width:180px;height:180px;left:-100px;top:18%}.living-mode-constellation .single-post:after{width:260px;height:260px;right:-160px;bottom:12%}
    .living-mode-timeline{--mode-bg:#ECE8DD;--mode-surface:#FFFEFA;--mode-ink:#242B25;--mode-muted:#6E766F;--mode-accent:#385D40}.living-mode-timeline .single-post{border-radius:0;border-width:0 0 0 4px;box-shadow:none}.living-mode-timeline .single-post>.media{border-radius:0}
    .living-mode-compass{--mode-bg:#E9EEE5;--mode-surface:#FFFEFA;--mode-ink:#183020;--mode-muted:#657068;--mode-accent:#2F6040}.living-mode-compass .single-post{max-width:1050px}.living-mode-compass .single-mode-kicker{padding:1rem;border-radius:999px;background:#E0EADD}.living-mode-compass .single-post h1{max-width:850px}.living-mode-compass .single-post>.media{border-radius:28px}
    .living-mode-mixer{--mode-bg:#DDE4DA;--mode-surface:#F5F1E8;--mode-ink:#1C2920;--mode-muted:#657068;--mode-accent:#446F4D}.living-mode-mixer .single-post{border-radius:4px;box-shadow:12px 12px 0 #293B2E}.living-mode-mixer .single-mode-kicker{border-top:5px solid var(--mode-accent);padding-top:1rem}
    .living-mode-cinema{--mode-bg:#070908;--mode-surface:#101512;--mode-ink:#FFFFFF;--mode-muted:#B3BCB5;--mode-accent:#D9FF80;--mode-border:rgba(255,255,255,.14)}.living-mode-cinema .single-post{max-width:1180px;padding-bottom:5rem;border-radius:0}.living-mode-cinema .single-post>.media{margin:calc(clamp(1.4rem,4vw,3.8rem)*-1) calc(clamp(1.4rem,4vw,3.8rem)*-1) 3rem;border-radius:0}.living-mode-cinema .single-post>.media img,.living-mode-cinema .single-post>.media video{max-height:82svh}.living-mode-cinema .single-post h1{font-size:clamp(3rem,7vw,7.2rem);line-height:.88}
    .living-mode-answers{--mode-bg:#EFEEE8;--mode-surface:#FFFFFF;--mode-ink:#1A2820;--mode-muted:#647067;--mode-accent:#376146}.living-mode-answers .single-post{max-width:820px;border-radius:12px;box-shadow:0 18px 50px rgba(20,29,23,.07)}.living-mode-answers .single-post h1:before{content:'Risposta approfondita';display:block;margin-bottom:1rem;color:var(--mode-accent);font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.living-mode-answers .single-post .body-content{padding-top:1rem;border-top:1px solid var(--mode-border)}
    .living-mode-atlas{--mode-bg:#E5EBE1;--mode-surface:#F9FBF6;--mode-ink:#1B2B20;--mode-muted:#667269;--mode-accent:#385F42}.living-mode-atlas .single-post{border-radius:54px 18px 54px 18px}.living-mode-atlas .single-post>.media{border-radius:42px 12px 42px 12px}
    .living-mode-adaptive{--mode-bg:#E8ECE5;--mode-surface:#FFFFFF;--mode-ink:#17261C;--mode-muted:#667168;--mode-accent:#335F3D}.living-mode-adaptive .single-post{max-width:1080px}.living-mode-adaptive .single-post h1{padding-bottom:1.5rem;border-bottom:1px solid var(--mode-border)}
    @media(max-width:760px){.has-living-home .living-native{width:100%;margin:0;border:0;border-radius:0;box-shadow:none}.has-living-home .native-head{padding:3.5rem 1.1rem}.has-living-home .native-head h1{font-size:clamp(3rem,15vw,5rem)}body[class*="living-mode-"]:not(.has-living-home) .container{padding:1rem}.single-mode-kicker{align-items:flex-start;flex-direction:column}.living-mode-constellation .single-post,.living-mode-atlas .single-post{border-radius:18px}.living-mode-mixer .single-post{box-shadow:6px 6px 0 #293B2E}}

    /* Tema hospitality coerente: home, pagine SEO e articoli condividono lo stesso sito. */
    .is-hospitality-site{--accent:#B75B3B;--bg:#F5F1E9;--card-bg:#FFFCF7;--text:#1E2822;--border:rgba(30,40,34,.13);background:var(--bg);color:var(--text)}
    .is-hospitality-site .network-bar{background:#1E2822}
    .is-hospitality-site .navbar{position:sticky;top:0;z-index:40;background:rgba(255,252,247,.94)!important;border-color:rgba(30,40,34,.12);backdrop-filter:blur(18px);padding:1rem max(1.2rem,calc((100vw - 1240px)/2))!important}
    .is-hospitality-site .nav-brand{color:#1E2822;font-weight:850}
    .is-hospitality-site .nav-brand-fallback{display:inline}
    .is-hospitality-site .nav-brand img{width:42px;height:42px;object-fit:contain;background:#fff}
    .is-hospitality-site .nav-links a{color:#445048}
    .is-hospitality-site .container{width:min(100%,1240px);padding:clamp(2rem,5vw,5rem) clamp(1rem,3vw,2rem)}
    .is-hospitality-site .hospitality-hero{min-height:calc(100svh - 116px);padding:clamp(5rem,10vw,9rem) clamp(1.2rem,6vw,7rem) clamp(3rem,7vw,6rem)}
    .is-hospitality-site .hospitality-hero-inner{width:min(100%,1240px);padding:0;background:none;border-radius:0;backdrop-filter:none}
    .is-hospitality-site .hospitality-hero h1{font-size:clamp(4rem,9vw,8.8rem);max-width:1050px;letter-spacing:-.075em;text-shadow:0 3px 35px rgba(0,0,0,.28)}
    .is-hospitality-site .hospitality-hero .bio{font-size:clamp(1.05rem,1.8vw,1.35rem);max-width:680px;text-shadow:0 2px 16px rgba(0,0,0,.3)}
    .is-hospitality-site .hospitality-cta-primary{background:#B75B3B}
    .is-hospitality-site .hospitality-hero-facts span{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.2);backdrop-filter:blur(10px)}
    .is-hospitality-site .hospitality-section{margin-bottom:clamp(3.5rem,7vw,7rem)}
    .is-hospitality-site .hospitality-section-head h2{font-size:clamp(2.5rem,5vw,4.8rem);letter-spacing:-.06em}
    .is-hospitality-site .hospitality-pillar,.is-hospitality-site .hospitality-mini-card{border-radius:18px;box-shadow:none}
    .is-hospitality-site .hospitality-card,.is-hospitality-site .hospitality-media-item{border-radius:18px;box-shadow:none;border:1px solid var(--border)}
    .is-hospitality-site .footer{background:#1E2822}

    .is-hospitality-site .breadcrumb{width:min(100%,1180px);margin:0 auto 1.2rem;padding:0 .25rem;color:#59645D;opacity:1}
    .is-hospitality-site .breadcrumb a{color:#B75B3B;font-weight:750}
    .is-hospitality-site .foundation-page{max-width:1180px;margin:0 auto}
    .is-hospitality-site .foundation-header{position:relative;isolation:isolate;display:flex;min-height:58vh;flex-direction:column;justify-content:flex-end;padding:clamp(2rem,6vw,5rem);overflow:hidden;border:0;border-radius:24px;background:linear-gradient(90deg,rgba(16,24,19,.86),rgba(16,24,19,.34)),var(--foundation-cover) center/cover;color:#fff}
    .is-hospitality-site .foundation-header::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(0deg,rgba(10,18,13,.62),transparent 60%)}
    .is-hospitality-site .foundation-header .network-kicker{color:#F2C5A9}
    .is-hospitality-site .foundation-header h1{max-width:850px;margin:.7rem 0 1rem;color:#fff;font-size:clamp(3.6rem,8vw,7.5rem);line-height:.88;letter-spacing:-.075em}
    .is-hospitality-site .foundation-header p{max-width:800px;margin:0;color:rgba(255,255,255,.86);font-size:clamp(1.05rem,1.7vw,1.3rem);line-height:1.6}
    .is-hospitality-site .foundation-content-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1rem 0}
    .is-hospitality-site .foundation-content-grid>.post-grid,.is-hospitality-site .foundation-content-grid>.official-channels{grid-column:1/-1;width:100%}
    .is-hospitality-site .foundation-section{height:100%;margin:0;padding:clamp(1.4rem,3vw,2.2rem);border:1px solid var(--border);border-radius:18px;background:#FFFCF7}
    .is-hospitality-site .foundation-section h2{font-size:clamp(1.5rem,2.5vw,2.2rem);letter-spacing:-.035em}
    .is-hospitality-site .foundation-section p{color:#566159}
    .is-hospitality-site .evidence-links{align-items:flex-start;border-top:1px solid var(--border);padding-top:1rem}
    .is-hospitality-site .evidence-links span{width:100%;color:#7B837E;font-size:.68rem;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
    .is-hospitality-site .evidence-links a{display:block;color:#87452E;text-decoration:none;font-weight:700}
    .is-hospitality-site .content-method{margin:1rem 0 0;padding:1.1rem 1.3rem;border:0;border-radius:14px;background:#EAE4D9;color:#606861}
    .is-hospitality-site .single-post{max-width:920px;padding:clamp(1.3rem,4vw,3.5rem);border-radius:22px;background:#FFFCF7;border:1px solid var(--border);box-shadow:none}
    .is-hospitality-site .single-post h1{font-size:clamp(2.5rem,5vw,4.8rem);line-height:.98;letter-spacing:-.055em}
    .is-hospitality-site .single-post>.media{margin:calc(clamp(1.3rem,4vw,3.5rem)*-1) calc(clamp(1.3rem,4vw,3.5rem)*-1) 2rem;overflow:hidden;border-radius:22px 22px 0 0}
    .is-hospitality-site .single-post>.media img,.is-hospitality-site .single-post>.media video{width:100%;max-height:620px;object-fit:cover}
    body .single-post>.media.media-sized{width:var(--media-display-width,100%)}
    body .single-post>.media.media-align-left{margin-left:0!important;margin-right:auto!important}
    body .single-post>.media.media-align-center{margin-left:auto!important;margin-right:auto!important}
    body .single-post>.media.media-align-right{margin-left:auto!important;margin-right:0!important}
    @media(max-width:760px){.is-hospitality-site .network-trust{display:none}.is-hospitality-site .container{padding:1rem}.is-hospitality-site .hospitality-hero{min-height:calc(100svh - 105px);padding:5rem 1.15rem 2.5rem}.is-hospitality-site .hospitality-hero h1{font-size:clamp(3.4rem,16vw,5.8rem)}.is-hospitality-site .foundation-header{min-height:62vh;border-radius:16px;padding:1.5rem}.is-hospitality-site .foundation-header h1{font-size:clamp(3.1rem,15vw,5rem)}.is-hospitality-site .foundation-content-grid{grid-template-columns:1fr}.is-hospitality-site .breadcrumb{padding:.5rem .25rem}.is-hospitality-site .hospitality-media-strip{grid-template-columns:1fr 1fr}}

    /* Catalogo temi: la struttura resta accessibile, la direzione visiva cambia davvero. */
    .has-custom-theme {
      --accent:<?= h($palPrimary) ?>;
      --accent-secondary:<?= h($palSecondary) ?>;
      --bg:<?= h($palBg) ?>;
      --card-bg:<?= h($palSurface) ?>;
      --text:<?= h($palText) ?>;
      --text-muted:<?= h($palTextMuted) ?>;
      --border:color-mix(in srgb,var(--text) 14%,transparent);
      --radius:<?= h($radius) ?>;
      background:var(--bg); color:var(--text);
    }
    .has-custom-theme .network-bar { display:none; }
    .has-custom-theme .network-signature { width:min(100%,<?= h($contentWidth) ?>); justify-content:flex-end; }
    .has-custom-theme .network-product-name,.has-custom-theme .network-trust { display:none; }
    .has-custom-theme .network-signature-brand { color:var(--bg); opacity:.78; }
    .has-custom-theme .network-signature-brand img { width:20px; height:20px; }
    .has-custom-theme .network-signature-brand strong { font-size:0; }
    .has-custom-theme .network-signature-brand strong::after { content:'Creato con All Social To Web'; font-size:.7rem; font-weight:700; }
    body.has-custom-theme[class*="living-mode-"]:not(.has-living-home) .navbar { width:100%!important; min-height:0; margin:0!important; padding:.75rem max(1rem,calc((100vw - <?= h($contentWidth) ?>)/2))!important; color:var(--text); border:0; border-radius:0!important; background:transparent!important; box-shadow:none!important; backdrop-filter:none!important; position:absolute; top:0; left:0; z-index:120; pointer-events:none; }
    /* La barra e' trasparente ai clic perche' sta sopra l'apertura e non deve
       rubarle lo spazio cliccabile, ma i suoi comandi devono restare tutti
       raggiungibili. Prima i clic venivano riaccesi solo da .nav-mode-solid,
       quindi in ogni altra modalita' - expanded compresa, che e' quella
       consigliata - il menu risultava visibile ma completamente inerte. */
    body.has-custom-theme[class*="living-mode-"]:not(.has-living-home) .navbar > * { pointer-events:auto; }
    .has-custom-theme .nav-brand,.has-custom-theme .nav-links a { color:var(--text); }
    .has-custom-theme .nav-brand { min-height:42px; padding:.35rem .65rem; border:1px solid var(--border); border-radius:999px; background:color-mix(in srgb,var(--card-bg) 88%,transparent); box-shadow:0 8px 28px rgba(0,0,0,.09); backdrop-filter:blur(14px); font-size:.9rem; pointer-events:auto; }
    .has-custom-theme .nav-brand-image { width:36px; height:36px; border-radius:9px; object-fit:contain; }
    .has-custom-theme .nav-brand-image.is-cover { width:46px; object-fit:cover; }
    .has-custom-theme .nav-toggle { display:block; width:42px; height:42px; padding:8px; border:1px solid var(--border); border-radius:50%; background:color-mix(in srgb,var(--card-bg) 88%,transparent); box-shadow:0 8px 28px rgba(0,0,0,.09); backdrop-filter:blur(14px); pointer-events:auto; }
    .has-custom-theme .nav-links { display:none; position:fixed; top:0; right:0; width:min(340px,88vw); height:100svh; flex-direction:column; gap:.35rem; padding:5rem 1.25rem 2rem; border-left:1px solid var(--border); background:var(--card-bg); box-shadow:-20px 0 60px rgba(0,0,0,.18); z-index:105; }
    .has-custom-theme .nav-links.open { display:flex; }
    .has-custom-theme .nav-links a { padding:.9rem 1rem; border-bottom:1px solid var(--border); font-size:1rem; }
    .has-custom-theme .nav-overlay { display:none!important; position:fixed!important; inset:0; background:rgba(0,0,0,.42); pointer-events:auto; }
    .has-custom-theme .nav-overlay.open { display:block!important; }
    body.has-custom-theme.is-public-home > main.container { padding-top:0!important; }
    .has-custom-theme.nav-mode-minimal .navbar { justify-content:flex-end; }
    .has-custom-theme.nav-mode-minimal .nav-brand { display:none; }
    .has-custom-theme.nav-mode-transparent .nav-brand,.has-custom-theme.nav-mode-transparent .nav-toggle { border-color:transparent; background:transparent; box-shadow:none; backdrop-filter:none; }
    .has-custom-theme.nav-mode-centered .navbar { justify-content:center; }
    .has-custom-theme.nav-mode-centered .nav-toggle { position:absolute; right:max(1rem,calc((100vw - <?= h($contentWidth) ?>)/2)); }
    body.has-custom-theme.nav-mode-solid .navbar { left:50%; width:max-content!important; padding:.4rem!important; transform:translateX(-50%); gap:.35rem; border:1px solid var(--border)!important; border-radius:999px!important; background:color-mix(in srgb,var(--card-bg) 90%,transparent)!important; box-shadow:0 10px 34px rgba(0,0,0,.12)!important; backdrop-filter:blur(16px)!important; pointer-events:auto; }
    body.has-custom-theme.nav-mode-solid .nav-brand,body.has-custom-theme.nav-mode-solid .nav-toggle { border:0; background:transparent; box-shadow:none; backdrop-filter:none; }
    .has-custom-theme.nav-mode-expanded .nav-toggle,.has-custom-theme.nav-mode-expanded .nav-overlay { display:none; }
    .has-custom-theme.nav-mode-expanded .nav-links { display:flex; position:static; flex-direction:row; align-items:center; width:auto; height:auto; margin-left:auto; padding:0; border:0; background:transparent; box-shadow:none; gap:1.75rem; z-index:auto; }
    .has-custom-theme.nav-mode-expanded .nav-links a { padding:.4rem 0; border-bottom:0; font-size:.92rem; font-weight:650; white-space:nowrap; }
    @media(max-width:900px){
      .has-custom-theme.nav-mode-expanded .nav-toggle { display:block; }
      .has-custom-theme.nav-mode-expanded .nav-links { display:none; position:fixed; top:0; right:0; width:min(340px,88vw); height:100svh; margin-left:0; flex-direction:column; gap:.35rem; padding:5rem 1.25rem 2rem; border-left:1px solid var(--border); background:var(--card-bg); box-shadow:-20px 0 60px rgba(0,0,0,.18); z-index:105; }
      .has-custom-theme.nav-mode-expanded .nav-links.open { display:flex; }
      .has-custom-theme.nav-mode-expanded .nav-links a { padding:.9rem 1rem; border-bottom:1px solid var(--border); font-size:1rem; }
      .has-custom-theme.nav-mode-expanded .nav-overlay.open { display:block!important; }
    }
    .has-custom-theme .container { width:min(100%,<?= h($contentWidth) ?>); max-width:none; padding:1rem 1.25rem 3rem; }
    .has-custom-theme .footer { background:var(--text); color:var(--bg); }
    .has-custom-theme .footer a { color:var(--bg); }
    .has-custom-theme .universal-home { display:flex; width:min(100%,<?= h($contentWidth) ?>); flex-direction:column; }
    .has-custom-theme .studio-section-hidden { display:none!important; }
    .has-custom-theme .universal-hero h1,.has-custom-theme .universal-section-heading h2,.has-custom-theme .universal-stats strong { color:var(--text); }
    .has-custom-theme .universal-hero-copy>p,.has-custom-theme .universal-identity,.has-custom-theme .universal-stats span,.has-custom-theme .universal-meta,.has-custom-theme .universal-card p { color:var(--text-muted); }
    .has-custom-theme .universal-eyebrow,.has-custom-theme .universal-section-heading>a,.has-custom-theme .universal-read,.has-custom-theme .universal-card h3 a:hover { color:var(--accent); }
    .has-custom-theme .universal-identity img,.has-custom-theme .universal-brand-cover { border-color:var(--border); border-radius:var(--radius); background:var(--card-bg); }
    .has-custom-theme .universal-button { border-color:var(--border); border-radius:var(--radius); background:var(--card-bg); color:var(--text); }
    .has-custom-theme .universal-button:hover { border-color:var(--accent); color:var(--accent); }
    .has-custom-theme .universal-button-primary { border-color:var(--accent); background:var(--accent); color:var(--card-bg); }
    .has-custom-theme .universal-button-primary:hover { background:var(--accent-secondary); color:var(--text); }
    .has-custom-theme .universal-lead { min-height:380px; border-radius:calc(var(--radius) * 1.35); background:linear-gradient(145deg,var(--text),var(--accent-secondary)); box-shadow:<?= h($cardShadow) ?>; }
    .has-custom-theme .universal-lead-no-image { background:linear-gradient(145deg,var(--text),var(--accent)); }
    .has-custom-theme .universal-section { border-color:var(--border); }
    .has-custom-theme .universal-card { border-color:var(--border); border-radius:var(--radius); background:var(--card-bg); box-shadow:<?= h($cardShadow) ?>; }
    .has-custom-theme .universal-card h3 a { color:var(--text); }
    .has-custom-theme .universal-topic-list a { border-color:var(--border); border-radius:var(--radius); background:var(--card-bg); color:var(--text); }
    .has-custom-theme .universal-topic-list a:hover { border-color:var(--accent); color:var(--accent); }
    .has-custom-theme .universal-topic-list strong { background:var(--accent-secondary); color:var(--text); }
    .has-custom-theme .universal-info-grid a { border:1px solid var(--border); border-radius:var(--radius); background:var(--text); color:var(--card-bg); }
    .has-custom-theme .universal-info-grid a>span { color:var(--card-bg); }
    .has-custom-theme .universal-info-grid p { color:color-mix(in srgb,var(--card-bg) 76%,transparent); }
    .has-custom-theme .universal-info-grid strong { color:color-mix(in srgb,var(--card-bg) 82%,var(--accent)); }
    .has-custom-theme .universal-custom-media { border-radius:var(--radius); }
    .has-custom-theme .content-archive,.has-custom-theme .foundation-page { color:var(--text); }
    .has-custom-theme .archive-intro,.has-custom-theme .foundation-header { background:linear-gradient(135deg,var(--text),var(--accent)); }
    .has-custom-theme .category-index,.has-custom-theme .media-preview,.has-custom-theme .foundation-directory,.has-custom-theme .foundation-section,.has-custom-theme .official-channels,.has-custom-theme .content-method { border-color:var(--border); background:var(--card-bg); color:var(--text); }
    .has-custom-theme .foundation-card,.has-custom-theme .official-channel,.has-custom-theme .media-preview-card { border-color:var(--border); background:var(--bg); color:var(--text); }
    .has-custom-theme .foundation-section p,.has-custom-theme .content-method { color:var(--text-muted); }
    .has-custom-theme .network-kicker,.has-custom-theme .foundation-card strong,.has-custom-theme .official-channel span,.has-custom-theme .evidence-links a { color:var(--accent); }

    .has-custom-theme.hero-mode-editorial .universal-hero { grid-template-columns:1fr; padding:clamp(5rem,8vw,6rem) 0 clamp(2.5rem,6vw,4.5rem); }
    .has-custom-theme.hero-mode-editorial .universal-hero-copy { max-width:920px; }
    .has-custom-theme.hero-mode-editorial .universal-lead { width:min(82%,920px); min-height:430px; justify-self:end; }
    .has-custom-theme.hero-mode-immersive:not(.is-hospitality-site) .universal-hero { width:100%; margin:0 auto 1.5rem; padding:clamp(5rem,8vw,6rem) clamp(1.25rem,5vw,4rem) clamp(2.5rem,5vw,4rem); border-radius:0 0 calc(var(--radius) * 1.5) calc(var(--radius) * 1.5); background:linear-gradient(135deg,var(--text),color-mix(in srgb,var(--text) 70%,var(--accent))); color:var(--bg); }
    .has-custom-theme.hero-mode-immersive:not(.is-hospitality-site) .universal-hero h1,.has-custom-theme.hero-mode-immersive:not(.is-hospitality-site) .universal-hero-copy>p,.has-custom-theme.hero-mode-immersive:not(.is-hospitality-site) .universal-identity { color:var(--bg); }
    .has-custom-theme.hero-mode-human .universal-hero { grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr); padding:clamp(5rem,8vw,6rem) 0 clamp(2.5rem,6vw,4.5rem); }
    .has-custom-theme.hero-mode-human .universal-lead { transform:rotate(1.2deg); }
    .has-custom-theme.hero-mode-product .universal-hero { padding:clamp(5rem,8vw,6rem) 0 clamp(2.5rem,6vw,4.5rem); }
    .has-custom-theme.hero-mode-product .universal-hero-copy { text-align:center; }
    .has-custom-theme.hero-mode-product .universal-actions,.has-custom-theme.hero-mode-product .universal-stats,.has-custom-theme.hero-mode-product .universal-identity { justify-content:center; }

    .has-custom-theme.cards-mode-bold .universal-card,.has-custom-theme.cards-mode-bold .universal-topic-list a { border:2px solid var(--text); box-shadow:7px 7px 0 var(--accent); }
    .has-custom-theme.cards-mode-bold .universal-card h3 { text-transform:uppercase; line-height:1.05; }
    .has-custom-theme.cards-mode-editorial .universal-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .has-custom-theme.cards-mode-editorial .universal-card:first-child { grid-row:span 2; }
    .has-custom-theme.cards-mode-editorial .universal-card:first-child .universal-card-media .media :where(img,video,iframe) { aspect-ratio:4/3; }
    .has-custom-theme.cards-mode-cinematic .universal-card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .has-custom-theme.cards-mode-cinematic .universal-card { position:relative; min-height:380px; justify-content:flex-end; background:var(--text); color:var(--card-bg); }
    .has-custom-theme.cards-mode-cinematic .universal-card-media { position:absolute; inset:0; opacity:.58; }
    .has-custom-theme.cards-mode-cinematic .universal-card-media .media,.has-custom-theme.cards-mode-cinematic .universal-card-media .media :where(img,video,iframe) { width:100%; height:100%; aspect-ratio:auto; }
    .has-custom-theme.cards-mode-cinematic .universal-card-body { position:relative; z-index:1; justify-content:flex-end; background:linear-gradient(0deg,color-mix(in srgb,var(--text) 94%,transparent),transparent); }
    .has-custom-theme.cards-mode-cinematic .universal-card h3 a,.has-custom-theme.cards-mode-cinematic .universal-card p,.has-custom-theme.cards-mode-cinematic .universal-meta,.has-custom-theme.cards-mode-cinematic .universal-read { color:var(--card-bg); }
    .has-custom-theme.cards-mode-soft .universal-card { border:0; }
    .has-custom-theme.cards-mode-product .universal-card { transition:transform .25s ease,border-color .25s ease; }
    .has-custom-theme.cards-mode-product .universal-card:hover { transform:translateY(-5px); border-color:var(--accent); }
    .has-custom-theme.density-mode-compact .universal-section { padding:2.2rem 0; }
    .has-custom-theme.density-mode-compact .universal-card-grid { gap:.8rem; }
    .has-custom-theme.density-mode-airy .universal-section { padding:clamp(3.5rem,8vw,6.5rem) 0; }

    @media(max-width:900px){
      .has-custom-theme.hero-mode-editorial .universal-lead { width:100%; }
      .has-custom-theme.hero-mode-human .universal-hero { grid-template-columns:1fr; }
    }
    @media(max-width:620px){
      .has-custom-theme.hero-mode-immersive:not(.is-hospitality-site) .universal-hero { width:100%; margin-top:0; padding:5rem 1rem 3rem; border-radius:0; }
      .has-custom-theme.cards-mode-editorial .universal-card-grid,.has-custom-theme.cards-mode-cinematic .universal-card-grid { grid-template-columns:1fr; }
      .has-custom-theme.cards-mode-editorial .universal-card:first-child { grid-row:auto; }
    }
  </style>
<?php
  if ($archetype === 'restaurant') $unsplashKeyword = 'food,restaurant';
  $placeholderImage = "https://images.unsplash.com/photo-1542314831-c53cd4b85ca4?auto=format&fit=crop&w=1600&q=80";
  if (in_array($archetype, ['wedding', 'realestate', 'restaurant', 'fitness', 'darkphoto', 'medical', 'agency', 'startup', 'lawyer'])) {
      $placeholderImage = "https://source.unsplash.com/1600x900/?" . urlencode($unsplashKeyword);
  }
?>
<?php // La home pubblica usa sempre la struttura editoriale universale. ?>
<?php
  $isLivingHome = false;
  $hasCustomTheme = $archetype !== 'network-standard' && (!empty($aiData) || !empty($_GET['preview_data']) || !empty($_POST['preview_data']));
  $isPublicHome = !$single && !$foundationPage && $view === '' && !$activeTag;
?>
<body class="theme-<?= h(networkTopicSlug($archetype)) ?> layout-<?= $layoutVariant ?> living-mode-<?= h($livingSpaceMode) ?><?= $isLivingHome ? ' has-living-home' : '' ?><?= $isPublicHome ? ' is-public-home' : '' ?><?= $useHospitalityLanding ? ' is-hospitality-site' : '' ?><?= $hasCustomTheme ? ' has-custom-theme' : '' ?> theme-family-<?= h(networkTopicSlug($primaryModel ?: 'standard')) ?> hero-mode-<?= h(networkTopicSlug($heroMode ?: 'product')) ?> nav-mode-<?= h(networkTopicSlug($navMode ?: 'solid')) ?> cards-mode-<?= h(networkTopicSlug($cardsMode ?: 'product')) ?> density-mode-<?= h(networkTopicSlug($densityMode ?: 'balanced')) ?>">
<a class="skip-link" href="#main-content">Vai al contenuto principale</a>
<div class="network-bar">
  <div class="network-signature">
    <a class="network-signature-brand" href="<?= h(app_base_url()) ?>/scopri"><img src="/logo-cropped.png?v=2" alt=""><strong>All Social To Web</strong></a>
    <span class="network-product-name">✦ Spazio Vivo</span>
    <span class="network-trust">Contenuti collegati alle fonti ufficiali</span>
  </div>
</div>

<?php
ob_start();
?>
  <a href="<?= $siteUrl ?>" class="nav-brand">
    <?php if ($brandVisualUrl): ?><img class="nav-brand-image<?= $brandVisualMode === 'cover' ? ' is-cover' : '' ?>" src="<?= h($brandVisualUrl) ?>" alt=""><span class="nav-brand-fallback"><?= $title ?></span>
    <?php else: ?><?= $title ?><?php endif; ?>
  </a>
  <?php if ($menuLinks): ?>
  <button class="nav-toggle" aria-label="Apri menu" aria-expanded="false" aria-controls="nav-links" id="nav-toggle">
    <span></span><span></span><span></span>
  </button>
  <div class="nav-overlay" id="nav-overlay"></div>
  <div class="nav-links" id="nav-links">
    <?php foreach ($menuLinks as $link): 
        $href = trim($link['url'] ?? '');
        if ($href === '/' || $href === '') { $href = $siteUrl; }
        elseif (preg_match('/[?&]tag=([^&]+)/i', $href, $m)) { $href = $siteUrl . '?tag=' . $m[1]; }
        elseif (preg_match('/[?&]view=media/i', $href)) { $href = $siteUrl . '?view=media'; }
        elseif (str_starts_with($href, '/')) { $href = $siteUrl . $href; }
        else { $href = h($href); }
    ?>
      <a href="<?= $href ?>"><?= h($link['label']) ?></a>
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
  <?php if ($officialSiteUrl): ?><p><a href="<?= h($officialSiteUrl) ?>" target="_blank" rel="noopener">Visita il sito ufficiale →</a></p><?php endif; ?>
  <div class="footer-bottom">
    <span>&copy; <?= date('Y') ?> <?= $title ?>. Uno <a href="<?= h(app_base_url()) ?>">Spazio Vivo All Social To Web</a>.</span>
    <span><a href="<?= h(app_base_url()) ?>/scopri">Esplora la rete</a> · <a href="<?= $siteUrl ?>/sitemap.xml">Sitemap</a></span>
  </div>
<?php
$footerHtml = ob_get_clean();

ob_start();
?>
<?php if ($foundationPage): ?>
  <nav class="breadcrumb" aria-label="Percorso"><a href="<?= $siteUrl ?>">Home</a><span class="sep">/</span><span><?= h($foundationPage['title']) ?></span></nav>
  <article class="foundation-page">
    <header class="foundation-header"<?php if ($useHospitalityLanding): ?> style="--foundation-cover:url('<?= h($hospitalityHeroImage ?: $placeholderImage) ?>')"<?php endif; ?>>
      <span class="network-kicker">Informazioni ufficiali organizzate da All Social To Web</span>
      <h1><?= h($foundationPage['title']) ?></h1>
      <p><?= h($foundationPage['intro'] ?? '') ?></p>
    </header>

    <div class="foundation-content-grid">
    <?php if (($foundationPage['page_type'] ?? '') === 'archive'): ?>
      <section class="post-grid" aria-label="Contenuti pubblicati">
        <?php foreach ($allPosts as $p): ?>
        <article class="post"><?= mediaHtml($p) ?><div class="post-body"><div class="meta"><span><?= h($p['platform'] ?? '') ?></span><span><?= !empty($p['published_at']) ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span></div><h2><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><?= h(postTitle($p)) ?></a></h2><p class="excerpt"><?= h(postExcerpt($p)) ?></p></div></article>
        <?php endforeach; ?>
      </section>
    <?php elseif (($foundationPage['page_type'] ?? '') === 'contacts'): ?>
      <section class="official-channels" aria-label="Canali ufficiali">
        <?php if ($officialSiteUrl): ?><a class="official-channel" href="<?= h($officialSiteUrl) ?>" target="_blank" rel="noopener"><strong>Sito ufficiale</strong><span>Vai al sito dell’attività →</span></a><?php endif; ?>
        <?php foreach ($sources as $source): ?><a class="official-channel" href="<?= h($source['url']) ?>" target="_blank" rel="noopener"><strong><?= h($source['label'] ?: ucfirst($source['platform'])) ?></strong><span>Apri il canale ufficiale <?= h($source['platform']) ?> →</span></a><?php endforeach; ?>
      </section>
    <?php else: ?>
      <?php foreach (($foundationPage['sections'] ?? []) as $section): ?>
      <section class="foundation-section"><h2><?= h($section['heading'] ?? '') ?></h2><p><?= h($section['body'] ?? '') ?></p>
        <?php if (!empty($section['evidence_post_ids'])): ?><div class="evidence-links"><span>Fonti:</span><?php foreach ($allPosts as $evidencePost): if (!in_array((int)$evidencePost['id'], array_map('intval', $section['evidence_post_ids']), true)) continue; ?><a href="<?= $siteUrl . '/' . h($evidencePost['slug']) ?>"><?= h(postTitle($evidencePost)) ?></a><?php endforeach; ?></div><?php endif; ?>
      </section>
      <?php endforeach; ?>
      <?php if (!empty($foundationPage['faq'])): ?><section class="foundation-section"><h2>Domande frequenti</h2><?php foreach ($foundationPage['faq'] as $faq): ?><details><summary><?= h($faq['question']) ?></summary><p><?= h($faq['answer']) ?></p></details><?php endforeach; ?></section><?php endif; ?>
    <?php endif; ?>
    </div>
    <aside class="content-method">Questa pagina è stata organizzata con assistenza AI usando esclusivamente informazioni e contenuti attribuiti ai canali ufficiali dell’attività. I collegamenti alle fonti permettono di verificarne il contesto.</aside>
  </article>

<?php elseif ($single): $p = $single; ?>
  <a class="back-btn" href="<?= $siteUrl ?>">← Torna ai contenuti</a>
  <article class="single-post" itemscope itemtype="https://schema.org/Article">
    <div class="single-mode-kicker"><span>✦ <?= h($livingModeName) ?></span><strong><?= h($title) ?></strong></div>
    <?= mediaHtml($p) ?>
    <div class="meta">
      <span><?= $icons[$p['platform']] ?? '📄' ?> <?= h($p['platform']) ?></span>
      <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
      <?php if (strtoupper($p['media_type'] ?? '') === 'VIDEO'): ?><span class="badge">Video → Testo</span><?php endif; ?>
    </div>
    <h1 itemprop="headline"><?= h(postTitle($p)) ?></h1>
    <div class="body-content" itemprop="articleBody"><?= bodyHtml(postBody($p)) ?></div>
    <?php if ($p['tags']): ?>
    <div class="tags" style="margin-top:2rem;">
      <?php foreach ($p['tags'] as $tag): ?><a class="tag" href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($tag)) ?>">#<?= h($tag) ?></a><?php endforeach; ?>
    </div>
    <?php endif; ?>
  </article>

  <?php
  // ── Dopo la risposta ────────────────────────────────────────────────────
  // Chi arriva da una ricerca atterra quasi sempre qui, non in home: questo e
  // il momento di massimo interesse, e prima finiva in un vicolo cieco.
  // Si mostrano solo gli elementi realmente disponibili: nessun pulsante finto.
  $phone = trim((string)($reachabilityProfile['phone'] ?? ''));
  $whatsapp = trim((string)($reachabilityProfile['whatsapp'] ?? ''));
  $email = trim((string)($reachabilityProfile['email'] ?? ''));
  $contactPage = isset($foundationPagesBySlug['contatti']) ? $siteUrl . '/contatti' : '';
  $aboutPage = isset($foundationPagesBySlug['chi-siamo']) ? $siteUrl . '/chi-siamo' : '';
  $hasActions = $phone !== '' || $whatsapp !== '' || $email !== '' || $contactPage !== '';
  $related = relatedPosts($p, $allPosts, 3);
  $authorBio = trim((string)($site['profile_summary'] ?? ($site['bio'] ?? '')));
  ?>

  <?php if ($hasActions): ?>
  <section class="answer-cta" aria-labelledby="answer-cta-title">
    <h2 id="answer-cta-title"><?= $livingDesiredAction !== '' ? h($livingDesiredAction) : 'Parliamone' ?></h2>
    <p>Se questa risposta ti e stata utile e vuoi un parere sul tuo caso, <?= h($displayTitle) ?> e raggiungibile qui.</p>
    <div class="answer-cta-actions">
      <?php if ($phone !== ''): ?><a class="answer-btn answer-btn--primary" href="tel:<?= h($phone) ?>">Chiama <?= h($phone) ?></a><?php endif; ?>
      <?php if ($whatsapp !== ''): ?><a class="answer-btn" href="https://wa.me/<?= h($whatsapp) ?>" target="_blank" rel="noopener">Scrivi su WhatsApp</a><?php endif; ?>
      <?php if ($email !== ''): ?><a class="answer-btn" href="mailto:<?= h($email) ?>">Manda una email</a><?php endif; ?>
      <?php if ($contactPage !== ''): ?><a class="answer-btn" href="<?= h($contactPage) ?>">Vai ai contatti</a><?php endif; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($authorBio !== '' || $logoUrl): ?>
  <section class="answer-author" itemscope itemtype="https://schema.org/Person">
    <?php if ($logoUrl): ?><img src="<?= h($logoUrl) ?>" alt="" loading="lazy" width="64" height="64"><?php endif; ?>
    <div>
      <div class="answer-author-label">Scritto da</div>
      <strong itemprop="name"><?= h($displayTitle) ?></strong>
      <?php if ($authorBio !== ''): ?><p itemprop="description"><?= h(mb_substr($authorBio, 0, 260)) ?></p><?php endif; ?>
      <?php if ($aboutPage !== ''): ?><a href="<?= h($aboutPage) ?>">Chi siamo</a><?php endif; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if ($related): ?>
  <section class="answer-related" aria-labelledby="answer-related-title">
    <h2 id="answer-related-title">Continua a leggere</h2>
    <div class="answer-related-grid">
      <?php foreach ($related as $rel): ?>
      <a href="<?= $siteUrl . '/' . h($rel['slug'] ?? '') ?>">
        <?php if (!empty($rel['media_url']) && strtolower((string)($rel['media_type'] ?? '')) !== 'video'): ?>
          <img src="<?= h($rel['media_url']) ?>" alt="" loading="lazy">
        <?php endif; ?>
        <span><?= h(postTitle($rel)) ?></span>
      </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($p['source_url'])): ?>
  <?php // Attribuzione della fonte: resta, ma come nota di provenienza in
        // fondo, non come unico invito ad agire della pagina. ?>
  <p class="answer-source">
    Questo testo nasce da un contenuto pubblicato da <?= h($displayTitle) ?>
    su <?= h($p['platform']) ?><?= $p['published_at'] ? ' il ' . date('d/m/Y', strtotime($p['published_at'])) : '' ?>.
    <a href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener nofollow">Vedi l'originale</a>
  </p>
  <?php endif; ?>

<?php else: ?>

  <?php if ($view === 'media'): ?>
  <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--card-bg); border-radius: var(--radius); border-left: 4px solid var(--accent);">
    <h2 style="margin:0;">Media Center</h2>
    <p style="margin-top: 0.5rem; color: var(--text-muted);">Raccolta di foto e video pubblicati sul sito.</p>
  </div>
  <section class="post-grid" aria-label="Media Center">
    <?php foreach ($mediaPosts as $p):
      $purl = $siteUrl . '/' . h($p['slug'] ?? '');
    ?>
    <article class="post">
      <?= mediaHtml($p) ?>
      <div class="post-body">
        <div class="meta">
          <span><?= $icons[$p['platform']] ?? 'ðŸ“„' ?> <?= h($p['platform']) ?></span>
          <span><?= $p['published_at'] ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></span>
        </div>
        <h2><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h2>
        <p class="excerpt"><?= h(postExcerpt($p)) ?></p>
        <?php if (!empty($p['source_url'])): ?>
        <a class="source-link" href="<?= h($p['source_url']) ?>" target="_blank" rel="noopener">Apri originale</a>
        <?php endif; ?>
      </div>
    </article>
    <?php endforeach; ?>
  </section>
  <?php if (empty($mediaPosts)): ?>
  <div style="text-align:center;padding:4rem 1rem;opacity:0.6;">
    <div style="font-size:3rem;margin-bottom:1rem;">ðŸ–¼ï¸</div>
    <p>Nessun media disponibile al momento.</p>
  </div>
  <?php endif; ?>

  <?php elseif ($activeTag): ?>
  <div style="margin-bottom: 2rem; padding: 1.5rem; background: var(--card-bg); border-radius: var(--radius); border-left: 4px solid var(--accent);">
    <h1 style="margin:0;">Categoria: <strong><?= h(humanizeDisplayName($activeTagLabel)) ?></strong></h1>
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

  <?php elseif ($useHospitalityLanding): ?>

  <section class="hospitality-section hospitality-intro" id="esperienza">
    <div class="hospitality-section-head">
      <span class="eyebrow">Esperienza</span>
      <h2>Un agriturismo da vivere, non solo da leggere</h2>
      <p><?= h($bio ?: 'Natura, tavola e momenti speciali diventano il centro dell’esperienza.') ?></p>
    </div>
    <div class="hospitality-pillars">
      <?php foreach ($hospitalityHighlights as $item): ?>
      <article class="hospitality-pillar">
        <h3><?= h($item['title']) ?></h3>
        <p><?= h($item['text']) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
  </section>

  <?php if (!empty($hospitalityEventPosts)): ?>
  <section class="hospitality-section" id="eventi">
    <div class="hospitality-section-head">
      <span class="eyebrow">Eventi</span>
      <h2>Momenti speciali da prenotare</h2>
      <p>Le occasioni che rendono il luogo vivo: pranzi stagionali, serate sotto gli ulivi, benessere e convivialità.</p>
    </div>
    <div class="post-grid hospitality-grid hospitality-grid-3">
      <?php foreach ($hospitalityEventPosts as $p):
        $purl = $siteUrl . '/' . h($p['slug'] ?? '');
      ?>
      <article class="post hospitality-card">
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
    </div>
  </section>
  <?php endif; ?>

  <section class="hospitality-section hospitality-split-band" id="sapori">
    <div class="hospitality-split-copy">
      <span class="eyebrow">Sapori</span>
      <h2>Cucina, stagione e tavola condivisa</h2>
      <p>Qui la cucina racconta il territorio: ingredienti, stagioni e convivialità diventano parte dell’esperienza.</p>
      <a class="hospitality-cta hospitality-cta-primary" href="<?= h($hospitalityPrimaryCtaUrl) ?>" target="<?= preg_match('/^https?:\/\//i', $hospitalityPrimaryCtaUrl) ? '_blank' : '_self' ?>" rel="noopener"><?= h($hospitalityPrimaryCtaLabel) ?></a>
    </div>
    <div class="hospitality-split-stack">
      <?php foreach (array_slice($hospitalityFoodPosts ?: $recentPosts, 0, 2) as $p):
        $purl = $siteUrl . '/' . h($p['slug'] ?? '');
      ?>
      <article class="hospitality-mini-card">
        <strong><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></strong>
        <p><?= h(postExcerpt($p)) ?></p>
      </article>
      <?php endforeach; ?>
    </div>
  </section>

  <?php if (!empty($mediaPosts)): ?>
  <section class="hospitality-section" id="spazi">
    <div class="hospitality-section-head">
      <span class="eyebrow">Spazi</span>
      <h2>Atmosfera, natura e dettagli del luogo</h2>
      <p>Una galleria pensata per far desiderare la visita prima ancora della lettura completa dei contenuti.</p>
    </div>
    <div class="hospitality-media-strip">
      <?php foreach (array_slice($mediaPosts, 0, 4) as $p): ?>
      <a class="hospitality-media-item" href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>">
        <?php if (!empty($p['media_url'])): ?>
          <img src="<?= h($p['media_url']) ?>" alt="<?= h(postTitle($p)) ?>" loading="lazy">
        <?php endif; ?>
        <span><?= h(postTitle($p)) ?></span>
      </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($recentPosts)): ?>
  <section class="hospitality-section" id="storie">
    <div class="hospitality-section-head">
      <span class="eyebrow">Storie</span>
      <h2>Dal luogo, non dal template</h2>
      <p>Gli ultimi contenuti restano utili, ma come rinforzo editoriale di una destinazione già chiara e desiderabile.</p>
    </div>
    <div class="post-grid hospitality-grid">
      <?php foreach (array_slice($recentPosts, 0, 6) as $p):
        $purl = $siteUrl . '/' . h($p['slug'] ?? '');
      ?>
      <article class="post hospitality-card">
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
    </div>
  </section>
  <?php endif; ?>

  <section class="hospitality-section hospitality-cta-band" id="contatti">
    <div>
      <span class="eyebrow">Prenotazione</span>
      <h2>Se il posto è giusto, il prossimo passo deve essere semplice</h2>
      <p>Contatto diretto, visita agli spazi, eventi e contenuti devono accompagnare verso una richiesta reale, non restare solo navigazione passiva.</p>
    </div>
    <div class="hospitality-cta-actions">
      <a class="hospitality-cta hospitality-cta-primary" href="<?= h($hospitalityPrimaryCtaUrl) ?>" target="<?= preg_match('/^https?:\/\//i', $hospitalityPrimaryCtaUrl) ? '_blank' : '_self' ?>" rel="noopener"><?= h($hospitalityPrimaryCtaLabel) ?></a>
      <a class="hospitality-cta hospitality-cta-secondary" href="<?= h($hospitalitySecondaryCtaUrl) ?>"><?= h($hospitalitySecondaryCtaLabel) ?></a>
    </div>
  </section>

  <?php else: ?>

  <?php
    $homeLead = $chronologicalPosts[0] ?? null;
    $homeLatest = $homeLead
        ? array_values(array_filter($chronologicalPosts, static fn($item) => (int)($item['id'] ?? 0) !== (int)($homeLead['id'] ?? 0)))
        : $chronologicalPosts;
    $homeLatest = array_slice($homeLatest, 0, 6);
    $homeLeadImage = '';
    if ($homeLead && strtolower((string)($homeLead['media_type'] ?? '')) !== 'video') {
        $homeLeadImage = normalizeMediaUrl((string)($homeLead['media_url'] ?? ''));
    }
    if ($homeLeadImage === '') $homeLeadImage = $coverUrl;

    $homeContactUrl = '';
    $homeContactLabel = '';
    if (isset($foundationPagesBySlug['contatti'])) {
        $homeContactUrl = $siteUrl . '/contatti';
        $homeContactLabel = 'Contatti';
    } elseif (!empty($reachabilityProfile['whatsapp'])) {
        $homeContactUrl = 'https://wa.me/' . $reachabilityProfile['whatsapp'];
        $homeContactLabel = 'Scrivi su WhatsApp';
    } elseif (!empty($reachabilityProfile['phone'])) {
        $homeContactUrl = 'tel:' . $reachabilityProfile['phone'];
        $homeContactLabel = 'Chiama';
    } elseif (!empty($reachabilityProfile['email'])) {
        $homeContactUrl = 'mailto:' . $reachabilityProfile['email'];
        $homeContactLabel = 'Scrivi una email';
    }
  ?>

  <div class="universal-home">
    <section class="universal-hero<?= $sectionHiddenClass('hero') ?>" style="order:<?= $sectionPosition('hero') ?>" aria-labelledby="universal-home-title">
      <div class="universal-hero-copy">
        <span class="universal-eyebrow">Contenuti e canali ufficiali</span>
        <?php if ($brandVisualMode === 'cover' && $coverUrl): ?><div class="universal-brand-cover"><img src="<?= h($coverUrl) ?>" alt="Immagine rappresentativa di <?= h($displayTitle) ?>" loading="eager" fetchpriority="high"></div><?php endif; ?>
        <?php if ($brandVisualMode === 'logo' && $logoUrl): ?><div class="universal-identity"><img src="<?= h($logoUrl) ?>" alt="" width="56" height="56"><span><?= $title ?></span></div><?php endif; ?>
        <h1 id="universal-home-title"><?= $heroTagline ?: $title ?></h1>
        <p><?= $bio ?: 'Informazioni, esperienze e aggiornamenti raccolti in uno spazio semplice da consultare.' ?></p>
        <div class="universal-actions">
          <?php if (!empty($chronologicalPosts)): ?><a class="universal-button universal-button-primary" href="<?= count($chronologicalPosts) > 1 ? '#ultimi' : '#in-evidenza' ?>">Leggi gli ultimi contenuti</a><?php endif; ?>
          <?php if ($homeContactUrl !== ''): ?><a class="universal-button" href="<?= h($homeContactUrl) ?>"><?= h($homeContactLabel) ?></a><?php endif; ?>
        </div>
        <ul class="universal-stats" aria-label="Riepilogo del sito">
          <li><strong><?= count($allPosts) ?></strong><span>contenuti</span></li>
          <li><strong><?= count($tagCounts) ?></strong><span>argomenti</span></li>
          <li><strong><?= count($sources) ?></strong><span>canali ufficiali</span></li>
        </ul>
      </div>

      <?php if ($homeLead): ?>
      <a id="in-evidenza" class="universal-lead<?= $homeLeadImage === '' ? ' universal-lead-no-image' : '' ?>" href="<?= $siteUrl . '/' . h($homeLead['slug'] ?? '') ?>" aria-label="Leggi: <?= h(postTitle($homeLead)) ?>">
        <?php if ($homeLeadImage !== ''): ?><img src="<?= h($homeLeadImage) ?>" alt="" loading="eager" fetchpriority="high"><?php endif; ?>
        <span class="universal-lead-body"><small>In evidenza · <?= h(ucfirst((string)($homeLead['platform'] ?? 'contenuto'))) ?></small><strong><?= h(postTitle($homeLead)) ?></strong><span><?= h(postExcerpt($homeLead)) ?></span><b>Leggi l’articolo →</b></span>
      </a>
      <?php else: ?>
      <div class="universal-lead universal-lead-empty" aria-hidden="true"><span class="universal-lead-body"><small>Spazio ufficiale</small><strong><?= $title ?></strong><span>I prossimi contenuti saranno pubblicati qui.</span></span></div>
      <?php endif; ?>
    </section>

    <?php if (!empty($homeLatest)): ?>
    <section class="universal-section<?= $sectionHiddenClass('latest') ?>" style="order:<?= $sectionPosition('latest') ?>" id="ultimi" aria-labelledby="universal-latest-title">
      <header class="universal-section-heading"><div><span class="universal-eyebrow">Aggiornamenti</span><h2 id="universal-latest-title">Ultimi contenuti</h2></div><?php if (isset($foundationPagesBySlug['contenuti'])): ?><a href="<?= $siteUrl ?>/contenuti">Vedi tutto →</a><?php endif; ?></header>
      <div class="universal-card-grid">
        <?php foreach ($homeLatest as $p): $purl = $siteUrl . '/' . h($p['slug'] ?? ''); ?>
        <article class="universal-card">
          <div class="universal-card-media"><?= mediaHtml($p) ?></div>
          <div class="universal-card-body"><div class="universal-meta"><span><?= h(ucfirst((string)($p['platform'] ?? 'Contenuto'))) ?></span><time datetime="<?= h(substr((string)($p['published_at'] ?? ''), 0, 10)) ?>"><?= !empty($p['published_at']) ? date('d/m/Y', strtotime($p['published_at'])) : '' ?></time></div><h3><a href="<?= $purl ?>"><?= h(postTitle($p)) ?></a></h3><p><?= h(postExcerpt($p)) ?></p><a class="universal-read" href="<?= $purl ?>">Continua a leggere <span aria-hidden="true">→</span></a></div>
        </article>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>

    <?php if (!empty($tagCounts)): ?>
    <nav class="universal-section universal-topics<?= $sectionHiddenClass('topics') ?>" style="order:<?= $sectionPosition('topics') ?>" id="categorie" aria-labelledby="universal-topics-title">
      <div class="universal-section-heading"><div><span class="universal-eyebrow">Esplora</span><h2 id="universal-topics-title">Argomenti</h2></div></div>
      <div class="universal-topic-list"><?php arsort($tagCounts); foreach (array_slice($tagCounts, 0, 8, true) as $tag => $tagCount): ?><a href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($tag)) ?>"><span><?= h(humanizeDisplayName($tag)) ?></span><strong><?= (int)$tagCount ?></strong></a><?php endforeach; ?></div>
    </nav>
    <?php endif; ?>

    <?php if (!empty($foundationPagesBySlug)): ?>
    <section class="universal-section universal-info<?= $sectionHiddenClass('info') ?>" style="order:<?= $sectionPosition('info') ?>" aria-labelledby="universal-info-title">
      <header class="universal-section-heading"><div><span class="universal-eyebrow">Informazioni utili</span><h2 id="universal-info-title">Conosci meglio <?= $title ?></h2></div></header>
      <div class="universal-info-grid"><?php $homeInfoCount = 0; foreach ($preferredFoundationPages as $pageSlug => $label): if (!isset($foundationPagesBySlug[$pageSlug]) || $homeInfoCount >= 4) continue; $page = $foundationPagesBySlug[$pageSlug]; $homeInfoCount++; ?><a href="<?= $siteUrl . '/' . rawurlencode($pageSlug) ?>"><span><?= h($label) ?></span><p><?= h($page['meta_description'] ?? $page['intro'] ?? '') ?></p><strong>Approfondisci →</strong></a><?php endforeach; ?></div>
    </section>
    <?php endif; ?>

    <?php if (!empty($customSections)): foreach ($customSections as $cs): ?>
    <section class="universal-section<?= $sectionHiddenClass($cs['id']) ?>" style="order:<?= $sectionPosition($cs['id']) ?>" id="<?= h($cs['id']) ?>" aria-labelledby="universal-custom-<?= h($cs['id']) ?>-title">
      <header class="universal-section-heading"><div><h2 id="universal-custom-<?= h($cs['id']) ?>-title"><?= h($cs['title']) ?></h2></div></header>
      <?php if ($cs['image_url'] !== ''): ?><div class="universal-custom-media"><img src="<?= h($cs['image_url']) ?>" alt="" loading="lazy"></div><?php endif; ?>
      <div class="body-content"><?= bodyHtml($cs['body']) ?></div>
    </section>
    <?php endforeach; endif; ?>
  </div>

  <?php if (false): // Modalità sperimentali disattivate: il pubblico usa il layout universale. ?>

  <?php if (!empty($chronologicalPosts)):
    $wallPosts = array_slice($chronologicalPosts, 0, 16);
    $wallPlatforms = [];
    foreach ($wallPosts as $wallPost) {
        $wallPlatform = strtolower(trim((string)($wallPost['platform'] ?? 'social')));
        if ($wallPlatform !== '') $wallPlatforms[$wallPlatform] = ucfirst($wallPlatform);
    }
  ?>
  <?php if ($livingSpaceMode !== 'pulse'):
    $modeName = $livingModeName;
    $modeTopics = array_slice(array_keys($tagCounts), 0, 6);
  ?>
  <section class="living-native native-<?= h($livingSpaceMode) ?>" aria-labelledby="living-native-title">
    <header class="native-head">
      <div class="native-brand"><?php if ($logoUrl): ?><img src="<?= h($logoUrl) ?>" alt="Logo <?= h($title) ?>"><?php endif; ?><strong><?= h($title) ?></strong></div>
      <span><?= h($modeName) ?> · aggiornato dai canali ufficiali</span>
      <h1 id="living-native-title"><?php if ($livingSpaceMode === 'compass'): ?>Cosa vuoi vivere?<?php elseif ($livingSpaceMode === 'answers'): ?>Da dove vuoi cominciare?<?php elseif ($livingSpaceMode === 'atlas'): ?>Un luogo, molti mondi.<?php elseif ($livingSpaceMode === 'adaptive'): ?>Per te, adesso.<?php else: ?><?= h($displayTitle) ?><?php endif; ?></h1>
      <p><?= $bio ?: 'Contenuti, immagini e storie diventano un nuovo spazio da attraversare.' ?></p>
    </header>

    <?php if ($livingSpaceMode === 'stories'): ?>
      <div class="native-stories"><?php foreach (array_slice($wallPosts, 0, 10) as $index => $p): ?><article class="native-story"<?= !empty($p['media_url']) ? ' style="--native-image:url(\'' . h($p['media_url']) . '\')"' : '' ?>><span><?= str_pad((string)($index + 1), 2, '0', STR_PAD_LEFT) ?> · <?= h($p['platform'] ?? 'Storia') ?></span><h2><?= h(postTitle($p)) ?></h2><p><?= h(postExcerpt($p)) ?></p><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>">Scopri la storia →</a></article><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'constellation'): ?>
      <div class="native-constellation"><div class="native-core"><small>ESPLORA LE CONNESSIONI</small><strong><?= h($title) ?></strong></div><?php foreach ($modeTopics as $index => $topic): ?><a class="native-node node-<?= $index + 1 ?>" href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($topic)) ?>"><small>0<?= $index + 1 ?></small><?= h(humanizeDisplayName($topic)) ?></a><?php endforeach; ?></div>
      <div class="native-related"><?php foreach (array_slice($wallPosts, 0, 3) as $p): ?><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><?= h(postTitle($p)) ?><span>→</span></a><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'timeline'): ?>
      <div class="native-timeline"><?php foreach ($wallPosts as $index => $p): ?><article><time><?= $p['published_at'] ? date('d.m.Y', strtotime($p['published_at'])) : 'Ora' ?></time><i></i><div><?php if (!empty($p['media_url'])): ?><img src="<?= h($p['media_url']) ?>" alt="" loading="lazy"><?php endif; ?><small>CAPITOLO <?= str_pad((string)($index + 1), 2, '0', STR_PAD_LEFT) ?></small><h2><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><?= h(postTitle($p)) ?></a></h2><p><?= h(postExcerpt($p)) ?></p></div></article><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'compass'): ?>
      <nav class="native-intents"><a href="#categorie">Voglio mangiare bene <span>→</span></a><a href="#ultimi">Voglio vivere un'esperienza <span>→</span></a><a href="<?= $siteUrl ?>?view=media">Voglio vedere il luogo <span>→</span></a><a href="#categorie">Voglio scoprire cosa offre <span>→</span></a></nav>
      <div class="native-card-grid"><?php foreach (array_slice($wallPosts, 0, 6) as $p): ?><article class="native-card"><?= mediaHtml($p) ?><div><small><?= h($p['platform'] ?? 'Contenuto') ?></small><h2><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><?= h(postTitle($p)) ?></a></h2><p><?= h(postExcerpt($p)) ?></p></div></article><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'mixer'): ?>
      <div class="native-mixer"><?php foreach ([['Da guardare',$mediaPosts],['Da leggere',array_values(array_filter($wallPosts,fn($p)=>empty($p['media_url'])))],['Dai social',$wallPosts]] as $groupIndex => [$groupTitle,$groupPosts]): ?><section><span>0<?= $groupIndex + 1 ?></span><h2><?= h($groupTitle) ?></h2><?php foreach (array_slice($groupPosts ?: $wallPosts, 0, 5) as $p): ?><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><?= h(postTitle($p)) ?><i>↗</i></a><?php endforeach; ?></section><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'cinema'): $cinemaPosts = $mediaPosts ?: $wallPosts; $cinemaLead = $cinemaPosts[0] ?? null; ?>
      <?php if ($cinemaLead): ?><article class="native-cinema-lead"<?= !empty($cinemaLead['media_url']) ? ' style="--native-image:url(\'' . h($cinemaLead['media_url']) . '\')"' : '' ?>><small>IN PRIMO PIANO</small><h2><?= h(postTitle($cinemaLead)) ?></h2><p><?= h(postExcerpt($cinemaLead)) ?></p><a href="<?= $siteUrl . '/' . h($cinemaLead['slug'] ?? '') ?>">▶ Guarda e scopri</a></article><?php endif; ?>
      <div class="native-filmstrip"><?php foreach (array_slice($cinemaPosts, 1, 7) as $index => $p): ?><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"<?= !empty($p['media_url']) ? ' style="--native-image:url(\'' . h($p['media_url']) . '\')"' : '' ?>><span>0<?= $index + 2 ?></span><strong><?= h(postTitle($p)) ?></strong></a><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'answers'): ?>
      <div class="native-question">⌕ <strong>Cosa vuoi sapere su <?= h($title) ?>?</strong></div><div class="native-answers"><?php foreach (array_slice($wallPosts, 0, 7) as $index => $p): ?><details<?= $index === 0 ? ' open' : '' ?>><summary><?= h(postTitle($p)) ?><span>+</span></summary><p><?= h(postExcerpt($p)) ?></p><small>Fonte: contenuto pubblicato su <?= h($p['platform'] ?? 'Spazio Vivo') ?></small><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>">Apri l'approfondimento →</a></details><?php endforeach; ?></div>
    <?php elseif ($livingSpaceMode === 'atlas'): ?>
      <div class="native-atlas"><?php foreach ($modeTopics as $index => $topic): ?><a class="region-<?= $index + 1 ?>" href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($topic)) ?>"><span>0<?= $index + 1 ?></span><strong><?= h(humanizeDisplayName($topic)) ?></strong><small>Entra nel territorio →</small></a><?php endforeach; ?></div>
    <?php else: $adaptiveLead = $wallPosts[0] ?? null; ?>
      <div class="native-adaptive"><?php if ($adaptiveLead): ?><article class="native-adaptive-lead"<?= !empty($adaptiveLead['media_url']) ? ' style="--native-image:url(\'' . h($adaptiveLead['media_url']) . '\')"' : '' ?>><small>DA NON PERDERE ORA</small><h2><?= h(postTitle($adaptiveLead)) ?></h2><p><?= h(postExcerpt($adaptiveLead)) ?></p><a href="<?= $siteUrl . '/' . h($adaptiveLead['slug'] ?? '') ?>">Scopri adesso →</a></article><?php endif; ?><aside><small>IL PROSSIMO PASSO GIUSTO</small><?php foreach (array_slice($wallPosts, 1, 5) as $index => $p): ?><a href="<?= $siteUrl . '/' . h($p['slug'] ?? '') ?>"><span>0<?= $index + 1 ?></span><?= h(postTitle($p)) ?><i>→</i></a><?php endforeach; ?></aside></div>
    <?php endif; ?>
  </section>
  <?php else: ?>
  <section class="social-pulse" id="social-pulse" aria-labelledby="social-pulse-title">
    <header class="social-pulse-hero">
      <div class="social-pulse-brand"><?php if ($logoUrl): ?><img src="<?= h($logoUrl) ?>" alt="Logo <?= h($title) ?>"><?php endif; ?><strong><?= h($title) ?></strong></div>
      <span class="social-pulse-kicker"><i></i> Social Intelligence Wall · aggiornato dai canali ufficiali</span>
      <h1 id="social-pulse-title">Tutto ciò che pubblichiamo.<br><em>Vivo, insieme.</em></h1>
      <p><?= $bio ?: 'Social, articoli, immagini e video non scorrono più via: diventano un unico spazio vivo da esplorare.' ?></p>
      <div class="social-pulse-stats">
        <span><strong><?= count($allPosts) ?></strong> segnali raccolti</span>
        <span><strong><?= count($wallPlatforms) ?></strong> canali connessi</span>
        <span><strong><?= count($mediaPosts) ?></strong> media vivi</span>
      </div>
      <a class="social-pulse-scroll" href="#wall-stream">Entra nel flusso <span>↓</span></a>
    </header>

    <div class="social-pulse-console" id="wall-stream">
      <div>
        <span class="social-pulse-console-label">Filtra il flusso</span>
        <div class="social-pulse-filters" aria-label="Filtra i contenuti per canale">
          <button type="button" class="social-pulse-filter is-active" data-wall-filter="all" aria-pressed="true">Tutto</button>
          <?php foreach ($wallPlatforms as $wallPlatform => $wallPlatformLabel): ?>
          <button type="button" class="social-pulse-filter" data-wall-filter="<?= h(networkTopicSlug($wallPlatform)) ?>" aria-pressed="false"><?= h($wallPlatformLabel) ?></button>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="social-pulse-now"><i></i><span>Feed attivo</span><strong><?= date('H:i') ?></strong></div>
    </div>

    <div class="social-wall" aria-live="polite">
      <?php foreach ($wallPosts as $wallIndex => $wallPost):
        $wallPostUrl = $siteUrl . '/' . h($wallPost['slug'] ?? '');
        $wallPlatform = networkTopicSlug((string)($wallPost['platform'] ?? 'social'));
        $wallHasMedia = !empty($wallPost['media_url']);
      ?>
      <article class="social-signal<?= $wallIndex === 0 ? ' social-signal--lead' : '' ?><?= $wallHasMedia ? ' social-signal--media' : ' social-signal--text' ?>" data-wall-platform="<?= h($wallPlatform) ?>">
        <a href="<?= $wallPostUrl ?>">
          <?php if ($wallHasMedia): ?><?= mediaHtml($wallPost) ?><?php endif; ?>
          <div class="social-signal-body">
            <div class="social-signal-meta"><span><i></i><?= h(ucfirst((string)($wallPost['platform'] ?? 'Social'))) ?></span><time><?= $wallPost['published_at'] ? date('d.m.Y', strtotime($wallPost['published_at'])) : 'Ora' ?></time></div>
            <h2><?= h(postTitle($wallPost)) ?></h2>
            <p><?= h(postExcerpt($wallPost)) ?></p>
            <span class="social-signal-open">Apri il segnale <b>↗</b></span>
          </div>
        </a>
      </article>
      <?php endforeach; ?>
    </div>
    <footer class="social-pulse-footer"><span>Non è un feed copiato.</span><strong>È la memoria pubblica e navigabile dell’attività.</strong><a href="#categorie">Esplora per tema →</a></footer>
  </section>
  <?php endif; ?>
  <?php endif; ?>

  <section class="content-archive" aria-labelledby="archive-heading">
    <header class="archive-intro">
      <span class="network-kicker">Archivio sempre aggiornato</span>
      <h1 id="archive-heading"><?= h($displayTitle) ?></h1>
      <p><?= $bio ?: 'Articoli, approfondimenti, foto e video organizzati in un unico spazio.' ?></p>
      <div class="archive-stats" aria-label="Riepilogo contenuti">
        <a href="#ultimi"><strong><?= count($allPosts) ?></strong><span>contenuti</span></a>
        <a href="#categorie"><strong><?= count($tagCounts) ?></strong><span>categorie</span></a>
        <?php if (!empty($mediaPosts)): ?><a href="<?= $siteUrl ?>?view=media"><strong><?= count($mediaPosts) ?></strong><span>foto e video</span></a><?php endif; ?>
      </div>
    </header>

  <?php if (!empty($tagCounts)): ?>
  <nav class="category-index" id="categorie" aria-labelledby="category-heading">
    <div><span class="network-kicker">Esplora per argomento</span><h2 id="category-heading">Categorie</h2></div>
    <div class="category-chips">
      <?php arsort($tagCounts); foreach ($tagCounts as $tag => $tagCount): ?>
      <a href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($tag)) ?>"><span><?= h(humanizeDisplayName($tag)) ?></span><strong><?= (int)$tagCount ?></strong></a>
      <?php endforeach; ?>
    </div>
  </nav>
  <?php endif; ?>

  <?php if (!empty($mediaPosts)): ?>
  <section class="media-preview" aria-labelledby="media-preview-heading">
    <div class="section-heading-row"><div><span class="network-kicker">Dai canali ufficiali</span><h2 id="media-preview-heading">Foto e video recenti</h2></div><a href="<?= $siteUrl ?>?view=media">Apri tutti i media →</a></div>
    <div class="media-preview-grid">
      <?php foreach (array_slice($mediaPosts, 0, 4) as $mediaPost): ?>
      <a href="<?= $siteUrl . '/' . h($mediaPost['slug'] ?? '') ?>" class="media-preview-card">
        <?= mediaHtml($mediaPost) ?>
        <span><?= h(postTitle($mediaPost)) ?></span>
      </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($foundationPagesBySlug)): ?>
  <section class="foundation-directory" aria-labelledby="foundation-heading">
    <div class="foundation-directory-head"><span class="network-kicker">Informazioni essenziali</span><h2 id="foundation-heading">Scopri <?= $title ?></h2><p>Pagine tematiche costruite a partire dai contenuti e dai canali ufficiali dell’attività.</p></div>
    <div class="foundation-card-grid">
      <?php foreach ($preferredFoundationPages as $pageSlug => $label): if (!isset($foundationPagesBySlug[$pageSlug])) continue; $page = $foundationPagesBySlug[$pageSlug]; ?>
      <a class="foundation-card" href="<?= $siteUrl . '/' . rawurlencode($pageSlug) ?>"><span><?= h($label) ?></span><p><?= h($page['meta_description'] ?? $page['intro'] ?? '') ?></p><strong>Approfondisci →</strong></a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <!-- SEZIONI PER ARGOMENTI (HOME) -->
  <?php foreach ($postsByTopic as $topic => $topicPosts): ?>
  <section class="topic-section">
    <div class="topic-header">
      <h2><?= h(ucfirst($topic)) ?></h2>
      <a href="<?= $siteUrl ?>/categoria/<?= rawurlencode(networkTopicSlug($topic)) ?>">Vedi tutti →</a>
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
  <div class="section-heading-row" id="ultimi"><div><span class="network-kicker">In ordine cronologico</span><h2 class="recent-header">Ultimi contenuti</h2></div><a href="<?= $siteUrl ?>/contenuti">Apri l'archivio completo →</a></div>
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

  </section>

  <?php endif; ?>

  <?php endif; ?>

<?php endif; ?>
<?php
$mainContentHtml = ob_get_clean();

ob_start();
?>
<?php if ($useHospitalityLanding && !$single && !$foundationPage && $view === '' && !$activeTag): ?>
<section class="hero hospitality-hero" style="background:
  linear-gradient(120deg, rgba(0,0,0,0.52), rgba(0,0,0,0.22)),
  url('<?= h($hospitalityHeroImage ?: $placeholderImage) ?>') center/cover;">
  <div class="hospitality-hero-inner">
    <span class="eyebrow">Agriturismo · Natura · Esperienze</span>
    <h1><?= h($displayTitle) ?></h1>
    <p class="bio"><?= h($hospitalityHeroCopy) ?></p>
    <div class="hospitality-hero-actions">
      <a class="hospitality-cta hospitality-cta-primary" href="<?= h($hospitalityPrimaryCtaUrl) ?>" target="<?= preg_match('/^https?:\/\//i', $hospitalityPrimaryCtaUrl) ? '_blank' : '_self' ?>" rel="noopener"><?= h($hospitalityPrimaryCtaLabel) ?></a>
      <a class="hospitality-cta hospitality-cta-secondary" href="<?= h($hospitalitySecondaryCtaUrl) ?>"><?= h($hospitalitySecondaryCtaLabel) ?></a>
    </div>
    <div class="hospitality-hero-facts">
      <?php foreach (array_slice($hospitalityFacts, 0, 4) as $fact): ?><span><?= h($fact) ?></span><?php endforeach; ?>
    </div>
  </div>
</section>
<?php elseif (!$single && !$foundationPage && count($sliderPosts) > 0): ?>
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
<?php elseif (!$single && !$foundationPage): ?>
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
if (!$single && !$foundationPage && $view === '' && !$activeTag && !$useHospitalityLanding) {
    // La homepage universale include già il proprio hero accessibile.
    $heroHtml = '';
}
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
    <main class="layout-content-col" id="main-content">
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

  <main class="container" id="main-content">
     <?= $mainContentHtml ?>
  </main>

  <footer class="footer">
    <?= $footerHtml ?>
  </footer>
<?php endif; ?>

<script nonce="<?= h($cspNonce) ?>">
document.addEventListener('DOMContentLoaded', () => {
  if (new URLSearchParams(window.location.search).get('studio_preview') === '1' && window.parent !== window) {
    const studioTargets = [
      ['menu', '.navbar, .site-nav, header nav'],
      ['header', '.universal-hero, .hero, .hospitality-hero, #hero-slider'],
      ['content', '.universal-section, .post-grid, .topic-section, .media-preview'],
      ['structure', '.foundation-directory, .universal-info-grid'],
    ];
    studioTargets.forEach(([section, selector]) => {
      document.querySelectorAll(selector).forEach(element => {
        element.dataset.studioSection = section;
        element.style.cursor = 'pointer';
        element.addEventListener('mouseenter', () => {
          element.style.outline = '3px solid #2563eb';
          element.style.outlineOffset = '-3px';
        });
        element.addEventListener('mouseleave', () => {
          element.style.outline = '';
          element.style.outlineOffset = '';
        });
      });
    });
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-studio-section]');
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage({ type:'sts-studio-select', section:target.dataset.studioSection }, window.location.origin);
    }, true);
  }
  document.querySelectorAll('.nav-brand img').forEach(image => {
    const showBrandFallback = () => {
      image.style.display = 'none';
      const fallback = image.nextElementSibling;
      if (fallback?.classList.contains('nav-brand-fallback')) fallback.style.display = 'inline';
    };
    image.addEventListener('error', showBrandFallback);
    if (image.complete && image.naturalWidth === 0) showBrandFallback();
  });
  document.querySelectorAll('.living-media-item img, .living-media-item video').forEach(media => {
    const removeBrokenItem = () => media.closest('.living-media-item')?.remove();
    media.addEventListener('error', removeBrokenItem);
    if (media.tagName === 'IMG' && media.complete && media.naturalWidth === 0) removeBrokenItem();
  });
  const analyticsEndpoint = '/api/index.php?action=track';
  const analyticsContext = {
    slug: <?= json_encode($slug, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>,
    path: window.location.pathname + window.location.search,
    post_id: <?= (int)($single['id'] ?? 0) ?>
  };
  const sendVisibilityEvent = (eventType, targetUrl = '') => {
    if (navigator.doNotTrack === '1') return;
    fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...analyticsContext, event_type: eventType, target_url: targetUrl }),
      keepalive: true,
      credentials: 'same-origin'
    }).catch(() => {});
  };
  const livingPaths = <?= json_encode($livingPaths, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
  const livingRoot = document.getElementById('percorsi-vivi');
  if (livingRoot && Array.isArray(livingPaths) && livingPaths.length) {
    const livingTitle = document.getElementById('living-title');
    const livingSubtitle = document.getElementById('living-subtitle');
    const livingStage = document.getElementById('living-stage');
    const livingPathName = document.getElementById('living-path-name');
    const livingQuestion = document.getElementById('living-question');
    const renderLivingPath = (index, trackSelection = false) => {
      const path = livingPaths[index];
      if (!path) return;
      livingTitle.textContent = path.title || '';
      livingSubtitle.textContent = path.subtitle || '';
      livingPathName.textContent = path.path_name || '';
      livingQuestion.textContent = path.question || '';
      livingRoot.querySelectorAll('.living-intent').forEach((button, buttonIndex) => button.setAttribute('aria-pressed', buttonIndex === index ? 'true' : 'false'));
      livingStage.replaceChildren();
      (path.chapters || []).forEach((chapter, chapterIndex) => {
        const link = document.createElement('a');
        link.className = 'living-chapter';
        link.dataset.index = String(chapterIndex + 1).padStart(2, '0');
        link.href = chapter.url || '#';
        let media = null;
        if (chapter.media_url) {
          media = document.createElement('span');
          media.className = 'living-chapter-media';
          if (chapter.media_type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(chapter.media_url)) {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.src = chapter.media_url;
            media.appendChild(video);
          } else {
            const image = document.createElement('img');
            image.src = chapter.media_url;
            image.alt = '';
            image.loading = 'lazy';
            media.appendChild(image);
          }
        }
        const step = document.createElement('span');
        step.className = 'living-step';
        step.textContent = chapter.step || '';
        const heading = document.createElement('strong');
        heading.textContent = chapter.title || '';
        const excerpt = document.createElement('p');
        excerpt.textContent = chapter.excerpt || '';
        const meta = document.createElement('span');
        meta.className = 'living-chapter-meta';
        const source = document.createElement('span');
        source.textContent = `✓ ${chapter.source || 'Contenuto ufficiale'}`;
        const enter = document.createElement('b');
        enter.textContent = 'Entra →';
        meta.append(source, enter);
        if (media) link.appendChild(media);
        link.append(step, heading, excerpt, meta);
        link.addEventListener('click', () => sendVisibilityEvent('path_content_click', link.href));
        livingStage.appendChild(link);
      });
      if (trackSelection) sendVisibilityEvent('path_select');
    };
    livingRoot.querySelectorAll('.living-intent').forEach((button, index) => button.addEventListener('click', () => renderLivingPath(index, true)));
    livingRoot.querySelectorAll('.living-chapter').forEach(link => link.addEventListener('click', () => sendVisibilityEvent('path_content_click', link.href)));
  }
  const wallFilters = document.querySelectorAll('[data-wall-filter]');
  const wallSignals = document.querySelectorAll('[data-wall-platform]');
  wallFilters.forEach(button => button.addEventListener('click', () => {
    const selectedPlatform = button.dataset.wallFilter || 'all';
    wallFilters.forEach(filterButton => {
      const active = filterButton === button;
      filterButton.classList.toggle('is-active', active);
      filterButton.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    wallSignals.forEach(signal => signal.classList.toggle('is-hidden', selectedPlatform !== 'all' && signal.dataset.wallPlatform !== selectedPlatform));
    sendVisibilityEvent('social_wall_filter', selectedPlatform);
  }));
  const classifyTrackedLink = (anchor) => {
    const rawHref = anchor.getAttribute('href') || '';
    const href = anchor.href || rawHref;
    const text = (anchor.textContent || '').toLowerCase();
    if (/^tel:/i.test(rawHref)) return 'call_click';
    if (/^mailto:/i.test(rawHref)) return 'contact_click';
    if (/wa\.me|whatsapp/i.test(href)) return 'whatsapp_click';
    if (/google\.[^/]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(href)) return 'directions_click';
    if (/booking\.com|prenot|reserv/i.test(href + ' ' + text)) return 'booking_click';
    if (/facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|x\.com|twitter\.com/i.test(href)) return 'social_click';
    try { if (new URL(href, window.location.href).origin !== window.location.origin) return 'external_click'; } catch (_) {}
    return '';
  };
  const viewKey = `sts_view:${analyticsContext.path}`;
  try {
    if (!sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, '1');
      sendVisibilityEvent('page_view');
    }
  } catch (_) {
    sendVisibilityEvent('page_view');
  }
  document.querySelectorAll('a[href]').forEach(anchor => {
    const eventType = classifyTrackedLink(anchor);
    if (eventType) anchor.addEventListener('click', () => sendVisibilityEvent(eventType, anchor.href || ''));
  });

  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const navOverlay = document.getElementById('nav-overlay');
  
  if (navToggle && navLinks && navOverlay) {
    const setMenuOpen = (open, returnFocus = false) => {
      navLinks.classList.toggle('open', open);
      navOverlay.classList.toggle('open', open);
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
      document.body.style.overflow = open ? 'hidden' : '';
      if (returnFocus) navToggle.focus();
    };
    navToggle.addEventListener('click', () => setMenuOpen(!navLinks.classList.contains('open')));
    navOverlay.addEventListener('click', () => setMenuOpen(false, true));
    navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && navLinks.classList.contains('open')) setMenuOpen(false, true);
    });
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
