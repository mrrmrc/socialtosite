<?php
// api/services/ai.php — Motore AI: Gemini (trascrizione + armonizzazione).
// Mantiene anche Whisper/Claude come alternative.
require_once __DIR__ . '/../../config/config.php';
if (file_exists(__DIR__ . '/../../config/keys.php')) require_once __DIR__ . '/../../config/keys.php';

class AI {

    // ── Chiamata generica a Gemini (generateContent) ───────────────────────
    // $parts: array di "part" Gemini. $config: opzioni generationConfig.
    private static function gemini(array $parts, array $config = []): string {
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
            ['fileData' => ['fileUri' => $youtubeUrl]],
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
    private static function findMediaUrl($node): string {
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
            foreach ($node as $v) {
                $u = self::findMediaUrl($v);
                if ($u) return $u;
            }
        }
        return '';
    }

    // ── Cerca ricorsivamente il primo URL immagine plausibile ─────────────
    private static function findImageUrl($node): string {
        if (is_string($node)) {
            if (preg_match('~^https?://~', $node) &&
                preg_match('~\.(jpg|jpeg|png|webp)(\?|$)~i', $node)) return $node;
            return '';
        }
        if (is_array($node)) {
            foreach (['displayUrl','thumbnailUrl','coverUrl','imageUrl','cover','thumbnail'] as $k) {
                if (!empty($node[$k]) && is_string($node[$k]) && preg_match('~^https?://~', $node[$k])) {
                    return $node[$k];
                }
            }
            foreach ($node as $v) {
                $u = self::findImageUrl($v);
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

    public static function sourceItems(string $platform, string $url, int $limit = 5): array {
        if ($platform === 'youtube') {
            if (preg_match('~/channel/([A-Za-z0-9_-]+)~', $url, $m)) {
                $feed = @simplexml_load_file('https://www.youtube.com/feeds/videos.xml?channel_id=' . $m[1]);
                $items = [];
                if ($feed && isset($feed->entry)) {
                    foreach ($feed->entry as $entry) {
                        $videoId = (string) $entry->children('yt', true)->videoId;
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
                ['directUrls' => [$url], 'resultsType' => 'posts', 'resultsLimit' => $limit],
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

        $caption = '';
        foreach (['text','caption','description','title','message'] as $k) {
            if (!empty($it[$k]) && is_string($it[$k])) { $caption = $it[$k]; break; }
        }
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
}
