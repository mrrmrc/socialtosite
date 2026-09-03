<?php
// api/routes/upload.php
// Eseguito dal router in index.php per gestire i caricamenti multimediali.

// ── POST site-logo-upload ───────────────────────────────────────────────────
// Logo del brand: usato solo quando i canali social non restituiscono una foto profilo valida
// o quando l'utente vuole sostituire quella recuperata automaticamente.
if ($action === 'site-logo-upload' && $method === 'POST') {
    ensureSiteSchemaUpgrades();
    $b = body();
    $dataUrl = trim((string)($b['data_url'] ?? ''));
    if (!preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$~', $dataUrl, $matches)) {
        jsonError('Formato logo non valido. Usa JPG, PNG o WebP.', 422);
    }
    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);
    if ($binary === false || strlen($binary) < 32) jsonError('Il file del logo è vuoto o danneggiato.', 422);
    if (strlen($binary) > 3 * 1024 * 1024) jsonError('Il logo deve pesare meno di 3 MB.', 413);

    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary) ?: '';
    $extension = match ($mime) {
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        default => '',
    };
    if ($extension === '') jsonError('Il contenuto del file non è un’immagine supportata.', 422);

    $directory = __DIR__ . '/../../public/media';
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) jsonError('Impossibile preparare la cartella del logo.', 500);
    $filename = 'brand_logo_' . $userId . '_' . date('YmdHis') . '.' . $extension;
    $path = $directory . '/' . $filename;
    if (@file_put_contents($path, $binary, LOCK_EX) === false) jsonError('Impossibile salvare il logo.', 500);

    $logoUrl = '/public/media/' . $filename;
    DB::execute("UPDATE sites SET logo_url=?, brand_visual_mode='logo' WHERE user_id=?", [$logoUrl, $userId]);
    json(['ok' => true, 'logo_url' => $logoUrl, 'brand_visual_mode' => 'logo']);
}

// ── POST site-visual-upload ─────────────────────────────────────────────────
// Identità visiva scelta dall'utente: marchio compatto oppure immagine
// rappresentativa. Il tipo selezionato governa anche il sito pubblico.
if ($action === 'site-visual-upload' && $method === 'POST') {
    ensureSiteSchemaUpgrades();
    $b = body();
    $kind = ($b['kind'] ?? '') === 'cover' ? 'cover' : 'logo';
    $dataUrl = trim((string)($b['data_url'] ?? ''));
    if (!preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$~', $dataUrl, $matches)) {
        jsonError('Formato immagine non valido. Usa JPG, PNG o WebP.', 422);
    }
    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);
    if ($binary === false || strlen($binary) < 32) jsonError('Il file è vuoto o danneggiato.', 422);
    $maxBytes = $kind === 'cover' ? 8 * 1024 * 1024 : 3 * 1024 * 1024;
    if (strlen($binary) > $maxBytes) jsonError($kind === 'cover' ? 'L’immagine deve pesare meno di 8 MB.' : 'Il logo deve pesare meno di 3 MB.', 413);

    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary) ?: '';
    $extension = match ($mime) {
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', default => '',
    };
    if ($extension === '') jsonError('Il contenuto del file non è un’immagine supportata.', 422);

    $directory = __DIR__ . '/../../public/media';
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) jsonError('Impossibile preparare la cartella immagini.', 500);
    $filename = ($kind === 'cover' ? 'brand_image_' : 'brand_logo_') . $userId . '_' . date('YmdHis') . '.' . $extension;
    if (@file_put_contents($directory . '/' . $filename, $binary, LOCK_EX) === false) jsonError('Impossibile salvare l’immagine.', 500);

    $url = '/public/media/' . $filename;
    $column = $kind === 'cover' ? 'cover_url' : 'logo_url';
    DB::execute("UPDATE sites SET `$column`=?, brand_visual_mode=? WHERE user_id=?", [$url, $kind, $userId]);
    json(['ok'=>true, 'kind'=>$kind, 'url'=>$url, 'logo_url'=>$kind === 'logo' ? $url : null, 'cover_url'=>$kind === 'cover' ? $url : null, 'brand_visual_mode'=>$kind]);
}

// ── POST post-media-upload ──────────────────────────────────────────────────
if ($action === 'post-media-upload' && $method === 'POST') {
    ensurePostMediaSchema();
    $b = body();
    $postId = (int)($b['post_id'] ?? 0);
    $dataUrl = trim((string)($b['data_url'] ?? ''));
    if (!$postId || !DB::fetch('SELECT id FROM posts WHERE id=? AND user_id=?', [$postId, $userId])) jsonError('Articolo non valido', 404);
    if (!preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$~', $dataUrl, $matches)) jsonError('Formato immagine non valido. Usa JPG, PNG o WebP.', 422);
    $binary = base64_decode(preg_replace('/\s+/', '', $matches[2]), true);
    if ($binary === false || strlen($binary) < 32) jsonError('Immagine vuota o danneggiata', 422);
    if (strlen($binary) > 8 * 1024 * 1024) jsonError('L’immagine deve pesare meno di 8 MB', 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary) ?: '';
    $extension = match ($mime) { 'image/jpeg'=>'jpg', 'image/png'=>'png', 'image/webp'=>'webp', default=>'' };
    if ($extension === '') jsonError('Il file caricato non è un’immagine supportata', 422);
    $directory = __DIR__ . '/../../public/media';
    if (!is_dir($directory) && !@mkdir($directory, 0775, true)) jsonError('Impossibile preparare la cartella media', 500);
    $filename = 'article_' . $userId . '_' . $postId . '_' . date('YmdHis') . '.' . $extension;
    if (@file_put_contents($directory . '/' . $filename, $binary, LOCK_EX) === false) jsonError('Impossibile salvare l’immagine', 500);
    $mediaUrl = '/public/media/' . $filename;
    json(['ok'=>true, 'media_url'=>$mediaUrl, 'media_type'=>'IMAGE']);
}
