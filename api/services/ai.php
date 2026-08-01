<?php
// api/services/ai.php — Motore AI: Gemini (trascrizione + armonizzazione).
// Mantiene anche Whisper/Claude come alternative.
require_once __DIR__ . '/../../config/config.php';
if (file_exists(__DIR__ . '/../../config/keys.php')) require_once __DIR__ . '/../../config/keys.php';
if (file_exists(__DIR__ . '/../middleware/logger.php')) require_once __DIR__ . '/../middleware/logger.php';

class AI {

    private static function loadDesignLibrary(): array {
        static $library = null;
        if ($library !== null) return $library;

        $library = [];
        $baseDir = realpath(__DIR__ . '/../../designs');
        if (!$baseDir || !is_dir($baseDir)) return $library;

        foreach (glob($baseDir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $metaPath = $dir . '/meta.json';
            $briefPath = $dir . '/DESIGN.md';
            if (!is_file($metaPath) || !is_file($briefPath)) continue;

            $meta = json_decode((string) file_get_contents($metaPath), true);
            $brief = trim((string) file_get_contents($briefPath));
            if (!is_array($meta) || $brief === '') continue;

            $library[] = [
                'id' => $meta['id'] ?? basename($dir),
                'name' => $meta['name'] ?? basename($dir),
                'description' => $meta['description'] ?? '',
                'colors' => $meta['colors'] ?? [],
                'brief' => $brief,
            ];
        }

        return $library;
    }

    private static function buildDesignLibraryPrompt(): string {
        $designs = self::loadDesignLibrary();
        if (empty($designs)) return '';

        $chunks = [];
        foreach ($designs as $design) {
            $colors = is_array($design['colors']) ? implode(', ', $design['colors']) : '';
            $chunks[] = "MODELLO {$design['id']} - {$design['name']}\n"
                . "Descrizione: {$design['description']}\n"
                . ($colors !== '' ? "Colori guida: {$colors}\n" : '')
                . "{$design['brief']}";
        }

        return "\n\nLIBRERIA MODELLI LOCALI\n"
            . "Devi partire da questi riferimenti curati. Non inventare uno stile casuale.\n"
            . "Scegli il modello piu coerente con il profilo oppure combina al massimo 2 modelli compatibili.\n"
            . "Evita il look AI generico: neon gratuiti, viola predefinito, gradienti casuali, glassmorphism invadente, layout da template intercambiabile.\n\n"
            . implode("\n\n---\n\n", $chunks);
    }

    private static function normalizeColorPalette(array $palette): array {
        $normalized = $palette;
        if (!isset($normalized['background']) && isset($normalized['bg'])) {
            $normalized['background'] = $normalized['bg'];
        }
        if (!isset($normalized['secondary']) && isset($normalized['surface'])) {
            $normalized['secondary'] = $normalized['surface'];
        }
        return $normalized;
    }

    private static function recommendDesignModels(string $profileSummary, string $roleMission, string $contentStrategy): array {
        $text = mb_strtolower(trim($profileSummary . ' ' . $roleMission . ' ' . $contentStrategy));
        $scores = [
            'editorial-luxe' => 0,
            'neo-brutal-pop' => 0,
            'dark-cinematic' => 0,
            'warm-humanist' => 0,
            'tech-clarity' => 0,
        ];

        $keywords = [
            'editorial-luxe' => ['editoriale', 'magazine', 'giornal', 'writer', 'scritt', 'consulen', 'luxury', 'elegan', 'beauty', 'fashion', 'brand personale'],
            'neo-brutal-pop' => ['creator', 'tiktok', 'street', 'bold', 'viral', 'performance', 'advertising', 'marketing', 'agency', 'energi', 'sport', 'fitness'],
            'dark-cinematic' => ['video', 'film', 'cinema', 'fotograf', 'music', 'artista', 'visual', 'premium', 'luxury', 'night', 'dark'],
            'warm-humanist' => ['coach', 'wellness', 'psicolog', 'terap', 'famiglia', 'education', 'educa', 'bambin', 'salute', 'human', 'cura', 'community'],
            'tech-clarity' => ['ai', 'software', 'saas', 'tech', 'startup', 'developer', 'engineer', 'data', 'prodotto', 'b2b', 'automation', 'digital'],
        ];

        foreach ($keywords as $model => $terms) {
            foreach ($terms as $term) {
                if ($text !== '' && mb_strpos($text, $term) !== false) {
                    $scores[$model] += 3;
                }
            }
        }

        if (preg_match('/\b(avvocat|law|legal|studio legale|notai)\b/u', $text)) $scores['editorial-luxe'] += 2;
        if (preg_match('/\b(ristor|chef|food|cucina)\b/u', $text)) $scores['warm-humanist'] += 2;
        if (preg_match('/\b(creator|streamer|gaming|gamer)\b/u', $text)) $scores['neo-brutal-pop'] += 2;
        if (preg_match('/\b(product|ux|ui|design system)\b/u', $text)) $scores['tech-clarity'] += 2;
        if (preg_match('/\b(photo|photojournal|director|regista)\b/u', $text)) $scores['dark-cinematic'] += 2;

        arsort($scores);
        $top = array_slice(array_keys($scores), 0, 2);
        if (($scores[$top[0]] ?? 0) <= 0) {
            return ['warm-humanist', 'tech-clarity'];
        }
        if (($scores[$top[1]] ?? 0) <= 0) {
            return [$top[0]];
        }
        return $top;
    }

    private static function buildDesignRecommendationPrompt(string $profileSummary, string $roleMission, string $contentStrategy): string {
        $recommended = self::recommendDesignModels($profileSummary, $roleMission, $contentStrategy);
        if (empty($recommended)) return '';
        return "\n\nRACCOMANDAZIONI DEL SISTEMA\n"
            . "Per questo profilo i modelli locali piu coerenti sono, in ordine: "
            . implode(', ', $recommended)
            . ". Usa questi modelli come base del design e, se serve, assemblane massimo 2.\n";
    }

    // ── Chiamata generica a Gemini (generateContent) ───────────────────────
    // $parts: array di "part" Gemini. $config: opzioni generationConfig.
    public static function gemini(array $parts, array $config = []): string {
        if (!defined('GEMINI_API_KEY') || !GEMINI_API_KEY) {
            throw new Exception('GEMINI_API_KEY mancante: aggiungila in config/keys.php');
        }
        $model = defined('GEMINI_MODEL') ? GEMINI_MODEL : 'gemini-2.5-flash';
        $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=" . GEMINI_API_KEY;

        $payload = ['contents' => [['parts' => $parts]]];
        if ($config) $payload['generationConfig'] = $config;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 600, // i video lunghi richiedono tempo
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($res === false)  throw new Exception("Gemini: errore di rete ($err)");
        $data = json_decode($res, true);
        if ($code >= 400) {
            $msg = $data['error']['message'] ?? $res;
            throw new Exception("Gemini ($code): $msg");
        }
        return $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    // ── AGENTE MEMORIA (RAG): Estrae fatti e tono di voce dal post ───────────
    public static function updateMemory(string $rawContent, string $existingKnowledge = ''): string {
        if (!$rawContent) return $existingKnowledge;
        
        $prompt = "Sei un analista esperto nel profilare gli autori. Di seguito c'è la MEMORIA ATTUALE sull'autore (se presente) e un NUOVO POST appena scritto da lui.
MEMORIA ATTUALE:
" . ($existingKnowledge ?: '(nessuna)') . "

NUOVO POST:
$rawContent

COMPITO:
Aggiorna la memoria attuale integrando eventuali nuovi fatti, preferenze, argomenti ricorrenti o caratteristiche stilistiche (tono di voce, formattazione, espressioni tipiche) che emergono dal nuovo post. 
- Sii sintetico ma preciso.
- Non elencare i post, crea una guida/wiki fluida sulla persona.
- Mantieni la lunghezza massima sotto i 2000 caratteri.
Restituisci SOLO la nuova memoria aggiornata (testo semplice), nient'altro.";

        return trim(self::gemini([['text' => $prompt]]));
    }

    // ── AGENTE VISIONE: Analisi Immagini (OCR + Descrittore) ───────────────
    public static function analyzeImage(string $imageUrl): string {
        try {
            $bytes = @file_get_contents($imageUrl);
            if ($bytes === false || $bytes === '') return '';
            
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($bytes) ?: 'image/jpeg';

            $prompt = "Analizza attentamente questa immagine. \n"
                    . "1. Descrivi dettagliatamente cosa c'è nella foto (soggetti, contesto, colori, atmosfera).\n"
                    . "2. Se c'è del testo scritto sull'immagine (infografica, meme, screenshot), TRASCRIVILO ACCURATAMENTE (OCR).\n"
                    . "3. Qual è il messaggio emotivo o commerciale che l'autore vuole trasmettere?\n"
                    . "Restituisci un testo fluido che unisca queste informazioni, pronto per essere usato come base per scrivere un articolo. Niente elenchi puntati se non necessari.";

            return trim(self::gemini([
                ['inlineData' => ['mimeType' => $mime, 'data' => base64_encode($bytes)]],
                ['text' => $prompt]
            ], [
                'temperature'    => 0.4,
                'maxOutputTokens'=> 2048,
            ]));
        } catch (Exception $e) {
            return ''; // Se fallisce (es. url protetto o invalido), ignora in modo silente per non bloccare il flusso
        }
    }

    // ── AGENTE 1 (Ingestione): trascrivi un video YouTube da link ──────────
    // Gemini accetta direttamente l'URL YouTube: niente download né Whisper.
    public static function transcribeYouTube(string $youtubeUrl): string {
        return trim(self::gemini([
            ['fileData' => ['fileUri' => $youtubeUrl, 'mimeType' => 'video/mp4']],
            ['text' => "Trascrivi INTEGRALMENTE e VERBATIM, in italiano, TUTTO il parlato di questo video, "
                     . "dall'inizio alla fine. NON riassumere, NON saltare parti, NON fermarti prima della fine. "
                     . "Restituisci SOLO il testo della trascrizione, senza timestamp e senza commenti."],
        ], [
            'temperature'    => 0,
            'maxOutputTokens'=> 65536,
            'thinkingConfig' => ['thinkingBudget' => 0],
        ]));
    }

    // ── AGENTE 1 (Ingestione): trascrivi un file audio/video già scaricato ─
    public static function transcribeFile(string $path, string $mime = 'video/mp4'): string {
        $bytes = @file_get_contents($path);
        if ($bytes === false || $bytes === '') return '';
        return trim(self::gemini([
            ['inlineData' => ['mimeType' => $mime, 'data' => base64_encode($bytes)]],
            ['text' => "Trascrivi INTEGRALMENTE e VERBATIM, in italiano, tutto il parlato dall'inizio "
                     . "alla fine. NON riassumere. Solo il testo."],
        ], [
            'temperature'    => 0,
            'maxOutputTokens'=> 65536,
            'thinkingConfig' => ['thinkingBudget' => 0],
        ]));
    }

    // ── AGENTE 2 (Armonizzatore): testo grezzo → articolo SEO (Gemini) ─────
    public static function harmonize(string $rawText, string $platform = '', string $caption = '', string $sourceContext = '', string $agentName = 'content_editor', string $accountType = 'business'): array {
        $source = $caption
            ? "Didascalia social: \"$caption\"\n\nTrascrizione: \"$rawText\""
            : "Contenuto: \"$rawText\"";
        $context = $sourceContext ? "\n\nContesto dei canali/profili dell'utente:\n$sourceContext\n" : '';

        $typePrompt = $accountType === 'business'
            ? "TIPOLOGIA ACCOUNT: BUSINESS. Il tuo obiettivo è convertire i lettori in clienti, fare lead generation o brand awareness aziendale. Usa Call to Action chiare e un tono professionale ma coinvolgente."
            : "TIPOLOGIA ACCOUNT: PERSONALE/CREATOR. Il tuo obiettivo è creare una forte connessione emotiva col lettore, engagement e storytelling. Usa un tono confidenziale, empatico e racconta il dietro le quinte.";

        $fallback = "Sei il copywriter e curatore editoriale ufficiale di questo utente/brand. "
            . "Il tuo compito è trasformare il seguente contenuto" . ($platform ? " (estratto da $platform)" : '') . " in un articolo professionale per il suo sito web.\n\n"
            . "REGOLE FONDAMENTALI (PENA IL FALLIMENTO DEL TASK):\n"
            . "1. ADERENZA AL FATTO: Basati ESCLUSIVAMENTE sulle informazioni fornite nel Contenuto. NON inventare dettagli, NON aggiungere tendenze, challenge, fenomeni virali o notizie esterne se non esplicitamente menzionate nella Trascrizione/Didascalia.\n"
            . "2. RISPETTO DELLA PROFILAZIONE: Adatta il tono di voce e lo stile esattamente come indicato nel 'Contesto dei canali/profili dell'utente' (Target, Strategia, Tono). Se il contesto richiede un tono specifico, usalo.\n"
            . "3. PRESERVAZIONE: Se il contenuto originale contiene umorismo, sarcasmo, barzellette o sketch comici, PRESERVA ASSOLUTAMENTE LA COMICITA'. Non trasformare una barzelletta in un testo accademico.\n"
            . "4. " . $typePrompt . "\n\n"
            . "PRIMA analizza il Contesto dell'Utente per capire chi sta parlando e a chi si rivolge. POI leggi il Contenuto e scrivi l'articolo.\n"
            . "{sourceContext}\n{source}\n\n"
            . "Rispondi SOLO con JSON valido con questa forma:\n"
            . '{"title":"Titolo SEO max 60 caratteri","body":"Articolo 200-400 parole, italiano naturale, paragrafi",'
            . '"excerpt":"Riassunto max 155 caratteri","tags":["tag1","tag2","tag3","tag4","tag5"],'
            . '"meta_description":"Meta description max 155 caratteri","seo_score":75}';

        $promptTemplate = self::getAgentPrompt($agentName, $fallback);
        $prompt = str_replace(
            ['{sourceContext}', '{profileSummary}', '{source}', '{content}', '{platform}'],
            [$context, $sourceContext, $source, $rawText, $platform],
            $promptTemplate
        );

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 8192,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result) {
            return [
                'title'            => mb_substr($caption ?: $rawText, 0, 60),
                'body'             => $rawText ?: $caption,
                'excerpt'          => mb_substr($caption ?: $rawText, 0, 155),
                'tags'             => [],
                'meta_description' => mb_substr($caption ?: $rawText, 0, 155),
                'seo_score'        => 40,
            ];
        }

        // Normalize generated keys to standard keys if returned by older templates
        if (isset($result['generated_title']) && !isset($result['title'])) $result['title'] = $result['generated_title'];
        if (isset($result['generated_body']) && !isset($result['body'])) $result['body'] = $result['generated_body'];
        if (isset($result['generated_excerpt']) && !isset($result['excerpt'])) $result['excerpt'] = $result['generated_excerpt'];

        return $result;
    }



    // ── Scraper locale Node.js ──────────────────────────────────────────────
    private static function nodeScrape(string $platform, string $url, int $limit = 0): array {
        if (!function_exists('shell_exec')) {
            Logger::error('scraper', "shell_exec disabilitato", ['platform' => $platform]);
            throw new Exception("shell_exec disabilitato dal server: impossibile usare lo scraper locale per $platform. Richiede Apify.");
        }
        $scriptPath = realpath(__DIR__ . '/../../scraper/scraper.js');
        if (!$scriptPath) {
            Logger::error('scraper', 'scraper.js non trovato');
            throw new Exception('Scraper Node.js non trovato. Verifica la cartella scraper/.');
        }
        
        // 2>&1 cattura anche stderr così i messaggi di errore Node.js sono visibili
        $cmd = 'node ' . escapeshellarg($scriptPath)
            . ' ' . escapeshellarg($platform)
            . ' ' . escapeshellarg($url)
            . ' ' . (int)$limit
            . ' 2>&1';
        
        Logger::info('scraper', "Avvio Node.js scraper", ['platform' => $platform, 'url' => $url, 'limit' => $limit, 'cmd' => $cmd]);
        
        $output = shell_exec($cmd);
        
        // shell_exec ritorna null se il comando non può essere eseguito (es. permessi)
        if ($output === null) {
            Logger::error('scraper', 'Node.js non avviabile (output null)', ['platform' => $platform]);
            throw new Exception("Scraper: impossibile avviare Node.js. Verificare che node sia installato e shell_exec sia abilitato.");
        }
        
        $output = trim($output);
        if ($output === '') {
            Logger::warn('scraper', 'Node.js output vuoto', ['platform' => $platform, 'url' => $url]);
            throw new Exception("Scraper: Node.js ha restituito output vuoto per $platform.");
        }
        
        Logger::debug('scraper', 'Node.js raw output', ['platform' => $platform, 'output_preview' => mb_substr($output, 0, 300)]);
        
        // Tenta di estrarre il JSON dall'output (può esserci stderr prima del JSON)
        $jsonStart = strpos($output, '{');
        $jsonStartArr = strpos($output, '[');
        if ($jsonStartArr !== false && ($jsonStart === false || $jsonStartArr < $jsonStart)) {
            $jsonStart = $jsonStartArr;
        }
        if ($jsonStart !== false) {
            $output = substr($output, $jsonStart);
        }
        
        $result = json_decode($output, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Logger::error('scraper', 'JSON non valido da Node.js', ['platform' => $platform, 'output' => mb_substr($output, 0, 300)]);
            throw new Exception("Scraper: risposta JSON non valida. Output: " . mb_substr($output, 0, 200));
        }
        
        if (isset($result['error'])) {
            Logger::error('scraper', 'Errore da Node.js scraper', ['platform' => $platform, 'error' => $result['error']]);
            throw new Exception("Scraper: " . $result['error']);
        }
        
        $count = is_array($result) ? count($result) : 1;
        Logger::info('scraper', "Node.js OK", ['platform' => $platform, 'items' => $count]);
        
        // Assicurati che ritorni un array di risultati (limit > 0) o un singolo oggetto (limit == 0)
        return is_array($result) ? $result : [];
    }

    private static function apifyRun(string $actorId, array $input): array {
        if (!defined('APIFY_TOKEN') || !APIFY_TOKEN) {
            Logger::error('apify', 'APIFY_TOKEN mancante');
            throw new Exception('APIFY_TOKEN mancante in config/keys.php');
        }
        $actorIdSafe = str_replace('/', '~', $actorId);
        // Aggiungiamo timeoutSecs e memoryMbytes all'input per contenere i tempi dell'actor
        $input = array_merge([
            'timeoutSecs'  => 180,
            'memoryMbytes' => 512,
        ], $input);
        $url = "https://api.apify.com/v2/acts/$actorIdSafe/run-sync-get-dataset-items?token=" . APIFY_TOKEN
             . "&timeout=180&memory=512";
        
        Logger::info('apify', "Avvio actor Apify", ['actor' => $actorId, 'input_keys' => array_keys($input)]);
        $startTime = microtime(true);
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($input, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 300, // 5 min: Apify può richiedere fino a 3 min
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        
        $elapsed = round(microtime(true) - $startTime, 2);

        if ($res === false) {
            Logger::error('apify', "Errore di rete curl", ['actor' => $actorId, 'curl_error' => $err, 'elapsed_s' => $elapsed]);
            throw new Exception("Apify: errore di rete ($err)");
        }
        
        $data = json_decode($res, true);
        if ($code >= 400) {
            $msg = $data['error']['message'] ?? (is_string($res) ? mb_substr($res, 0, 200) : 'risposta non valida');
            Logger::error('apify', "HTTP $code dal actor", ['actor' => $actorId, 'code' => $code, 'msg' => $msg, 'elapsed_s' => $elapsed]);
            throw new Exception("Apify ($code): $msg");
        }
        
        $count = is_array($data) ? count($data) : 0;
        Logger::info('apify', "Actor OK", ['actor' => $actorId, 'items' => $count, 'elapsed_s' => $elapsed]);
        
        return is_array($data) ? $data : [];
    }

    // ── Cerca ricorsivamente il primo URL video plausibile in un item ──────
    private static function findMediaUrl($node, $ignoreKeys = ['author', 'owner', 'user', 'profile']): string {
        if (is_string($node)) {
            if (preg_match('~^https?://~', $node) &&
                preg_match('~\.(mp4|mov|m4v|webm)(\?|$)~i', $node)) return $node;
            return '';
        }
        if (is_array($node)) {
            // chiavi "forti" controllate per prime
            foreach (['videoUrlNoWaterMark','videoUrl','downloadAddr','playAddr','mediaUrl'] as $k) {
                if (!empty($node[$k]) && is_string($node[$k]) && preg_match('~^https?://~', $node[$k])) {
                    return $node[$k];
                }
            }
            foreach ($node as $k => $v) {
                $skip = false;
                foreach ($ignoreKeys as $ik) {
                    if (stripos((string)$k, $ik) !== false) { $skip = true; break; }
                }
                if ($skip) continue;
                $u = self::findMediaUrl($v, $ignoreKeys);
                if ($u) return $u;
            }
        }
        return '';
    }

    // ── Cerca ricorsivamente il primo URL immagine plausibile ─────────────
    private static function findImageUrl($node, $ignoreKeys = ['author', 'owner', 'user', 'profile', 'avatar']): string {
        if (is_string($node)) {
            if (preg_match('~^https?://~', $node) &&
                preg_match('~\.(jpg|jpeg|png|webp)(\?|$)~i', $node)) return $node;
            return '';
        }
        if (is_array($node)) {
            foreach (['displayUrl','thumbnailUrl','coverUrl','imageUrl','cover','thumbnail','image'] as $k) {
                if (!empty($node[$k]) && is_string($node[$k]) && preg_match('~^https?://~', $node[$k])) {
                    return $node[$k];
                }
            }
            foreach ($node as $k => $v) {
                $skip = false;
                foreach ($ignoreKeys as $ik) {
                    if (stripos((string)$k, $ik) !== false) { $skip = true; break; }
                }
                if ($skip) continue;
                $u = self::findImageUrl($v, $ignoreKeys);
                if ($u) return $u;
            }
        }
        return '';
    }

    private static function findSourceUrl($node): string {
        if (is_string($node)) {
            return preg_match('~^https?://~', $node) ? $node : '';
        }
        if (is_array($node)) {
            foreach (['url','postUrl','webVideoUrl','videoWebUrl','shortCodeUrl','permalink','link'] as $k) {
                if (!empty($node[$k]) && is_string($node[$k]) && preg_match('~^https?://~', $node[$k])) {
                    return $node[$k];
                }
            }
            foreach ($node as $v) {
                $u = self::findSourceUrl($v);
                if ($u) return $u;
            }
        }
        return '';
    }

    public static function sourceItems(string $platform, string $url, int $limit = 5, ?string $sinceDate = null): array {
        if ($platform === 'youtube') {
            $channelId = '';
            if (preg_match('~/channel/([A-Za-z0-9_-]{20,})~', $url, $m)) {
                $channelId = $m[1];
            } else {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36)'
                ]);
                $html = curl_exec($ch);
                curl_close($ch);
                if ($html && preg_match('/"browseId":"(UC[a-zA-Z0-9_-]{22})"/', $html, $m)) {
                    $channelId = $m[1];
                } elseif ($html && preg_match('/<meta\s+itemprop="identifier"\s+content="(UC[a-zA-Z0-9_-]{22})"/i', $html, $m)) {
                    $channelId = $m[1];
                }
            }

            if ($channelId) {
                $feed = @simplexml_load_file('https://www.youtube.com/feeds/videos.xml?channel_id=' . $channelId);
                $items = [];
                if ($feed && isset($feed->entry)) {
                    foreach ($feed->entry as $entry) {
                        $videoId = (string) $entry->children('yt', true)->videoId;
                        $publishedAt = (string) $entry->published;
                        if ($sinceDate && strtotime($publishedAt) < strtotime($sinceDate)) {
                            continue;
                        }
                        if ($videoId) $items[] = ['url' => 'https://www.youtube.com/watch?v=' . $videoId];
                        if (count($items) >= $limit) break;
                    }
                }
                return $items;
            }
            return [];
        }

