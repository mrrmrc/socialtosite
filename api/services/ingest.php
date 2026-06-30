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
    public static function url(int $userId, string $url, array $prefetched = []): array {
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
        $caption    = $prefetched['caption'] ?? '';
        $mediaUrl   = $prefetched['media_url'] ?? $url;
        $mediaType  = $prefetched['media_type'] ?? 'text';

        if ($platform === 'youtube') {
            // Trascrizione posticipata all'elaborazione in background
            $transcript = '';
            $mediaUrl   = $url;
            $mediaType  = 'video';
        } elseif ($platform === 'website') {
            if (!$caption) {
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
            }
        } else {
            // TikTok / Instagram / Facebook: se non abbiamo i dati dal prefetched, usa Apify
            if (empty($caption) && empty($prefetched['media_url'])) {
                $r       = AI::apifyResolve($platform, $url);
                $caption = $r['caption'] ?? '';

                if (!empty($r['video'])) {
                    // Conserva il video sul server
                    $saved = self::saveMedia($r['video'], $platform, $postId, 'mp4');
                    if ($saved) {
                        $mediaUrl  = $saved['url'];
                        $mediaType = 'video';
                        $transcript = '';
                    }
                } elseif (!empty($r['image'])) {
                    $saved = self::saveMedia($r['image'], $platform, $postId, 'jpg');
                    if ($saved) { $mediaUrl = $saved['url']; $mediaType = 'image'; }
                }
            } else {
                // Abbiamo i dati dal prefetched. Salviamo i media se possibile
                if ($mediaType === 'video' && !empty($prefetched['media_url']) && strpos($prefetched['media_url'], 'http') === 0) {
                     $saved = self::saveMedia($prefetched['media_url'], $platform, $postId, 'mp4');
                     if ($saved) { $mediaUrl = $saved['url']; }
                } elseif ($mediaType === 'image' && !empty($prefetched['media_url']) && strpos($prefetched['media_url'], 'http') === 0) {
                     $saved = self::saveMedia($prefetched['media_url'], $platform, $postId, 'jpg');
                     if ($saved) { $mediaUrl = $saved['url']; }
                }
            }
        }

        $raw = $transcript ?: $caption;
        if (!$raw && !$mediaUrl) {
            throw new Exception('Nessun testo estratto e nessun media trovato.');
        }
        $contentHash = self::contentHash($raw);
        $hashExists = DB::fetch('SELECT id FROM posts WHERE user_id=? AND content_hash=?', [$userId, $contentHash]);
        if ($hashExists) {
            return ['id' => (int) $hashExists['id'], 'platform' => $platform, 'duplicate' => true, 'duplicate_reason' => 'contenuto equivalente'];
        }

        $id = DB::insert('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               media_url, media_type, source_url, published_at, content_hash, seo_score, published)
            VALUES (?,?,?,?,?,?,?,?,?,?,-1,0)
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
        $site = DB::fetch('SELECT profile_summary, bio, rag_knowledge FROM sites WHERE user_id=?', [$userId]);
        $profileSummary = trim($site['profile_summary'] ?? ($site['bio'] ?? ''));
        $sourceContext = '';
        if ($profileSummary !== '') {
            $sourceContext .= "Profilo utente/brand:\n" . $profileSummary . "\n\n";
        }
        if (!empty($site['rag_knowledge'])) {
            $sourceContext .= "Memoria Storica e Stile (RAG):\n" . $site['rag_knowledge'] . "\n\n";
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

    public static function scanSources(int $userId, int $limitPerSource = 5, string $profileOverride = '', string $roleMission = '', string $contentStrategy = '', ?int $sourceId = null): array {
        $sql = 'SELECT * FROM social_sources WHERE user_id=? AND active=1';
        $params = [$userId];
        if ($sourceId) {
            $sql .= ' AND id=?';
            $params[] = $sourceId;
        }
        $sql .= ' ORDER BY platform, id';
        
        $sources = DB::fetchAll($sql, $params);
        if (!$sources && !$sourceId) throw new Exception('Inserisci almeno un link social prima della scansione');

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
                        $ingested = self::url($userId, $sourceUrl, $item);
                        if (!empty($ingested['duplicate'])) {
                            $report['duplicates']++;
                            continue;
                        }
                        $report['imported']++;
                        // L'ingestione si ferma qui (bozza creata). L'elaborazione AI avviene in process-pending.
                    } catch (Throwable $e) {
                        $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
                    }
                }
            } catch (Throwable $e) {
                $report['errors'][] = $source['platform'] . ': ' . $e->getMessage();
            }
        }

        // L'orchestrazione globale (Caporedattore, SEO, Graphic Designer) 
        // è stata spostata all'endpoint finalize-sync per essere eseguita a fine batch.

        DB::execute('UPDATE sites SET last_sync=NOW() WHERE user_id=?', [$userId]);

        return $report;
    }
}
