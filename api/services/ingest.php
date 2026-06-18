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
        return '';
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

    // ── Ingestione di un singolo link → bozza nel DB ───────────────────────
    public static function url(int $userId, string $url): array {
        $url = trim($url);
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new Exception('Link non valido');
        }
        $platform = self::platform($url);
        if (!$platform) {
            throw new Exception('Piattaforma non riconosciuta (supportate: YouTube, TikTok, Instagram, Facebook)');
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
                    if ($saved['size'] <= 15 * 1024 * 1024) {
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

        $id = DB::insert('
            INSERT INTO posts
              (user_id, platform, platform_post_id, raw_content, transcript,
               media_url, media_type, published_at, published)
            VALUES (?,?,?,?,?,?,?,?,0)
        ', [
            $userId, $platform, $postId,
            $caption, $transcript,
            $mediaUrl, $mediaType, date('Y-m-d H:i:s'),
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
    public static function harmonize(int $userId, int $postId): array {
        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post) throw new Exception('Contenuto non trovato');

        $raw = $post['transcript'] ?: $post['raw_content'];
        if (!$raw) throw new Exception('Nessun testo da armonizzare');

        $seo = AI::harmonize($raw, $post['platform'], $post['raw_content'] ?? '');

        DB::execute('
            UPDATE posts SET
              generated_title=?, generated_body=?, generated_excerpt=?,
              tags=?, meta_description=?, seo_score=?, slug=?, published=1
            WHERE id=? AND user_id=?
        ', [
            $seo['title'] ?? '', $seo['body'] ?? '', $seo['excerpt'] ?? '',
            json_encode($seo['tags'] ?? []), $seo['meta_description'] ?? '',
            $seo['seo_score'] ?? 0, slugify($seo['title'] ?? (string) $postId),
            $postId, $userId,
        ]);

        return ['id' => $postId, 'seo' => $seo];
    }
}
