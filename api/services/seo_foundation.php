<?php

require_once __DIR__ . '/ai.php';

class SeoFoundation {
    private const PAGE_SLUGS = ['chi-siamo', 'cosa-offriamo', 'per-chi', 'domande-frequenti'];
    private const SCHEMA_TYPES = ['Organization', 'LocalBusiness', 'LodgingBusiness', 'Restaurant', 'ProfessionalService', 'Person'];

    public static function ensureSchema(): void {
        static $done = false;
        if ($done) return;
        $done = true;
        foreach ([
            'ALTER TABLE sites ADD COLUMN seo_foundation LONGTEXT NULL',
            'ALTER TABLE sites ADD COLUMN seo_foundation_hash CHAR(64) NULL',
            'ALTER TABLE sites ADD COLUMN seo_foundation_updated_at DATETIME NULL',
        ] as $query) {
            try { DB::execute($query); } catch (Throwable $e) {}
        }
    }

    private static function decode($value): array {
        if (is_array($value)) return $value;
        $decoded = is_string($value) ? json_decode($value, true) : null;
        return is_array($decoded) ? $decoded : [];
    }

    public static function fallback(array $site, array $sources, array $posts, array $understanding = []): array {
        $summary = trim((string)($site['profile_summary'] ?? $site['bio'] ?? ''));
        $mission = trim((string)($site['role_mission'] ?? ''));
        $business = trim((string)($understanding['business_model'] ?? ''));
        $audience = trim((string)($understanding['audience'] ?? ''));
        $pillars = array_values(array_filter($understanding['editorial_direction']['content_pillars'] ?? []));
        $validIds = array_map(static fn($post) => (int)($post['id'] ?? 0), $posts);
        $evidence = array_slice(array_values(array_filter($validIds)), 0, 8);
        $tagEvidence = [];
        foreach ($posts as $post) {
            $tags = self::decode($post['tags'] ?? []);
            foreach ($tags as $tag) {
                $tag = trim((string)$tag);
                if ($tag === '') continue;
                $tagEvidence[$tag] = array_values(array_unique(array_merge($tagEvidence[$tag] ?? [], [(int)($post['id'] ?? 0)])));
            }
        }
        uasort($tagEvidence, static fn($a, $b) => count($b) <=> count($a));
        if (!$pillars && $tagEvidence) $pillars = array_slice(array_keys($tagEvidence), 0, 5);
        $pages = [];

        if ($summary !== '' || $mission !== '') {
            $pages[] = [
                'slug' => 'chi-siamo',
                'title' => 'Chi siamo',
                'meta_description' => mb_substr($summary ?: $mission, 0, 155),
                'intro' => $summary ?: $mission,
                'sections' => $mission !== '' ? [['heading' => 'Il nostro impegno', 'body' => $mission, 'evidence_post_ids' => $evidence]] : [],
                'faq' => [],
            ];
        }
        if ($business !== '' || $pillars) {
            $pages[] = [
                'slug' => 'cosa-offriamo',
                'title' => 'Cosa offriamo',
                'meta_description' => mb_substr($business ?: implode(', ', $pillars), 0, 155),
                'intro' => $business ?: 'Esplora gli argomenti e le esperienze raccontate attraverso i nostri contenuti.',
                'sections' => array_map(static fn($pillar) => ['heading' => $pillar, 'body' => 'Questo tema ricorre nei contenuti pubblicati direttamente dall’attività. Gli approfondimenti collegati permettono di verificarne dettagli e contesto.', 'evidence_post_ids' => array_slice($tagEvidence[$pillar] ?? $evidence, 0, 5)], array_slice($pillars, 0, 5)),
                'faq' => [],
            ];
        }
        if ($audience !== '' && stripos($audience, 'confermare') === false) {
            $pages[] = [
                'slug' => 'per-chi',
                'title' => 'Per chi',
                'meta_description' => mb_substr($audience, 0, 155),
                'intro' => $audience,
                'sections' => [],
                'faq' => [],
            ];
        }
        $vertical = strtolower(trim((string)($understanding['vertical_slug'] ?? $understanding['vertical_label'] ?? '')));
        $businessType = 'Organization';
        if (preg_match('/agritur|hospital|hotel|b&b|resort|lodg/', $vertical)) $businessType = 'LodgingBusiness';
        elseif (preg_match('/ristor|food|trattoria|pizzer/', $vertical)) $businessType = 'Restaurant';
        elseif (preg_match('/profession|consulen|studio|avvocat|medic/', $vertical)) $businessType = 'ProfessionalService';
        return [
            'business_type' => $businessType,
            'summary' => $summary,
            'location' => '',
            'services' => [],
            'audience' => $audience,
            'facts' => [],
            'questions_to_confirm' => array_values(array_filter($understanding['editorial_direction']['critical_unknowns'] ?? [])),
            'pages' => $pages,
            'generated_by' => 'deterministic_fallback',
        ];
    }

