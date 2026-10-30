<?php
if (!defined('ABSPATH')) exit;

function astw_archive_panel(): void {
    $settings = get_option('astw_sync_settings', []);
    echo '<h2>Archivio AllSocialToWeb</h2><p>Qui puoi leggere tutto l’archivio, comprese bozze e contenuti con sole foto o video. La sincronizzazione segue invece i filtri salvati in Canali → Connettore WordPress.</p>';
    if (empty($settings['feed_url']) || empty($settings['feed_token'])) { echo '<div class="notice notice-warning inline"><p>Il codice abilita il connettore, ma il collegamento all’archivio non è ancora completo. Apri Canali → Connettore WordPress in AllSocialToWeb per completare il collegamento. Non occorre generare un nuovo codice.</p></div>'; return; }
    echo '<form method="get"><input type="hidden" name="page" value="allsocialtoweb"><input type="hidden" name="astw_archive" value="1"><button class="button">Leggi tutti gli articoli collegati</button></form>';
    $cursor = max(0, (int)($_GET['astw_cursor'] ?? 0));
    $response = wp_safe_remote_get(add_query_arg(['cursor'=>$cursor,'browse'=>'1'], $settings['feed_url']), ['headers'=>['X-ASTW-Feed'=>$settings['feed_token']], 'timeout'=>25, 'redirection'=>0, 'limit_response_size'=>12000000]);
    if (is_wp_error($response)) { echo '<div class="notice notice-error inline"><p>WordPress non riesce a raggiungere AllSocialToWeb: ' . esc_html($response->get_error_message()) . '</p></div>'; return; }
    $status = wp_remote_retrieve_response_code($response);
    if ($status !== 200) {
        $reason = in_array($status, [401,403], true) ? 'Collegamento non autorizzato: apri Canali → Connettore WordPress in AllSocialToWeb e ripristina il collegamento.' : 'Archivio temporaneamente non raggiungibile. Riprova tra poco.';
        echo '<div class="notice notice-error inline"><p>' . esc_html($reason) . ' (HTTP ' . (int)$status . ')</p></div>'; return;
    }
    $page = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($page) || !is_array($page['posts'] ?? null)) { echo '<p>Risposta archivio non valida.</p>'; return; }
    echo '<table class="widefat striped"><thead><tr><th>Articolo</th><th>Fonte</th><th>Stato AllSocialToWeb</th></tr></thead><tbody>';
    foreach ($page['posts'] as $post) {
        echo '<tr><td><strong>' . esc_html($post['title'] ?? '') . '</strong><details><summary>Leggi contenuto e media</summary><div style="max-width:760px;overflow-wrap:anywhere">';
        echo wp_kses_post($post['html'] ?? '');
        echo wp_kses($post['media_html'] ?? '', ['div'=>['class'=>true], 'img'=>['src'=>true,'alt'=>true,'loading'=>true,'style'=>true], 'video'=>['controls'=>true,'playsinline'=>true,'preload'=>true,'poster'=>true,'style'=>true], 'source'=>['src'=>true,'type'=>true], 'p'=>[], 'a'=>['href'=>true]], ['https','http']);
        if (!empty($post['source_url'])) echo '<p><a href="' . esc_url($post['source_url']) . '" target="_blank" rel="noopener noreferrer">Apri la fonte originale</a></p>';
        echo '</div></details></td><td>' . esc_html($post['platform'] ?? '') . '</td><td>' . (!empty($post['published']) ? 'Pubblicato' : 'Bozza / acquisito') . '</td></tr>';
    }
    if (!$page['posts']) echo '<tr><td colspan="3">Nessun contenuto in questa pagina dell’archivio.</td></tr>';
    echo '</tbody></table>';
    if (!empty($page['has_more'])) echo '<p><a class="button" href="' . esc_url(add_query_arg(['page'=>'allsocialtoweb','astw_archive'=>1,'astw_cursor'=>(int)$page['next_cursor']], admin_url('options-general.php'))) . '">Articoli successivi</a></p>';
    else echo '<p>Fine archivio. Per trasferire ogni contenuto scegli “Tutto l’archivio” e rimuovi i filtri di fonte e data in AllSocialToWeb.</p>';
}
