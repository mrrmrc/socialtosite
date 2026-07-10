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

// Test Instagram
$ig = apifyRun('apify/instagram-profile-scraper', ['usernames' => ['bellecapocce'], 'resultsLimit' => 1]);
echo "IG Keys: " . implode(", ", array_keys($ig[0] ?? [])) . "\n";
if (isset($ig[0]['latestPosts'])) {
    echo "IG latestPosts count: " . count($ig[0]['latestPosts']) . "\n";
    if (count($ig[0]['latestPosts']) > 0) {
        echo "IG first post keys: " . implode(", ", array_keys($ig[0]['latestPosts'][0])) . "\n";
    }
}

// Test TikTok
$tk = apifyRun('clockworks/tiktok-profile-scraper', ['profiles' => ['simonamirra4'], 'resultsPerPage' => 1]);
echo "\nTK Keys: " . implode(", ", array_keys($tk[0] ?? [])) . "\n";
