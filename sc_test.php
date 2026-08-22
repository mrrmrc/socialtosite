<?php
$apiKey = "sc_czKzcDGDFAyhYQ0DCGmESZW_pMN39JuWIjOD3UEVXfE";
$url = "https://api.socialcrawl.dev/facebook/profile";
$payload = json_encode(["startUrls" => [["url" => "https://www.facebook.com/zuck"]], "resultsLimit" => 3]);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["x-api-key: $apiKey", "Content-Type: application/json"],
    CURLOPT_POSTFIELDS => $payload
]);
$res = curl_exec($ch);
file_put_contents("sc_test_fb.json", $res);
echo "Written to sc_test_fb.json. Length: " . strlen($res);