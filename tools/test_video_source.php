<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once __DIR__ . '/../api/services/video_source.php';
function checkVideo(string $name, bool $passed): void {
    echo ($passed ? 'OK ' : 'FAIL ') . $name . "\n";
    if (!$passed) exit(1);
}
function rejectsVideo(callable $operation): bool {
    try { $operation(); return false; } catch (RuntimeException $e) { return true; }
}
$speech = "Non ho promesso risultati. Ho detto forse.\n\nIl costo è 12 euro, non 120. <script>alert(1)</script>";
$stored = VideoSource::encode(json_encode(['speech'=>$speech]));
$article = VideoSource::article($stored, 'https://www.youtube.com/watch?v=example');
checkVideo('spoken source is retained exactly', VideoSource::speech($stored) === $speech);
checkVideo('negations and figures survive article rendering', str_contains($article['body'], 'Non ho promesso risultati. Ho detto forse.') && str_contains($article['body'], '12 euro, non 120'));
checkVideo('spoken markup is escaped rather than executed', str_contains($article['body'], '&lt;script&gt;') && !str_contains($article['body'], '<script>'));
checkVideo('original video is linked', str_contains($article['body'], 'https://www.youtube.com/watch?v=example'));
checkVideo('unsafe source links are omitted', !str_contains(VideoSource::article($stored, 'javascript:alert(1)')['body'], 'href='));
checkVideo('empty spoken source blocks generation', rejectsVideo(fn()=>VideoSource::encode('{"speech":""}')));
checkVideo('visual description cannot stand in for speech', rejectsVideo(fn()=>VideoSource::encode('{"description":"Una persona sul palco"}')));
checkVideo('legacy unverified transcripts require retranscription', VideoSource::speech('Descrizione o riassunto precedente') === '');
checkVideo('caption-only article is rejected', rejectsVideo(fn()=>VideoSource::article('didascalia TikTok', 'https://example.com')));
checkVideo('TikTok and YouTube remain videos without media metadata', VideoSource::isVideo(['platform'=>'tiktok']) && VideoSource::isVideo(['platform'=>'youtube']));
checkVideo('Facebook videos use the same policy', VideoSource::isVideo(['platform'=>'facebook','media_type'=>'VIDEO']));
checkVideo('ordinary image posts remain unaffected', !VideoSource::isVideo(['platform'=>'instagram','media_type'=>'IMAGE']));
checkVideo('TikTok photo slideshows remain image posts', !VideoSource::isVideo(['platform'=>'tiktok','media_type'=>'IMAGE']));
checkVideo('YouTube thumbnails do not disable source-video transcription', VideoSource::isVideo(['platform'=>'youtube','media_type'=>'IMAGE']));

// Run the actual MIME gate/transcription method against a provider fixture.
$source=file_get_contents(__DIR__.'/../api/services/ai.php');
$start=strpos($source,'    public static function transcribeFile(');
$end=strpos($source,'    private static function decodeJsonObject(', $start);
$method=substr($source,$start,$end-$start);
eval('class TranscriberFixture { public static array $parts=[]; public static function gemini($parts,$config) { self::$parts=$parts; return json_encode(["speech"=>"Parlato originale verificato"]); } '.$method.' }');
$temp=tempnam(sys_get_temp_dir(),'sts-tiktok-');
try {
    $bytes=hex2bin('000000186674797069736f6d0000020069736f6d69736f32000000086d646174');
    file_put_contents($temp,$bytes);
    $result=TranscriberFixture::transcribeFile($temp);
    checkVideo('transcription receives actual MP4 bytes', TranscriberFixture::$parts[0]['inlineData']['mimeType']==='video/mp4' && base64_decode(TranscriberFixture::$parts[0]['inlineData']['data'])===$bytes);
    checkVideo('spoken transcript is stored in verified format',VideoSource::speech($result)==='Parlato originale verificato');
    file_put_contents($temp,'<html>TikTok login page</html>');
    checkVideo('HTML pages cannot be transcribed as videos', rejectsVideo(fn()=>TranscriberFixture::transcribeFile($temp)));
} finally { unlink($temp); }
