<?php
// api/services/ai.php — Motore AI: Gemini (trascrizione + armonizzazione).
// Mantiene anche Whisper/Claude come alternative.
require_once __DIR__ . '/../../config/config.php';
if (file_exists(__DIR__ . '/../../config/keys.php')) require_once __DIR__ . '/../../config/keys.php';

class AI {

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
    public static function harmonize(string $rawText, string $platform = '', string $caption = '', string $sourceContext = ''): array {
        $source = $caption
            ? "Didascalia social: \"$caption\"\n\nTrascrizione: \"$rawText\""
            : "Contenuto: \"$rawText\"";
        $context = $sourceContext ? "\n\nContesto dei canali/profili dell'utente:\n$sourceContext\n" : '';

        $prompt = "Sei il copywriter e curatore editoriale ufficiale di questo utente/brand. "
            . "Il tuo compito è trasformare il seguente contenuto" . ($platform ? " (estratto da $platform)" : '') . " in un articolo professionale per il suo sito web.\n\n"
            . "REGOLE FONDAMENTALI (PENA IL FALLIMENTO DEL TASK):\n"
            . "1. ADERENZA AL FATTO: Basati ESCLUSIVAMENTE sulle informazioni fornite nel Contenuto. NON inventare dettagli, NON aggiungere tendenze, challenge, fenomeni virali o notizie esterne se non esplicitamente menzionate nella Trascrizione/Didascalia.\n"
            . "2. RISPETTO DELLA PROFILAZIONE: Adatta il tono di voce e lo stile esattamente come indicato nel 'Contesto dei canali/profili dell'utente' (Target, Strategia, Tono). Se il contesto richiede un tono specifico, usalo.\n"
            . "3. PRESERVAZIONE: Se il contenuto originale contiene umorismo, sarcasmo, barzellette o sketch comici, PRESERVA ASSOLUTAMENTE LA COMICITA'. Non trasformare una barzelletta in un testo accademico.\n\n"
            . "PRIMA analizza il Contesto dell'Utente per capire chi sta parlando e a chi si rivolge. POI leggi il Contenuto e scrivi l'articolo.\n"
            . "$context\n$source\n\n"
            . "Rispondi SOLO con JSON valido con questa forma:\n"
            . '{"title":"Titolo SEO max 60 caratteri","body":"Articolo 200-400 parole, italiano naturale, paragrafi",'
            . '"excerpt":"Riassunto max 155 caratteri","tags":["tag1","tag2","tag3","tag4","tag5"],'
            . '"meta_description":"Meta description max 155 caratteri","seo_score":75}';

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
        return $result;
    }



    // ── Apify: deprecato, ora usa lo scraper locale Node.js ─────────────
    private static function nodeScrape(string $platform, string $url, int $limit = 0): array {
        $scriptPath = realpath(__DIR__ . '/../../scraper/scraper.js');
        if (!$scriptPath) {
            throw new Exception('Scraper Node.js non trovato. Verifica la cartella scraper/.');
        }
        
        $cmd = 'node ' . escapeshellarg($scriptPath) . ' ' . escapeshellarg($platform) . ' ' . escapeshellarg($url) . ' ' . (int)$limit;
        
        // Esegui comando
        $output = shell_exec($cmd);
        if (!$output) {
            throw new Exception("Scraper: errore durante l'esecuzione di Node.js (output vuoto).");
        }
        
        $result = json_decode($output, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Scraper: risposta JSON non valida. Output grezzo: " . substr($output, 0, 100));
        }
        
        if (isset($result['error'])) {
            throw new Exception("Scraper: " . $result['error']);
        }
        
        // Assicurati che ritorni un array di risultati (limit > 0) o un singolo array (limit == 0)
        return is_array($result) ? $result : [];
    }

