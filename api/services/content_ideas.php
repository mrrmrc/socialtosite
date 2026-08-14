<?php

/**
 * Normalizza le proposte editoriali e costruisce fallback realmente derivati
 * dalla profilazione. I fallback non devono mai sembrare idee generiche: usano
 * strategia dichiarata, profilo, voce, memoria editoriale e reachability.
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

    private static function first(array $values, int $maxLength = 180): string {
        foreach ($values as $value) {
            $text = self::text($value, $maxLength);
            if ($text !== '') return $text;
        }
        return '';
    }

    private static function jsonArray($value): array {
        if (is_array($value)) return $value;
        if (!is_string($value) || trim($value) === '') return [];
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function decode(string $raw): array {
        $raw = trim((string)preg_replace('/^\xEF\xBB\xBF/', '', $raw));
        $raw = trim((string)preg_replace('/```(?:json)?|```/i', '', $raw));
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $first = strpos($raw, '{'); $last = strrpos($raw, '}');
            if ($first !== false && $last !== false && $last > $first) $decoded = json_decode(substr($raw, $first, $last - $first + 1), true);
        }
        if (!is_array($decoded)) return [];
        foreach (['ideas','content_ideas','proposte'] as $container) if (is_array($decoded[$container] ?? null)) return array_values($decoded[$container]);
        return array_is_list($decoded) ? array_values($decoded) : [];
    }

    public static function normalize(array $candidates, array $fallbacks = []): array {
        $ideas=[]; $seen=[]; $allowedTypes=['Attualità','Guida','Domanda cliente','Storia','Offerta'];
        foreach (array_merge($candidates,$fallbacks) as $candidate) {
            if (!is_array($candidate)) continue;
            $title=self::text($candidate['title']??$candidate['titolo']??'',180); if($title==='')continue;
            $key=self::key($title); if($key===''||isset($seen[$key]))continue;
            $sourceUrl=self::text($candidate['source_url']??$candidate['url']??'',500);
            if($sourceUrl!==''&&(!filter_var($sourceUrl,FILTER_VALIDATE_URL)||!preg_match('/^https?:\/\//i',$sourceUrl)))$sourceUrl='';
            $type=self::text($candidate['type']??$candidate['tipo']??'',40);
            $aliases=['attualita'=>'Attualità','attualità'=>'Attualità','guida'=>'Guida','domanda cliente'=>'Domanda cliente','storia'=>'Storia','offerta'=>'Offerta'];
            $type=$aliases[self::key($type)]??$type; if(!in_array($type,$allowedTypes,true))$type='Guida';
            $priority=self::text($candidate['priority']??$candidate['priorita']??'',20); if(!in_array($priority,['Alta','Media'],true))$priority='Media';
            $freshness=self::text($candidate['freshness']??'',20); if(!in_array($freshness,['Attuale','Evergreen'],true))$freshness=$sourceUrl!==''?'Attuale':'Evergreen';
            $ideas[]=[
                'title'=>$title,
                'reason'=>self::text($candidate['reason']??$candidate['perche']??$candidate['why']??'',420)?:'Approfondisce un bisogno concreto del pubblico usando le informazioni già confermate.',
                'type'=>$type,'priority'=>$priority,
                'source'=>self::text($candidate['source']??$candidate['fonte']??'',160)?:($sourceUrl!==''?'Segnale di attualità verificabile':'Profilazione editoriale LinkSeoWeb'),
                'source_url'=>$sourceUrl,'freshness'=>$freshness,
                'social_angle'=>self::text($candidate['social_angle']??$candidate['taglio_social']??'',280)?:'Trasforma il punto centrale in una domanda concreta e rimanda all’approfondimento completo.',
            ];
            $seen[$key]=true; if(count($ideas)>=3)break;
        }
        return $ideas;
    }

    /**
     * Tre tracce di emergenza basate sul profilo profondo. Questa funzione viene
     * usata anche quando il provider AI non risponde: l'utente deve comunque
     * ricevere idee riconoscibili come proprie, non titoli universali.
     */
    public static function fallbacks(array $site, array $declared, array $reachability): array {
        $understanding=self::jsonArray($site['site_understanding']??[]);
        $declared=array_replace($understanding['declared_strategy']??[],$declared);
        $voice=self::jsonArray($site['brand_voice_profile']??[]);
        $keywords=[];
        foreach ([$voice['topic_clusters']??[], $understanding['keywords']??[], $reachability['topics']??[], $reachability['service_areas']??[]] as $list) {
            if(!is_array($list))continue; foreach($list as $item){$t=self::text($item,80);if($t!==''&&!in_array($t,$keywords,true))$keywords[]=$t;}
        }
        $subject=self::first([$reachability['primary_topic']??'', $declared['activity_type']??'', $site['title']??''],72)?:'questa attività';
        $offer=self::first([$declared['offer_summary']??'', $site['profile_summary']??'', $site['bio']??''],180);
        $audience=self::first([$declared['primary_audience']??'', $understanding['primary_audience']??''],130);
        $area=self::first([$declared['geographic_area']??'', implode(', ',array_slice((array)($reachability['service_areas']??[]),0,3))],90);
        $strategy=self::first([$site['content_strategy']??'', $understanding['content_strategy']??'', $voice['custom_instructions']??''],220);
        $memory=self::text($site['rag_knowledge']??'',180);
        $topic1=$keywords[0]??$subject; $topic2=$keywords[1]??$subject; $topic3=$keywords[2]??$subject;
        $who=$audience!==''?" per {$audience}":''; $where=$area!==''?" in {$area}":'';
        $evidence=implode(' · ',array_filter([$offer,$strategy,$memory]));
        $evidence=self::text($evidence,260);
        return [
            [
                'title'=>"{$topic1}: cosa sapere prima di scegliere",
                'reason'=>self::text("Approfondimento costruito sul tema ricorrente {$topic1}{$who}{$where}. ".($offer!==''?"È coerente con l'offerta dichiarata: {$offer}. ":'').($strategy!==''?"Segue la strategia editoriale confermata.":''),420),
                'type'=>'Guida','priority'=>'Alta','source'=>'Profilo, strategia e contenuti acquisiti','source_url'=>'','freshness'=>'Evergreen',
                'social_angle'=>"Una domanda concreta su {$topic1} e tre criteri pratici spiegati con il tono abituale del profilo.",
            ],
            [
                'title'=>"Le domande che contano davvero su {$topic2}",
                'reason'=>self::text(($audience!==''?"Risponde ai dubbi di {$audience}. ":'')."Parte da un argomento ricorrente della profilazione e lo trasforma in risposte utili, evitando contenuti generici. ".$evidence,420),
                'type'=>'Domanda cliente','priority'=>'Alta','source'=>'Profilazione profonda e memoria editoriale','source_url'=>'','freshness'=>'Evergreen',
                'social_angle'=>"Apri con il dubbio più frequente su {$topic2}, rispondi in modo diretto e invita all'approfondimento.",
            ],
            [
                'title'=>"{$topic3}: il punto di vista di {$subject}",
                'reason'=>self::text("Sviluppa {$topic3} dal punto di vista specifico del profilo invece di produrre un articolo intercambiabile. ".($memory!==''?"Tiene conto anche della memoria stilistica e tematica costruita dai contenuti precedenti.":''),420),
                'type'=>'Storia','priority'=>'Media','source'=>'Voce del brand, RAG e topic ricorrenti','source_url'=>'','freshness'=>'Evergreen',
                'social_angle'=>"Parti da un'esperienza, un'opinione o un esempio già coerente con i contenuti dell'autore e portalo verso {$topic3}.",
            ],
        ];
    }
}
