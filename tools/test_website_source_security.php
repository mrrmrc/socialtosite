<?php

require_once __DIR__ . '/../api/services/website_source.php';

$passed = 0;
$failed = 0;

function rejectsWebsiteUrl(string $label, string $url): void {
    global $passed, $failed;
    try {
        WebsiteSource::validate($url);
        echo "  FAIL  $label\n";
        $failed++;
    } catch (Throwable $e) {
        echo "  ok    $label\n";
        $passed++;
    }
}

echo "Protezione acquisizione siti\n";
rejectsWebsiteUrl('blocca localhost', 'http://localhost/example');
rejectsWebsiteUrl('blocca IPv4 loopback', 'http://127.0.0.1/example');
rejectsWebsiteUrl('blocca rete privata', 'http://192.168.1.10/example');
rejectsWebsiteUrl('blocca link-local cloud metadata', 'http://169.254.169.254/latest/meta-data');
rejectsWebsiteUrl('blocca credenziali nell’URL', 'https://user:password@example.com/');
rejectsWebsiteUrl('blocca porte arbitrarie', 'https://example.com:8443/');
rejectsWebsiteUrl('blocca protocolli non HTTP', 'file:///etc/passwd');

$sitemap = WebsiteSource::parseSitemap('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/primo</loc><lastmod>2026-08-20</lastmod></url><url><loc>https://example.com/secondo</loc></url></urlset>');
if ($sitemap['type'] === 'urlset' && count($sitemap['entries']) === 2 && $sitemap['entries'][0]['url'] === 'https://example.com/primo') {
    echo "  ok    legge sitemap URL con namespace\n";
    $passed++;
} else {
    echo "  FAIL  legge sitemap URL con namespace\n";
    $failed++;
}

$index = WebsiteSource::parseSitemap('<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/post-sitemap.xml</loc></sitemap></sitemapindex>');
if ($index['type'] === 'index' && ($index['entries'][0]['url'] ?? '') === 'https://example.com/post-sitemap.xml') {
    echo "  ok    legge indici sitemap\n";
    $passed++;
} else {
    echo "  FAIL  legge indici sitemap\n";
    $failed++;
}

$invalid = WebsiteSource::parseSitemap('<html>non xml');
if ($invalid['type'] === 'invalid' && !$invalid['entries']) {
    echo "  ok    rifiuta sitemap non valide\n";
    $passed++;
} else {
    echo "  FAIL  rifiuta sitemap non valide\n";
    $failed++;
}

echo "\n$passed test passati, $failed falliti\n";
exit($failed > 0 ? 1 : 0);