    private static function apifyRun(string $actorId, array $input): array {
        // Mantenuto per compatibilità, ma non verrà più usato
        throw new Exception('Apify deprecato. Usa nodeScrape.');
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

        // Usa lo scraper locale Node.js (limit > 0)
        $items = self::nodeScrape($platform, $url, $limit);
        $out = [];
        foreach ($items as $item) {
            $sourceUrl = self::findSourceUrl($item);
            if (!$sourceUrl) continue;
            
            $caption = '';
            foreach (['text','caption','message','description','video_description','story'] as $k) {
                if (!empty($item[$k]) && is_string($item[$k])) { $caption = $item[$k]; break; }
            }
            if (!$caption && !empty($item['edge_media_to_caption']['edges'][0]['node']['text'])) {
                $caption = $item['edge_media_to_caption']['edges'][0]['node']['text'];
            }
            
            $mediaUrl = self::findMediaUrl($item);
            $mediaType = $mediaUrl ? 'video' : 'text';
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
            if (count($out) >= $limit) break;
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
        // Usa lo scraper locale Node.js (limit = 0 per risolvere singolo URL)
        $it = self::nodeScrape($platform, $url, 0);
        if (!$it || (empty($it['caption']) && empty($it['video']) && empty($it['image']))) {
            throw new Exception('Lo scraper non ha restituito contenuti validi per questo link');
        }

        return [
            'caption' => $it['caption'] ?? '',
            'video'   => $it['video'] ?? '',
            'image'   => $it['image'] ?? '',
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
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Genera un array JSON con ESATTAMENTE 3 oggetti, ognuno rappresenta una proposta. Struttura:\n"
            . "1. 'design_archetype': Nome dell'archetipo (es. 'Minimal & Clean', 'Dark Neo-brutalism', 'Elegant Editorial').\n"
            . "2. 'font_heading': Google Font per titoli (es. 'Playfair Display', 'Syne', 'Outfit').\n"
            . "3. 'font_body': Google Font testi (es. 'Inter', 'Lora').\n"
            . "4. 'color_palette': oggetto con { 'bg': '#hex', 'surface': '#hex', 'text': '#hex', 'primary': '#hex', 'primary_gradient': 'linear-gradient(...)' }.\n"
            . "5. 'ui_style': oggetto con { 'radius': 'px', 'card_shadow': 'css string', 'glassmorphism': bool }.\n"
            . "6. 'custom_css': CSS aggiuntivo ultra-raffinato (micro-animazioni, hover). Max 300 char.\n\n"
            . "Esempio output:\n"
            . '{"proposals": [{"design_archetype":"Minimal","font_heading":"Inter","font_body":"Inter","color_palette":{"bg":"#ffffff","surface":"#f8f9fa","text":"#111111","primary":"#000000","primary_gradient":"linear-gradient(to right, #333, #000)"},"ui_style":{"radius":"4px","card_shadow":"none","glassmorphism":false},"custom_css":""}]}';

        $prompt = self::getAgentPrompt('graphic_designer', $fallback);
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
                    'color_palette' => ['bg'=>'#FAFAFA', 'surface'=>'#FFFFFF', 'text'=>'#1F2937', 'primary'=>'#6366F1', 'primary_gradient'=>'linear-gradient(135deg, #818CF8, #6366F1)'],
                    'ui_style' => ['radius'=>'16px', 'card_shadow'=>'0 10px 30px rgba(0,0,0,0.05)', 'glassmorphism'=>false],
                    'custom_css' => ''
                ]
            ];
        }
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
            . '    "bg": "#hex (chiaro o scuro a seconda dell\'archetipo)",' . "\n"
            . '    "surface": "#hex (colore per le card, con buon contrasto su bg)",' . "\n"
            . '    "text": "#hex (colore testo primario ad altissimo contrasto)",' . "\n"
            . '    "text_muted": "#hex",' . "\n"
            . '    "primary": "#hex (colore di accento vibrante)",' . "\n"
            . '    "primary_gradient": "linear-gradient(135deg, #hex, #hex)"' . "\n"
            . '  },' . "\n"
            . '  "ui_style": {' . "\n"
            . '    "radius": "0px / 8px / 16px / 24px (in base allo stile)",' . "\n"
            . '    "card_shadow": "ombra CSS premium (es. 0 10px 30px rgba(0,0,0,0.05))",' . "\n"
            . '    "glassmorphism": true o false (se usare backdrop-filter)' . "\n"
            . '  },' . "\n"
            . '  "menu_links": [{"label":"Home","url":"/"},{"label":"Categoria Esistente","url":"/?tag=tag_reale"}],' . "\n"
            . '  "footer_text": "Testo footer",' . "\n"
            . '  "hero_tagline": "Frase impatto max 80 char",' . "\n"
            . '  "cta_text": "Call to action",' . "\n"
            . '  "custom_css": "CSS aggiuntivo opzionale (max 500 char) per micro-animazioni o hover states unici."' . "\n"
            . "}";

