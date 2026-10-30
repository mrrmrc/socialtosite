<?php
if (!defined('ABSPATH')) exit;

add_filter('cron_schedules', static function ($schedules) {
    $schedules['astw_five_minutes'] = ['interval'=>300, 'display'=>'AllSocialToWeb ogni 5 minuti'];
    return $schedules;
});
add_action('astw_sync_feed', static function () {
    if (!empty(get_option('astw_sync_settings', [])['enabled'])) astw_sync_feed();
});
add_action('init', static function () {
    // Reinstalling/upgrading the ZIP can clear scheduled events while retaining options.
    if (get_option('astw_secret') && !empty(get_option('astw_sync_settings', [])['enabled']) && !wp_next_scheduled('astw_sync_feed')) wp_schedule_event(time()+30, 'astw_five_minutes', 'astw_sync_feed');
});
register_deactivation_hook(__DIR__ . '/allsocialtoweb.php', static function () { wp_clear_scheduled_hook('astw_sync_feed'); });

function astw_public_sync_settings(): array {
    $settings = get_option('astw_sync_settings', []);
    return array_intersect_key($settings, array_flip(['enabled','post_status','category_id','mappings','filters']));
}

function astw_mapping(array $topics, array $settings): array {
    $categories = []; $tags = [];
    foreach ($topics as $topic) {
        $mapped = $settings['mappings'][trim((string)$topic)] ?? [];
        if (!empty($mapped['category_id'])) $categories[] = (int)$mapped['category_id'];
        if (!empty($mapped['tag_id'])) $tags[] = (int)$mapped['tag_id'];
    }
    if (!$categories && !empty($settings['category_id'])) $categories[] = (int)$settings['category_id'];
    return ['category_ids'=>array_values(array_unique($categories)), 'tag_ids'=>array_values(array_unique($tags))];
}

