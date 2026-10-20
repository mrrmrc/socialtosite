<?php
// Regression: exercise the real public renderer's buffer and head preparation.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Solo da CLI'); }

$publicFile = __DIR__ . '/../public/site.php';
$source = file_get_contents($publicFile);
$begin = strpos($source, '// OpenPage must emit one document');
$end = strpos($source, '?>', $begin);
$integration = strpos($source, '// -- OPENPAGE INTEGRATION --');
$articles = strpos($source, '// 1) Inject dynamic articles grid', $integration);
if ($begin === false || $end === false || $integration === false || $articles === false) {
    throw new RuntimeException('Public rendering sections not found');
}
$bufferCode = substr($source, $begin, $end - $begin);
$documentCode = substr($source, $integration, $articles - $integration) . "\n}";
$documentCode = str_replace('__DIR__', var_export(dirname($publicFile), true), $documentCode);

$site = ['openpage_html' => '<!DOCTYPE html><html lang="it"><head><style>:root{--color-bg-1:#ffffff}</style></head><body><main class="site-render">Customer site</main><script data-openpage-runtime>oldRuntime()</script><script>untrusted()</script></body></html>'];
$siteUrl = '/customer';
function h($value) { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
ob_start();
eval($bufferCode);
echo '<!DOCTYPE html><html><head><style>body{background:black}*{padding:0}</style><link rel="canonical" href="/customer"><script type="application/ld+json" nonce="test-nonce">{"@type":"WebSite"}</script></head><body class="legacy-layout">';
eval($documentCode);
echo $out;
$response = ob_get_clean();

$checks = [
    'exactly one document' => substr_count(strtolower($response), '<!doctype html>') === 1,
    'no fallback styles' => strpos($response, 'background:black') === false,
    'no fallback body classes' => strpos($response, 'legacy-layout') === false,
    'customer theme preserved' => strpos($response, '--color-bg-1:#ffffff') !== false,
    'SEO preserved' => strpos($response, 'rel="canonical"') !== false && strpos($response, '"@type":"WebSite"') !== false,
    'home destination available for saved sites' => strpos($response, 'name="sts-home" content="/customer"') !== false,
    'runtime allowed by self-only CSP' => strpos($response, 'src="/public/openpage-runtime.js?v=') !== false,
    'old inline runtime removed' => strpos($response, 'oldRuntime()') === false,
    'untrusted scripts never granted nonce' => strpos($response, '<script>untrusted()</script>') !== false,
];
foreach ($checks as $name => $passed) {
    echo ($passed ? 'OK ' : 'FAIL ') . $name . "\n";
}
exit(in_array(false, $checks, true) ? 1 : 0);
