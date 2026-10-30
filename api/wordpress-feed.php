<?php
// Private machine feed: authentication is independent of the interactive JWT session.
ini_set('display_errors', '0');
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/middleware/response.php';
require_once __DIR__ . '/services/wordpress_bridge.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') jsonError('Metodo non consentito.', 405);
$userId = max(0, (int)($_GET['user_id'] ?? 0));
$token = $_SERVER['HTTP_X_ASTW_FEED'] ?? '';
if (!$userId || !preg_match('/^[a-f0-9]{64}$/', $token)) jsonError('Collegamento non autorizzato.', 401);
try {
    $settings = WordPressBridge::load($userId);
    if (empty($settings['secret']) || !hash_equals(WordPressBridge::feedToken($userId, WordPressBridge::crypt($settings['secret'], true)), $token)) jsonError('Collegamento non autorizzato.', 401);
    if (!DB::fetch('SELECT id FROM users WHERE id=?', [$userId])) jsonError('Collegamento non autorizzato.', 401);
    $filters = ($_GET['browse'] ?? '') === '1' ? ['scope'=>'all'] : ($settings['filters'] ?? []);
    // Older plugins cannot distinguish editable source drafts from finished articles.
    if (($_GET['browse'] ?? '') !== '1' && ($_GET['format'] ?? '') !== 'article-v2') $filters['ready_only'] = true;
    json(WordPressBridge::feed($userId, max(0, (int)($_GET['cursor'] ?? 0)), $filters));
} catch (Throwable $e) {
    error_log('[wordpress-feed] ' . $e->getMessage());
    jsonError('Feed temporaneamente non disponibile.', 503);
}
