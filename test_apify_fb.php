<?php
define('APIFY_TOKEN', 'apify_api_3LX8nL0nZmdDli7n4YlbyrJiPatuRf1MWkGE');

function apifyRun(string $actorId, array $input) {
    $actorIdSafe = str_replace('/', '~', $actorId);
    $url = "https://api.apify.com/v2/acts/$actorIdSafe/run-sync-get-dataset-items?token=" . APIFY_TOKEN;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($input),
        CURLOPT_TIMEOUT        => 300,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    return json_decode($res, true);
}

// Test Facebook
$fb = apifyRun('apify/facebook-pages-scraper', ['startUrls' => [['url' => 'https://www.facebook.com/PagineDiEsempio/']], 'resultsLimit' => 3]);
echo "FB count: " . count($fb) . "\n";
if (count($fb) > 0) {
    echo "FB keys of first item: " . implode(", ", array_keys($fb[0])) . "\n";
    if (isset($fb[0]['posts'])) echo "Has posts array!\n";
}
