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

echo "\n$passed test passati, $failed falliti\n";
exit($failed > 0 ? 1 : 0);
