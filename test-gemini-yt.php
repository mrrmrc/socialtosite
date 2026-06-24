<?php
require_once __DIR__ . '/api/services/ai.php';

try {
    $res = AI::gemini([
        ['fileData' => ['fileUri' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'mimeType' => 'video/mp4']],
        ['text' => "Puoi dirmi di cosa parla esattamente questo video e farne la trascrizione?"]
    ], ['maxOutputTokens' => 8000]);
    echo "SUCCESS: " . substr($res, 0, 500);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
