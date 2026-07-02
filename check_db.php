<?php
// Script di debug per verificare il campo generated_body nei post
require_once __DIR__ . '/config/db.php';

header('Content-Type: text/plain; charset=utf-8');

$posts = DB::fetchAll(
    'SELECT id, generated_title, LENGTH(generated_body) as body_len, LEFT(generated_body, 100) as body_preview, LENGTH(edited_body) as edited_len, LEFT(edited_body, 100) as edited_preview FROM posts ORDER BY id DESC LIMIT 10'
);

echo "=== CHECK generated_body nei primi 10 post ===\n\n";
foreach ($posts as $p) {
    echo "ID: {$p['id']}\n";
    echo "  Titolo: {$p['generated_title']}\n";
    echo "  generated_body length: " . ($p['body_len'] ?? 'NULL') . "\n";
    echo "  generated_body preview: " . ($p['body_preview'] ?? '(vuoto)') . "\n";
    echo "  edited_body length: " . ($p['edited_len'] ?? 'NULL') . "\n";
    echo "  edited_body preview: " . ($p['edited_preview'] ?? '(vuoto)') . "\n";
    echo "\n";
}
