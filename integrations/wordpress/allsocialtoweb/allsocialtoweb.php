<?php
/**
 * Plugin Name: AllSocialToWeb Connector
 * Description: Riceve bozze e pubblicazioni esplicite da AllSocialToWeb. Versione pilota.
 * Version: 0.1.0
 * Requires PHP: 8.0
 * Requires at least: 6.0
 */
if (!defined('ABSPATH')) exit;

register_activation_hook(__FILE__, static function () {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$wpdb->prefix}astw_deliveries (
        delivery_key varchar(64) NOT NULL,
        payload_hash varchar(64) NOT NULL,
        post_id bigint unsigned NULL,
        created_at datetime NOT NULL,
        PRIMARY KEY  (delivery_key)
    ) $charset;");
    dbDelta("CREATE TABLE {$wpdb->prefix}astw_nonces (
        nonce varchar(32) NOT NULL,
        expires_at datetime NOT NULL,
        PRIMARY KEY  (nonce)
    ) $charset;");
});

add_action('admin_menu', static function () {
    add_options_page('AllSocialToWeb', 'AllSocialToWeb', 'manage_options', 'allsocialtoweb', 'astw_settings');
});

function astw_settings(): void {
    if (!current_user_can('manage_options')) return;
    $newSecret = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        check_admin_referer('astw_connection');
        if (isset($_POST['disconnect'])) {
            delete_option('astw_secret'); delete_option('astw_author');
        } else {
            $newSecret = bin2hex(random_bytes(32));
            update_option('astw_secret', $newSecret, false);
            update_option('astw_author', get_current_user_id(), false);
        }
    }
    echo '<div class="wrap"><h1>AllSocialToWeb</h1><p>Collega questo sito per ricevere articoli. La creazione iniziale è sempre una bozza. Gli articoli rimangono qui dopo la disconnessione.</p>';
    echo '<p>Indirizzo del sito: <code>' . esc_html(untrailingslashit(home_url())) . '</code></p>';
    if ($newSecret) echo '<p>Copia ora il codice in AllSocialToWeb. Non sarà mostrato nuovamente.</p><code style="user-select:all">' . esc_html($newSecret) . '</code>';
    echo '<p>Stato: ' . (get_option('astw_secret') ? 'collegamento abilitato' : 'disabilitato') . '</p><form method="post">';
    wp_nonce_field('astw_connection');
    submit_button('Genera nuovo codice (revoca il precedente)', 'primary', 'connect');
    submit_button('Disabilita collegamento', 'secondary', 'disconnect');
    echo '</form></div>';
}

function astw_permission(WP_REST_Request $request) {
    global $wpdb;
    $secret = get_option('astw_secret', '');
    $author = (int)get_option('astw_author', 0);
    if (!$secret || !$author || !user_can($author, 'edit_posts')) return new WP_Error('astw_auth', 'Collegamento disabilitato.', ['status'=>403]);
    $timestamp = $request->get_header('x-astw-time');
    $nonce = $request->get_header('x-astw-nonce');
    if (!ctype_digit($timestamp) || abs(time() - (int)$timestamp) > 300 || !preg_match('/^[a-f0-9]{32}$/', $nonce)) return new WP_Error('astw_auth', 'Firma scaduta o non valida.', ['status'=>401]);
    $route = substr($request->get_route(), strlen('/allsocialtoweb/v1'));
    $message = implode("\n", [$timestamp, $nonce, $request->get_method(), $route, hash('sha256', $request->get_body())]);
    if (!hash_equals(hash_hmac('sha256', $message, $secret), $request->get_header('x-astw-signature'))) return new WP_Error('astw_auth', 'Firma non valida.', ['status'=>401]);
    $wpdb->query("DELETE FROM {$wpdb->prefix}astw_nonces WHERE expires_at<UTC_TIMESTAMP()");
    $inserted = $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->prefix}astw_nonces (nonce,expires_at) VALUES (%s,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))", $nonce));
    if ($inserted !== 1) return new WP_Error('astw_replay', 'Richiesta già utilizzata.', ['status'=>409]);
    wp_set_current_user($author);
    return true;
}

