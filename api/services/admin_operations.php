<?php

/** Administrative operations on the existing schema. Never runs migrations. */
final class AdminOperations
{
    public static function listing(array $query): array
    {
        $page = max(1, min(100000, (int)($query['page'] ?? 1)));
        $status = (string)($query['status'] ?? 'all');
        $conditions = [
            'all' => '1=1',
            'published' => 'p.published=1',
            'draft' => "p.published=0 AND p.seo_score>=0 AND p.processing_status='done'",
            'pending' => "p.seo_score=-1 AND p.processing_status='pending'",
            'processing' => "p.processing_status='processing'",
            'failed' => "p.processing_status='failed'",
            'queue' => "(p.seo_score=-1 OR p.processing_status IN ('processing','failed'))",
        ];
        if (!isset($conditions[$status])) throw new InvalidArgumentException('Stato non valido.');
        $where = $conditions[$status];
        $params = [];
        if (!empty($query['user_id'])) {
            $where .= ' AND p.user_id=?';
            $params[] = (int)$query['user_id'];
        }
        $search = substr(trim((string)($query['q'] ?? '')), 0, 120);
        if ($search !== '') {
            $where .= " AND (u.name LIKE ? OR u.email LIKE ? OR p.generated_title LIKE ? OR p.edited_title LIKE ? OR CAST(p.id AS CHAR)=?)";
            $like = '%' . $search . '%';
            array_push($params, $like, $like, $like, $like, ltrim($search, '#'));
        }
        $total = (int)(DB::fetch("SELECT COUNT(*) AS total FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE $where", $params)['total'] ?? 0);
        $pages = max(1, (int)ceil($total / 25));
        $page = min($page, $pages);
        $offset = ($page - 1) * 25;
        $items = DB::fetchAll("SELECT p.id,p.user_id,p.platform,p.generated_title,p.edited_title,p.published,p.seo_score,
            p.processing_status,p.processing_attempts,p.processing_started_at,p.imported_at,p.noindex,u.name,u.email,
            CASE WHEN p.processing_status='processing' AND p.processing_started_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE) THEN 1 ELSE 0 END AS stale,
            CASE WHEN TRIM(COALESCE(p.edited_title,p.generated_title,''))<>'' AND TRIM(COALESCE(p.edited_body,p.generated_body,''))<>'' THEN 1 ELSE 0 END AS has_content
            FROM posts p LEFT JOIN users u ON u.id=p.user_id WHERE $where ORDER BY p.id DESC LIMIT 25 OFFSET $offset", $params);
        return ['items' => $items, 'total' => $total, 'page' => $page, 'pages' => $pages];
    }

    public static function change(array $payload, int $adminId): void
    {
        $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
        $action = $payload['operation'] ?? '';
        if (!$id || $id < 1 || !in_array($action, ['publish','unpublish','retry','noindex','index'], true)) {
            throw new InvalidArgumentException('Contenuto o operazione non validi.');
        }
        if (!DB::fetch('SELECT id FROM posts WHERE id=?', [$id])) throw new OutOfBoundsException('Contenuto non trovato.');
        // Conditions are part of the write: a concurrent worker cannot be overwritten.
        $queries = [
            'publish' => "UPDATE posts SET published=1,published_at=COALESCE(published_at,NOW()) WHERE id=? AND published=0 AND seo_score>=0 AND processing_status='done' AND TRIM(COALESCE(edited_title,generated_title,''))<>'' AND TRIM(COALESCE(edited_body,generated_body,''))<>''",
            'unpublish' => 'UPDATE posts SET published=0 WHERE id=? AND published=1',
            'retry' => "UPDATE posts SET processing_status='pending',processing_started_at=NULL,processing_error=NULL,processing_attempts=0 WHERE id=? AND published=0 AND seo_score=-1 AND (processing_status='failed' OR (processing_status='processing' AND processing_started_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)))",
            'noindex' => 'UPDATE posts SET noindex=1 WHERE id=? AND noindex=0',
            'index' => 'UPDATE posts SET noindex=0 WHERE id=? AND noindex=1',
        ];
        if (DB::execute($queries[$action], [$id]) !== 1) throw new DomainException('Stato cambiato o operazione non disponibile. Aggiorna la lista.');
        if (class_exists('Logger')) Logger::info('admin-audit', 'Operazione contenuto: ' . $action, ['admin_id' => $adminId, 'post_id' => $id]);
    }
}
