<?php
// api/services/ingest.php — AGENTE 1: Ingestione da link social.
// Rileva la piattaforma, ricava il testo (trascrizione/didascalia) e salva
// il contenuto come BOZZA (published=0). L'armonizzazione è il passo 2.
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/ai.php';
require_once __DIR__ . '/../middleware/response.php';

class Ingest {

    // ── Rileva la piattaforma dall'URL ─────────────────────────────────────
    public static function platform(string $url): string {
        $u = strtolower($url);
        if (str_contains($u, 'youtube.com') || str_contains($u, 'youtu.be')) return 'youtube';
        if (str_contains($u, 'tiktok.com'))    return 'tiktok';
        if (str_contains($u, 'instagram.com')) return 'instagram';
        if (str_contains($u, 'facebook.com') || str_contains($u, 'fb.watch')) return 'facebook';
        return 'website';
    }

    // ── ID univoco del contenuto (per evitare duplicati) ───────────────────
    private static function postId(string $platform, string $url): string {
        if ($platform === 'youtube') {
            if (preg_match('~(?:v=|youtu\.be/|shorts/|/embed/)([A-Za-z0-9_-]{11})~', $url, $m)) {
                return $m[1];
            }
        }
        return substr(md5($url), 0, 24);
    }

    private static function contentHash(string $text): string {
        $normalized = mb_strtolower(strip_tags($text));
        $normalized = preg_replace('/https?:\/\/\S+/', ' ', $normalized);
        $normalized = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $normalized);
        $normalized = preg_replace('/\s+/', ' ', trim($normalized));
        return hash('sha256', mb_substr($normalized, 0, 4000));
    }

    // ── Ingestione di un singolo link → bozza nel DB ───────────────────────
    public static function url(int $userId, string $url): array {
        $url = trim($url);
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new Exception('Link non valido');
        }
        $platform = self::platform($url);
        if (!$platform) {
            throw new Exception('Piattaforma non riconosciuta');
        }

        $postId = self::postId($platform, $url);

        // Già importato?
        $exists = DB::fetch(
            'SELECT id FROM posts WHERE user_id=? AND platform=? AND platform_post_id=?',
            [$userId, $platform, $postId]
        );
        if ($exists) {
            return ['id' => (int) $exists['id'], 'platform' => $platform, 'duplicate' => true];
        }

        // Ricava testo grezzo + media (video/immagine)
        $transcript = '';
        $caption    = '';
        $mediaUrl   = $url;       // riferimento mostrabile nel contenuto
        $mediaType  = 'text';

        if ($platform === 'youtube') {
            // Gemini trascrive direttamente dal link; il video resta su YouTube (embed).
            $transcript = AI::transcribeYouTube($url);
            $mediaUrl   = $url;
            $mediaType  = 'video';
        } elseif ($platform === 'website') {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'Mozilla/5.0']);
            $html = curl_exec($ch);
            curl_close($ch);
            
            if ($html) {
                preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $mTitle);
                $title = $mTitle[1] ?? '';
                preg_match('/<meta[^>]*name=["\']description["\'][^>]*content=["\'](.*?)["\']/is', $html, $mDesc);
                $desc = $mDesc[1] ?? '';
                $text = strip_tags(preg_replace('/<(script|style)[^>]*>.*?<\/\1>/is', '', $html));
                $text = preg_replace('/\s+/', ' ', $text);
                $caption = trim($title . "\n\n" . $desc . "\n\n" . mb_substr($text, 0, 5000));
            }
        } else {
            // TikTok / Instagram / Facebook: Apify recupera media + didascalia.
            $r       = AI::apifyResolve($platform, $url);
            $caption = $r['caption'] ?? '';

            if (!empty($r['video'])) {
                // Conserva il video sul server (così resta nei contenuti dell'utente)
                $saved = self::saveMedia($r['video'], $platform, $postId, 'mp4');
                if ($saved) {
                    $mediaUrl  = $saved['url'];
                    $mediaType = 'video';
                    
                    // Use Whisper for all video transcriptions
                    $ch = curl_init('https://api.openai.com/v1/audio/transcriptions');
                    $cfile = new CURLFile($saved['path'], 'video/mp4', 'audio.mp4');
                    curl_setopt_array($ch, [
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_POST           => true,
                        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . OPENAI_API_KEY],
                        CURLOPT_POSTFIELDS     => ['file' => $cfile, 'model' => 'whisper-1', 'language' => 'it'],
                        CURLOPT_TIMEOUT        => 120,
                    ]);
                    $res = curl_exec($ch);
                    curl_close($ch);
                    $data = json_decode((string)$res, true);
                    $transcript = $data['text'] ?? '';
                    
                    if (!$transcript && $saved['size'] <= 15 * 1024 * 1024) {
                        $transcript = AI::transcribeFile($saved['path'], 'video/mp4');
                    }
                }
            } elseif (!empty($r['image'])) {
                $saved = self::saveMedia($r['image'], $platform, $postId, 'jpg');
                if ($saved) { $mediaUrl = $saved['url']; $mediaType = 'image'; }
            }
        }

        $raw = $transcript ?: $caption;
        if (!$raw) {
            throw new Exception('Nessun testo estratto: il link potrebbe non essere un contenuto pubblico, o senza parlato/didascalia');
        }
        $contentHash = self::contentHash($raw);
        $hashExists = DB::fetch('SELECT id FROM posts WHERE user_id=? AND content_hash=?', [$userId, $contentHash]);
        if ($hashExists) {
            return ['id' => (int) $hashExists['id'], 'platform' => $platform, 'duplicate' => true, 'duplicate_reason' => 'contenuto equivalente'];
        }

        $id = DB::insert('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               media_url, media_type, source_url, published_at, content_hash, published)
            VALUES (?,?,?,?,?,?,?,?,?,?,0)
        ', [
            $userId, $platform, $postId,
            $caption, $transcript,
            $mediaUrl, $mediaType, $url, date('Y-m-d H:i:s'), $contentHash,
        ]);

        return [
            'id'         => $id,
            'platform'   => $platform,
            'duplicate'  => false,
            'transcript' => $transcript,
            'preview'    => mb_substr($transcript ?: $caption, 0, 280),
        ];
    }

    // ── Scarica e conserva un media nel sito (public/media) ────────────────
    // Ritorna ['url'=>pubblico, 'path'=>locale, 'size'=>byte] oppure null.
    private static function saveMedia(string $src, string $platform, string $postId, string $ext): ?array {
        $dir = __DIR__ . '/../../public/media';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (!is_dir($dir) || !is_writable($dir)) return null;

        $name = $platform . '_' . preg_replace('/[^A-Za-z0-9_-]/', '', $postId) . '.' . $ext;
        $path = "$dir/$name";

        $fp = fopen($path, 'w');
        if (!$fp) return null;
        $ch = curl_init($src);
        curl_setopt_array($ch, [
            CURLOPT_FILE           => $fp,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 120,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; SocialToSite/1.0)',
        ]);
        curl_exec($ch);
        curl_close($ch);
        fclose($fp);

        $size = @filesize($path) ?: 0;
        if (!$size) { @unlink($path); return null; }

        $base = defined('BASE_URL') ? rtrim(BASE_URL, '/') : '';
        return ['url' => "$base/public/media/$name", 'path' => $path, 'size' => $size];
    }

    // ── AGENTE 2 (Armonizzatore): bozza → articolo SEO pubblicato ──────────
    public static function harmonize(int $userId, int $postId, int $autoPublish = 1): array {
        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post) throw new Exception('Contenuto non trovato');

        $raw = $post['transcript'] ?: $post['raw_content'];
        if (!$raw) throw new Exception('Nessun testo da armonizzare');

        $sources = DB::fetchAll(
            'SELECT platform, label, url, topic_summary FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id',
            [$userId]
        );
        $site = DB::fetch('SELECT profile_summary, bio FROM sites WHERE user_id=?', [$userId]);
        $profileSummary = trim($site['profile_summary'] ?? ($site['bio'] ?? ''));
        $sourceContext = '';
        if ($profileSummary !== '') {
            $sourceContext .= "Profilo utente/brand:\n" . $profileSummary . "\n\n";
        }
        foreach ($sources as $source) {
            $sourceContext .= '- ' . $source['platform'] . ': ' . ($source['label'] ?: $source['url']);
            if (!empty($source['topic_summary'])) $sourceContext .= ' — ' . $source['topic_summary'];
            $sourceContext .= "\n";
        }

        $seo = AI::harmonize($raw, $post['platform'], $post['raw_content'] ?? '', $sourceContext);

        DB::execute('
            UPDATE posts SET
              generated_title=?, generated_body=?, generated_excerpt=?,
              tags=?, meta_description=?, seo_score=?, slug=?, published=?
            WHERE id=? AND user_id=?
        ', [
            $seo['title'] ?? '', $seo['body'] ?? '', $seo['excerpt'] ?? '',
            json_encode($seo['tags'] ?? []), $seo['meta_description'] ?? '',
            $seo['seo_score'] ?? 0, slugify($seo['title'] ?? (string) $postId),
            $autoPublish, $postId, $userId,
        ]);

        return ['id' => $postId, 'seo' => $seo];
    }

    public static function scanSources(int $userId, int $limitPerSource = 5, string $profileOverride = '', string $roleMission = '', string $contentStrategy = ''): array {
        $sources = DB::fetchAll(
            'SELECT * FROM social_sources WHERE user_id=? AND active=1 ORDER BY platform, id',
            [$userId]
        );
        if (!$sources) throw new Exception('Inserisci almeno un link social prima della scansione');

        $profileOverride = trim($profileOverride);
        $roleMission = trim($roleMission);
        $contentStrategy = trim($contentStrategy);
        if ($profileOverride !== '' || $roleMission !== '' || $contentStrategy !== '') {
            DB::execute(
                'UPDATE sites SET profile_summary=COALESCE(?,profile_summary), bio=COALESCE(NULLIF(bio, ""), ?), role_mission=COALESCE(?,role_mission), content_strategy=COALESCE(?,content_strategy) WHERE user_id=?',
                [$profileOverride !== '' ? $profileOverride : null, $profileOverride !== '' ? $profileOverride : null, $roleMission !== '' ? $roleMission : null, $contentStrategy !== '' ? $contentStrategy : null, $userId]
            );
        }

        $report = ['sources' => count($sources), 'found' => 0, 'imported' => 0, 'published' => 0, 'skipped' => 0, 'duplicates' => 0, 'errors' => []];
        $seenUrls = [];

        foreach ($sources as $source) {
            try {
                $sinceDate = !empty($source['since_date']) ? $source['since_date'] : null;
                $autoPublish = (int)($source['auto_publish'] ?? 1);
                $limit = !empty($source['max_posts']) ? (int)$source['max_posts'] : $limitPerSource;
                $items = AI::sourceItems($source['platform'], $source['url'], $limit, $sinceDate);
                $report['found'] += count($items);
                foreach ($items as $item) {
                    $sourceUrl = $item['url'] ?? '';
                    if (!$sourceUrl) continue;
                    $normalizedUrl = strtok($sourceUrl, '?') ?: $sourceUrl;
                    if (isset($seenUrls[$normalizedUrl])) {
                        $report['duplicates']++;
                        continue;
                    }
                    $seenUrls[$normalizedUrl] = true;
                    try {
                        $ingested = self::url($userId, $sourceUrl);
                        if (!empty($ingested['duplicate'])) {
                            $report['duplicates']++;
                            continue;
                        }
                        $report['imported']++;
                        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [(int)$ingested['id'], $userId]);
                        $raw = trim(($post['transcript'] ?? '') ?: ($post['raw_content'] ?? ''));
                        $site = DB::fetch('SELECT profile_summary, role_mission, content_strategy FROM sites WHERE user_id=?', [$userId]);
                        $editorialContext = trim(
                            "Profilo:\n" . ($site['profile_summary'] ?? '') . "\n\n"
                            . "Ruolo/Missione:\n" . ($site['role_mission'] ?? '') . "\n\n"
                            . "Strategia:\n" . ($site['content_strategy'] ?? '')
                        );
                        $recentPosts = DB::fetchAll(
                            'SELECT generated_title, generated_excerpt, raw_content FROM posts WHERE user_id=? AND published=1 ORDER BY published_at DESC LIMIT 12',
                            [$userId]
                        );
                        $decision = AI::contentDecision($raw, $source['platform'], $sourceUrl, $editorialContext, $recentPosts);
                        DB::execute(
                            'UPDATE posts SET relevance_score=?, agent_notes=? WHERE id=? AND user_id=?',
                            [$decision['relevance_score'], json_encode($decision, JSON_UNESCAPED_UNICODE), (int)$ingested['id'], $userId]
                        );
                        if (!$decision['publish'] || $decision['relevance_score'] < 55 || $decision['duplicate_risk'] >= 75) {
                            $report['skipped']++;
                            continue;
                        }
                        self::harmonize($userId, (int)$ingested['id'], $autoPublish);
                        $report['published']++;
                    } catch (Throwable $e) {
                        $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
                    }
                }
            } catch (Throwable $e) {
                $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
            }
        }

        $posts = DB::fetchAll(
            'SELECT generated_title, generated_excerpt, raw_content FROM posts WHERE user_id=? ORDER BY imported_at DESC LIMIT 12',
            [$userId]
        );
        if ($posts) {
            $profile = AI::editorialProfile($sources, $posts, $profileOverride);
            $summary = $profileOverride !== '' ? $profileOverride : ($profile['profile_summary'] ?? '');
            $finalRoleMission = $roleMission !== '' ? $roleMission : ($profile['role_mission'] ?? '');
            $finalContentStrategy = $contentStrategy !== '' ? $contentStrategy : ($profile['content_strategy'] ?? '');

            // Eseguiamo gli agenti in background setup solo se i dati del sito sono vuoti o per la prima volta
            // Per forzare, useremo l'endpoint apposito
            $site = DB::fetch('SELECT title, theme FROM sites WHERE user_id=?', [$userId]);
            
            $seoTitle = '';
            $seoBio = '';
            $seoMenu = '';
            $seoFooter = '';
            $gTheme = '';
            $gColor = '';
            $gLayout = '';
            $gCss = '';

            // Chiamiamo gli agenti solo se manca qualcosa di essenziale
            $layoutsJson = '';
            if (empty($site['title']) || $site['title'] === 'Sito Personale' || empty($site['theme']) || $site['theme'] === 'classic') {
                $seo = AI::seoSpecialistSetup($summary, $finalRoleMission, $finalContentStrategy);
                $graphicProposals = AI::graphicDesignerSetup($summary, $finalRoleMission, $finalContentStrategy);
                
                $seoTitle = $seo['title'] ?? '';
                $seoBio = $seo['bio'] ?? '';
                $seoMenu = isset($seo['menu_links']) ? json_encode($seo['menu_links'], JSON_UNESCAPED_UNICODE) : '';
                $seoFooter = $seo['footer_text'] ?? '';
                
                // Prendiamo la prima proposta come default
                $gTheme = $graphicProposals[0]['theme'] ?? '';
                $gColor = $graphicProposals[0]['accent_color'] ?? '';
                $gLayout = $graphicProposals[0]['header_layout'] ?? '';
                $gCss = $graphicProposals[0]['custom_css'] ?? '';
                
                $layoutsJson = json_encode($graphicProposals, JSON_UNESCAPED_UNICODE);
            }

            DB::execute(
                'UPDATE sites SET 
                    profile_summary=?, 
                    role_mission=?, 
                    content_strategy=?,
                    title=COALESCE(NULLIF(title, ""), NULLIF(?, "")),
                    bio=COALESCE(NULLIF(bio, ""), NULLIF(?, "")),
                    menu_links=COALESCE(NULLIF(menu_links, ""), NULLIF(?, "")),
                    footer_text=COALESCE(NULLIF(footer_text, ""), NULLIF(?, "")),
                    theme=COALESCE(NULLIF(theme, ""), NULLIF(?, "")),
                    accent_color=COALESCE(NULLIF(accent_color, ""), NULLIF(?, "")),
                    header_layout=COALESCE(NULLIF(header_layout, ""), NULLIF(?, "")),
                    custom_css=COALESCE(NULLIF(custom_css, ""), NULLIF(?, "")),
                    generated_layouts=COALESCE(NULLIF(?, ""), generated_layouts)
                 WHERE user_id=?',
                [
                    $summary, 
                    $finalRoleMission, 
                    $finalContentStrategy,
                    $seoTitle, $seoBio, $seoMenu, $seoFooter,
                    $gTheme, $gColor, $gLayout, $gCss,
                    $layoutsJson,
                    $userId
                ]
            );
        }
        DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);

        return $report;
    }
}
