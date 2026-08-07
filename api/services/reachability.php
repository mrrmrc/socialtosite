<?php

class ReachabilityNetwork {
    private static bool $schemaReady = false;

    public static function ensureSchema(): void {
        if (self::$schemaReady) return;
        self::$schemaReady = true;
        foreach ([
            'ALTER TABLE sites ADD COLUMN reachability_profile LONGTEXT NULL',
            'ALTER TABLE sites ADD COLUMN reachability_updated_at DATETIME NULL',
        ] as $query) {
            try { DB::execute($query); } catch (Throwable $e) {}
        }
    }

    private static function url(string $value): string {
        $value = trim($value);
        if ($value === '') return '';
        if (!preg_match('~^https?://~i', $value)) $value = 'https://' . $value;
        if (!filter_var($value, FILTER_VALIDATE_URL)) return '';
        $parts = parse_url($value);
        if (!in_array(strtolower((string)($parts['scheme'] ?? '')), ['http', 'https'], true)) return '';
        return rtrim($value, '/');
    }

    public static function decode($value): array {
        if (is_array($value)) return $value;
        if (!is_string($value) || trim($value) === '') return [];
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function normalize(array $input): array {
        $areas = $input['service_areas'] ?? [];
        if (is_string($areas)) $areas = preg_split('/[\r\n,]+/', $areas);
        $areas = array_values(array_unique(array_filter(array_map(
            static fn($item) => mb_substr(trim((string)$item), 0, 100),
            is_array($areas) ? $areas : []
        ))));
        return [
            'official_site_url' => self::url((string)($input['official_site_url'] ?? '')),
            'business_profile_url' => self::url((string)($input['business_profile_url'] ?? '')),
            'primary_topic' => mb_substr(trim((string)($input['primary_topic'] ?? '')), 0, 180),
            'service_areas' => array_slice($areas, 0, 12),
            'reciprocal_link_confirmed' => !empty($input['reciprocal_link_confirmed']),
        ];
    }

    public static function update(int $userId, array $input): array {
        self::ensureSchema();
        $profile = self::normalize($input);
        DB::execute(
            'UPDATE sites SET reachability_profile=?, reachability_updated_at=NOW() WHERE user_id=?',
            [json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $userId]
        );
        return $profile;
    }

    public static function summary(int $userId, array $site, array $sources, array $posts, array $visibility): array {
        self::ensureSchema();
        $profile = self::normalize(self::decode($site['reachability_profile'] ?? null));
        if ($profile['official_site_url'] === '') {
            foreach ($sources as $source) {
                if (strtolower((string)($source['platform'] ?? '')) !== 'website') continue;
                $profile['official_site_url'] = self::url((string)($source['url'] ?? ''));
                if ($profile['official_site_url'] !== '') break;
            }
        }
        $published = array_values(array_filter($posts, static fn($post) => (int)($post['published'] ?? 0) === 1));
        $mediaCount = count(array_filter($published, static fn($post) => trim((string)($post['media_url'] ?? '')) !== ''));
        $hasSearchEvidence = (int)($visibility['google_visible_pages'] ?? 0) > 0 || (int)($visibility['impressions'] ?? 0) > 0;
        $hasOfficialSite = $profile['official_site_url'] !== '';
        $hasGsc = trim((string)($site['gsc_verification'] ?? '')) !== '' || !empty($visibility['latest_search_date']);

        $checks = [
            ['id'=>'space', 'label'=>'Spazio Vivo pubblicato', 'done'=>count($published) > 0, 'weight'=>15, 'detail'=>count($published) . ' contenuti pubblicati'],
            ['id'=>'sources', 'label'=>'Canali ufficiali collegati', 'done'=>count($sources) > 0, 'weight'=>10, 'detail'=>count($sources) . ' fonti attive'],
            ['id'=>'official_site', 'label'=>'Sito ufficiale identificato', 'done'=>$hasOfficialSite, 'weight'=>15, 'detail'=>$hasOfficialSite ? $profile['official_site_url'] : 'Da collegare'],
            ['id'=>'reciprocal', 'label'=>'Collegamento reciproco', 'done'=>$hasOfficialSite && $profile['reciprocal_link_confirmed'], 'weight'=>10, 'detail'=>$profile['reciprocal_link_confirmed'] ? 'Confermato' : 'Inserisci dal sito un link allo Spazio Vivo'],
            ['id'=>'structured', 'label'=>'Identità e dati strutturati', 'done'=>true, 'weight'=>10, 'detail'=>'Organization/LocalBusiness e fonti ufficiali'],
            ['id'=>'sitemap', 'label'=>'Sitemap e archivio crawlable', 'done'=>count($published) > 0, 'weight'=>10, 'detail'=>'Pagine e immagini segnalate ai crawler'],
            ['id'=>'gsc', 'label'=>'Controllo Google attivo', 'done'=>$hasGsc, 'weight'=>10, 'detail'=>$hasGsc ? 'Search Console collegata o rilevata' : 'Verifica Search Console da completare'],
            ['id'=>'discovered', 'label'=>'Presenza rilevata nelle ricerche', 'done'=>$hasSearchEvidence, 'weight'=>15, 'detail'=>$hasSearchEvidence ? ((int)($visibility['google_visible_pages'] ?? 0) . ' pagine con impression') : 'In attesa dei primi dati Google'],
            ['id'=>'media', 'label'=>'Patrimonio visuale reperibile', 'done'=>$mediaCount > 0, 'weight'=>5, 'detail'=>$mediaCount . ' immagini o video collegati'],
        ];
        $score = array_sum(array_map(static fn($check) => $check['done'] ? $check['weight'] : 0, $checks));
        $stage = $hasSearchEvidence ? 'rilevato' : ($hasGsc ? 'monitorato' : (count($published) > 0 ? 'pubblicato' : 'configurazione'));

        return [
            'profile' => $profile,
            'score' => $score,
            'stage' => $stage,
            'checks' => $checks,
            'published_pages' => (int)($visibility['published_pages'] ?? count($published) + 1),
            'google_visible_pages' => (int)($visibility['google_visible_pages'] ?? 0),
            'impressions' => (int)($visibility['impressions'] ?? 0),
            'clicks' => (int)($visibility['clicks'] ?? 0),
            'visits' => (int)($visibility['unique_visitors'] ?? 0),
            'actions' => (int)($visibility['actions'] ?? 0),
            'updated_at' => $site['reachability_updated_at'] ?? null,
        ];
    }
}