add_action('rest_api_init', static function () {
    register_rest_route('allsocialtoweb/v1', '/health', ['methods'=>'GET','permission_callback'=>'astw_permission','callback'=>static function () {
        $categories = get_categories(['hide_empty'=>false]);
        return ['protocol'=>'1','categories'=>array_map(static fn($c)=>['id'=>$c->term_id,'name'=>$c->name], $categories)];
    }]);
    register_rest_route('allsocialtoweb/v1', '/deliveries/(?P<key>[a-f0-9]{64})', [
        ['methods'=>'GET','permission_callback'=>'astw_permission','callback'=>static fn($r)=>astw_receipt($r['key'])],
        ['methods'=>'POST','permission_callback'=>'astw_permission','callback'=>'astw_deliver'],
    ]);
    register_rest_route('allsocialtoweb/v1', '/deliveries/(?P<key>[a-f0-9]{64})/publish', ['methods'=>'POST','permission_callback'=>'astw_permission','callback'=>'astw_publish']);
});

function astw_receipt(string $key): array {
    global $wpdb;
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}astw_deliveries WHERE delivery_key=%s", $key), ARRAY_A);
    if (!$row) return ['state'=>'missing'];
    if (!$row['post_id']) {
        // Marker in the initial post INSERT survives a crash before saving receipt.
        $id = $wpdb->get_var($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type='post' AND post_content_filtered=%s ORDER BY ID LIMIT 1", 'astw:' . $key));
        if (!$id) return ['state'=>'uncertain'];
        $wpdb->update($wpdb->prefix . 'astw_deliveries', ['post_id'=>$id], ['delivery_key'=>$key]);
        $row['post_id'] = $id;
    }
    $post = get_post((int)$row['post_id']);
    if (!$post || !in_array($post->post_status, ['draft','publish'], true)) return ['state'=>'uncertain'];
    return ['state'=>$post->post_status === 'publish' ? 'published' : 'draft','id'=>$post->ID,'url'=>get_permalink($post->ID)];
}

