<?php

require_once __DIR__ . '/../../config/db.php';

final class ProviderConfig
{
    private static bool $ready = false;

    public static function ensureSchema(): void
    {
        if (self::$ready) return;
        DB::execute("CREATE TABLE IF NOT EXISTS ai_provider_connections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            provider VARCHAR(40) NOT NULL UNIQUE,
            label VARCHAR(100) NOT NULL,
            model VARCHAR(120) NULL,
            secret_ciphertext LONGTEXT NULL,
            monthly_credit DECIMAL(12,2) NULL,
            enabled TINYINT NOT NULL DEFAULT 1,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        DB::execute("CREATE TABLE IF NOT EXISTS api_usage_logs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            provider VARCHAR(40) NOT NULL,
            action VARCHAR(100) NOT NULL,
            tokens_used INT NOT NULL DEFAULT 0,
            estimated_cost DECIMAL(12,6) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY usage_provider_date (provider, created_at),
            KEY usage_user_date (user_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $usageColumns = [];
        foreach (DB::fetchAll('SHOW COLUMNS FROM api_usage_logs') as $column) $usageColumns[$column['Field']] = true;
        if (!isset($usageColumns['estimated_cost'])) DB::execute('ALTER TABLE api_usage_logs ADD COLUMN estimated_cost DECIMAL(12,6) NOT NULL DEFAULT 0 AFTER tokens_used');
        DB::execute("INSERT IGNORE INTO ai_provider_connections (provider,label,model) VALUES
            ('gemini','Google Gemini',NULL),
            ('refetcher','Refetch(er)',NULL)");
        self::$ready = true;
    }

    private static function key(): string
    {
        return hash('sha256', (string)JWT_SECRET, true);
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) throw new RuntimeException('Impossibile proteggere la credenziale.');
        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(?string $encoded): string
    {
        if (!$encoded) return '';
        $raw = base64_decode($encoded, true);
        if ($raw === false || strlen($raw) < 29) return '';
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return is_string($plain) ? $plain : '';
    }

    public static function secret(string $provider): string
    {
        self::ensureSchema();
        $row = DB::fetch('SELECT secret_ciphertext, enabled FROM ai_provider_connections WHERE provider=?', [$provider]);
        return $row && (int)$row['enabled'] === 1 ? self::decrypt($row['secret_ciphertext'] ?? null) : '';
    }

    public static function enabled(string $provider): bool
    {
        self::ensureSchema();
        $row = DB::fetch('SELECT enabled FROM ai_provider_connections WHERE provider=?', [$provider]);
        return !$row || (int)$row['enabled'] === 1;
    }

    public static function model(string $provider): string
    {
        self::ensureSchema();
        $row = DB::fetch('SELECT model, enabled FROM ai_provider_connections WHERE provider=?', [$provider]);
        if (!$row || (int)$row['enabled'] !== 1) return '';
        $stored = trim((string)$row['model']);
        $model = self::normalizeModel($provider, $stored);
        if ($model !== $stored) {
            DB::execute('UPDATE ai_provider_connections SET model=? WHERE provider=?', [$model !== '' ? $model : null, $provider]);
        }
        return $model;
    }

    public static function normalizeModel(string $provider, string $model): string
    {
        $model = trim($model);
        if (strtolower(trim($provider)) !== 'gemini' || $model === '') return $model;

        // The REST URL already supplies the `models/` path segment.
        $model = preg_replace('#^models/#i', '', $model) ?? $model;
        if (strtolower($model) === 'gemini-2.5-flash') return 'gemini-3.6-flash';
        return $model;
    }
}
