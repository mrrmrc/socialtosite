<?php
require_once __DIR__ . '/config/keys.php';
require_once __DIR__ . '/api/services/apify_client.php';

try {
    $result = ApifyClient::source('https://www.facebook.com/Apple/', 5);
    echo json_encode($result, JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
