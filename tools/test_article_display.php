<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/services/article_display.php';
$fixture = json_decode(file_get_contents(__DIR__ . '/article_rules_cases.json'), true);
foreach ($fixture['cases'] as $case) {
    $ids = array_column(ArticleDisplay::filter($fixture['posts'], $case['rules'], strtotime($fixture['now'])), 'id');
    if ($ids !== $case['ids']) throw new RuntimeException('Article display differs from shared fixture: ' . json_encode($case));
}
$config = ['blocks'=>[['type'=>'articles','props'=>['maxArticles'=>99]]], 'pages'=>[['path'=>'/','blocks'=>[['type'=>'articles','props'=>['maxArticles'=>3]]]]]];
if (ArticleDisplay::rules(json_encode($config)) !== ['maxArticles'=>3]) throw new RuntimeException('Home rules not read');
echo "Article display rules OK\n";
