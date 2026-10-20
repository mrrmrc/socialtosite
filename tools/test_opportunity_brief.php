<?php
require_once __DIR__ . '/../api/services/opportunity_brief.php';
function checkBrief(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$card = ['id'=>'reuse-7', 'evidence'=>['label'=>'Articolo proprio pubblicato']];
$post = ['id'=>7, 'generated_title'=>'Titolo originale', 'generated_body'=>'<p>Servizio documentato.</p>', 'published'=>1];
$context = OpportunityBrief::context(['title'=>'Studio', 'site_understanding'=>'{"inferred":true}'], $card, $post);
checkBrief($context['source']['body'] === 'Servizio documentato.', 'Source body must be loaded and stripped of markup');
checkBrief($context['source']['title'] === 'Titolo originale', 'Generated title fallback');
$brief = OpportunityBrief::normalize(json_encode(['title'=>'<b>Titolo</b>', 'reason'=>'Intervento', 'source_post_id'=>900, 'questions'=>['Zona?', ['bad'], '']]), $card, $post);
checkBrief($brief['title'] === 'Titolo', 'No markup in title');
checkBrief($brief['source_post_id'] === 7, 'Model cannot replace source id');
checkBrief($brief['questions'] === ['Zona?'], 'Invalid questions filtered');
checkBrief($brief['source'] === 'Articolo proprio pubblicato', 'Evidence comes from trusted opportunity');
foreach (['broken', '{}', '{"title":"T"}', '[]'] as $raw) {
    $failed = false;
    try { OpportunityBrief::normalize($raw, $card, null); } catch (RuntimeException $e) { $failed = true; }
    checkBrief($failed, 'Malformed and incomplete generations must fail');
}
echo "Opportunity brief: source provenance, normalization and invalid generations passed.\n";
