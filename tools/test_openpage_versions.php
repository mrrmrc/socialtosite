<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/services/openpage_versions.php';
$published = ['name'=>'Published', 'blocks'=>[['id'=>'hero','type'=>'hero','props'=>['headline'=>'Original']]],'theme'=>['accent'=>'#123456']];
$document = OpenPageVersions::append($published,$published,'Original',['seoTitle'=>'Original title','deployAccessKey'=>'private']);
$draft = $published;
$draft['blocks'][0]['props']['headline'] = 'Changed';
$result = OpenPageVersions::append($document,$draft,'New draft');
$checks = [
 'saving a draft version does not change public config' => $result['blocks'] === $published['blocks'],
 'previous version is immutable' => $result['_versions'][0]['config'] === $published,
 'new version has edited content' => $result['_versions'][1]['config'] === $draft,
 'versions are not recursively embedded' => !isset($result['_versions'][0]['config']['_versions']),
 'version ids are unique' => $result['_versions'][0]['id'] !== $result['_versions'][1]['id'],
 'settings preserve SEO but omit credentials' => $result['_versions'][0]['settings'] === ['seoTitle'=>'Original title'],
 'version can be retrieved unchanged after persistence' => json_decode(json_encode($result),true)['_versions'][0]['config'] === $published,
];
foreach($checks as $name=>$passed){echo ($passed?'OK ':'FAIL ').$name."\n";if(!$passed)exit(1);}
