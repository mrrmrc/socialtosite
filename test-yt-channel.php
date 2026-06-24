<?php
$url = "https://www.youtube.com/@videoduemme";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
]);
$html = curl_exec($ch);
curl_close($ch);

if (preg_match('/"browseId":"(UC[a-zA-Z0-9_-]{22})"/', $html, $m)) {
    echo "Found channel ID: " . $m[1] . "\n";
} else if (preg_match('/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{22})"/i', $html, $m)) {
    echo "Found channel ID: " . $m[1] . "\n";
} else {
    echo "Not found. HTML length: " . strlen($html) . "\n";
}