        if (!in_array($platform, ['tiktok', 'instagram', 'facebook'])) {
            throw new Exception('Piattaforma non gestita per la scansione');
        }

        // Se è Instagram, usiamo Apify
        if ($platform === 'instagram') {
            Logger::info('apify', 'sourceItems Instagram start', ['url' => $url, 'limit' => $limit, 'sinceDate' => $sinceDate]);
            $actorId = 'apify/instagram-profile-scraper';
            // Estrai username dall'url (gestisce URL con o senza trailing slash e query string)
            $username = '';
            if (preg_match('~(?:instagram\.com/)([A-Za-z0-9_.]+)~i', $url, $m)) {
                $username = rtrim($m[1], '/');
            }
            if (!$username) {
                Logger::error('apify', 'URL Instagram non valido', ['url' => $url]);
                throw new Exception('URL Instagram non valido: impossibile estrarre username.');
            }
            
            // Recuperiamo molti più post di quanti ne servono per poi filtrare per data lato PHP.
            $fetchLimit = max($limit * 3, 30);
            
            $input = [
                'usernames'    => [$username],
                'resultsLimit' => $fetchLimit,
            ];
            
            $dataset = self::apifyRun($actorId, $input);
            if (empty($dataset)) {
                Logger::warn('apify', 'Dataset Instagram vuoto (profilo privato?)', ['username' => $username]);
                return []; // Profilo privato o zero post: non è un errore
            }
            
            $out = [];
            $skippedByDate = 0;
            
            $postsData = [];
            foreach ($dataset as $it) {
                if (isset($it['latestPosts'])) {
                    foreach ($it['latestPosts'] as $p) {
                        $postsData[] = $p;
                    }
                } else {
                    $postsData[] = $it; // Fallback se fosse array di post diretti
                }
            }
            
            foreach ($postsData as $item) {
                // Apify instagram-profile-scraper usa 'url' o 'shortCode' per il link del post
                $postUrl = $item['url'] ?? '';
                if (!$postUrl && !empty($item['shortCode'])) {
                    $postUrl = 'https://www.instagram.com/p/' . $item['shortCode'] . '/';
                }
                if (!$postUrl || preg_match('~/p/$~', $postUrl) || $postUrl === $url) continue; // Evita di ingurgitare la home del profilo
                
                // Filtraggio per data: controlla sia 'timestamp' che 'takenAtTimestamp'
                if ($sinceDate) {
                    $ts = $item['timestamp'] ?? $item['takenAtTimestamp'] ?? '';
                    if ($ts) {
                        $postTime = is_numeric($ts) ? (int)$ts : strtotime($ts);
                        if ($postTime > 0 && $postTime < strtotime($sinceDate)) {
                            $skippedByDate++;
                            continue;
                        }
                    }
                }
                
                $caption   = $item['caption'] ?? $item['alt'] ?? '';
                $mediaUrl  = $item['videoUrl'] ?? $item['displayUrl'] ?? $item['thumbnailUrl'] ?? '';
                $mediaType = !empty($item['videoUrl']) ? 'video' : 'image';
                
                $out[] = [
                    'url'        => $postUrl,
                    'caption'    => $caption,
                    'media_url'  => $mediaUrl,
                    'media_type' => $mediaType,
                ];
                if ($limit > 0 && count($out) >= $limit) break;
            }
            Logger::info('apify', 'sourceItems Instagram result', [
                'username'       => $username,
                'fetched'        => count($dataset),
                'returned'       => count($out),
                'skipped_date'   => $skippedByDate,
                'sinceDate'      => $sinceDate,
            ]);
            return $out;
        }