        $prompt = self::getAgentPrompt('site_ai', $fallback);
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
                'color_palette' => ['bg'=>'#FAFAFA', 'surface'=>'#FFFFFF', 'text'=>'#1F2937', 'text_muted'=>'#6B7280', 'primary'=>'#6366F1', 'primary_gradient'=>'linear-gradient(135deg, #818CF8, #6366F1)'],
                'ui_style'      => ['radius'=>'16px', 'card_shadow'=>'0 10px 30px rgba(0,0,0,0.05)', 'glassmorphism'=>false],
                'menu_links'    => [],
                'footer_text'   => '',
                'custom_css'    => '',
                'hero_tagline'  => '',
                'cta_text'      => 'Scopri i miei contenuti',
            ];
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
        
        // 1. Raccogliamo i dati essenziali di tutti i post (per risparmiare token)
        $postsData = [];
        $currentTags = [];
        foreach ($posts as $p) {
            $postsData[] = [
                'id' => $p['id'],
                'title' => $p['edited_title'] ?: ($p['generated_title'] ?: 'Post'),
                'tags' => is_array($p['tags']) ? $p['tags'] : (json_decode($p['tags'] ?? '[]', true) ?: [])
            ];
            $tArr = is_array($p['tags']) ? $p['tags'] : (json_decode($p['tags'] ?? '[]', true) ?: []);
            foreach ($tArr as $t) {
                $t = trim($t);
                if ($t) $currentTags[] = strtolower($t);
            }
        }
        $currentTags = array_unique($currentTags);

        // 2. Normalizzazione dei tag
        $normalizedTagsMapping = self::tagNormalizer($currentTags);
        
        // Applichiamo la normalizzazione ai post (in memoria) per l'analisi del caporedattore
        foreach ($postsData as &$pd) {
            $newT = [];
            foreach ($pd['tags'] as $t) {
                $lowT = strtolower(trim($t));
                $newT[] = $normalizedTagsMapping[$lowT] ?? $t;
            }
            $pd['tags'] = array_unique(array_filter(array_map('trim', $newT)));
        }
        unset($pd);

        $postsContext = json_encode($postsData, JSON_UNESCAPED_UNICODE);

        $fallback = "Sei il CAPOREDATTORE di un sito web personale/brand. Analizza tutti i post pubblicati e orchestra i contenuti per creare un'esperienza editoriale coerente.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo:\n{roleMission}\n\n"
            . "Post attuali (JSON id, title, tags):\n{postsContext}\n\n"
            . "Istruzioni:\n"
            . "1. Individua 3-4 macro-categorie tematiche reali basandoti ESCLUSIVAMENTE sui tag presenti nei post forniti nel JSON.\n"
            . "2. Genera un menu_links usando SOLO E RIGOROSAMENTE i tag esatti presenti nei post (es. /?tag=nome_tag_esatto). Non inventare nuovi tag. Se non ci sono tag, non generare categorie nel menu.\n"
            . "3. Scegli l'ID del post migliore, più rappresentativo e di alta qualità da mettere in evidenza (featured_post_id).\n"
            . "4. Genera una hero_tagline (max 80 char) che riassuma l'identità editoriale attuale.\n"
            . "5. Scrivi un breve piano editoriale (max 300 char) su cosa manca o su cosa puntare.\n\n"
            . "Rispondi SOLO con JSON valido:\n"
            . '{"categories":["Cat1 esatta","Cat2 esatta"],"menu_links":[{"label":"Home","url":"/"},{"label":"Cat1","url":"/?tag=cat1"}],"featured_post_id":123,"hero_tagline":"Tagline d\'impatto","editorial_plan":"Note editoriali..."}';

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
        $result['tag_mapping'] = $normalizedTagsMapping;
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

