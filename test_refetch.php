<?php
require_once __DIR__ . '/api/services/refetcher.php';
$urls = ['https://www.facebook.com/twoemme/posts/pfbid02RBy4aR3o5tMhG667eTXXvTzLz6mNstxQYt2g27wQ1i9a2y9v4j9F9kM3M2p7e9Rl'];
$res = Refetcher::request(['urls' => $urls]);
print_r($res);
