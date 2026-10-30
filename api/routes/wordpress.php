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
        $sameSite = ($settings['endpoint'] ?? '') === $endpoint;
        $candidate = ['endpoint'=>$endpoint, 'secret'=>WordPressBridge::crypt($secret), 'filters'=>WordPressBridge::filters($sameSite ? ($settings['filters'] ?? ['scope'=>'all']) : ['scope'=>'all'])];
        $health = WordPressBridge::remote($candidate, 'GET', '/health');
        if (empty($health['sync_available'])) throw new DomainException('Installa il plugin AllSocialToWeb versione 0.3.0 o successiva.');
        $options = array_merge($sameSite ? ($settings['preferences'] ?? []) : [], $health['settings'] ?? [], ['filters'=>$candidate['filters']]);
        $configured = WordPressBridge::configure($userId, $candidate, $options);
        $candidate['preferences'] = $configured['settings'] ?? $options;
        WordPressBridge::save($userId, $candidate);
        json(array_merge($health, $configured, ['ok'=>true, 'ready'=>true, 'endpoint'=>$endpoint]));
    }
    if ($action === 'wordpress-prepare') {
        $health = WordPressBridge::remote($settings, 'GET', '/health');
        if (!WordPressBridge::ready($health)) {
            $options = array_merge($settings['preferences'] ?? [], $health['settings'] ?? [], ['filters'=>$settings['filters'] ?? ['scope'=>'all']]);
            $configured = WordPressBridge::configure($userId, $settings, $options);
            $settings['filters'] = $configured['settings']['filters'] ?? WordPressBridge::filters($options['filters']);
            $settings['preferences'] = $configured['settings'] ?? $options;
            WordPressBridge::save($userId, $settings);
            $health = array_merge($health, $configured);
        }
        json(array_merge($health, ['ready'=>true]));
    }
    if ($action === 'wordpress-settings') {
        $filters = WordPressBridge::filters(is_array($input['filters'] ?? null) ? $input['filters'] : []);
        $result = WordPressBridge::configure($userId, $settings, array_merge($input, ['filters'=>$filters]));
        $settings['filters'] = $filters;
        $settings['preferences'] = $result['settings'] ?? $input;
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
