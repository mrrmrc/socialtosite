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

        $prompt = "Sei un esperto SEO e copywriter italiano. Da questo contenuto"
            . ($platform ? " ($platform)" : '') . " genera un articolo pronto per un sito.\n"
            . "Prima interpreta l'argomento del profilo e del contenuto, poi crea un post leggibile, accurato, non inventato e utile per un sito HTML.\n"
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



    // ── Apify: esegue un actor in modo sincrono e torna gli item dataset ───
    private static function apifyRun(string $actorId, array $input): array {
        if (!defined('APIFY_TOKEN') || !APIFY_TOKEN) {
            throw new Exception('APIFY_TOKEN mancante in config/keys.php');
        }
        $url = "https://api.apify.com/v2/acts/$actorId/run-sync-get-dataset-items?token=" . APIFY_TOKEN;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($input, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 300,
        ]);
        $res  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        if ($res === false) throw new Exception("Apify: errore di rete ($err)");
        $data = json_decode($res, true);
        if ($code >= 400) {
            $msg = $data['error']['message'] ?? (is_string($res) ? substr($res, 0, 200) : 'errore');
            throw new Exception("Apify ($code): $msg");
        }
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

        [$actor, $input] = match ($platform) {
            'tiktok' => [
                defined('APIFY_ACTOR_TIKTOK') ? APIFY_ACTOR_TIKTOK : 'clockworks~tiktok-scraper',
                ['profiles' => [$url], 'resultsPerPage' => $limit, 'shouldDownloadVideos' => false],
            ],
            'instagram' => [
                defined('APIFY_ACTOR_INSTAGRAM') ? APIFY_ACTOR_INSTAGRAM : 'apify~instagram-scraper',
                array_filter(['directUrls' => [$url], 'resultsType' => 'posts', 'resultsLimit' => $limit, 'oldestPostDate' => $sinceDate ? $sinceDate . 'T00:00:00.000Z' : null]),
            ],
            'facebook' => [
                defined('APIFY_ACTOR_FACEBOOK') ? APIFY_ACTOR_FACEBOOK : 'apify~facebook-posts-scraper',
                ['startUrls' => [['url' => $url]], 'resultsLimit' => $limit],
            ],
            default => throw new Exception('Piattaforma non gestita per la scansione'),
        };

        $items = self::apifyRun($actor, $input);
        $out = [];
        foreach ($items as $item) {
            $sourceUrl = self::findSourceUrl($item);
            if (!$sourceUrl) continue;
            $out[] = ['url' => $sourceUrl];
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
        [$actor, $input] = match ($platform) {
            'tiktok' => [
                defined('APIFY_ACTOR_TIKTOK') ? APIFY_ACTOR_TIKTOK : 'clockworks~tiktok-scraper',
                ['postURLs' => [$url], 'resultsPerPage' => 1, 'shouldDownloadVideos' => false],
            ],
            'instagram' => [
                defined('APIFY_ACTOR_INSTAGRAM') ? APIFY_ACTOR_INSTAGRAM : 'apify~instagram-scraper',
                ['directUrls' => [$url], 'resultsType' => 'posts', 'resultsLimit' => 1],
            ],
            'facebook' => [
                defined('APIFY_ACTOR_FACEBOOK') ? APIFY_ACTOR_FACEBOOK : 'apify~facebook-posts-scraper',
                ['startUrls' => [['url' => $url]], 'resultsLimit' => 1],
            ],
            default => throw new Exception('Piattaforma non gestita da Apify'),
        };

        $items = self::apifyRun($actor, $input);
        $it = $items[0] ?? null;
        if (!$it) throw new Exception('Apify non ha restituito contenuti per questo link');

        $captionParts = [];
        // Ricerca testuale più estesa
        foreach (['title','description','caption','text','message','fullText','video_description'] as $k) {
            if (!empty($it[$k])) {
                if (is_string($it[$k])) {
                    $captionParts[] = trim($it[$k]);
                } elseif (is_array($it[$k])) {
                    $captionParts[] = json_encode($it[$k], JSON_UNESCAPED_UNICODE);
                }
            }
        }
        // Se non troviamo nulla, prendiamo la stringa più lunga nell'oggetto ignorando metadata
        if (empty(array_filter($captionParts))) {
            $longest = '';
            array_walk_recursive($it, function($v, $k) use (&$longest) {
                if (is_string($v) && mb_strlen($v) > mb_strlen($longest)) {
                    // ignora url, id, date, etc
                    if (!preg_match('~^https?://~', $v) && mb_strlen($v) > 20) {
                        if (stripos((string)$k, 'author') === false && stripos((string)$k, 'owner') === false && stripos((string)$k, 'user') === false) {
                            $longest = $v;
                        }
                    }
                }
            });
            if ($longest) $captionParts[] = trim($longest);
        }
        
        $caption = trim(implode("\n\n", array_unique(array_filter($captionParts))));
        return [
            'caption' => $caption,
            'video'   => self::findMediaUrl($it),
            'image'   => self::findImageUrl($it),
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
        $fallback = "Sei un agente Graphic Designer esperto in UI/UX web moderna. Devi creare 3 proposte di design premium e distinte per questo profilo.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Istruzioni:\n"
            . "Genera un array JSON con ESATTAMENTE 3 oggetti. Ogni oggetto rappresenta una proposta e deve avere questa struttura:\n"
            . "1. 'theme' scelto tra: classic, journal, authority, portfolio, magazine, minimal, studio, local, academy, timeline, bottega.\n"
            . "2. 'accent_color' esadecimale (es. #FF0000) super accattivante e adatto al mestiere.\n"
            . "3. 'header_layout' scelto tra: standard, centered, split.\n"
            . "4. 'custom_css' un blocco di CSS creativo per abbellire il sito in modo drastico (sfumature, ombreggiature moderne, border-radius). Il CSS verrà iniettato globalmente.\n\n"
            . "Esempio output:\n"
            . '{"proposals": [{"theme":"classic","accent_color":"#000000","header_layout":"standard","custom_css":":root { --dynamic-radius: 12px; } body { background: linear-gradient(...); }"}]}';

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
                ['theme' => 'classic', 'accent_color' => '', 'header_layout' => 'standard', 'custom_css' => ''],
            ];
        }
        
        $validThemes = ['classic', 'journal', 'authority', 'portfolio', 'magazine', 'minimal', 'studio', 'local', 'academy', 'timeline', 'bottega'];
        foreach ($result['proposals'] as &$prop) {
            if (!in_array($prop['theme'] ?? '', $validThemes)) {
                $prop['theme'] = 'classic';
            }
        }
        return $result['proposals'];
    }

    // ── AGENTE SITO AI (Generazione completa su misura) ────────────────────
    // Prende tutto il profilo + post recenti e genera titolo, bio, tema, CSS custom
    // in un'unica chiamata: un vero art director digitale.
    public static function siteAiGenerate(string $profileSummary, string $roleMission, string $contentStrategy, string $recentPosts = '', string $tagsContext = ''): array {
        $fallback = "Sei un team AI completo, ma soprattutto sei il CAPOREDATTORE del sito.\n"
            . "Il tuo compito: generare TUTTO il necessario per un sito web professionale su misura per questo profilo creando una vera organicità dei contenuti.\n\n"
            . "Profilo:\n{profileSummary}\n\n"
            . "Ruolo e Missione:\n{roleMission}\n\n"
            . "Strategia contenuti:\n{contentStrategy}\n\n"
            . "Post recenti pubblicati:\n{recentPosts}\n\n"
            . "Tag REALI attualmente assegnati ai contenuti nel database:\n[{tagsContext}]\n\n"
            . "Genera JSON con questa struttura:\n"
            . '{"title":"Titolo H1 sito max 60 caratteri","bio":"Bio ottimizzata max 200 caratteri","role_mission":"Missione aggiornata max 150 caratteri","theme":"classic","accent_color":"#hex colore primario","accent_secondary":"#hex colore secondario","header_layout":"standard","menu_links":[{"label":"Home","url":"/"},{"label":"Nome Categoria Esistente","url":"/?tag=tag_esatto_dalla_lista_reale"}],"footer_text":"Testo footer","custom_css":"CSS completo e creativo. Usa :root variables, gradienti, font Google @import, animazioni keyframe. Min 300 caratteri.","hero_tagline":"Frase impatto max 80 caratteri","cta_text":"Call to action"}';

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
                'theme'         => 'classic',
                'accent_color'  => '#7F77DD',
                'header_layout' => 'standard',
                'menu_links'    => [],
                'footer_text'   => '',
                'custom_css'    => '',
                'hero_tagline'  => '',
                'cta_text'      => 'Scopri i miei contenuti',
            ];
        }
        $validThemes = ['classic', 'journal', 'authority', 'portfolio', 'magazine', 'minimal', 'studio', 'local', 'academy', 'timeline', 'bottega'];
        if (!in_array($result['theme'] ?? '', $validThemes)) {
            $result['theme'] = 'classic';
        }
        return $result;
    }
}

