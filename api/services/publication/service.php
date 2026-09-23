<?php
require_once __DIR__ . '/../../../config/db.php';
require_once __DIR__ . '/../plan_policy.php';
require_once __DIR__ . '/wordpress.php';

final class PublicationService
{
    public static function enabled(): bool
    {
        return getenv('PUBLICATION_CONNECTORS_ENABLED') === '1';
    }

    public static function authorize(int $userId): void
    {
        if (!self::enabled()) throw new DomainException('Connettori non ancora abilitati.');
        $user = DB::fetch('SELECT plan FROM users WHERE id=?', [$userId]);
        if (!$user || !PlanPolicy::connectors($user['plan'])) throw new DomainException('I connettori richiedono il piano Pro.');
        $allowed = array_filter(array_map('intval', explode(',', getenv('PUBLICATION_PILOT_USERS') ?: '')));
        if (!in_array($userId, $allowed, true)) throw new DomainException('Connettori disponibili per gli account pilota abilitati.');
    }

    public static function connection(int $userId, int $id): array
    {
        $row = DB::fetch('SELECT c.* FROM publication_connections c JOIN sites s ON s.id=c.site_id AND s.user_id=c.user_id WHERE c.id=? AND c.user_id=?', [$id, $userId]);
        if (!$row) throw new DomainException('Collegamento non disponibile.');
        return $row;
    }

