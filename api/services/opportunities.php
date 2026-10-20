<?php

/**
 * Pure planner: no database, network, clock or writes. Inputs must already be
 * scoped to the account. Returns at most three cards, in priority order.
 * Card: id,type,title,reason,evidence{kind: observed|hypothesis,label,...},
 * objective,next_action{type,target,post_id?,brief?},measurement.
 * An observed query is only attached to a post through an explicit post_id or
 * a matching page URL supplied by analytics; title similarity is not proof.
 */
class OpportunityPlanner {
    private static function text($value, int $limit = 240): string {
        if (!is_scalar($value)) return '';
        $plain = html_entity_decode(strip_tags((string)$value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $plain = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $plain) ?? '';
        $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? '');
        // Encoded HTML must not become markup when consumed by another client.
        $plain = strip_tags($plain);
        return function_exists('mb_substr') ? mb_substr($plain, 0, $limit) : substr($plain, 0, $limit);
    }

    private static function card(string $id, string $type, string $title, string $reason, array $evidence, string $objective, array $action, string $measurement): array {
        return ['id'=>$id, 'type'=>$type, 'title'=>$title, 'reason'=>$reason,
            'evidence'=>$evidence, 'objective'=>$objective, 'next_action'=>$action, 'measurement'=>$measurement];
    }

    private static function postTitle(array $post): string {
        foreach (['edited_title', 'generated_title', 'title'] as $key) {
            $title = self::text($post[$key] ?? '');
            if ($title !== '') return $title;
        }
        return '';
    }

    private static function matchPost(array $row, array $published): ?array {
        $id = (int)($row['post_id'] ?? 0);
        if ($id > 0) return $published[$id] ?? null;
        $path = parse_url((string)($row['page_url'] ?? ''), PHP_URL_PATH);
        if (!is_string($path) || trim($path, '/') === '') return null;
        $parts = explode('/', trim($path, '/'));
        $slug = rawurldecode((string)end($parts));
        foreach ($published as $post) {
            if (self::text($post['slug'] ?? '') !== '' && (string)$post['slug'] === $slug) return $post;
        }
        return null;
    }

