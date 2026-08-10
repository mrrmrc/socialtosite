<?php
// tools/test_html_sanitizer.php — Verifica il filtro anti-XSS del corpo articoli.
// Uso:  php tools/test_html_sanitizer.php   (solo da riga di comando)
if (php_sapi_name() !== 'cli') { http_response_code(403); exit('Solo da CLI'); }
function h(?string $s): string { return htmlspecialchars(html_entity_decode((string)$s, ENT_QUOTES,'UTF-8'), ENT_QUOTES,'UTF-8'); }
$src=file_get_contents(__DIR__ . '/../public/site.php');
$i=strpos($src,'/** Tag ammessi'); $j=strpos($src,'// ── Percorsi Vivi');
eval(substr($src,$i,$j-$i));

$pass=0;$fail=0;
function t($name,$in,$mustNot=[],$must=[]){ global $pass,$fail;
  $o=bodyHtml($in); $ok=true; $why='';
  foreach($mustNot as $n) if(stripos($o,$n)!==false){$ok=false;$why="contiene ancora '$n'";}
  foreach($must as $m) if(stripos($o,$m)===false){$ok=false;$why="ha perso '$m'";}
  if($ok){$pass++;echo "  ok    $name\n";} else {$fail++;echo "  FALLITO $name — $why\n     → $o\n";}
}
echo "\nAttacchi\n";
t('script inline',      '<p>ciao</p><script>alert(1)</script>',        ['<script','alert(1)'], ['<p>ciao</p>']);
t('img onerror',        '<p>x</p><img src=x onerror=alert(1)>',        ['onerror'],            ['<p>x</p>']);
t('href javascript:',   '<p><a href="javascript:alert(1)">clicca</a></p>', ['javascript:'],    ['clicca']);
t('javascript offuscato','<p><a href="java&#09;script:alert(1)">c</a></p>',['javascript:','java\tscript'], ['c']);
t('iframe',             '<p>a</p><iframe src="//evil.tld"></iframe>',  ['<iframe'],            ['<p>a</p>']);
t('svg onload',         '<p>a</p><svg onload=alert(1)></svg>',         ['onload','<svg'],      []);
t('style + espressione','<p>a</p><style>body{display:none}</style>',   ['<style'],             ['<p>a</p>']);
t('div con onclick',    '<div onclick="alert(1)">testo</div>',         ['onclick'],            ['testo']);
t('form ruba dati',     '<p>a</p><form action="//evil.tld"><input></form>', ['<form','<input'], ['<p>a</p>']);
t('data: uri in href',  '<p><a href="data:text/html,<script>x</script>">c</a></p>', ['data:text/html'], ['c']);
t('commento condiz.',   '<p>a</p><!--[if IE]><script>x</script><![endif]-->', ['<script','<!--'], ['<p>a</p>']);

echo "\nContenuto legittimo preservato\n";
t('formattazione',   '<h2>Titolo</h2><p>Testo <strong>forte</strong> e <em>corsivo</em>.</p>', [], ['<h2>','<strong>','<em>']);
t('liste',           '<ul><li>uno</li><li>due</li></ul>',            [], ['<ul>','<li>uno</li>']);
t('tabella',         '<table><tr><th scope="col">A</th><td colspan="2">B</td></tr></table>', [], ['<table>','scope="col"','colspan="2"']);
t('link normale',    '<p><a href="https://esempio.it" title="t">sito</a></p>', [], ['href="https://esempio.it"','title="t"']);
t('immagine',        '<p><img src="https://x.it/a.jpg" alt="foto" loading="lazy"></p>', [], ['src="https://x.it/a.jpg"','alt="foto"']);
t('accenti',         '<p>Perché è così: città, però.</p>',            [], ['Perché','città','però']);
t('testo semplice',  "Primo paragrafo.\n\nSecondo paragrafo.",        [], ['<p>Primo paragrafo.</p>','<p>Secondo paragrafo.</p>']);
t('rel su target',   '<p><a href="https://x.it" target="_blank">x</a></p>', [], ['noopener']);

echo "\n".str_repeat('─',46)."\n".($fail===0?"TUTTI I TEST PASSATI":"CI SONO FALLIMENTI")." — $pass ok, $fail falliti\n";
exit($fail===0?0:1);
