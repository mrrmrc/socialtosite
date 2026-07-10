<?php
// api/routes/openclaw_webhook.php
// Endpoint per ricevere i post elaborati da OpenClaw

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../middleware/response.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) {
    require_once __DIR__ . '/../middleware/logger.php';
}

// 1. Lettura Payload JSON
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data) {
    Response::error(400, "Payload JSON non valido");
}

// 2. Verifica Sicurezza
// Definisci OPENCLAW_API_KEY nel tuo config.php o keys.php
$expectedKey = defined('OPENCLAW_API_KEY') ? OPENCLAW_API_KEY : 'TEST_KEY_123'; // Fallback per il test

$providedKey = $data['api_key'] ?? '';
if ($providedKey !== $expectedKey) {
    if (class_exists('Logger')) Logger::error('openclaw', 'Tentativo accesso negato', ['ip' => $_SERVER['REMOTE_ADDR']]);
    Response::error(401, "Non autorizzato");
}

// 3. Estrazione e Validazione Campi Base
$userId    = (int)($data['user_id'] ?? 0);
$sourceUrl = trim($data['source_url'] ?? '');
$platform  = trim($data['platform'] ?? 'website');

if (!$userId || !$sourceUrl) {
    Response::error(400, "Parametri obbligatori mancanti (user_id, source_url)");
}

// 4. Estrazione Contenuto Armonizzato
$title      = trim($data['title'] ?? '');
$body       = trim($data['body'] ?? '');
$excerpt    = trim($data['excerpt'] ?? '');
$tags       = isset($data['tags']) && is_array($data['tags']) ? json_encode($data['tags']) : '[]';
$mediaUrl   = trim($data['media_url'] ?? '');
$mediaType  = trim($data['media_type'] ?? 'text');
$metaDesc   = trim($data['meta_description'] ?? $excerpt);

// 5. Gestione Duplicati
// Controlliamo se esiste già un post pubblicato con questo URL
$existing = DB::fetch('SELECT id, published FROM posts WHERE user_id=? AND source_url=?', [$userId, $sourceUrl]);
if ($existing) {
    if ((int)$existing['published'] === 1) {
        if (class_exists('Logger')) Logger::info('openclaw', 'Post duplicato (già online)', ['url' => $sourceUrl]);
        Response::success(["message" => "Post già esistente e pubblicato", "post_id" => $existing['id'], "duplicate" => true]);
    } else {
        // Se c'è una bozza, aggiorniamo quella anziché crearne una nuova
        $postId = $existing['id'];
        DB::execute('
            UPDATE posts SET 
                generated_title=?, generated_body=?, generated_excerpt=?, 
                tags=?, meta_description=?, seo_score=100, published=1, 
                media_url=?, media_type=?, platform=?
            WHERE id=?
        ', [
            $title, $body, $excerpt, $tags, $metaDesc,
            $mediaUrl, $mediaType, $platform, $postId
        ]);
        if (class_exists('Logger')) Logger::info('openclaw', 'Bozza aggiornata con successo', ['post_id' => $postId]);
        Response::success(["message" => "Post aggiornato con successo", "post_id" => $postId, "updated" => true]);
    }
}

// 6. Inserimento Nuovo Post
// Generiamo un platform_post_id "fake" o usiamo quello di OpenClaw se fornito
$platformPostId = $data['platform_post_id'] ?? substr(md5($sourceUrl), 0, 24);

// Calcoliamo un content_hash di massima per consistenza strutturale col DB
$contentHash = hash('sha256', mb_substr(strip_tags($body), 0, 4000));

// Creiamo lo slug
$slugText = $title !== '' ? $title : (string)time();
$slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $slugText), '-'));

$postId = DB::insert('
    INSERT INTO posts 
      (user_id, platform, platform_post_id, raw_content, transcript, 
       generated_title, generated_body, generated_excerpt, tags, meta_description, 
       media_url, media_type, source_url, published_at, imported_at, 
       content_hash, seo_score, slug, published, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, 100, ?, 1, 0)
', [
    $userId, $platform, $platformPostId, 
    'Generato da OpenClaw', '', // raw_content e transcript non servono se body è già pronto
    $title, $body, $excerpt, $tags, $metaDesc,
    $mediaUrl, $mediaType, $sourceUrl, 
    $contentHash, $slug
]);

if (class_exists('Logger')) Logger::info('openclaw', 'Nuovo post pubblicato', ['post_id' => $postId, 'url' => $sourceUrl]);

Response::success([
    "message" => "Post importato e pubblicato con successo", 
    "post_id" => $postId,
    "inserted" => true
]);
