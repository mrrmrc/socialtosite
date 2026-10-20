<?php
/** Safe operational errors: never expose credentials or provider payloads. */
final class AIHealth {
    public static function runtime(?array $available = null): array {
        $available ??= [
            'curl'=>function_exists('curl_init'),
            'mbstring'=>function_exists('mb_substr'),
            'openssl'=>function_exists('openssl_encrypt'),
        ];
        $missing = [];
        foreach (['curl','mbstring','openssl'] as $extension) if (empty($available[$extension])) $missing[] = $extension;
        return ['ready'=>$missing === [], 'missing_extensions'=>$missing];
    }

    public static function assertRuntime(): void {
        $runtime = self::runtime();
        if (!$runtime['ready']) throw new RuntimeException('AI_RUNTIME_MISSING:'.implode(',', $runtime['missing_extensions']));
    }

    public static function failure(Throwable $error): array {
        $message = $error->getMessage();
        if (str_contains($message, 'AI_RUNTIME_MISSING:') || preg_match('/undefined function .*?(?:curl_|mb_|openssl_)/i', $message)) {
            return ['code'=>'runtime_unavailable','message'=>'LIA non è disponibile per un problema di configurazione del server. Le tue informazioni restano salvate.'];
        }
        if (str_contains($message, 'GEMINI_API_KEY')) return ['code'=>'provider_not_configured','message'=>'Il collegamento al servizio IA non è configurato o è disattivato. Le tue informazioni restano salvate.'];
        if (preg_match('/Gemini\s*\((401|403)\)/', $message)) return ['code'=>'provider_access_denied','message'=>'Il servizio IA non ha autorizzato la richiesta. Occorre verificare il collegamento del servizio.'];
        if (preg_match('/Gemini\s*\(429\)/', $message)) return ['code'=>'provider_rate_limited','message'=>'Il servizio IA ha raggiunto un limite di utilizzo o di quota. Attendi e riprova; se persiste, occorre verificare la quota del servizio.'];
        if (preg_match('/Gemini\s*\(404\)/', $message)) return ['code'=>'provider_model_unavailable','message'=>'Il modello IA configurato non è disponibile. Occorre verificare la configurazione del servizio.'];
        if (preg_match('/Gemini\s*\(400\)/', $message)) return ['code'=>'provider_invalid_request','message'=>'Il servizio IA non accetta la configurazione della richiesta. Occorre correggere il collegamento del servizio.'];
        if (str_contains($message, 'SQLSTATE')) return ['code'=>'provider_storage_error','message'=>'LIA non riesce a leggere la configurazione salvata del servizio. Le tue informazioni restano salvate.'];
        if (preg_match('/timed?\s*out|timeout/i', $message)) return ['code'=>'provider_timeout','message'=>'Il servizio IA ha impiegato troppo tempo a rispondere. Puoi riprovare: le tue informazioni restano salvate.'];
        if (preg_match('/Gemini.*rete/i', $message)) return ['code'=>'provider_network_error','message'=>'Il server non riesce a raggiungere il servizio IA. Puoi riprovare tra poco.'];
        if (preg_match('/Revisione LIA incompleta|Risposta LIA non valida|Nessuna risposta dal modello|non ha restituito una risposta/i', $message)) return ['code'=>'provider_incomplete_response','message'=>'LIA ha restituito una risposta incompleta. Puoi riprovare senza riscrivere le informazioni già salvate.'];
        return ['code'=>'provider_unavailable','message'=>'LIA non riesce a completare la richiesta in questo momento. Puoi riprovare: le tue informazioni restano salvate.'];
    }
}
