<?php
require_once 'config/config.php';
require_once 'config/keys.php';

$payload = [
    'inputUrl' => 'https://www.instagram.com/zuck/',
    'maxPosts' => 2
];
$url = "https://api.socialcrawl.dev/instagram/posts";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . SOCIALCRAWL_API_KEY
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 90,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);
$startTime = microtime(true);
$res = curl_exec($ch);
$elapsed = round(microtime(true) - $startTime, 2);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $code\n";
echo "Elapsed: {$elapsed}s\n";
if ($res) {
    echo "Response: " . substr($res, 0, 2000) . "\n";
} else {
    echo "No response.\n";
}