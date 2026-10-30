<?php
// Included only after the user's JWT and current database identity are verified.
require_once __DIR__ . '/../services/wordpress_bridge.php';
header('Cache-Control: no-store');
try {
    $settings = WordPressBridge::load($userId);
    if ($action === 'wordpress-status' && $method === 'GET') {
        json(['connected'=>!empty($settings['secret']), 'endpoint'=>$settings['endpoint'] ?? '', 'topics'=>WordPressBridge::topics($userId), 'filters'=>WordPressBridge::filters($settings['filters'] ?? ['scope'=>'all']), 'archive'=>WordPressBridge::archive($userId)]);
    }
    if ($action === 'wordpress-taxonomies' && in_array($method, ['GET','POST'], true)) json(WordPressBridge::remote($settings, 'GET', '/health'));
    if ($action === 'wordpress-library' && $method === 'GET') {
        $page = WordPressBridge::feed($userId, max(0, (int)($_GET['cursor'] ?? 0)), ['scope'=>'all']);
        $page['posts'] = array_map(static function ($post) { unset($post['html']); return $post; }, $page['posts']);
        json($page);
    }
    if ($method !== 'POST') jsonError('Metodo non consentito.', 405);
    $input = body();
    if ($action === 'wordpress-connect') {
        $endpoint = PublicationSecurity::endpoint((string)($input['endpoint'] ?? ''));
        $secret = (string)($input['secret'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $secret)) throw new DomainException('Inserisci il codice generato dal plugin WordPress.');
        $candidate = ['endpoint'=>$endpoint, 'secret'=>WordPressBridge::crypt($secret), 'filters'=>WordPressBridge::filters(['scope'=>'all'])];
        $health = WordPressBridge::remote($candidate, 'GET', '/health');
        if (empty($health['sync_available'])) throw new DomainException('Installa il plugin AllSocialToWeb versione 0.3.0 o successiva.');
        WordPressBridge::save($userId, $candidate);
        json(['ok'=>true, 'endpoint'=>$endpoint] + $health);
    }
    if ($action === 'wordpress-settings') {
        $base = app_base_url();
        if (!str_starts_with($base, 'https://')) throw new DomainException('La sincronizzazione automatica WordPress richiede un indirizzo HTTPS della piattaforma.');
        $filters = WordPressBridge::filters(is_array($input['filters'] ?? null) ? $input['filters'] : []);
        $payload = [
            'feed_url'=>$base . '/api/wordpress-feed.php?user_id=' . $userId,
            'feed_token'=>WordPressBridge::feedToken($userId, WordPressBridge::crypt($settings['secret'], true)),
            'enabled'=>!empty($input['enabled']),
            'post_status'=>($input['post_status'] ?? '') === 'publish' ? 'publish' : 'draft',
            'category_id'=>(int)($input['category_id'] ?? 0),
            'mappings'=>$input['mappings'] ?? [],
            'filters'=>$filters,
        ];
        $result = WordPressBridge::remote($settings, 'POST', '/sync-settings', $payload);
        if (empty($result['archive_available'])) throw new DomainException('Aggiorna il plugin WordPress alla versione 0.3.0 per collegare tutto l’archivio.');
        $settings['filters'] = $filters;
        WordPressBridge::save($userId, $settings);
        json($result);
    }
    if ($action === 'wordpress-sync') json(WordPressBridge::remote($settings, 'POST', '/sync-now', ['restart'=>!empty($input['restart'])]));
    if ($action === 'wordpress-disconnect') {
        // Local credential removal immediately revokes the private feed, even if WP is offline.
        WordPressBridge::save($userId, []);
        json(['ok'=>true]);
    }
    jsonError('Azione non disponibile.', 404);
} catch (DomainException | InvalidArgumentException $e) { jsonError($e->getMessage(), 422); }
catch (Throwable $e) {
    error_log('[wordpress-bridge] ' . $e->getMessage());
    jsonError('WordPress non raggiungibile: verifica indirizzo HTTPS, plugin attivo e codice di collegamento.', 502);
}
