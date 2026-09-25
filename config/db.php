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

/**
 * Percorsi di primo livello riservati all'applicazione (vedi .htaccess):
 * uno spazio utente con uno di questi indirizzi non sarebbe raggiungibile.
 */
function app_reserved_slugs(): array {
    return ['api','cron','db','frontend','public','node_modules','assets','accedi','login',
            'dashboard','admin','connect','generating','scopri','privacy','terms','termini',
            'config','tools','integrations','sitemap','robots','media','index'];
}

function app_is_reserved_slug(string $slug): bool {
    return in_array(strtolower(trim($slug)), app_reserved_slugs(), true);
}

/** Frammento SQL che esclude dagli elenchi pubblici slug riservati e account admin. */
function app_public_user_sql(string $alias = 'u'): string {
    $list = implode(',', array_map(fn($s) => "'" . $s . "'", app_reserved_slugs()));
    return " AND LOWER($alias.slug) NOT IN ($list) AND COALESCE($alias.role,'user') <> 'admin'";
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
            $host = getenv('DB_HOST') ?: (defined('DB_HOST') ? DB_HOST : 'localhost');
            $name = getenv('DB_NAME') ?: (defined('DB_NAME') ? DB_NAME : 'test');
            $user = getenv('DB_USER') ?: (defined('DB_USER') ? DB_USER : 'root');
            $pass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : (defined('DB_PASS') ? DB_PASS : '');
            $charset = getenv('DB_CHARSET') ?: (defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4');

            $dsn = "mysql:host=" . $host . ";dbname=" . $name . ";charset=" . $charset;
            self::$pdo = new PDO($dsn, $user, $pass, [
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
