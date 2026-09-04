<?php

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/ingest.php';

/** Orchestra tutte le sorgenti attraverso il solo motore di ingestione URL. */
final class Sync {
    public static function ensureAutoSyncSchema(): void {
        static $done = false;
        if ($done) return;
        $done = true;
        try {
            $columns = [];
            foreach (DB::fetchAll('SHOW COLUMNS FROM social_sources') as $column) $columns[$column['Field']] = true;
            if (!isset($columns['auto_sync'])) DB::execute('ALTER TABLE social_sources ADD COLUMN auto_sync TINYINT NOT NULL DEFAULT 1');
        } catch (Throwable $e) {}
    }

    private static function logResult(int $userId, array $result): void {
        try {
            DB::execute(
                'INSERT INTO sync_log (user_id,platform,status,posts_found,posts_new,error,ran_at) VALUES (?,?,?,?,?,?,NOW())',
                [
                    $userId,
                    (string)($result['platform'] ?? ''),
                    empty($result['error']) ? 'success' : 'error',
                    (int)($result['found'] ?? 0),
                    (int)($result['new'] ?? 0),
                    $result['error'] ?? null,
                ]
            );
        } catch (Throwable $e) {}
    }

    public static function syncUser(int $userId, int $maxPosts = 20, ?string $sinceDate = null, bool $automatic = false): array {
        self::ensureAutoSyncSchema();
        $sql = 'SELECT id, platform FROM social_sources WHERE user_id=? AND active=1';
        if ($automatic) $sql .= ' AND auto_sync=1';
        $sources = DB::fetchAll($sql . ' ORDER BY id', [$userId]);
        $results = [];

        foreach ($sources as $source) {
            $platform = (string)$source['platform'];
            try {
                if (function_exists('setSyncStatus')) setSyncStatus($userId, 'Aggiornamento ' . ucfirst($platform) . ' tramite Refetch(er)…');
                $report = Ingest::scanSources($userId, $maxPosts, '', '', '', (int)$source['id'], $sinceDate);
                $result = [
                    'platform' => $platform,
                    'found' => (int)($report['found'] ?? 0),
                    'new' => (int)($report['imported'] ?? 0),
                    'duplicates' => (int)($report['duplicates'] ?? 0),
                    'error' => !empty($report['errors']) ? implode(' | ', $report['errors']) : null,
                    'debug' => $report['debug'] ?? [],
                ];
            } catch (Throwable $e) {
                $result = ['platform' => $platform, 'found' => 0, 'new' => 0, 'duplicates' => 0, 'error' => mb_substr($e->getMessage(), 0, 1500)];
            }
            $results[] = $result;
            self::logResult($userId, $result);
        }

        try {
            $site = DB::fetch('SELECT cover_url FROM sites WHERE user_id=?', [$userId]);
            if (empty($site['cover_url'])) {
                $latestImage = DB::fetch("SELECT media_url FROM posts WHERE user_id=? AND UPPER(media_type)='IMAGE' AND media_url<>'' ORDER BY published_at DESC LIMIT 1", [$userId]);
                if (!empty($latestImage['media_url'])) DB::execute('UPDATE sites SET cover_url=? WHERE user_id=?', [$latestImage['media_url'], $userId]);
            }
            $score = DB::fetch('SELECT AVG(seo_score) average FROM posts WHERE user_id=? AND published=1 AND seo_score>=0', [$userId]);
            DB::execute('UPDATE sites SET last_sync=NOW(), seo_score=? WHERE user_id=?', [round((float)($score['average'] ?? 0)), $userId]);
        } catch (Throwable $e) {}

        if (function_exists('setSyncStatus')) setSyncStatus($userId, 'Sincronizzazione completata.');
        return $results;
    }
}