function astw_deliver(WP_REST_Request $request) {
    global $wpdb;
    if (strlen($request->get_body()) > 3500000) return new WP_Error('astw_size','Contenuto troppo grande.',['status'=>413]);
    $payload = $request->get_json_params();
    if (!is_array($payload)) return new WP_Error('astw_payload','Contenuto non valido.',['status'=>422]);
    $title = sanitize_text_field($payload['title'] ?? '');
    $allowed = ['p'=>[], 'br'=>[], 'h2'=>[], 'h3'=>[], 'h4'=>[], 'strong'=>[], 'em'=>[], 'ul'=>[], 'ol'=>[], 'li'=>[], 'blockquote'=>[], 'a'=>['href'=>true,'title'=>true]];
    $html = wp_kses($payload['html'] ?? '', $allowed, ['https','http','mailto']);
    if ($title === '' || trim(wp_strip_all_tags($html)) === '') return new WP_Error('astw_empty','Titolo e testo obbligatori.',['status'=>422]);
    $category = absint($payload['category_id'] ?? 0);
    if ($category && !term_exists($category, 'category')) return new WP_Error('astw_category','Categoria non disponibile.',['status'=>422]);
    $imageBytes = null;
    if (isset($payload['image'])) {
        $imageBytes = base64_decode((string)($payload['image']['data'] ?? ''), true);
        $info = $imageBytes !== false ? @getimagesizefromstring($imageBytes) : false;
        if (!$info || strlen($imageBytes)>2097152 || !in_array($info['mime'], ['image/jpeg','image/png','image/webp'], true) || $info[0]*$info[1]>20000000 || !current_user_can('upload_files')) return new WP_Error('astw_image','Immagine non valida o caricamento non autorizzato.',['status'=>422]);
    }
    $key = $request['key'];
    $hash = hash('sha256', $request->get_body());
    $lock = 'astw:' . substr(hash('sha256', $wpdb->prefix . $key), 0, 48);
    if ((int)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock)) !== 1) return new WP_Error('astw_busy','Consegna in corso.',['status'=>409]);
    try {
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}astw_deliveries WHERE delivery_key=%s", $key), ARRAY_A);
        if ($row) {
            if (!hash_equals($row['payload_hash'], $hash)) return new WP_Error('astw_conflict','La versione consegnata è diversa.',['status'=>409]);
            return astw_receipt($key);
        }
        $inserted = $wpdb->insert($wpdb->prefix . 'astw_deliveries', ['delivery_key'=>$key,'payload_hash'=>$hash,'created_at'=>gmdate('Y-m-d H:i:s')]);
        if ($inserted !== 1) return new WP_Error('astw_storage','Registro consegna non disponibile.',['status'=>503]);
        $imageId = 0;
        if ($imageBytes !== null) {
            $ext = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$info['mime']];
            $upload = wp_upload_bits('allsocialtoweb-' . substr($key,0,16) . '.' . $ext, null, $imageBytes);
            if (!empty($upload['error'])) return new WP_Error('astw_image','Caricamento immagine da verificare.',['status'=>503]);
            $imageId = wp_insert_attachment(['post_mime_type'=>$info['mime'],'post_title'=>$title,'post_status'=>'inherit'], $upload['file'], 0, true);
            if (is_wp_error($imageId)) return new WP_Error('astw_image','Allegato da verificare.',['status'=>503]);
            require_once ABSPATH . 'wp-admin/includes/image.php';
            wp_update_attachment_metadata($imageId, wp_generate_attachment_metadata($imageId, $upload['file']));
            update_post_meta($imageId, '_wp_attachment_image_alt', sanitize_text_field($payload['image']['alt'] ?? ''));
        }
        $id = wp_insert_post(wp_slash([
            'post_title'=>$title, 'post_content'=>$html, 'post_excerpt'=>sanitize_textarea_field($payload['excerpt'] ?? ''),
            'post_status'=>'draft', 'post_type'=>'post', 'post_author'=>get_current_user_id(),
            'post_category'=>$category ? [$category] : [], 'post_content_filtered'=>'astw:' . $key,
            'meta_input'=>$imageId ? ['_thumbnail_id'=>$imageId] : [],
        ]), true);
        if (is_wp_error($id) || !$id) return new WP_Error('astw_create','Creazione da verificare.',['status'=>503]);
        $wpdb->update($wpdb->prefix . 'astw_deliveries', ['post_id'=>$id], ['delivery_key'=>$key]);
        return astw_receipt($key);
    } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock)); }
}

function astw_publish(WP_REST_Request $request) {
    global $wpdb;
    $lock = 'astw:' . substr(hash('sha256', $wpdb->prefix . $request['key']), 0, 48);
    if ((int)$wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 0)', $lock)) !== 1) return new WP_Error('astw_busy','Consegna in corso.',['status'=>409]);
    try {
        $receipt = astw_receipt($request['key']);
        if (!isset($receipt['id']) || !current_user_can('publish_posts') || !current_user_can('edit_post', $receipt['id'])) return new WP_Error('astw_publish','Pubblicazione non disponibile.',['status'=>403]);
        if ($receipt['state'] === 'published') return $receipt;
        // Pubblica la versione presente nel CMS: mai sovrascrivere le modifiche locali.
        $result = wp_update_post(['ID'=>$receipt['id'],'post_status'=>'publish'], true);
        if (is_wp_error($result)) return new WP_Error('astw_publish','Pubblicazione da verificare.',['status'=>503]);
        return astw_receipt($request['key']);
    } finally { $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock)); }
}
