<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Solo CLI'); }
require_once __DIR__ . '/../api/services/publication/service.php';
$deadline = microtime(true) + 50;
$processed = 0;
while ($processed < 10 && microtime(true) < $deadline && PublicationService::runOne()) $processed++;
echo 'Consegne elaborate: ' . $processed . PHP_EOL;
