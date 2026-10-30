<?php
if (!defined('ABSPATH')) exit;

function astw_archive_panel(): void {
    $settings = get_option('astw_sync_settings', []);
    echo '<h2>Archivio AllSocialToWeb</h2><p>Qui puoi leggere tutto l’archivio, comprese bozze e contenuti con sole foto o video. La sincronizzazione segue invece i filtri salvati in Canali → Connettore WordPress.</p>';
    if (empty($settings['feed_url'])) { echo '<p>Completa il collegamento e salva i parametri in AllSocialToWeb per leggere l’archivio.</p>'; return; }
    echo '<form method="get"><input type="hidden" name="page" value="allsocialtoweb"><input type="hidden" name="astw_archive" value="1"><button class="button">Leggi tutti gli articoli collegati</button></form>';
    if (empty($_GET['astw_archive'])) return;
    $cursor = max(0, (int)($_GET['astw_cursor'] ?? 0));
    $response = wp_safe_remote_get(add_query_arg(['cursor'=>$cursor,'browse'=>'1'], $settings['feed_url']), ['headers'=>['X-ASTW-Feed'=>$settings['feed_token']], 'timeout'=>25, 'redirection'=>0, 'limit_response_size'=>12000000]);
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response)!==200) { echo '<p>Archivio non raggiungibile. Verifica il collegamento e salva nuovamente i parametri in AllSocialToWeb.</p>'; return; }
    $page = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($page) || !is_array($page['posts'] ?? null)) { echo '<p>Risposta archivio non valida.</p>'; return; }
    echo '<table class="widefat striped"><thead><tr><th>Articolo</th><th>Fonte</th><th>Stato AllSocialToWeb</th></tr></thead><tbody>';
    foreach ($page['posts'] as $post) echo '<tr><td>' . esc_html($post['title'] ?? '') . '</td><td>' . esc_html($post['platform'] ?? '') . '</td><td>' . (!empty($post['published']) ? 'Pubblicato' : 'Bozza / acquisito') . '</td></tr>';
    echo '</tbody></table>';
    if (!empty($page['has_more'])) echo '<p><a class="button" href="' . esc_url(add_query_arg(['page'=>'allsocialtoweb','astw_archive'=>1,'astw_cursor'=>(int)$page['next_cursor']], admin_url('options-general.php'))) . '">Articoli successivi</a></p>';
    else echo '<p>Fine archivio. Per trasferire ogni contenuto scegli “Tutto l’archivio” e rimuovi i filtri di fonte e data in AllSocialToWeb.</p>';
}
