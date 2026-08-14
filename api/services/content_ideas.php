<?php

/**
 * Rende affidabile l'output editoriale anche quando il modello restituisce
 * JSON imperfetto, campi con nomi diversi o meno di tre proposte.
 */
final class ContentIdeaFormatter {
    private static function text($value, int $maxLength): string {
        if (is_array($value) || is_object($value)) return '';
        $value = trim(strip_tags(html_entity_decode((string)$value, ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        $value = trim((string)preg_replace('/\s+/u', ' ', $value));
        if ($value === '') return '';
        return function_exists('mb_substr') ? mb_substr($value, 0, $maxLength, 'UTF-8') : substr($value, 0, $maxLength);
    }

    private static function key(string $value): string {
        $value = function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
        return trim((string)preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value));
    }

    /** Estrae una lista sia da {ideas:[...]} sia da un array JSON diretto. */
    public static function decode(string $raw): array {
        $raw = trim((string)preg_replace('/^\xEF\xBB\xBF/', '', $raw));
        $raw = trim((string)preg_replace('/```(?:json)?|```/i', '', $raw));
        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            $first = strpos($raw, '{');
            $last = strrpos($raw, '}');
            if ($first !== false && $last !== false && $last > $first) {
                $decoded = json_decode(substr($raw, $first, $last - $first + 1), true);
            }
        }
        if (!is_array($decoded)) return [];

        foreach (['ideas', 'content_ideas', 'proposte'] as $container) {
            if (is_array($decoded[$container] ?? null)) return array_values($decoded[$container]);
        }
        return array_is_list($decoded) ? array_values($decoded) : [];
    }

    /**
     * Normalizza, deduplica e completa fino a tre elementi. I fallback sono
     * deliberatamente deterministici: nessuna seconda chiamata AI e nessun 502.
     */
    public static function normalize(array $candidates, array $fallbacks = []): array {
        $ideas = [];
        $seen = [];
        $allowedTypes = ['Attualità', 'Guida', 'Domanda cliente', 'Storia', 'Offerta'];

        foreach (array_merge($candidates, $fallbacks) as $candidate) {
            if (!is_array($candidate)) continue;
            $title = self::text($candidate['title'] ?? $candidate['titolo'] ?? '', 180);
            if ($title === '') continue;
            $key = self::key($title);
            if ($key === '' || isset($seen[$key])) continue;

            $sourceUrl = self::text($candidate['source_url'] ?? $candidate['url'] ?? '', 500);
            if ($sourceUrl !== '' && !filter_var($sourceUrl, FILTER_VALIDATE_URL)) $sourceUrl = '';
            if ($sourceUrl !== '' && !preg_match('/^https?:\/\//i', $sourceUrl)) $sourceUrl = '';

            $type = self::text($candidate['type'] ?? $candidate['tipo'] ?? '', 40);
            $typeAliases = [
                'attualita' => 'Attualità', 'attualità' => 'Attualità',
                'guida' => 'Guida', 'domanda cliente' => 'Domanda cliente',
                'storia' => 'Storia', 'offerta' => 'Offerta',
            ];
            $type = $typeAliases[self::key($type)] ?? $type;
            if (!in_array($type, $allowedTypes, true)) $type = 'Guida';
            $priority = self::text($candidate['priority'] ?? $candidate['priorita'] ?? '', 20);
            if (!in_array($priority, ['Alta', 'Media'], true)) $priority = 'Media';
            $freshness = self::text($candidate['freshness'] ?? '', 20);
            if (!in_array($freshness, ['Attuale', 'Evergreen'], true)) $freshness = $sourceUrl !== '' ? 'Attuale' : 'Evergreen';

            $ideas[] = [
                'title' => $title,
                'reason' => self::text($candidate['reason'] ?? $candidate['perche'] ?? $candidate['why'] ?? '', 420)
                    ?: 'Approfondisce un bisogno concreto del pubblico usando le informazioni già confermate.',
                'type' => $type,
                'priority' => $priority,
                'source' => self::text($candidate['source'] ?? $candidate['fonte'] ?? '', 160)
                    ?: ($sourceUrl !== '' ? 'Segnale di attualità verificabile' : 'Profilo e strategia dell’attività'),
                'source_url' => $sourceUrl,
                'freshness' => $freshness,
                'social_angle' => self::text($candidate['social_angle'] ?? $candidate['taglio_social'] ?? '', 280)
                    ?: 'Apri con una domanda diretta e invita il pubblico a condividere la propria esperienza.',
            ];
            $seen[$key] = true;
            if (count($ideas) >= 3) break;
        }

        return $ideas;
    }

    /** Tre tracce sicure costruite esclusivamente da dati già disponibili. */
    public static function fallbacks(array $site, array $declared, array $reachability): array {
        $subject = '';
        foreach ([$reachability['primary_topic'] ?? '', $declared['activity_type'] ?? '', $site['title'] ?? ''] as $subjectCandidate) {
            $subject = self::text($subjectCandidate, 72);
            if ($subject !== '') break;
        }
        if ($subject === '') $subject = 'questa attività';
        $offer = self::text($declared['offer_summary'] ?? $site['profile_summary'] ?? $site['bio'] ?? '', 160);
        $audience = self::text($declared['primary_audience'] ?? '', 120);
        $profileSource = 'Profilo e strategia dell’attività';

        return [
            [
                'title' => "Guida essenziale: {$subject}",
                'reason' => $offer !== '' ? "Spiega in modo semplice l’offerta confermata: {$offer}." : 'Offre un punto di partenza chiaro alle persone che stanno cercando informazioni.',
                'type' => 'Guida', 'priority' => 'Alta', 'source' => $profileSource, 'source_url' => '', 'freshness' => 'Evergreen',
                'social_angle' => 'Tre indicazioni pratiche in formato breve, con rimando alla guida completa.',
            ],
            [
                'title' => "Le domande più frequenti su {$subject}",
                'reason' => $audience !== '' ? "Risponde ai dubbi del pubblico dichiarato: {$audience}." : 'Riduce i dubbi iniziali con risposte immediate e comprensibili.',
                'type' => 'Domanda cliente', 'priority' => 'Alta', 'source' => $profileSource, 'source_url' => '', 'freshness' => 'Evergreen',
                'social_angle' => 'Una domanda per schermata o paragrafo, chiusa da una risposta sintetica.',
            ],
            [
                'title' => "Cosa valutare quando cerchi {$subject}",
                'reason' => 'Aiuta il pubblico a scegliere con criteri concreti senza promesse o informazioni inventate.',
                'type' => 'Guida', 'priority' => 'Media', 'source' => $profileSource, 'source_url' => '', 'freshness' => 'Evergreen',
                'social_angle' => 'Checklist breve di criteri utili da salvare e condividere.',
            ],
        ];
    }
}
