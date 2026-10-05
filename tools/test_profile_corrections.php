<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$source = file_get_contents(__DIR__ . '/../api/index.php');
$begin = strpos($source, 'function decodeJsonObject(');
$end = strpos($source, 'function normalizeSiteAiResult(', $begin);
if ($begin === false || $end === false) throw new RuntimeException('Profile functions missing');
eval(substr($source, $begin, $end - $begin));
$generated = ['vertical_label'=>'Guessed activity','declared_strategy'=>['priority_services'=>['One','Two']], 'social_profile'=>['topics'=>['One','Two']]];
$approved = ['declared_strategy'=>['activity_type'=>'Approved activity','primary_audience'=>'Approved audience','priority_services'=>[]], 'social_profile'=>['topics'=>['Corrected']]];
$merged = mergeUnderstanding($generated, $approved);
$checks = [
    'customer activity takes priority' => $merged['vertical_label'] === 'Approved activity',
    'customer audience takes priority' => $merged['audience'] === 'Approved audience',
    'removed services stay removed' => $merged['declared_strategy']['priority_services'] === [],
    'corrected social lists replace guesses' => $merged['social_profile']['topics'] === ['Corrected'],
    'JSON persistence retains corrections' => mergeUnderstanding(json_encode($generated), json_encode($approved)) === $merged,
];
foreach ($checks as $name=>$passed) { echo ($passed?'OK ':'FAIL ') . $name . "\n"; if (!$passed) exit(1); }
