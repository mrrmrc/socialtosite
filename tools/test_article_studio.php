<?php
require_once __DIR__.'/../api/services/article_studio.php';
function studioCheck(bool $ok,string $message):void { if(!$ok)throw new RuntimeException($message); echo "OK: $message\n"; }
function studioReject(callable $fn,string $message):void { try{$fn();}catch(RuntimeException|InvalidArgumentException $e){echo "OK: $message\n";return;}throw new RuntimeException($message); }
$brief=ArticleStudio::input(['mode'=>'articles','subject'=>'Sonificazione e accessibilità','objective'=>'Spiegare ai docenti','channel'=>'Newsletter','instructions'=>'Niente offerte. Usa esempi di grafici per studenti.','length'=>'400-600 parole']);
$prompt=ArticleStudio::prompt(['profile_summary'=>'Attività artistica'],['declared_strategy'=>['primary_audience'=>'Docenti']],[],$brief,[]);
foreach(['Sonificazione e accessibilità','Spiegare ai docenti','Newsletter','Niente offerte. Usa esempi di grafici per studenti.','400-600 parole']as$value)studioCheck(str_contains($prompt,$value),'Explicit brief reaches the generation prompt: '.$value);
studioCheck(str_contains($prompt,'precedenza sul profilo'),'Explicit request has priority over stored profile');
studioReject(fn()=>ArticleStudio::input(['mode'=>'articles','subject'=>'  ']),'A full-article request cannot run without the subject');
$content='<p>'.str_repeat('Un esempio concreto per comprendere questo argomento. ',60).'</p><script>alert(1)</script><p onclick="alert(2)">Conclusione.</p>';
$articles=['articles'=>[['title'=>'Sonificazione in classe','content'=>$content,'excerpt'=>'Sintesi','tags'=>['Scuola']],['title'=>'Ascoltare un grafico','content'=>$content,'excerpt'=>'Sintesi','tags'=>[]]]];
$result=ArticleStudio::result(json_encode($articles),$brief,[]);
studioCheck(count($result['articles'])===2 && $result['articles'][0]['word_count']>=250,'Two complete articles are returned with their actual word counts');
studioCheck(!str_contains($result['articles'][0]['content'],'script')&&!str_contains($result['articles'][0]['content'],'onclick'),'Generated HTML drops executable elements and attributes');
studioCheck($result['brief']===$brief,'The result retains the exact brief for user review');
$short=$articles;$short['articles'][0]['content']='<p>Scaletta da sviluppare.</p>';
studioReject(fn()=>ArticleStudio::result(json_encode($short),$brief,[]),'A skeleton cannot be presented as a complete article');
$duplicate=$articles;$duplicate['articles'][1]['title']=$duplicate['articles'][0]['title'];
studioReject(fn()=>ArticleStudio::result(json_encode($duplicate),$brief,[]),'Duplicate articles are rejected');
studioReject(fn()=>ArticleStudio::result('{"articles":[', $brief,[]),'Truncated JSON is rejected without fabricating articles');
$signals=[['title'=>'Una ricerca recente','url'=>'https://example.com/research','published_at'=>'Tue, 20 Oct 2026 08:00:00 GMT']];
$proposal=['title'=>'Ascoltare i dati','reason'=>'Aiuta i docenti a capire una ricerca recente.','angle'=>'Grafici accessibili attraverso il suono','outline'=>['Il problema','Un esempio','Le applicazioni'],'source_url'=>$signals[0]['url'],'source_title'=>'Titolo inventato','published_at'=>'Data inventata'];
$proposals=['proposals'=>[$proposal,array_replace($proposal,['title'=>'Il suono in classe'])]];
$proposalBrief=ArticleStudio::input(['mode'=>'proposals','objective'=>'Educare']);
$result=ArticleStudio::result(json_encode($proposals),$proposalBrief,$signals);
studioCheck(count($result['proposals'])===2&&$result['proposals'][0]['source_title']===$signals[0]['title']&&$result['proposals'][0]['published_at']===$signals[0]['published_at'],'Proposal source names and dates come from retrieved evidence, never model inventions');
$proposals['proposals'][0]['source_url']='https://invented.example/news';
studioReject(fn()=>ArticleStudio::result(json_encode($proposals),$proposalBrief,$signals),'A proposal with an invented source is rejected');
$single=ArticleStudio::input(['mode'=>'articles','subject'=>'Sviluppa questa proposta','proposal'=>$proposal]);
$result=ArticleStudio::result(json_encode(['articles'=>[$articles['articles'][0]]]),$single,$signals);
studioCheck(count($result['articles'])===1,'Selecting one proposal produces its full article, not another batch of proposals');
echo "Article studio behavioral checks passed.\n";
