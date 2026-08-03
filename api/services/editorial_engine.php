<?php

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/ai.php';

class EditorialEngine {
    private static function defaultSettings(): array {
        return [
            'enabled' => true,
            'auto_run' => true,
            'min_posts' => 8,
            'strict_indexing_mode' => true,
        ];
    }

    public static function getSettings(?string $raw): array {
        $settings = json_decode((string)$raw, true);
        if (!is_array($settings)) $settings = [];
        return array_merge(self::defaultSettings(), $settings);
    }

    public static function saveSettings(int $userId, array $settings): array {
        $merged = array_merge(self::defaultSettings(), $settings);
        DB::execute(
            'UPDATE sites SET editorial_settings=? WHERE user_id=?',
            [json_encode($merged, JSON_UNESCAPED_UNICODE), $userId]
        );
        return $merged;
    }

    public static function getState(int $userId): array {
        $site = DB::fetch(
            'SELECT editorial_dna, editorial_memory, editorial_engine_state, editorial_last_run, editorial_settings
               FROM sites
              WHERE user_id=?',
            [$userId]
        ) ?: [];

        return [
            'settings' => self::getSettings($site['editorial_settings'] ?? ''),
            'dna' => json_decode((string)($site['editorial_dna'] ?? ''), true) ?: [],
            'memory' => json_decode((string)($site['editorial_memory'] ?? ''), true) ?: [],
            'state' => json_decode((string)($site['editorial_engine_state'] ?? ''), true) ?: [],
            'last_run' => $site['editorial_last_run'] ?? null,
        ];
    }

    public static function run(int $userId, array $overrides = []): array {
        $site = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]);
        if (!$site) throw new Exception('Sito non trovato');

        $settings = self::getSettings($site['editorial_settings'] ?? '');
        $settings = array_merge($settings, $overrides);
        if (empty($settings['enabled'])) {
            return [
                'ok' => false,
                'skipped' => true,
                'reason' => 'Motore editoriale disattivato',
                'settings' => $settings,
            ];
        }

        $posts = DB::fetchAll(
            'SELECT id, generated_title, generated_excerpt, generated_body, edited_title, edited_excerpt, edited_body, tags, seo_score, slug, published_at
               FROM posts
              WHERE user_id=?
                AND published=1
                AND seo_score >= 0
              ORDER BY published_at DESC, id DESC
              LIMIT 60',
            [$userId]
        );

        if (count($posts) < max(3, (int)($settings['min_posts'] ?? 8))) {
            $state = [
                'status' => 'waiting_content',
                'reason' => 'Contenuti pubblicati insufficienti per un orchestration utile',
                'published_posts' => count($posts),
                'required_posts' => (int)($settings['min_posts'] ?? 8),
                'updated_at' => date('Y-m-d H:i:s'),
            ];
            DB::execute(
                'UPDATE sites SET editorial_engine_state=?, editorial_last_run=NOW() WHERE user_id=?',
                [json_encode($state, JSON_UNESCAPED_UNICODE), $userId]
            );
            return ['ok' => true, 'skipped' => true, 'state' => $state, 'settings' => $settings];
        }

        $sources = DB::fetchAll(
            'SELECT platform, label, url, topic_summary
               FROM social_sources
              WHERE user_id=?
                AND active=1
              ORDER BY platform, id',
            [$userId]
        );

        $existingDna = json_decode((string)($site['editorial_dna'] ?? ''), true) ?: [];
        $existingMemory = json_decode((string)($site['editorial_memory'] ?? ''), true) ?: [];
        $analysis = AI::editorialEngineBlueprint($site, $sources, $posts, $existingDna, $existingMemory, $settings);

        $dna = $analysis['editorial_dna'] ?? [];
        $memory = $analysis['editorial_memory'] ?? [];
        $state = $analysis['editorial_state'] ?? [];
        $featuredPostId = (int)($state['featured_post_id'] ?? 0);

        DB::execute(
            'UPDATE sites
                SET editorial_dna=?,
                    editorial_memory=?,
                    editorial_engine_state=?,
                    editorial_last_run=NOW(),
                    editorial_settings=?
              WHERE user_id=?',
            [
                json_encode($dna, JSON_UNESCAPED_UNICODE),
                json_encode($memory, JSON_UNESCAPED_UNICODE),
                json_encode($state, JSON_UNESCAPED_UNICODE),
                json_encode($settings, JSON_UNESCAPED_UNICODE),
                $userId,
            ]
        );

        if ($featuredPostId > 0) {
            DB::execute('UPDATE posts SET featured=0 WHERE user_id=?', [$userId]);
            DB::execute('UPDATE posts SET featured=1 WHERE user_id=? AND id=?', [$userId, $featuredPostId]);
        }

        return [
            'ok' => true,
            'settings' => $settings,
            'editorial_dna' => $dna,
            'editorial_memory' => $memory,
            'editorial_state' => $state,
        ];
    }
}
