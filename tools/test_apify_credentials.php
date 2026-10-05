<?php
// Exercise the real client with an isolated provider stub: no DB, network or real keys.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$directory = sys_get_temp_dir() . '/sts-apify-test-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$names = ['SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN', 'APIFY_API_TOKEN'];
$original = array_map('getenv', $names);
try {
    copy(__DIR__ . '/../api/services/apify_client.php', $directory . '/apify_client.php');
    file_put_contents($directory . '/provider_config.php', '<?php final class ProviderConfig { public static bool $active = true; public static string $key = "managed-test"; public static function enabled(string $provider): bool { return self::$active; } public static function secret(string $provider): string { return self::$key; } }');
    require $directory . '/apify_client.php';
    $method = new ReflectionMethod(ApifyClient::class, 'apiKey');
    $check = function(string $name, bool $passed): void {
        echo ($passed ? 'OK ' : 'FAIL ') . $name . "\n";
        if (!$passed) throw new RuntimeException('Credential regression test failed');
    };
    putenv('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN= runtime-test ');
    putenv('APIFY_API_TOKEN=legacy-test');
    $check('runtime environment credential is returned and has precedence', $method->invoke(null) === 'runtime-test');
    putenv('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN=   ');
    $check('blank runtime environment falls back to legacy environment', $method->invoke(null) === 'legacy-test');
    putenv('APIFY_API_TOKEN');
    $check('managed credential remains supported', $method->invoke(null) === 'managed-test');
    ProviderConfig::$key = '';
    $missing = false;
    try { $method->invoke(null); } catch (RuntimeException $e) { $missing = str_contains($e->getMessage(), 'non configurata'); }
    $check('missing credentials still fail explicitly', $missing);
    define('SOCIALTOSITE_RUNTIME_APIFY_API_TOKEN', 'constant-test');
    $check('production runtime constant remains supported', $method->invoke(null) === 'constant-test');
    ProviderConfig::$active = false;
    $disabled = false;
    try { $method->invoke(null); } catch (RuntimeException $e) { $disabled = str_contains($e->getMessage(), 'disattivata'); }
    $check('disabled provider remains blocked', $disabled);
} finally {
    foreach ($names as $i => $name) putenv($original[$i] === false ? $name : $name . '=' . $original[$i]);
    unlink($directory . '/apify_client.php');
    unlink($directory . '/provider_config.php');
    rmdir($directory);
}