    public static function connect(int $userId, array $input): int
    {
        self::authorize($userId);
        $site = DB::fetch('SELECT id FROM sites WHERE id=? AND user_id=?', [(int)($input['site_id'] ?? 0), $userId]);
        if (!$site) throw new DomainException('Sito non disponibile.');
        $endpoint = PublicationSecurity::endpoint((string)($input['endpoint'] ?? ''));
        $secret = (string)($input['secret'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $secret)) throw new InvalidArgumentException('Inserire il codice di collegamento generato dal plugin.');
        $cipher = PublicationSecurity::encrypt($secret);
        $candidate = ['endpoint' => $endpoint, 'secret_ciphertext' => $cipher];
        $health = WordPressPublicationAdapter::request($candidate, 'GET', '/health');
        if (($health['protocol'] ?? '') !== '1') throw new DomainException('Versione del plugin non compatibile.');
        // Verifica proprietà e serializza modifiche della destinazione.
        $pdo = DB::get();
        $pdo->beginTransaction();
        try {
            DB::fetch('SELECT id FROM sites WHERE id=? AND user_id=? FOR UPDATE', [$site['id'], $userId]);
            $existing = DB::fetch("SELECT * FROM publication_connections WHERE site_id=? AND provider='wordpress' FOR UPDATE", [$site['id']]);
            if ($existing) {
                if ($existing['endpoint'] !== $endpoint) throw new DomainException('La destinazione non può cambiare: conserva lo storico del collegamento.');
                DB::execute("UPDATE publication_connections SET secret_ciphertext=?,status='connected' WHERE id=?", [$cipher, $existing['id']]);
                $id = (int)$existing['id'];
            } else {
                $id = DB::insert("INSERT INTO publication_connections (user_id,site_id,provider,label,endpoint,secret_ciphertext,status) VALUES (?,?,'wordpress',?,?,?,'connected')", [$userId, $site['id'], substr(trim((string)($input['label'] ?? 'WordPress')), 0, 120) ?: 'WordPress', $endpoint, $cipher]);
            }
            $pdo->commit();
            return $id;
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
    }

    public static function queue(int $userId, int $connectionId, int $postId, int $categoryId, ?array $image = null): int
    {
        self::authorize($userId);
        $connection = self::connection($userId, $connectionId);
        if ($connection['status'] !== 'connected') throw new DomainException('Ricollegare il sito prima di inviare.');
        // Finché il runtime legacy è per utente, accettiamo solo l'unico sito.
        $sites = DB::fetchAll('SELECT id FROM sites WHERE user_id=?', [$userId]);
        if (count($sites) !== 1 || (int)$sites[0]['id'] !== (int)$connection['site_id']) throw new DomainException('Migrazione del contesto sito necessaria.');
        $post = DB::fetch('SELECT * FROM posts WHERE id=? AND user_id=?', [$postId, $userId]);
        if (!$post || (int)$post['seo_score'] < 0) throw new DomainException('Selezionare un articolo elaborato.');
        if ((int)$post['published'] === 1) throw new DomainException('Sospendi prima la pubblicazione locale per evitare due copie pubbliche.');
        $payload = self::snapshot($post, $categoryId);
        if ($image !== null) {
            $bytes = base64_decode((string)($image['data'] ?? ''), true);
            $info = $bytes !== false ? @getimagesizefromstring($bytes) : false;
            if (!$info || strlen($bytes) > 2097152 || !in_array($info['mime'], ['image/jpeg','image/png','image/webp'], true) || $info[0] * $info[1] > 20000000) throw new DomainException('Immagine non valida: JPEG, PNG o WebP, massimo 2 MB e 20 megapixel.');
            $payload['image'] = ['data'=>base64_encode($bytes),'mime'=>$info['mime'],'alt'=>substr(strip_tags((string)($image['alt'] ?? '')), 0, 500)];
        }
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $key = hash('sha256', $connectionId . ':' . $postId);
        DB::execute("INSERT IGNORE INTO publication_jobs (user_id,connection_id,post_id,delivery_key,payload,payload_hash) VALUES (?,?,?,?,?,?)", [$userId, $connectionId, $postId, $key, $encoded, hash('sha256', $encoded)]);
        $job = DB::fetch('SELECT id FROM publication_jobs WHERE delivery_key=? AND user_id=?', [$key, $userId]);
        if (!$job) throw new RuntimeException('Invio non registrato.');
        return (int)$job['id'];
    }

    public static function snapshot(array $post, int $categoryId): array
    {
        $title = trim(strip_tags($post['edited_title'] ?? $post['generated_title'] ?? ''));
        $html = trim($post['edited_body'] ?? $post['generated_body'] ?? '');
        if ($title === '' || trim(strip_tags($html)) === '') throw new DomainException('Titolo e testo sono obbligatori.');
        if (strlen($html) > 500000) throw new DomainException('Articolo troppo grande.');
        // Gli elementi multimediali inline non vanno lasciati dipendenti dalla piattaforma.
        if (preg_match('/<(img|video|audio|iframe)\b/i', $html)) throw new DomainException('Per il pilota rimuovi i media inline; usa l’immagine principale caricata nel connettore.');
        return ['title' => $title, 'html' => $html, 'excerpt' => strip_tags($post['edited_excerpt'] ?? $post['generated_excerpt'] ?? ''), 'category_id' => max(0, $categoryId)];
    }

    public static function transition(int $userId, int $jobId, string $action): void
    {
        self::authorize($userId);
        $job = DB::fetch('SELECT * FROM publication_jobs WHERE id=? AND user_id=?', [$jobId, $userId]);
        if (!$job) throw new DomainException('Invio non disponibile.');
        if ($action === 'publish') {
            $changed = DB::execute("UPDATE publication_jobs SET state='queued',action='publish',attempts=0,next_attempt_at=NOW(),last_error=NULL WHERE id=? AND user_id=? AND state='draft' AND remote_id IS NOT NULL", [$jobId, $userId]);
        } else {
            $changed = DB::execute("UPDATE publication_jobs SET state='queued',next_attempt_at=NOW(),last_error=NULL WHERE id=? AND user_id=? AND state IN ('failed','uncertain') AND attempts<5", [$jobId, $userId]);
        }
        if (!$changed) throw new DomainException('Azione non disponibile per questo stato.');
    }

    public static function runOne(): bool
    {
        if (!self::enabled()) return false;
        DB::execute("UPDATE publication_jobs SET state='uncertain',lease_token=NULL,lease_until=NULL,last_error='Worker interrotto: riconciliare prima di ripetere.' WHERE state='sending' AND lease_until<NOW()");
        $token = bin2hex(random_bytes(16));
        DB::execute("UPDATE publication_jobs SET state='sending',lease_token=?,lease_until=DATE_ADD(NOW(),INTERVAL 2 MINUTE),attempts=attempts+1 WHERE state='queued' AND next_attempt_at<=NOW() ORDER BY id LIMIT 1", [$token]);
        $job = DB::fetch('SELECT * FROM publication_jobs WHERE lease_token=?', [$token]);
        if (!$job) return false;
        $state = 'failed'; $message = ''; $remoteId = $job['remote_id']; $remoteUrl = $job['remote_url'];
        try {
            self::authorize((int)$job['user_id']);
            $connection = self::connection((int)$job['user_id'], (int)$job['connection_id']);
            if ($connection['status'] !== 'connected') throw new DomainException('Collegamento revocato.');
            $route = '/deliveries/' . $job['delivery_key'];
            $existing = WordPressPublicationAdapter::request($connection, 'GET', $route);
            if (($existing['state'] ?? '') === 'uncertain') throw new RuntimeException('Creazione remota da verificare nel CMS.');
            if (($existing['state'] ?? '') === 'missing') {
                if ($job['action'] !== 'draft') throw new DomainException('Bozza remota non disponibile.');
                $post = DB::fetch('SELECT published FROM posts WHERE id=? AND user_id=?', [$job['post_id'], $job['user_id']]);
                if (!$post || (int)$post['published'] === 1) throw new DomainException('Articolo eliminato o pubblicato localmente: invio sospeso.');
                $existing = WordPressPublicationAdapter::request($connection, 'POST', $route, json_decode($job['payload'], true, 32, JSON_THROW_ON_ERROR));
            }
            if ($job['action'] === 'publish' && ($existing['state'] ?? '') === 'draft') {
                $existing = WordPressPublicationAdapter::request($connection, 'POST', $route . '/publish', []);
            }
            $state = (string)($existing['state'] ?? '');
            if (!in_array($state, ['draft', 'published'], true) || empty($existing['id'])) throw new RuntimeException('Esito remoto da verificare.');
            $remoteId = (int)$existing['id'];
            $remoteUrl = filter_var($existing['url'] ?? '', FILTER_VALIDATE_URL) && str_starts_with($existing['url'], 'https://') ? $existing['url'] : null;
            $message = $state === 'draft' ? 'Bozza consegnata.' : 'Pubblicazione confermata dal CMS.';
        } catch (DomainException $e) { $message = $e->getMessage(); }
        catch (Throwable $e) { $state = 'uncertain'; $message = 'Consegna da verificare. Controlla connessione e stato nel CMS prima di riprovare.'; }
        $changed = DB::execute('UPDATE publication_jobs SET state=?,remote_id=?,remote_url=?,last_error=?,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?', [$state, $remoteId, $remoteUrl, in_array($state, ['draft','published'], true) ? null : $message, $job['id'], $token]);
        if ($changed) DB::insert('INSERT INTO publication_events (job_id,state,message) VALUES (?,?,?)', [$job['id'], $state, $message]);
        return true;
    }
}
