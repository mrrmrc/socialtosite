<?php
// Incluso esclusivamente dopo JWT e risoluzione del proprietario in index.php.
require_once __DIR__ . '/../services/publication/service.php';
if ($action === 'publication-capabilities' && $method === 'GET') {
    try { PublicationService::authorize($userId); json(['enabled'=>true,'providers'=>['wordpress']]); }
    catch (Throwable $e) { json(['enabled'=>false,'providers'=>[]]); }
}
try {
    PublicationService::authorize($userId);
    if ($action === 'publication-list' && $method === 'GET') {
        json([
            'sites' => DB::fetchAll('SELECT id,title FROM sites WHERE user_id=?', [$userId]),
            'connections' => DB::fetchAll('SELECT id,site_id,provider,label,endpoint,status FROM publication_connections WHERE user_id=?', [$userId]),
            'jobs' => DB::fetchAll('SELECT id,connection_id,post_id,state,action,attempts,remote_url,last_error,created_at FROM publication_jobs WHERE user_id=? ORDER BY id DESC LIMIT 100', [$userId]),
            'posts' => DB::fetchAll('SELECT id,COALESCE(edited_title,generated_title) title FROM posts WHERE user_id=? AND published=0 AND seo_score>=0 ORDER BY id DESC LIMIT 100', [$userId]),
        ]);
    }
    if ($method !== 'POST') jsonError('Metodo non consentito', 405);
    $input = body();
    if ($action === 'publication-categories') {
        $connection = PublicationService::connection($userId, (int)($input['connection_id'] ?? 0));
        if ($connection['status'] !== 'connected') throw new DomainException('Collegamento non attivo.');
        json(WordPressPublicationAdapter::request($connection, 'GET', '/health'));
    }
    if ($action === 'publication-connect') json(['id' => PublicationService::connect($userId, $input)]);
    if ($action === 'publication-queue') {
        if (($input['confirmed'] ?? false) !== true) throw new DomainException('Confermare il contenuto e la destinazione.');
        json(['id' => PublicationService::queue($userId, (int)($input['connection_id'] ?? 0), (int)($input['post_id'] ?? 0), (int)($input['category_id'] ?? 0), isset($input['image']) && is_array($input['image']) ? $input['image'] : null)]);
    }
    if ($action === 'publication-disconnect') {
        $connection = PublicationService::connection($userId, (int)($input['connection_id'] ?? 0));
        DB::execute("UPDATE publication_connections SET status='disconnected',secret_ciphertext='' WHERE id=? AND user_id=?", [$connection['id'], $userId]);
        DB::execute("UPDATE publication_jobs SET state='cancelled' WHERE connection_id=? AND user_id=? AND state IN ('queued','failed','uncertain')", [$connection['id'], $userId]);
        json(['ok' => true]);
    }
    if (in_array($action, ['publication-retry', 'publication-publish'], true)) {
        if (($input['confirmed'] ?? false) !== true) throw new DomainException('Conferma richiesta.');
        PublicationService::transition($userId, (int)($input['job_id'] ?? 0), $action === 'publication-publish' ? 'publish' : 'retry');
        json(['ok' => true]);
    }
    jsonError('Azione non disponibile', 404);
} catch (DomainException | InvalidArgumentException $e) { jsonError($e->getMessage(), 422); }
catch (Throwable $e) { jsonError('Connettori non disponibili: verificare migrazione e configurazione del pilota.', 503); }
