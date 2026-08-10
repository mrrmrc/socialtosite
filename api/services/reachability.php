<?php

class ReachabilityNetwork {
    private static bool $schemaReady = false;

    public static function ensureSchema(): void {
        if (self::$schemaReady) return;
        self::$schemaReady = true;
        $existing = [];
        try { foreach (DB::fetchAll('SHOW COLUMNS FROM sites') as $column) $existing[$column['Field']] = true; } catch (Throwable $e) { return; }
        foreach (['reachability_profile'=>'LONGTEXT NULL','reachability_updated_at'=>'DATETIME NULL'] as $column => $definition) {
            if (isset($existing[$column])) continue;
            try { DB::execute("ALTER TABLE sites ADD COLUMN `$column` $definition"); } catch (Throwable $e) {}
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

    /** Numero pronto per un link tel: — tiene cifre e prefisso internazionale. */
    private static function phone(string $value): string {
        $value = trim($value);
        if ($value === '') return '';
        $plus = str_starts_with($value, '+');
        $digits = preg_replace('/\D+/', '', $value) ?? '';
        if (strlen($digits) < 6 || strlen($digits) > 15) return '';
        return ($plus ? '+' : '') . $digits;
    }

    /** wa.me vuole solo cifre con prefisso paese, senza + e senza spazi. */
    private static function whatsapp(string $value): string {
        $digits = preg_replace('/\D+/', '', trim($value)) ?? '';
        if (strlen($digits) < 8 || strlen($digits) > 15) return '';
        // Numero italiano scritto senza prefisso: lo completiamo, altrimenti
        // wa.me apre una chat verso un numero inesistente.
        if (strlen($digits) === 10 && str_starts_with($digits, '3')) $digits = '39' . $digits;
        return $digits;
    }

    private static function email(string $value): string {
        $value = trim($value);
        return filter_var($value, FILTER_VALIDATE_EMAIL) ? mb_substr($value, 0, 190) : '';
    }

    public static function normalize(array $input): array {
        $areas = $input['service_areas'] ?? [];
        if (is_string($areas)) $areas = preg_split('/[\r\n,]+/', $areas);
        $areas = array_values(array_unique(array_filter(array_map(
            static fn($item) => mb_substr(trim((string)$item), 0, 100),
            is_array($areas) ? $areas : []
        ))));
        return [
            'presence_mode' => in_array(($input['presence_mode'] ?? ''), ['space_only', 'existing_site'], true)
                ? $input['presence_mode']
                : 'undecided',
            'official_site_url' => self::url((string)($input['official_site_url'] ?? '')),
            'business_profile_url' => self::url((string)($input['business_profile_url'] ?? '')),
            'primary_topic' => mb_substr(trim((string)($input['primary_topic'] ?? '')), 0, 180),
            'service_areas' => array_slice($areas, 0, 12),
            'reciprocal_link_confirmed' => !empty($input['reciprocal_link_confirmed']),
            // Contatti diretti: alimentano i pulsanti in fondo agli articoli,
            // che è il punto in cui atterra chi arriva da una ricerca.
            'phone' => self::phone((string)($input['phone'] ?? '')),
            'whatsapp' => self::whatsapp((string)($input['whatsapp'] ?? '')),
            'email' => self::email((string)($input['email'] ?? '')),
            'search_console_choice' => in_array(($input['search_console_choice'] ?? ''), ['connected', 'not_connected', 'need_help'], true)
                ? $input['search_console_choice']
                : 'unknown',
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
        $hasContacts = $profile['phone'] !== '' || $profile['whatsapp'] !== '' || $profile['email'] !== '';
        $usesSpaceOnly = $profile['presence_mode'] === 'space_only';
        $presenceChosen = $profile['presence_mode'] !== 'undecided';
        $publishedPages = max(0, (int)($visibility['published_pages'] ?? count($published) + 1));
        $googleVisiblePages = max(0, (int)($visibility['google_visible_pages'] ?? 0));
        $searchPresencePercent = $publishedPages > 0
            ? min(100, (int)round(($googleVisiblePages / $publishedPages) * 100))
            : 0;
        $googleConnectionPercent = $hasGsc
            ? 100
            : ($profile['search_console_choice'] === 'connected' ? 50
                : ($profile['search_console_choice'] === 'need_help' ? 15 : 0));
        $googleProgress = (int)round(($googleConnectionPercent * 0.4) + ($searchPresencePercent * 0.6));

        $checks = [
            ['id'=>'space', 'label'=>'Spazio Vivo pubblicato', 'done'=>count($published) > 0, 'weight'=>15, 'detail'=>count($published) . ' contenuti pubblicati'],
            ['id'=>'sources', 'label'=>'Canali ufficiali collegati', 'done'=>count($sources) > 0, 'weight'=>10, 'detail'=>count($sources) . ' fonti attive'],
            ['id'=>'official_site', 'label'=>$usesSpaceOnly ? 'Spazio Vivo scelto come presenza ufficiale' : ($presenceChosen ? 'Sito ufficiale identificato' : 'Tipo di presenza scelto'), 'done'=>$usesSpaceOnly || ($presenceChosen && $hasOfficialSite), 'weight'=>15, 'detail'=>$usesSpaceOnly ? 'Non serve un sito tradizionale' : ($hasOfficialSite ? $profile['official_site_url'] : 'Scegli se hai già un sito oppure no')],
            ['id'=>'reciprocal', 'label'=>$usesSpaceOnly ? 'Contatti diretti configurati' : 'Collegamento reciproco', 'done'=>$usesSpaceOnly ? $hasContacts : ($hasOfficialSite && $profile['reciprocal_link_confirmed']), 'weight'=>10, 'detail'=>$usesSpaceOnly ? ($hasContacts ? 'Le persone possono contattarti dagli articoli' : 'Inserisci almeno un contatto') : ($profile['reciprocal_link_confirmed'] ? 'Confermato' : 'Inserisci dal sito un link allo Spazio Vivo')],
            ['id'=>'structured', 'label'=>'Identità e dati strutturati', 'done'=>true, 'weight'=>10, 'detail'=>'Organization/LocalBusiness e fonti ufficiali'],
            ['id'=>'sitemap', 'label'=>'Sitemap e archivio crawlable', 'done'=>count($published) > 0, 'weight'=>10, 'detail'=>'Pagine e immagini segnalate ai crawler'],
            ['id'=>'media', 'label'=>'Patrimonio visuale reperibile', 'done'=>$mediaCount > 0, 'weight'=>5, 'detail'=>$mediaCount . ' immagini o video collegati'],
        ];
        $completedWeight = array_sum(array_map(static fn($check) => $check['done'] ? $check['weight'] : 0, $checks));
        $totalWeight = array_sum(array_column($checks, 'weight')) ?: 1;
        $score = (int)round(($completedWeight / $totalWeight) * 100);
        $stage = $hasSearchEvidence ? 'rilevato' : ($hasGsc ? 'monitorato' : (count($published) > 0 ? 'pubblicato' : 'configurazione'));

        return [
            'profile' => $profile,
            'score' => $score,
            'stage' => $stage,
            'checks' => $checks,
            'published_pages' => $publishedPages,
            'google_visible_pages' => $googleVisiblePages,
            'google' => [
                'connection_percent' => $googleConnectionPercent,
                'presence_percent' => $searchPresencePercent,
                'overall_percent' => $googleProgress,
                'visible_pages' => $googleVisiblePages,
                'published_pages' => $publishedPages,
                'connected' => $hasGsc,
                'has_evidence' => $hasSearchEvidence,
                'status' => $hasGsc ? 'connected' : ($profile['search_console_choice'] === 'connected' ? 'verifying' : $profile['search_console_choice']),
                'source' => $hasGsc ? 'Google Search Console' : 'In attesa di collegamento Search Console',
                'last_data_at' => $visibility['latest_search_date'] ?? null,
            ],
            'data_sources' => [
                ['key'=>'platform', 'label'=>'Contenuti e pagine', 'source'=>'Database AllSocialToWeb', 'connected'=>true, 'updated_at'=>$site['last_sync'] ?? null],
                ['key'=>'google', 'label'=>'Impression e clic', 'source'=>'Google Search Console', 'connected'=>$hasGsc, 'updated_at'=>$visibility['latest_search_date'] ?? null],
                ['key'=>'analytics', 'label'=>'Visite e azioni', 'source'=>'Analytics interno AllSocialToWeb', 'connected'=>true, 'updated_at'=>date('Y-m-d')],
            ],
            'impressions' => (int)($visibility['impressions'] ?? 0),
            'clicks' => (int)($visibility['clicks'] ?? 0),
            'visits' => (int)($visibility['unique_visitors'] ?? 0),
            'actions' => (int)($visibility['actions'] ?? 0),
            'updated_at' => $site['reachability_updated_at'] ?? null,
        ];
    }
}