    public static function plan(array $site, array $posts, array $sources, array $visibility, array $knowledge = [], array $reachability = []): array {
        $cards = [];
        $published = [];
        foreach ($posts as $post) {
            if (!is_array($post) || (int)($post['published'] ?? 0) !== 1 || (int)($post['id'] ?? 0) < 1 || self::postTitle($post) === '') continue;
            $published[(int)$post['id']] = $post;
        }
        ksort($published, SORT_NUMERIC);
        $strategy = is_array($knowledge['declared_strategy'] ?? null) ? $knowledge['declared_strategy'] : [];
        $goal = self::text($strategy['primary_goal'] ?? '');
        $audience = self::text($strategy['primary_audience'] ?? '');
        $profile = is_array($reachability['profile'] ?? null) ? $reachability['profile'] : $reachability;
        if (!$profile && is_string($site['reachability_profile'] ?? null)) {
            $decoded = json_decode($site['reachability_profile'], true);
            $profile = is_array($decoded) ? $decoded : [];
        }
        $topic = self::text($strategy['activity_type'] ?? '');
        if ($topic === '') $topic = self::text($profile['primary_topic'] ?? '');
        if ($topic === '') $topic = self::text($site['profile_summary'] ?? ($site['bio'] ?? ''));

        // Only analytics rows explicitly tied to a published post may suggest
        // improving that post. Aggregated site-level queries alone cannot.
        $rows = [];
        foreach (['opportunities', 'top_queries'] as $key) {
            foreach ((array)($visibility[$key] ?? []) as $row) {
                if (!is_array($row)) continue;
                if (is_array($row['queries'] ?? null)) {
                    foreach ($row['queries'] as $query) {
                        if (is_array($query)) $rows[] = array_merge(['post_id'=>$row['post_id'] ?? null, 'page_url'=>$row['page_url'] ?? ''], $query);
                    }
                } else $rows[] = $row;
            }
        }
        usort($rows, static function ($a, $b) {
            return ((int)($b['impressions'] ?? 0) <=> (int)($a['impressions'] ?? 0))
                ?: strcmp(self::text($a['query_text'] ?? ($a['query'] ?? '')), self::text($b['query_text'] ?? ($b['query'] ?? '')));
        });
        $improvedId = null;
        foreach ($rows as $row) {
            $query = self::text($row['query_text'] ?? ($row['query'] ?? ''));
            $impressions = max(0, (int)($row['impressions'] ?? 0));
            $post = self::matchPost($row, $published);
            if ($query === '' || $impressions < 1 || !$post) continue;
            $improvedId = (int)$post['id'];
            $title = self::postTitle($post);
            $cards[] = self::card('search-'.$improvedId, 'search_improvement', 'Rispondi meglio a una ricerca osservata',
                'La ricerca «'.$query.'» ha mostrato una tua pagina. Verifica se il contenuto risponde alla domanda.',
                ['kind'=>'observed', 'label'=>'Dati Google ricevuti per questo contenuto', 'query'=>$query, 'impressions'=>$impressions, 'clicks'=>max(0, (int)($row['clicks'] ?? 0)), 'post_id'=>$improvedId, 'post_title'=>$title],
                'Rendere più utile un contenuto già mostrato in ricerca.',
                ['type'=>'improve_content', 'target'=>'content', 'post_id'=>$improvedId, 'brief'=>'Rivedi «'.$title.'» rispetto alla ricerca osservata «'.$query.'». Usa soltanto fatti disponibili e chiedi le informazioni mancanti.'],
                'Confronta impression e clic del contenuto nel prossimo periodo; un miglioramento non è garantito.');
            break;
        }
        $hasContact = false;
        foreach (['phone', 'whatsapp', 'email'] as $field) if (self::text($profile[$field] ?? '') !== '') $hasContact = true;
        if (!$hasContact) $cards[] = self::card('contacts-missing', 'missing_contacts', 'Dai alle persone un modo per contattarti',
            'Non risulta un contatto diretto nel profilo dello spazio.', ['kind'=>'observed', 'label'=>'Profilo dello spazio senza telefono, WhatsApp o email'],
            'Permettere a chi legge di compiere il passo successivo.', ['type'=>'navigate', 'target'=>'reachability'],
            'Verifica il contatto pubblicato e osserva i clic; un clic non equivale a una richiesta ricevuta.');
        if ($topic === '') $cards[] = self::card('profile-missing', 'missing_profile', 'Racconta che cosa fai e per chi',
            'Manca una descrizione utile per preparare proposte pertinenti senza inventare.', ['kind'=>'observed', 'label'=>'Attività e descrizione non presenti nel profilo disponibile'],
            'Dare a LIA un contesto verificabile.', ['type'=>'navigate', 'target'=>'profile'], 'Conferma una descrizione corretta della tua attività prima di generare nuove idee.');
        foreach ($published as $id => $post) {
            if ($id === $improvedId) continue;
            $title = self::postTitle($post);
            $cards[] = self::card('reuse-'.$id, 'reuse_content', 'Riporta sui social un contenuto utile',
                'Hai già pubblicato «'.$title.'». Puoi prepararne una presentazione breve con un collegamento alla pagina.',
                ['kind'=>'observed', 'label'=>'Contenuto proprio già pubblicato', 'post_id'=>$id, 'post_title'=>$title],
                'Aiutare il pubblico dei tuoi canali a raggiungere il contenuto.',
                ['type'=>'reuse_content', 'target'=>'content', 'post_id'=>$id, 'brief'=>'Prepara un testo breve per condividere «'.$title.'» sui miei canali. Riusa soltanto i fatti presenti e invita a leggere la pagina.'],
                'Dopo la condivisione osserva le visite alla pagina e i clic sui contatti.');
            break;
        }
        if (!$posts && $sources) $cards[] = self::card('sources-empty', 'empty_sources', 'Raccogli i primi contenuti dai canali collegati',
            'Sono presenti canali collegati ma nessun contenuto nell’archivio disponibile.', ['kind'=>'observed', 'label'=>'Canali collegati senza contenuti disponibili', 'source_count'=>count($sources)],
            'Avere materiali reali prima di preparare una proposta.', ['type'=>'navigate', 'target'=>'sources'], 'Verifica il risultato dell’acquisizione e quanti contenuti sono effettivamente disponibili.');
        if (!$sources) $cards[] = self::card('sources-missing', 'missing_sources', 'Collega il canale che usi già',
            'Non risultano canali collegati da cui raccogliere i tuoi materiali.', ['kind'=>'observed', 'label'=>'Nessuna fonte collegata'],
            'Partire dai contenuti che ti rappresentano.', ['type'=>'navigate', 'target'=>'sources'], 'Controlla che almeno un contenuto reale sia stato acquisito correttamente.');
        if ($topic !== '') $cards[] = self::card('profile-idea', 'profile_idea', 'Prova una risposta utile per chi ti cerca',
            'Dal tuo profilo: «'.$topic.'». Possiamo ipotizzare una domanda utile, da confermare con te.', ['kind'=>'hypothesis', 'label'=>'Idea da validare, basata sul profilo', 'profile_topic'=>$topic],
            'Verificare una proposta coerente con la tua attività.',
            ['type'=>'create_content', 'target'=>'idea', 'brief'=>'La mia attività è: '.$topic.'. Proponi una domanda concreta del mio pubblico come ipotesi, chiedimi conferma e i fatti necessari prima di scrivere. Non attribuire volumi di ricerca o domanda non misurati.'],
            'Valida la domanda con persone reali; dopo la pubblicazione osserva visite e azioni.');
        // These are the owner's editorial preferences, not evidence that a
        // market exists. Keep observations intact and adapt the next action.
        $goalLower = function_exists('mb_strtolower') ? mb_strtolower($goal, 'UTF-8') : strtolower($goal);
        $wantsContacts = preg_match('/richiest|contatt|preventiv|prenotaz|vendit/u', $goalLower) === 1;
        $wantsPortfolio = preg_match('/presentar|lavori|competenz|portfolio/u', $goalLower) === 1;
        $wantsInformation = preg_match('/inform|aiutar|pubblico|conosc|spieg|educa/u', $goalLower) === 1;
        $priorities = ['missing_profile'=>0, 'search_improvement'=>10, 'empty_sources'=>15,
            'missing_contacts'=>30, 'reuse_content'=>40, 'missing_sources'=>50, 'profile_idea'=>60];
        if ($wantsContacts) $priorities['missing_contacts'] = 5;
        if ($wantsPortfolio) $priorities['reuse_content'] = 20;
        if ($wantsInformation && !$wantsPortfolio && !$wantsContacts) $priorities['profile_idea'] = 20;
        foreach ($cards as &$card) {
            if (!in_array($card['next_action']['type'], ['create_content','reuse_content','improve_content'], true)) continue;
            if ($goal !== '') {
                $card['objective'] .= ' Obiettivo dichiarato: '.$goal.'.';
                $card['next_action']['brief'] .= ' Obiettivo dichiarato dal titolare: '.$goal.'. Adatta la proposta a questo obiettivo senza promettere risultati.';
            }
            if ($audience !== '') $card['next_action']['brief'] .= ' Pubblico dichiarato: '.$audience.'. Non estenderlo a segmenti non confermati.';
        }
        unset($card);
        usort($cards, static function ($a, $b) use ($priorities) {
            return ($priorities[$a['type']] <=> $priorities[$b['type']]) ?: strcmp($a['id'], $b['id']);
        });
        return array_slice($cards, 0, 3);
    }
}
