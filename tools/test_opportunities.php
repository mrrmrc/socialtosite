<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('Solo da CLI'); }
require_once __DIR__.'/../api/services/opportunities.php';

$checks = 0;
function checkOpportunity(bool $condition, string $message): void {
    global $checks;
    $checks++;
    if (!$condition) throw new RuntimeException($message);
}
function opportunityOf(array $cards, string $type): ?array {
    foreach ($cards as $card) if ($card['type'] === $type) return $card;
    return null;
}
$site = ['profile_summary'=>'Riparazione biciclette'];
$contact = ['profile'=>['whatsapp'=>'393401234567']];
$posts = [['id'=>7, 'published'=>1, 'slug'=>'freni', 'generated_title'=>'<b>Regolare i freni</b>'], ['id'=>9, 'published'=>0, 'title'=>'Bozza privata']];
$sources = [['id'=>1, 'platform'=>'instagram']];
$visibility = ['opportunities'=>[['post_id'=>7, 'queries'=>[['query_text'=>'freni bicicletta', 'impressions'=>42, 'clicks'=>3]]]]];
$snapshot = serialize([$site, $posts, $sources, $visibility, $contact]);
$cards = OpportunityPlanner::plan($site, $posts, $sources, $visibility, [], $contact);
$search = opportunityOf($cards, 'search_improvement');
checkOpportunity($search !== null, 'A query tied to a published post must yield an improvement.');
checkOpportunity($search['evidence']['impressions'] === 42 && $search['evidence']['clicks'] === 3, 'Preserve observed metrics.');
checkOpportunity($search['next_action']['post_id'] === 7, 'Action identifies the real post.');
checkOpportunity($search['evidence']['post_title'] === 'Regolare i freni', 'Post titles must be plain text.');
checkOpportunity($snapshot === serialize([$site, $posts, $sources, $visibility, $contact]), 'Planner must not mutate inputs.');
checkOpportunity($cards === OpportunityPlanner::plan($site, $posts, $sources, $visibility, [], $contact), 'Planner must be deterministic.');

$unrelated = OpportunityPlanner::plan($site, $posts, $sources, ['top_queries'=>[['query_text'=>'freni', 'impressions'=>100]]], [], $contact);
checkOpportunity(opportunityOf($unrelated, 'search_improvement') === null, 'A site-level query cannot prove a query/post relationship.');
checkOpportunity(opportunityOf($unrelated, 'reuse_content')['next_action']['post_id'] === 7, 'Published content can be reused without search data.');
checkOpportunity(opportunityOf($unrelated, 'profile_idea')['evidence']['kind'] === 'hypothesis', 'Profile ideas are explicit hypotheses.');
$foreign = OpportunityPlanner::plan($site, $posts, $sources, ['top_queries'=>[['post_id'=>999, 'query_text'=>'freni', 'impressions'=>100]]], [], $contact);
checkOpportunity(opportunityOf($foreign, 'search_improvement') === null, 'Unknown post IDs must never be linked.');
$draft = OpportunityPlanner::plan($site, $posts, $sources, ['top_queries'=>[['post_id'=>9, 'query_text'=>'privata', 'impressions'=>10]]], [], $contact);
checkOpportunity(opportunityOf($draft, 'search_improvement') === null, 'Unpublished posts must not become observed public opportunities.');
$zero = OpportunityPlanner::plan($site, $posts, $sources, ['top_queries'=>[['post_id'=>7, 'query_text'=>'freni', 'impressions'=>0]]], [], $contact);
checkOpportunity(opportunityOf($zero, 'search_improvement') === null, 'Zero impressions are not an observed search opportunity.');
$byUrl = OpportunityPlanner::plan($site, $posts, $sources, ['top_queries'=>[['page_url'=>'https://example.test/spazio/freni', 'query_text'=>'freni', 'impressions'=>8]]], [], $contact);
checkOpportunity(opportunityOf($byUrl, 'search_improvement')['next_action']['post_id'] === 7, 'Explicit analytics URL resolves only a supplied published post.');

