<?php
// config/db.php — Connessione PDO MySQL
require_once __DIR__ . '/config.php';
if (file_exists(__DIR__ . '/runtime-secrets.php')) require_once __DIR__ . '/runtime-secrets.php';

function app_base_url(): string {
    $runtime = defined('SOCIALTOSITE_RUNTIME_BASE_URL')
        ? trim((string)SOCIALTOSITE_RUNTIME_BASE_URL)
        : '';
    $configured = defined('BASE_URL') ? trim((string)BASE_URL) : '';
    return rtrim($runtime !== '' ? $runtime : $configured, '/');
}

function app_allowed_origin(): string {
    if (defined('SOCIALTOSITE_RUNTIME_BASE_URL') && trim((string)SOCIALTOSITE_RUNTIME_BASE_URL) !== '') {
        return app_base_url();
    }
    return defined('ALLOWED_ORIGIN') ? trim((string)ALLOWED_ORIGIN) : app_base_url();
}

class DB {
    private static ?PDO $pdo = null;

    public static function get(): PDO {
        if (!self::$pdo) {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        }
        return self::$pdo;
    }

    public static function query(string $sql, array $params = []): PDOStatement {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public static function fetch(string $sql, array $params = []): ?array {
        return self::query($sql, $params)->fetch() ?: null;
    }

    public static function fetchAll(string $sql, array $params = []): array {
        return self::query($sql, $params)->fetchAll();
    }

    public static function insert(string $sql, array $params = []): int {
        self::query($sql, $params);
        return (int) self::get()->lastInsertId();
    }

    public static function execute(string $sql, array $params = []): int {
        return self::query($sql, $params)->rowCount();
    }
}
