<?php
$file = 'c:\Users\marcoemme\Desktop\ALLWORKS\socialtosite\api\services\ai.php';
$content = file_get_contents($file);

// Replace apifyRun definition
$oldApifyRun = <<<OLD
    private static function apifyRun(string \$actorId, array \$input, int \$timeoutSeconds = 180): array {
        if (!defined('APIFY_TOKEN') || !APIFY_TOKEN) {
            Logger::error('apify', 'APIFY_TOKEN mancante');
            throw new Exception('APIFY_TOKEN mancante in config/keys.php');
        }
        \$actorIdSafe = str_replace('/', '~', \$actorId);
        \$timeoutSeconds = max(30, min(300, \$timeoutSeconds));
        // Aggiungiamo timeoutSecs e memoryMbytes all'input per contenere i tempi dell'actor
        \$input = array_merge([
            'timeoutSecs'  => \$timeoutSeconds,
            'memoryMbytes' => 512,
        ], \$input);
        \$url = "https://api.apify.com/v2/acts/\$actorIdSafe/run-sync-get-dataset-items?token=" . APIFY_TOKEN
             . "&timeout={\$timeoutSeconds}&memory=512";
        
        Logger::info('apify', "Avvio actor Apify", ['actor' => \$actorId, 'input_keys' => array_keys(\$input)]);
        \$startTime = microtime(true);
        
        \$ch = curl_init(\$url);
        curl_setopt_array(\$ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode(\$input, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => \$timeoutSeconds + 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        \$res  = curl_exec(\$ch);
        \$code = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
        \$err  = curl_error(\$ch);
        curl_close(\$ch);
        
        \$elapsed = round(microtime(true) - \$startTime, 2);

        if (\$res === false) {
            Logger::error('apify', "Errore di rete curl", ['actor' => \$actorId, 'curl_error' => \$err, 'elapsed_s' => \$elapsed]);
            throw new Exception("Apify: errore di rete (\$err)");
        }
        
        \$data = json_decode(\$res, true);
        if (\$code >= 400) {
            \$msg = \$data['error']['message'] ?? (is_string(\$res) ? mb_substr(\$res, 0, 200) : 'risposta non valida');
            Logger::error('apify', "HTTP \$code dal actor", ['actor' => \$actorId, 'code' => \$code, 'msg' => \$msg, 'elapsed_s' => \$elapsed]);
            throw new Exception("Apify (\$code): \$msg");
        }
        
        \$count = is_array(\$data) ? count(\$data) : 0;
        Logger::info('apify', "Actor OK", ['actor' => \$actorId, 'items' => \$count, 'elapsed_s' => \$elapsed]);
        
        return is_array(\$data) ? \$data : [];
    }
OLD;

$newSocialCrawl = <<<NEW
    public static function isSocialCrawlQuotaError(Throwable \$e): bool {
        \$msg = mb_strtolower(\$e->getMessage());
        return str_contains(\$msg, '402') || str_contains(\$msg, 'quota') || str_contains(\$msg, 'insufficient credit');
    }

    private static function socialCrawlRequest(string \$endpoint, array \$payload, int \$timeoutSeconds = 90): array {
        if (!defined('SOCIALCRAWL_API_KEY') || !SOCIALCRAWL_API_KEY) {
            Logger::error('socialcrawl', 'SOCIALCRAWL_API_KEY mancante');
            throw new Exception('SOCIALCRAWL_API_KEY mancante in config/keys.php');
        }

        \$url = "https://api.socialcrawl.dev\$endpoint";
        
        \$ch = curl_init(\$url);
        curl_setopt_array(\$ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'x-api-key: ' . SOCIALCRAWL_API_KEY
            ],
            CURLOPT_POSTFIELDS     => json_encode(\$payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => \$timeoutSeconds,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        
        \$startTime = microtime(true);
        \$res  = curl_exec(\$ch);
        \$code = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
        \$err  = curl_error(\$ch);
        curl_close(\$ch);
        
        \$elapsed = round(microtime(true) - \$startTime, 2);

        if (\$res === false) {
            Logger::error('socialcrawl', "Errore di rete curl", ['endpoint' => \$endpoint, 'curl_error' => \$err, 'elapsed_s' => \$elapsed]);
            throw new Exception("SocialCrawl: errore di rete (\$err)");
        }
        
        \$data = json_decode(\$res, true);
        if (\$code >= 400) {
            \$msg = \$data['error'] ?? \$data['message'] ?? (is_string(\$res) ? mb_substr(\$res, 0, 200) : 'risposta non valida');
            Logger::error('socialcrawl', "HTTP \$code", ['endpoint' => \$endpoint, 'code' => \$code, 'msg' => \$msg, 'elapsed_s' => \$elapsed]);
            throw new Exception("SocialCrawl (\$code): \$msg");
        }
        
        Logger::info('socialcrawl', "Request OK", ['endpoint' => \$endpoint, 'elapsed_s' => \$elapsed]);
        return is_array(\$data) ? \$data : [];
    }
NEW;

$content = str_replace($oldApifyRun, $newSocialCrawl, $content, $count);
if ($count > 0) echo "Replaced apifyRun definition.\n";
else echo "WARNING: apifyRun definition not found.\n";

file_put_contents($file, $content);