$empty = OpportunityPlanner::plan([], [], [], []);
checkOpportunity(count($empty) === 3, 'Empty accounts receive three concrete setup actions.');
checkOpportunity(opportunityOf($empty, 'missing_profile') !== null && opportunityOf($empty, 'missing_sources') !== null && opportunityOf($empty, 'missing_contacts') !== null, 'Missing inputs must be named.');
checkOpportunity(opportunityOf($empty, 'profile_idea') === null, 'No generic fabricated idea without a profile.');
$sourceEmpty = OpportunityPlanner::plan($site, [], $sources, [], [], $contact);
checkOpportunity(opportunityOf($sourceEmpty, 'empty_sources') !== null, 'Connected sources with empty archive need collection.');
$another = OpportunityPlanner::plan(['bio'=>'Laboratorio ceramica'], [], $sources, [], [], $contact);
checkOpportunity(str_contains(opportunityOf($another, 'profile_idea')['next_action']['brief'], 'ceramica'), 'Hypothesis follows the supplied activity, not a fixed vertical.');
checkOpportunity(!str_contains(json_encode($another), 'biciclette'), 'A second account must not inherit the first account context.');
$html = OpportunityPlanner::plan([], [['id'=>2,'published'=>1,'title'=>'&lt;img src=x&gt;Una <em>prova</em>']], [], [], [], $contact);
checkOpportunity(!str_contains(json_encode($html), '<') && !str_contains(json_encode($html), '>'), 'Encoded and raw title markup must be removed.');
foreach ([$cards,$unrelated,$foreign,$empty,$sourceEmpty,$another] as $set) {
    checkOpportunity(count($set) <= 3, 'At most three priorities.');
    foreach ($set as $card) checkOpportunity(isset($card['id'],$card['type'],$card['title'],$card['reason'],$card['evidence']['kind'],$card['objective'],$card['next_action']['target'],$card['measurement']), 'Each card meets the documented schema.');
}
$knowledge = ['declared_strategy'=>['activity_type'=>'Riparazione biciclette', 'primary_goal'=>'Ricevere richieste', 'primary_audience'=>'Pendolari della zona']];
$contactsFirst = OpportunityPlanner::plan($site, $posts, $sources, $visibility, $knowledge);
checkOpportunity($contactsFirst[0]['type'] === 'missing_contacts', 'A declared contact goal prioritizes missing contacts.');
$searchWithGoal = opportunityOf($contactsFirst, 'search_improvement');
checkOpportunity(str_contains($searchWithGoal['objective'], 'Ricevere richieste'), 'Declared goal is visible in the operational objective.');
checkOpportunity(str_contains($searchWithGoal['next_action']['brief'], 'Pendolari della zona'), 'Declared audience reaches the generation brief.');
checkOpportunity($searchWithGoal['evidence']['kind'] === 'observed', 'Editorial preferences never overwrite observed evidence.');
$knowledge['declared_strategy']['primary_goal'] = 'Aiutare il mio pubblico';
$inform = OpportunityPlanner::plan($site, $posts, $sources, [], $knowledge, $contact);
checkOpportunity($inform[0]['type'] === 'profile_idea' && $inform[0]['evidence']['kind'] === 'hypothesis', 'Informing prioritizes a supported profile hypothesis, still labeled as such.');
$knowledge['declared_strategy']['primary_goal'] = 'Presentare lavori e competenze';
$portfolio = OpportunityPlanner::plan($site, $posts, $sources, [], $knowledge, $contact);
checkOpportunity($portfolio[0]['type'] === 'reuse_content', 'Presenting work prioritizes existing published content.');
$noProfile = OpportunityPlanner::plan([], $posts, [], [], [], []);
checkOpportunity($noProfile[0]['type'] === 'missing_profile', 'Missing profile takes precedence over generation.');
$emptyWithGoal = OpportunityPlanner::plan($site, [], $sources, [], $knowledge);
checkOpportunity($emptyWithGoal[0]['type'] === 'empty_sources', 'Collect materials before proposing to invent source content.');
checkOpportunity(opportunityOf($emptyWithGoal, 'profile_idea') !== null, 'With a profile, setup actions do not hide every content action.');
echo "OK: $checks checks, no database or network.\n";
