<?php
require_once __DIR__ . '/api/services/ai.php';

try {
    $res = AI::transcribeYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    echo "SUCCESS: " . substr($res, 0, 100);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