function astw_save_sync_settings(WP_REST_Request $request) {
    $input = $request->get_json_params();
    if (!is_array($input)) return new WP_Error('astw_settings','Impostazioni non valide.',['status'=>422]);
    $url = (string)($input['feed_url'] ?? '');
    $parts = wp_parse_url($url);
    if (!$parts || ($parts['scheme'] ?? '') !== 'https' || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment']) || !wp_http_validate_url($url)) return new WP_Error('astw_url','Feed HTTPS pubblico richiesto.',['status'=>422]);
    $token = (string)($input['feed_token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return new WP_Error('astw_token','Codice feed non valido.',['status'=>422]);
    $status = ($input['post_status'] ?? '') === 'publish' ? 'publish' : 'draft';
    if ($status === 'publish' && !current_user_can('publish_posts')) return new WP_Error('astw_publish','L’utente collegato non può pubblicare.',['status'=>403]);
    $category = absint($input['category_id'] ?? 0);
    if ($category && !term_exists($category, 'category')) return new WP_Error('astw_category','Categoria non disponibile.',['status'=>422]);
    $mappings = $input['mappings'] ?? [];
    if (!is_array($mappings) || count($mappings) > 300) return new WP_Error('astw_mapping','Massimo 300 abbinamenti.',['status'=>422]);
    $normalized = [];
    foreach ($mappings as $topic=>$mapping) {
        if (!is_array($mapping) || (!is_string($topic) && !is_int($topic)) || strlen((string)$topic) > 300) return new WP_Error('astw_mapping','Abbinamento non valido.',['status'=>422]);
        $categoryId = absint($mapping['category_id'] ?? 0); $tagId = absint($mapping['tag_id'] ?? 0);
        if (($categoryId && !term_exists($categoryId, 'category')) || ($tagId && !term_exists($tagId, 'post_tag'))) return new WP_Error('astw_mapping','Categoria o tag non più disponibile: aggiorna l’elenco.',['status'=>422]);
        if ($categoryId || $tagId) $normalized[trim($topic)] = ['category_id'=>$categoryId, 'tag_id'=>$tagId];
    }
    $filters = $input['filters'] ?? ['scope'=>'published'];
    if (!is_array($filters) || !in_array($filters['scope'] ?? '', ['all','published','drafts'], true)) return new WP_Error('astw_filters','Archivio non valido.',['status'=>422]);
    $settings = ['feed_url'=>$url, 'feed_token'=>$token, 'enabled'=>!empty($input['enabled']), 'post_status'=>$status, 'category_id'=>$category, 'mappings'=>$normalized, 'filters'=>$filters];
    $old = get_option('astw_sync_settings', []);
    update_option('astw_sync_settings', $settings, false);
    if (($old['feed_url'] ?? '') !== $url || ($old['filters'] ?? []) !== $filters) update_option('astw_sync_cursor', 0, false);
    if ($settings['enabled'] && !wp_next_scheduled('astw_sync_feed')) wp_schedule_event(time()+30, 'astw_five_minutes', 'astw_sync_feed');
    if (!$settings['enabled']) wp_clear_scheduled_hook('astw_sync_feed');
    return ['ok'=>true, 'archive_available'=>true, 'settings'=>astw_public_sync_settings()];
}

function astw_sync_feed(?WP_REST_Request $command = null) {
    global $wpdb;
    $settings = get_option('astw_sync_settings', []);
    $author = (int)get_option('astw_author', 0);
    if (!$author || !get_option('astw_secret') || empty($settings['feed_url']) || !user_can($author, 'edit_posts')) return new WP_Error('astw_sync','Configura il collegamento e salva gli abbinamenti.',['status'=>422]);
    // Cron runs without an interactive user; always use the administrator who connected the plugin.
    $previousUser = get_current_user_id();
    wp_set_current_user($author);
    $lock = 'astw_sync:' . substr(hash('sha256', $wpdb->prefix), 0, 40);
    if ((int)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock)) !== 1) { wp_set_current_user($previousUser); return new WP_Error('astw_busy','Sincronizzazione già in corso.',['status'=>409]); }
    try {
        if ($command && !empty($command->get_json_params()['restart'])) update_option('astw_sync_cursor', 0, false);
        $cursor = (int)get_option('astw_sync_cursor', 0);
        $response = wp_safe_remote_get(add_query_arg('cursor', $cursor, $settings['feed_url']), [
            'headers'=>['X-ASTW-Feed'=>$settings['feed_token']], 'timeout'=>25, 'redirection'=>0, 'limit_response_size'=>12000000,
        ]);
        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) throw new RuntimeException('Feed non disponibile: controlla il collegamento in AllSocialToWeb.');
        $feed = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($feed) || !is_array($feed['posts'] ?? null) || !isset($feed['next_cursor'], $feed['has_more'])) throw new RuntimeException('Risposta feed non valida.');
        $imported = 0; $skipped = 0;
        foreach ($feed['posts'] as $item) {
            $key = $item['key'] ?? '';
            if (!preg_match('/^[a-f0-9]{64}$/', $key)) throw new RuntimeException('Identificativo contenuto non valido.');
            $receipt = astw_receipt($key);
            // Repeated sweeps catch articles published later with an older ID and never overwrite CMS edits.
            if (($receipt['state'] ?? '') === 'uncertain') throw new RuntimeException('Una consegna precedente è da verificare nel registro WordPress.');
            $request = new WP_REST_Request('POST', '/allsocialtoweb/v1/deliveries/' . $key);
            $request->set_url_params(['key'=>$key]);
            if (($receipt['state'] ?? '') !== 'missing') {
                if ($receipt['state'] === 'draft' && get_post_meta((int)$receipt['id'], '_astw_sync_publish', true)) {
                    $published = astw_publish($request);
                    if (is_wp_error($published) || ($published['state'] ?? '') !== 'published') throw new RuntimeException('Pubblicazione da verificare in WordPress.');
                    delete_post_meta((int)$receipt['id'], '_astw_sync_publish');
                }
                $skipped++; continue;
            }
            $mediaHtml = (string)($item['media_html'] ?? '');
            if (str_contains($mediaHtml, '<iframe')) $mediaHtml = '<p><a href="' . esc_url($item['source_url'] ?? '') . '">Guarda il video originale</a></p>';
            $payload = ['title'=>$item['title'] ?? '', 'html'=>($item['html'] ?? '') . $mediaHtml, 'excerpt'=>$item['excerpt'] ?? '', 'sync_publish'=>$settings['post_status'] === 'publish'] + astw_mapping((array)($item['topics'] ?? []), $settings);
            $request->set_body(wp_json_encode($payload));
            $request->set_header('content-type', 'application/json');
            $receipt = astw_deliver($request);
            if (is_wp_error($receipt) || empty($receipt['id'])) throw new RuntimeException('Importazione interrotta: controlla categorie, tag e registro WordPress.');
            if ($settings['post_status'] === 'publish') {
                $receipt = astw_publish($request);
                if (is_wp_error($receipt) || ($receipt['state'] ?? '') !== 'published') throw new RuntimeException('Articolo importato come bozza; pubblicazione da verificare in WordPress.');
                delete_post_meta((int)$receipt['id'], '_astw_sync_publish');
            }
            $imported++;
        }
        update_option('astw_sync_cursor', max(0, (int)$feed['next_cursor']), false);
        $result = ['ok'=>true, 'imported'=>$imported, 'skipped'=>$skipped, 'has_more'=>(bool)$feed['has_more'], 'at'=>gmdate('c')];
        update_option('astw_last_sync', $result, false);
        return $result;
    } catch (Throwable $e) {
        update_option('astw_last_sync', ['ok'=>false, 'error'=>$e->getMessage(), 'at'=>gmdate('c')], false);
        return new WP_Error('astw_sync', $e->getMessage(), ['status'=>502]);
    } finally {
        $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        wp_set_current_user($previousUser);
    }
}
