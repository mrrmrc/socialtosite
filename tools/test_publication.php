<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/services/publication/service.php';
$checks = 0;
function check(bool $condition, string $label): void {
    global $checks;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $checks++; echo 'OK ' . $label . PHP_EOL;
}
function rejects(callable $operation, string $label): void {
    $rejected = false;
    try { $operation(); } catch (Throwable $e) { $rejected = true; }
    check($rejected, $label);
}
check(PlanPolicy::siteLimit('base') === 1 && PlanPolicy::siteLimit('pro') === 3, 'limiti Base e Pro');
check(!PlanPolicy::connectors(null) && PlanPolicy::connectors(' PROFESSIONAL '), 'autorizzazione normalizzata');
foreach (['http://example.com','https://user:pass@example.com','https://example.com:8080','https://example.com?token=x','https://example.com/#x', "https://example.com\n"] as $url) {
    // Whitespace around a URL is intentionally normalized, controls inside aren't.
    if (str_ends_with($url, "\n")) $url = "https://exam\nple.com";
    rejects(fn()=>PublicationSecurity::endpoint($url), 'URL rifiutato ' . json_encode($url));
}
check(PublicationSecurity::endpoint('https://example.com/blog/') === 'https://example.com/blog', 'WordPress in sottocartella');
foreach (['127.0.0.1','10.1.2.3','192.168.1.1','172.16.0.1','169.254.169.254','100.64.0.1','100.127.255.254','0.0.0.0','::1','::ffff:127.0.0.1','224.0.0.1','198.18.0.1','192.0.2.1'] as $ip) check(!PublicationSecurity::publicIp($ip), 'IP privato bloccato ' . $ip);
check(PublicationSecurity::publicIp('8.8.8.8'), 'IPv4 pubblico ammesso');
putenv('PUBLICATION_ENCRYPTION_KEY=' . base64_encode(random_bytes(32)));
$cipher = PublicationSecurity::encrypt('test-credential');
check(PublicationSecurity::decrypt($cipher) === 'test-credential', 'credenziale cifrata');
$bytes = base64_decode($cipher); $bytes[20] = chr(ord($bytes[20]) ^ 1);
rejects(fn()=>PublicationSecurity::decrypt(base64_encode($bytes)), 'credenziale alterata respinta');
$signature = PublicationSecurity::signature('secret','100','nonce','POST','/deliveries/key','body');
check($signature !== PublicationSecurity::signature('secret','100','nonce','POST','/deliveries/key','changed'), 'firma legata al contenuto');
check($signature !== PublicationSecurity::signature('secret','100','nonce','POST','/deliveries/key/publish','body'), 'firma legata all’azione');
$snapshot = PublicationService::snapshot(['edited_title'=>'Titolo rivisto','generated_title'=>'Vecchio','edited_body'=>'<p>Versione approvata</p>'], 2);
check($snapshot['title'] === 'Titolo rivisto' && $snapshot['category_id'] === 2, 'versione editoriale prioritaria');
rejects(fn()=>PublicationService::snapshot(['generated_title'=>'x','generated_body'=>''],0), 'articolo vuoto respinto');
rejects(fn()=>PublicationService::snapshot(['generated_title'=>'x','generated_body'=>'<p>x</p><img src="https://example.com/a.jpg">'],0), 'nessun hotlink media inline');
check(!PublicationService::enabled(), 'connettori disabilitati per default');
echo "$checks controlli superati.\n";