        // Usa lo scraper locale Node.js (se disponibile) per Tiktok e Facebook, altrimenti usa Apify
        $items = [];
        if (function_exists('shell_exec')) {
            $items = self::nodeScrape($platform, $url, $limit);
        } else {
            // Fallback ad Apify se shell_exec non e' disponibile
            if ($platform === 'facebook') {
                $dataset = self::apifyRun('apify/facebook-pages-scraper', [
                    'startUrls' => [['url' => $url]],
                    'resultsLimit' => $limit ?: 20,
                ]);
                $items = $dataset;
            } elseif ($platform === 'tiktok') {
                // Per TikTok possiamo provare tiktok-scraper
                $username = '';
                if (preg_match('~@([^/?]+)~', $url, $m)) $username = $m[1];
                if (!$username) throw new Exception("Impossibile estrarre username da URL TikTok");
                $dataset = self::apifyRun('clockworks/tiktok-profile-scraper', [
                    'profiles' => [$username],
                    'resultsPerPage' => $limit ?: 20,
                ]);
                $items = $dataset;
            } else {
                 throw new Exception("shell_exec disabilitato: impossibile avviare lo scraper locale.");
            }
        }

        $out = [];
        foreach ($items as $item) {
            $sourceUrl = self::findSourceUrl($item);
            if (!$sourceUrl && !empty($item['url'])) $sourceUrl = $item['url'];
            if (!$sourceUrl) continue;
            
            $caption = '';
            foreach (['text','caption','message','description','video_description','story'] as $k) {
                if (!empty($item[$k]) && is_string($item[$k])) { $caption = $item[$k]; break; }
            }
            if (!$caption && !empty($item['edge_media_to_caption']['edges'][0]['node']['text'])) {
                $caption = $item['edge_media_to_caption']['edges'][0]['node']['text'];
            }
            
            $mediaUrl = self::findMediaUrl($item);
            if (!$mediaUrl && !empty($item['mediaUrl'])) $mediaUrl = $item['mediaUrl'];
            
            $mediaType = $mediaUrl && preg_match('/\.mp4/i', $mediaUrl) ? 'video' : ($mediaUrl ? 'image' : 'text');
            if (!$mediaUrl) {
                $mediaUrl = self::findImageUrl($item);
                if ($mediaUrl) $mediaType = 'image';
            }
            
            $out[] = [
                'url' => $sourceUrl,
                'caption' => $caption,
                'media_url' => $mediaUrl,
                'media_type' => $mediaType
            ];
            if ($limit > 0 && count($out) >= $limit) break;
        }
        return $out;
    }

    public static function profileSummary(array $sources, array $samplePosts): string {
        $lines = [];
        foreach ($sources as $source) {
            $lines[] = strtoupper($source['platform']) . ': ' . ($source['label'] ?: $source['url']);
        }
        $samples = [];
        foreach ($samplePosts as $post) {
            $text = trim(($post['generated_title'] ?? '') . ' ' . ($post['generated_excerpt'] ?? '') . ' ' . ($post['raw_content'] ?? ''));
            if ($text) $samples[] = mb_substr($text, 0, 500);
        }

        $prompt = "Genera un profilo sintetico, editabile e realistico della persona o brand dietro questi social.\n"
            . "Non inventare dati biografici: deduci solo temi, tono, competenze, pubblico e argomenti ricorrenti.\n\n"
            . "Canali:\n- " . implode("\n- ", $lines) . "\n\n"
            . "Esempi contenuti:\n- " . implode("\n- ", array_slice($samples, 0, 8)) . "\n\n"
            . "Rispondi in italiano in 5-7 frasi, senza markdown.";

        return trim(self::gemini([['text' => $prompt]], [
            'maxOutputTokens' => 2048,
        ]));
    }

    public static function editorialProfile(array $sources, array $samplePosts, string $profileOverride = ''): array {
        $lines = [];
        foreach ($sources as $source) {
            $lines[] = strtoupper($source['platform']) . ': ' . ($source['label'] ?: $source['url']);
        }
        $samples = [];
        foreach ($samplePosts as $post) {
            $text = trim(($post['generated_title'] ?? '') . ' ' . ($post['generated_excerpt'] ?? '') . ' ' . ($post['raw_content'] ?? '') . ' ' . ($post['transcript'] ?? ''));
            if ($text) $samples[] = mb_substr($text, 0, 700);
        }

        $prompt = "Agisci come agente editoriale per un sito personale/brand nato da piu' social.\n"
            . "Obiettivo: capire il ruolo unico impersonificato dalla persona/brand, la missione e cosa va aggregato.\n"
            . "Non inventare biografia. Deduci solo da canali, profilo indicato e contenuti.\n\n"
            . "Profilo gia' indicato dall'utente:\n" . ($profileOverride ?: 'Non indicato') . "\n\n"
            . "Canali:\n- " . implode("\n- ", $lines) . "\n\n"
            . "Esempi contenuti:\n- " . implode("\n- ", array_slice($samples, 0, 10)) . "\n\n"
            . "Rispondi SOLO con JSON valido: "
            . '{"profile_summary":"5-7 frasi sintetiche","role_mission":"ruolo e missione in 2-3 frasi",'
            . '"content_strategy":"regole editoriali: cosa pubblicare, cosa evitare, tono, temi ricorrenti",'
            . '"keywords":["keyword1","keyword2","keyword3","keyword4","keyword5"]}';

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 4096,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result) {
            return [
                'profile_summary'  => $profileOverride,
                'role_mission'     => $profileOverride,
                'content_strategy' => 'Pubblica solo contenuti coerenti con profilo, competenze, temi ricorrenti e pubblico del brand.',
                'keywords'         => [],
            ];
        }
        return $result;
    }

    public static function contentDecision(string $content, string $platform, string $sourceUrl, string $editorialContext, array $recentPosts = []): array {
        $recent = [];
        foreach ($recentPosts as $post) {
            $recent[] = trim(($post['generated_title'] ?? '') . ' ' . ($post['generated_excerpt'] ?? '') . ' ' . ($post['raw_content'] ?? ''));
        }
        $prompt = "Sei un agente curatoriale. Decidi se questo contenuto social va pubblicato nel sito.\n"
            . "Criteri: deve rappresentare ruolo/missione del profilo, evitare doppioni tematici, essere utile a Google e non essere puro rumore.\n"
            . "Contesto editoriale:\n$editorialContext\n\n"
            . "Contenuti recenti gia' pubblicati:\n- " . implode("\n- ", array_slice($recent, 0, 10)) . "\n\n"
            . "Nuovo contenuto ($platform, $sourceUrl):\n" . mb_substr($content, 0, 2500) . "\n\n"
            . "Rispondi SOLO con JSON valido: "
            . '{"publish":true,"relevance_score":82,"duplicate_risk":12,"reason":"motivazione breve",'
            . '"canonical_topic":"tema principale normalizzato","suggested_angle":"taglio editoriale"}';

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 2048,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result) {
            return [
                'publish'          => true,
                'relevance_score'  => 60,
                'duplicate_risk'   => 0,
                'reason'           => 'Valutazione automatica non disponibile: contenuto accettato con priorita media.',
                'canonical_topic'  => '',
                'suggested_angle'  => '',
            ];
        }
        $result['relevance_score'] = max(0, min(100, (int)($result['relevance_score'] ?? 0)));
        $result['duplicate_risk'] = max(0, min(100, (int)($result['duplicate_risk'] ?? 0)));
        $result['publish'] = (bool)($result['publish'] ?? false);
        return $result;
    }

    // ── AGENTE 1: risolve un link social via Apify → caption + media ───────
    public static function apifyResolve(string $platform, string $url): array {
        if (function_exists('shell_exec')) {
            try {
                $it = self::nodeScrape($platform, $url, 0);
                if ($it && (!empty($it['caption']) || !empty($it['video']) || !empty($it['image']))) {
                    return [
                        'caption' => $it['caption'] ?? '',
                        'video'   => $it['video'] ?? '',
                        'image'   => $it['image'] ?? '',
                    ];
                }
            } catch (Throwable $e) {}
        }

        // Fallback ad Apify
        $items = self::sourceItems($platform, $url, 1);
        if (empty($items)) {
            throw new Exception('Lo scraper non ha restituito contenuti validi per questo link');
        }
        $item = $items[0];
        return [
            'caption' => $item['caption'] ?? '',
            'video'   => $item['media_type'] === 'video' ? $item['media_url'] : '',
            'image'   => $item['media_type'] === 'image' ? $item['media_url'] : '',
        ];
    }

    // ── Scarica un media e lo trascrive con Gemini (inline) ────────────────
    public static function transcribeMediaUrl(string $mediaUrl): string {
        $tmp = tempnam(sys_get_temp_dir(), 'sts_') . '.mp4';
        $fp  = fopen($tmp, 'w');
        $ch  = curl_init($mediaUrl);
        curl_setopt_array($ch, [
            CURLOPT_FILE           => $fp,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; SocialToSite/1.0)',
        ]);
        curl_exec($ch);
        curl_close($ch);
        fclose($fp);

        $size = @filesize($tmp) ?: 0;
        if (!$size) { @unlink($tmp); return ''; }
        if ($size > 15 * 1024 * 1024) { // limite inline Gemini ~20MB col base64
            @unlink($tmp);
            throw new Exception('Video troppo grande per la trascrizione diretta (>15MB). Lo gestiremo a breve con upload dedicato.');
        }
        $text = self::transcribeFile($tmp, 'video/mp4');
        @unlink($tmp);
        return $text;
    }

    // ── Genera il Profilo di Brand Voice ──────────────────────────────────────
    public static function generateBrandVoiceProfile(array $texts): string {
        $joined = implode("\n\n---\n\n", array_map(function($t) { return mb_substr(trim($t), 0, 1000); }, $texts));
        $prompt = "Sei un analista linguistico ed esperto SEO. Analizza i seguenti post social di un creatore di contenuti.
Crea un profilo dettagliato del suo 'Tono di Voce' (Brand Voice).
Cerca di identificare:
1. Il livello di formalità (informale, professionale, amichevole, tecnico).
2. L'uso di emoji, abbreviazioni o espressioni tipiche.
3. Se si rivolge al pubblico dando del 'tu', del 'voi' o in terza persona.
4. I 3-5 argomenti principali ricorrenti (Topic Clusters).

Restituisci ESCLUSIVAMENTE un oggetto JSON valido (senza markdown o altri testi) con questa struttura:
{
  \"tone\": \"descrizione del tono\",
  \"formality\": \"informal/professional/etc\",
  \"vocabulary_traits\": [\"lista\", \"di\", \"caratteristiche\"],
  \"pronouns\": \"tu/voi\",
  \"topic_clusters\": [\"topic1\", \"topic2\", \"topic3\"],
  \"custom_instructions\": \"istruzioni specifiche per l'AI che genererà futuri articoli (es. usa le emoji a fine frase, fai domande provocatorie)\"
}

Testi da analizzare:
" . $joined;

        $response = self::gemini([['text' => $prompt]], ['responseMimeType' => 'application/json']);
        $decoded = json_decode($response, true);
        if (!$decoded) return '{}';
        return json_encode($decoded, JSON_UNESCAPED_UNICODE);
    }

    // ── Trascrivi URL video con Whisper ────────────────────────────────────
    public static function transcribeUrl(string $videoUrl): string {
        // Scarica video in tmp
        $tmp = tempnam(sys_get_temp_dir(), 'sts_') . '.mp4';
        $ch  = curl_init($videoUrl);
        $fp  = fopen($tmp, 'w');
        curl_setopt_array($ch, [
            CURLOPT_FILE           => $fp,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_USERAGENT      => 'SocialToSite/1.0',
        ]);
        curl_exec($ch);
        curl_close($ch);
        fclose($fp);

        if (!filesize($tmp)) { unlink($tmp); return ''; }

        // Invia a Whisper
        $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
        $cfile = new CURLFile($tmp, 'video/mp4', 'audio.mp4');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . OPENAI_API_KEY],
            CURLOPT_POSTFIELDS     => ['file' => $cfile, 'model' => 'whisper-1', 'language' => 'it'],
            CURLOPT_TIMEOUT        => 120,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        unlink($tmp);

        $data = json_decode($res, true);
        return $data['text'] ?? '';
    }

    // ── Genera contenuto SEO con Claude ───────────────────────────────────
    public static function generateSeo(string $rawText, string $platform, string $caption = ''): array {
        $source = $caption
            ? "Caption social: \"$caption\"\n\nTrascrizione audio: \"$rawText\""
            : "Contenuto: \"$rawText\"";

        $prompt = "Sei un esperto SEO italiano. Analizza questo contenuto da $platform e genera:\n\n$source\n\n"
            . "Rispondi SOLO con JSON valido (nessun testo prima o dopo):\n"
            . '{"title":"Titolo SEO max 60 caratteri","body":"Testo articolo 200-400 parole in italiano naturale",'
            . '"excerpt":"Riassunto max 155 caratteri","tags":["tag1","tag2","tag3","tag4","tag5"],'
            . '"meta_description":"Meta description max 155 caratteri","seo_score":75}';

        $payload = json_encode([
            'model'      => 'claude-sonnet-4-6',
            'max_tokens' => 1024,
            'messages'   => [['role' => 'user', 'content' => $prompt]]
        ]);

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'x-api-key: '        . ANTHROPIC_API_KEY,
                'anthropic-version: 2023-06-01',
                'content-type: application/json',
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT    => 60,
        ]);
        $res  = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($res, true);
        $text = $data['content'][0]['text'] ?? '';
        $text = preg_replace('/```json|```/', '', trim($text));

        $result = json_decode($text, true);
        if (!$result) {
            return [
                'title'            => mb_substr($caption ?: $rawText, 0, 60),
                'body'             => $rawText ?: $caption,
                'excerpt'          => mb_substr($caption ?: $rawText, 0, 155),
                'tags'             => [],
                'meta_description' => mb_substr($caption ?: $rawText, 0, 155),
                'seo_score'        => 40,
            ];
        }
        return $result;
    }

    // ── Lettura Prompt da DB ──────────────────────────────────────────────
    private static function getAgentPrompt(string $agentName, string $defaultFallback): string {
        try {
            $row = DB::fetch('SELECT instructions FROM agent_prompts WHERE agent_name=?', [$agentName]);
            if ($row && !empty($row['instructions'])) return $row['instructions'];
        } catch (Throwable $e) {}
        return $defaultFallback;
    }

    // ── AGENTE 3 (SEO/GEO Specialist) ─────────────────────────────────────
    public static function seoSpecialistSetup(string $profileSummary, string $roleMission, string $contentStrategy, string $tagsContext = ''): array {
        $fallback = "Sei un SEO Specialist ed esperto di Comunicazione.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Strategia:\n{contentStrategy}\n\n"
            . "Devi estrarre e generare un array JSON per la configurazione base del sito, con queste chiavi:\n"
            . "1. 'title': Nome o Brand (max 60 char).\n"
            . "2. 'bio': Una meta description SEO (max 160 char).\n"
            . "3. 'hero_tagline': Un breve slogan d'impatto o sottotitolo (max 80 char).\n"
            . "4. 'cover_url': Fornisci un URL per un'immagine di copertina adatta al settore usando Unsplash (es. https://images.unsplash.com/photo-... usa immagini reali, non source.unsplash.com obsoleto) oppure lascia vuoto se non trovi un URL preciso.\n"
            . "5. 'menu_links': Un array di 3-4 voci di menu. Includi una Home (url: '/') e 2-3 categorie basate RIGOROSAMENTE sui tag reali per filtrare i post (es. [{'label':'Lifestyle', 'url':'/?tag=lifestyle'}]). I tag reali disponibili nel DB sono: [{tagsContext}]. NON INVENTARE TAG CHE NON SONO NELLA LISTA.\n"
            . "6. 'footer_text': Una frase conclusiva o disclaimer per il footer.\n\n"
            . "Rispondi SOLO con il JSON.";

        $prompt = self::getAgentPrompt('seo_specialist', $fallback);
        $prompt = str_replace(['{profileSummary}', '{roleMission}', '{contentStrategy}', '{tagsContext}'], [$profileSummary, $roleMission, $contentStrategy, $tagsContext ?: 'Nessun tag disponibile'], $prompt);

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 1024,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result) {
            return [
                'title'       => '',
                'bio'         => '',
                'menu_links'  => [],
                'footer_text' => '',
            ];
        }
        return $result;
    }

    // ── AGENTE 4 (Graphic Designer - Generazione di 3 proposte) ───────────
    public static function graphicDesignerSetup(string $profileSummary, string $roleMission, string $contentStrategy): array {
        $fallback = "Sei un Art Director digitale di fama mondiale. Devi creare 3 proposte di design ('Archetipi') premium e radicalmente diverse per questo profilo. NON usare stock photo, basa l'estetica su colori vibranti, tipografia pregiata e layout puliti.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Strategia contenuti:\n{contentStrategy}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Genera un array JSON con ESATTAMENTE 3 oggetti, ognuno rappresenta una proposta. Struttura:\n"
            . "1. 'design_archetype': Nome dell'archetipo (es. 'Minimal & Clean', 'Dark Neo-brutalism', 'Elegant Editorial').\n"
            . "2. 'font_heading': Google Font per titoli (es. 'Playfair Display', 'Syne', 'Outfit').\n"
            . "3. 'font_body': Google Font testi (es. 'Inter', 'Lora').\n"
            . "4. 'color_palette': oggetto con { 'background': '#hex', 'surface': '#hex', 'text': '#hex', 'text_muted': '#hex', 'primary': '#hex', 'secondary': '#hex', 'primary_gradient': 'linear-gradient(...)' }.\n"
            . "5. 'ui_style': oggetto con { 'radius': 'px', 'card_shadow': 'css string', 'glassmorphism': bool }.\n"
            . "6. 'layout_recipe': oggetto con { 'hero': 'editorial|split|immersive|human|product', 'nav': 'transparent|solid|floating', 'cards': 'editorial|bold|soft|product|cinematic', 'density': 'airy|balanced|compact' }.\n"
            . "7. 'base_models': array con 1 o 2 ID presi SOLO dalla libreria locale.\n"
            . "8. 'custom_css': CSS aggiuntivo ultra-raffinato (micro-animazioni, hover). Max 300 char.\n\n"
            . "Le 3 proposte devono essere curate, credibili e molto diverse fra loro, ma sempre ancorate alla libreria modelli fornita.\n"
            . "Esempio output:\n"
            . '{"proposals": [{"design_archetype":"Minimal","font_heading":"Inter","font_body":"Inter","color_palette":{"background":"#ffffff","surface":"#f8f9fa","text":"#111111","text_muted":"#666666","primary":"#000000","secondary":"#f3f4f6","primary_gradient":"linear-gradient(to right, #333, #000)"},"ui_style":{"radius":"4px","card_shadow":"none","glassmorphism":false},"layout_recipe":{"hero":"product","nav":"solid","cards":"product","density":"balanced"},"base_models":["tech-clarity"],"custom_css":""}]}';

        $prompt = self::getAgentPrompt('graphic_designer', $fallback);
        $prompt .= self::buildDesignLibraryPrompt();
        $prompt .= self::buildDesignRecommendationPrompt($profileSummary, $roleMission, $contentStrategy);
        $prompt = str_replace(['{profileSummary}', '{roleMission}', '{contentStrategy}'], [$profileSummary, $roleMission, $contentStrategy], $prompt);

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 4096,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result || empty($result['proposals'])) {
            return [
                [
                    'design_archetype' => 'Default Clean',
                    'font_heading' => 'Outfit', 'font_body' => 'Inter',
                    'color_palette' => ['background'=>'#F5F1EA', 'surface'=>'#FFFDF9', 'text'=>'#201A17', 'text_muted'=>'#6E6258', 'primary'=>'#A06A42', 'secondary'=>'#FFF7EE', 'primary_gradient'=>'linear-gradient(135deg, #C79063, #8A5634)'],
                    'ui_style' => ['radius'=>'16px', 'card_shadow'=>'0 10px 30px rgba(0,0,0,0.05)', 'glassmorphism'=>false],
                    'layout_recipe' => ['hero' => 'editorial', 'nav' => 'transparent', 'cards' => 'editorial', 'density' => 'airy'],
                    'base_models' => ['editorial-luxe'],
                    'custom_css' => ''
                ]
            ];
        }
        foreach ($result['proposals'] as &$proposal) {
            $proposal['color_palette'] = self::normalizeColorPalette($proposal['color_palette'] ?? []);
            if (empty($proposal['base_models']) || !is_array($proposal['base_models'])) {
                $proposal['base_models'] = self::recommendDesignModels($profileSummary, $roleMission, $contentStrategy);
            }
            if (empty($proposal['layout_recipe']) || !is_array($proposal['layout_recipe'])) {
                $proposal['layout_recipe'] = ['hero' => 'editorial', 'nav' => 'transparent', 'cards' => 'editorial', 'density' => 'airy'];
            }
        }
        unset($proposal);
        return $result['proposals'];
    }

    // ── AGENTE SITO AI (Generazione completa su misura) ────────────────────
    public static function siteAiGenerate(string $profileSummary, string $roleMission, string $contentStrategy, string $recentPosts = '', string $tagsContext = ''): array {
        $fallback = "Sei un Direttore Artistico (Art Director) e Caporedattore di altissimo livello.\n"
            . "Il tuo compito: analizzare il profilo utente e definire un **Archetipo di Design** dinamico (es. Minimalista Elegante, Tech Vibrante, Creator Dinamico), generando la configurazione UI Premium su misura. NON proporre immagini di stock, il sito esalterà solo i contenuti social dell'utente e grafiche astratte di altissima qualità.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Strategia contenuti:\n{contentStrategy}\n\n"
            . "Post recenti pubblicati:\n{recentPosts}\n\n"
            . "Tag REALI attualmente assegnati ai contenuti nel database:\n[{tagsContext}]\n\n"
            . "Genera un JSON con questa rigorosa struttura:\n"
            . "{\n"
            . '  "title": "Titolo H1 sito max 60 caratteri",' . "\n"
            . '  "bio": "Bio ottimizzata max 200 caratteri",' . "\n"
            . '  "role_mission": "Missione aggiornata max 150 caratteri",' . "\n"
            . '  "design_archetype": "Il nome dell\'archetipo (es. Neo Brutalism, Clean Corporate)",' . "\n"
            . '  "font_heading": "Nome di un Google Font premium per titoli (es. Playfair Display, Outfit, Syne)",' . "\n"
            . '  "font_body": "Nome di un Google Font per i testi (es. Inter, Roboto, Lora)",' . "\n"
            . '  "color_palette": {' . "\n"
            . '    "background": "#hex (chiaro o scuro a seconda dell\'archetipo)",' . "\n"
            . '    "surface": "#hex (colore per le card, con buon contrasto su bg)",' . "\n"
            . '    "text": "#hex (colore testo primario ad altissimo contrasto)",' . "\n"
            . '    "text_muted": "#hex",' . "\n"
            . '    "primary": "#hex (colore di accento vibrante)",' . "\n"
            . '    "secondary": "#hex (supporto per superfici, badge e dettagli)",' . "\n"
            . '    "primary_gradient": "linear-gradient(135deg, #hex, #hex)"' . "\n"
            . '  },' . "\n"
            . '  "ui_style": {' . "\n"
            . '    "radius": "0px / 8px / 16px / 24px (in base allo stile)",' . "\n"
            . '    "card_shadow": "ombra CSS premium (es. 0 10px 30px rgba(0,0,0,0.05))",' . "\n"
            . '    "glassmorphism": true o false (se usare backdrop-filter)' . "\n"
            . '  },' . "\n"
            . '  "layout_recipe": {' . "\n"
            . '    "hero": "editorial|split|immersive|human|product",' . "\n"
            . '    "nav": "transparent|solid|floating",' . "\n"
            . '    "cards": "editorial|bold|soft|product|cinematic",' . "\n"
            . '    "density": "airy|balanced|compact"' . "\n"
            . '  },' . "\n"
            . '  "base_models": ["id_modello_1", "id_modello_2 opzionale"],' . "\n"
            . '  "menu_links": [{"label":"Home","url":"/"},{"label":"Categoria Esistente","url":"/?tag=tag_reale"}],' . "\n"
            . '  "footer_text": "Testo footer",' . "\n"
            . '  "hero_tagline": "Frase impatto max 80 char",' . "\n"
            . '  "cta_text": "Call to action",' . "\n"
            . '  "custom_css": "CSS aggiuntivo opzionale (max 500 char) per micro-animazioni o hover states unici."' . "\n"
            . "}\n\n"
            . "Il design deve sembrare scelto da un art director. Parti dalla libreria modelli fornita, non da estetiche AI generiche.";

        $prompt = self::getAgentPrompt('site_ai', $fallback);
        $prompt .= self::buildDesignLibraryPrompt();
        $prompt .= self::buildDesignRecommendationPrompt($profileSummary, $roleMission, $contentStrategy);
        $prompt = str_replace(
            ['{profileSummary}', '{roleMission}', '{contentStrategy}', '{recentPosts}', '{tagsContext}'],
            [$profileSummary, $roleMission, $contentStrategy, $recentPosts ?: 'Nessun post ancora disponibile', $tagsContext ?: 'Nessun tag disponibile'],
            $prompt
        );

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 8192,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);
        if (!$result) {
            return [
                'title'         => '',
                'bio'           => '',
                'role_mission'  => '',
                'design_archetype' => 'Default Clean',
                'font_heading'  => 'Outfit',
                'font_body'     => 'Inter',
                'color_palette' => ['background'=>'#F5F1EA', 'surface'=>'#FFFDF9', 'text'=>'#201A17', 'text_muted'=>'#6E6258', 'primary'=>'#A06A42', 'secondary'=>'#FFF7EE', 'primary_gradient'=>'linear-gradient(135deg, #C79063, #8A5634)'],
                'ui_style'      => ['radius'=>'16px', 'card_shadow'=>'0 10px 30px rgba(0,0,0,0.05)', 'glassmorphism'=>false],
                'layout_recipe' => ['hero' => 'editorial', 'nav' => 'transparent', 'cards' => 'editorial', 'density' => 'airy'],
                'base_models'   => ['editorial-luxe'],
                'menu_links'    => [],
                'footer_text'   => '',
                'custom_css'    => '',
                'hero_tagline'  => '',
                'cta_text'      => 'Scopri i miei contenuti',
            ];
        }
        if (isset($result['color_palette']) && is_array($result['color_palette'])) {
            $result['color_palette'] = self::normalizeColorPalette($result['color_palette']);
        }
        if (empty($result['base_models']) || !is_array($result['base_models'])) {
            $result['base_models'] = self::recommendDesignModels($profileSummary, $roleMission, $contentStrategy);
        }
        if (empty($result['layout_recipe']) || !is_array($result['layout_recipe'])) {
            $result['layout_recipe'] = ['hero' => 'editorial', 'nav' => 'transparent', 'cards' => 'editorial', 'density' => 'airy'];
        }
        return $result;
    }

    // ── AGENTE CAPOREDATTORE (Orchestrazione Contenuti) ─────────────────────
    public static function chiefEditor(array $site, array $posts): array {
        if (empty($posts)) {
            return ['ok' => false, 'message' => 'Nessun post da analizzare.'];
        }

        $summary  = trim($site['profile_summary'] ?? $site['bio'] ?? '');
        $role     = trim($site['role_mission'] ?? '');
        
        $postsData = [];
        foreach ($posts as $p) {
            $postsData[] = [
                'id' => (int)$p['id'],
                'title' => $p['edited_title'] ?: ($p['generated_title'] ?: mb_substr(strip_tags($p['raw_content'] ?? ''), 0, 80)),
                'tags' => is_array($p['tags']) ? $p['tags'] : (json_decode($p['tags'] ?? '[]', true) ?: [])
            ];
        }

        $postsContext = json_encode($postsData, JSON_UNESCAPED_UNICODE);

        $fallback = "Sei il CAPOREDATTORE di un sito web personale/brand. Analizza tutti i post pubblicati e orchestra i contenuti per creare un'esperienza editoriale coerente.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo:\n{roleMission}\n\n"
            . "Post attuali (JSON id, title, tags):\n{postsContext}\n\n"
            . "Istruzioni:\n"
            . "1. Individua 3-4 macro-categorie tematiche reali e armoniche analizzando il significato semantico dei titoli e dei tag presenti.\n"
            . "2. Per ciascuno dei post forniti nel JSON, assegna a quale di queste 3-4 macro-categorie appartiene (in base al contenuto).\n"
            . "3. Genera un menu_links usando queste categorie (es. label 'Design', url '/?tag=design'). Includi sempre anche la Home (url: '/').\n"
            . "4. Scegli l'ID del post migliore, più rappresentativo e di alta qualità da mettere in evidenza (featured_post_id).\n"
            . "5. Genera una hero_tagline (max 80 char) che riassuma l'identità editoriale attuale.\n\n"
            . "Rispondi SOLO con JSON valido con questa esatta struttura:\n"
            . '{"categories":["Categoria1","Categoria2"],"post_categories":{"POST_ID_1":"Categoria1","POST_ID_2":"Categoria2"},"menu_links":[{"label":"Home","url":"/"},{"label":"Categoria1","url":"/?tag=categoria1"}],"featured_post_id":123,"hero_tagline":"Tagline d\'impatto"}';

        $prompt = self::getAgentPrompt('chief_editor', $fallback);
        $prompt = str_replace(
            ['{profileSummary}', '{roleMission}', '{postsContext}'],
            [$summary, $role, $postsContext],
            $prompt
        );

        $text = self::gemini([['text' => $prompt]], [
            'responseMimeType' => 'application/json',
            'maxOutputTokens'  => 4096,
        ]);
        $text = preg_replace('/```json|```/', '', trim($text));
        $result = json_decode($text, true);

        if (!$result) {
            return ['ok' => false, 'message' => 'Errore nella generazione del piano editoriale.'];
        }

        $result['ok'] = true;
        return $result;
    }

    // ── AGENTE TAG NORMALIZER ────────────────────────────────────────────────
    public static function tagNormalizer(array $tags): array {
        if (empty($tags)) return [];
        $tagsList = implode(", ", $tags);
        
        $prompt = "Sei un tassonomista esperto. Hai questa lista disordinata di tag assegnati a vari post:\n"
            . "[$tagsList]\n\n"
            . "Il tuo compito è pulirli, unificare i sinonimi, correggere typo e raggrupparli in concetti chiave eleganti (es. 'cucina', 'ricette', 'food' -> 'Cucina'). "
            . "Mantieni i tag unici se sono specifici e sensati. Capitalizza la prima lettera.\n\n"
            . "Rispondi SOLO con un oggetto JSON chiave-valore dove la chiave è il tag originale esatto (minuscolo) e il valore è il tag normalizzato.\n"
            . 'Esempio: {"ricette":"Cucina", "food":"Cucina", "viaggi":"Viaggi", "ai":"Intelligenza Artificiale"}';

        try {
            $text = self::gemini([['text' => $prompt]], [
                'responseMimeType' => 'application/json',
                'maxOutputTokens'  => 4096,
            ]);
            $text = preg_replace('/```json|```/', '', trim($text));
            $mapping = json_decode($text, true);
            return is_array($mapping) ? $mapping : [];
        } catch (Throwable $e) {
            return [];
        }
    }
}

