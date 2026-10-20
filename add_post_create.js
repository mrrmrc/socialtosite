const fs = require('fs');
let code = fs.readFileSync('api/index.php', 'utf8');
const insertPoint = code.indexOf("if ($action === 'post-update'");

if (insertPoint > -1) {
    const newEndpoint = `if ($action === 'post-create' && $method === 'POST') {
    $b = body();
    $title = trim((string)($b['edited_title'] ?? ''));
    $body = trim((string)($b['edited_body'] ?? ''));
    
    if ($title === '') jsonError('Titolo mancante');
    
    $draftSlug = slugify($title . '-' . bin2hex(random_bytes(3)));
    $metaDescription = function_exists('mb_substr') ? mb_substr(strip_tags($body), 0, 155, 'UTF-8') : substr(strip_tags($body), 0, 155);
    $contentHash = hash('sha256', $userId . '|manual|' . bin2hex(random_bytes(10)));
    
    $postId = DB::insert(
        'INSERT INTO posts (user_id, platform, platform_post_id, raw_content, generated_title, generated_body, generated_excerpt, tags, meta_description, slug, published_at, imported_at, content_hash, seo_score, published, edited_title, edited_body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, 10, 0, ?, ?)',
        [$userId, 'manual', 'manual_'.bin2hex(random_bytes(5)), '', '', '', '', '[]', $metaDescription, $draftSlug, $contentHash, $title, $body]
    );
    
    json(['ok' => true, 'id' => $postId]);
}

`;
    code = code.substring(0, insertPoint) + newEndpoint + code.substring(insertPoint);
    fs.writeFileSync('api/index.php', code);
    console.log('post-create endpoint added!');
} else {
    console.log('Could not find insert point!');
}
