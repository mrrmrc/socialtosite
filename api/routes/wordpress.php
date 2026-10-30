<?php
// Included only after the user's JWT and current database identity are verified.
require_once __DIR__ . '/../services/wordpress_bridge.php';
header('Cache-Control: no-store');
try {
    $settings = WordPressBridge::load($userId);
    if ($action === 'wordpress-status' && $method === 'GET') {
        json(['connected'=>!empty($settings['secret']), 'endpoint'=>$settings['endpoint'] ?? '', 'topics'=>WordPressBridge::topics($userId)]);
    }
    if ($method !== 'POST') jsonError('Metodo non consentito.', 405);
    $input = body();
    if ($action === 'wordpress-connect') {
        $endpoint = PublicationSecurity::endpoint((string)($input['endpoint'] ?? ''));
        $secret = (string)($input['secret'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $secret)) throw new DomainException('Inserisci il codice generato dal plugin WordPress.');
        $candidate = ['endpoint'=>$endpoint, 'secret'=>WordPressBridge::crypt($secret)];
        $health = WordPressBridge::remote($candidate, 'GET', '/health');
        if (empty($health['sync_available'])) throw new DomainException('Installa il plugin AllSocialToWeb versione 0.2.0 o successiva.');
        WordPressBridge::save($userId, $candidate);
        json(['ok'=>true, 'endpoint'=>$endpoint] + $health);
    }
    if ($action === 'wordpress-taxonomies') json(WordPressBridge::remote($settings, 'GET', '/health'));
    if ($action === 'wordpress-settings') {
        $base = app_base_url();
        if (!str_starts_with($base, 'https://')) throw new DomainException('La sincronizzazione automatica WordPress richiede un indirizzo HTTPS della piattaforma.');
        $payload = [
            'feed_url'=>$base . '/api/wordpress-feed.php?user_id=' . $userId,
            'feed_token'=>WordPressBridge::feedToken($userId, WordPressBridge::crypt($settings['secret'], true)),
            'enabled'=>!empty($input['enabled']),
            'post_status'=>($input['post_status'] ?? '') === 'publish' ? 'publish' : 'draft',
            'category_id'=>(int)($input['category_id'] ?? 0),
            'mappings'=>$input['mappings'] ?? [],
        ];
        json(WordPressBridge::remote($settings, 'POST', '/sync-settings', $payload));
    }
    if ($action === 'wordpress-sync') json(WordPressBridge::remote($settings, 'POST', '/sync-now', []));
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
