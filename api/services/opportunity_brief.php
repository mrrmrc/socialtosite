<?php
final class OpportunityBrief {
    public static function text($value, int $limit = 600): string {
        if (!is_scalar($value)) return '';
        $text = trim((string)preg_replace('/\s+/u', ' ', strip_tags((string)$value)));
        return function_exists('mb_substr') ? mb_substr($text, 0, $limit, 'UTF-8') : substr($text, 0, $limit);
    }

    public static function context(array $site, array $opportunity, ?array $post): array {
        $understanding = $site['site_understanding'] ?? [];
        if (is_string($understanding)) $understanding = json_decode($understanding, true) ?: [];
        return [
            'identity'=>array_intersect_key($site, array_flip(['title','profile_summary','bio','role_mission','content_strategy'])),
            'editorial_understanding'=>$understanding,
            'owner_corrections'=>is_array($site['site_understanding_corrections'] ?? null) ? $site['site_understanding_corrections'] : (json_decode((string)($site['site_understanding_corrections'] ?? ''), true) ?: []),
            'opportunity'=>$opportunity,
            'source'=>$post ? [
                'id'=>(int)$post['id'],
                'title'=>self::text(($post['edited_title'] ?? '') ?: ($post['generated_title'] ?? ''), 240),
                'body'=>self::text(($post['edited_body'] ?? '') ?: ($post['generated_body'] ?? '') ?: ($post['raw_content'] ?? ''), 9000),
                'published'=>(int)($post['published'] ?? 0),
            ] : null,
        ];
    }

    public static function normalize(string $raw, array $opportunity, ?array $post): array {
        $data = json_decode(trim((string)preg_replace('/```(?:json)?|```/i', '', $raw)), true);
        if (!is_array($data)) throw new RuntimeException('Brief non valido');
        $brief = [];
        foreach (['title','reason','objective','format','hook','cta','social_angle'] as $field) $brief[$field] = self::text($data[$field] ?? '', $field === 'title' ? 200 : 600);
        if ($brief['title'] === '' || $brief['reason'] === '') throw new RuntimeException('Brief incompleto');
        $brief['questions'] = [];
        foreach (array_slice(is_array($data['questions'] ?? null) ? $data['questions'] : [], 0, 3) as $question) {
            $question = self::text($question, 300);
            if ($question !== '') $brief['questions'][] = $question;
        }
        $brief['source'] = self::text($opportunity['evidence']['label'] ?? 'Profilo e contenuti disponibili', 200);
        $brief['source_post_id'] = $post ? (int)$post['id'] : null;
        $brief['type'] = 'Guida';
        $brief['priority'] = 'Alta';
        return $brief;
    }
}