    private static function normalize(array $foundation, array $posts, array $fallback): array {
        $validPostIds = array_flip(array_map(static fn($post) => (int)($post['id'] ?? 0), $posts));
        $type = (string)($foundation['business_type'] ?? 'Organization');
        if (!in_array($type, self::SCHEMA_TYPES, true)) $type = 'Organization';
        $normalizedPages = [];
        $seen = [];
        foreach (($foundation['pages'] ?? []) as $page) {
            $slug = strtolower(trim((string)($page['slug'] ?? '')));
            if (!in_array($slug, self::PAGE_SLUGS, true) || isset($seen[$slug])) continue;
            $sections = [];
            foreach (($page['sections'] ?? []) as $section) {
                $ids = array_values(array_filter(array_map('intval', $section['evidence_post_ids'] ?? []), static fn($id) => isset($validPostIds[$id])));
                $body = trim(strip_tags((string)($section['body'] ?? '')));
                if ($body === '' || !$ids) continue;
                $sections[] = ['heading' => trim((string)($section['heading'] ?? 'Approfondimento')), 'body' => $body, 'evidence_post_ids' => $ids];
            }
            $intro = trim(strip_tags((string)($page['intro'] ?? '')));
            if ($intro === '' && !$sections) continue;
            $faq = [];
            foreach (($page['faq'] ?? []) as $item) {
                $ids = array_values(array_filter(array_map('intval', $item['evidence_post_ids'] ?? []), static fn($id) => isset($validPostIds[$id])));
                if (!$ids || trim((string)($item['question'] ?? '')) === '' || trim((string)($item['answer'] ?? '')) === '') continue;
                $faq[] = ['question' => trim($item['question']), 'answer' => trim(strip_tags($item['answer'])), 'evidence_post_ids' => $ids];
            }
            $seen[$slug] = true;
            $normalizedPages[] = [
                'slug' => $slug,
                'title' => trim((string)($page['title'] ?? ucfirst(str_replace('-', ' ', $slug)))),
                'meta_description' => mb_substr(trim(strip_tags((string)($page['meta_description'] ?? $intro))), 0, 155),
                'intro' => $intro,
                'sections' => $sections,
                'faq' => $faq,
            ];
        }
        if (!$normalizedPages) return $fallback;
        $foundation['business_type'] = $type;
        $foundation['pages'] = $normalizedPages;
        $foundation['generated_by'] = 'ai_with_evidence';
        return $foundation;
    }

    public static function cachedOrFallback(int $userId, array $site, array $sources, array $posts): array {
        $understanding = self::decode($site['site_understanding'] ?? null);
        $cached = self::decode($site['seo_foundation'] ?? null);
        return $cached ?: self::fallback($site, $sources, $posts, $understanding);
    }

    public static function rebuild(int $userId, bool $force = false): array {
        self::ensureSchema();
        $site = DB::fetch('SELECT * FROM sites WHERE user_id=?', [$userId]) ?: [];
        $sources = DB::fetchAll('SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY id', [$userId]);
        $posts = DB::fetchAll('SELECT id, generated_title, edited_title, generated_excerpt, edited_excerpt, raw_content, transcript, tags, published_at FROM posts WHERE user_id=? AND published=1 AND seo_score>0 ORDER BY published_at DESC, id DESC LIMIT 50', [$userId]);
        $understanding = self::decode($site['site_understanding'] ?? null);
        $fingerprint = hash('sha256', json_encode([$site['profile_summary'] ?? '', $site['role_mission'] ?? '', $site['content_strategy'] ?? '', $understanding, $sources, array_map(static fn($post) => [$post['id'], $post['generated_title'], $post['tags']], $posts)], JSON_UNESCAPED_UNICODE));
        if (!$force && !empty($site['seo_foundation']) && hash_equals((string)($site['seo_foundation_hash'] ?? ''), $fingerprint)) {
            return self::decode($site['seo_foundation']);
        }
        $fallback = self::fallback($site, $sources, $posts, $understanding);
        $foundation = $fallback;
        if ($posts) {
            try { $foundation = self::normalize(AI::seoFoundation($site, $sources, $posts, $understanding), $posts, $fallback); } catch (Throwable $e) {}
        }
        DB::execute('UPDATE sites SET seo_foundation=?, seo_foundation_hash=?, seo_foundation_updated_at=NOW() WHERE user_id=?', [json_encode($foundation, JSON_UNESCAPED_UNICODE), $fingerprint, $userId]);
        return $foundation;
    }
}
