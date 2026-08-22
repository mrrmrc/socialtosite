<?php
require_once 'config/config.php';
require_once 'config/keys.php';
$payload = ["startUrls" => [["url" => "https://www.facebook.com/zuck"]], "resultsLimit" => 2];
$url = "https://api.socialcrawl.dev/facebook/profile";
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . SOCIALCRAWL_API_KEY
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
]);
$res = curl_exec($ch);
curl_close($ch);
echo "Response: " . substr($res, 0, 1000);