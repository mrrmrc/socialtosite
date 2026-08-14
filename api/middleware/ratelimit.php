<?php
// api/middleware/ratelimit.php — Freno agli attacchi a dizionario sul login.
//
// Il login era completamente privo di protezione: password_hash difende la
// password a riposo, ma nulla impediva di provare migliaia di combinazioni.
// Qui si conta quanti tentativi falliti recenti ci sono stati per la coppia
// email+IP e si blocca oltre soglia, con una finestra mobile.

require_once __DIR__ . '/../../config/db.php';

class LoginGuard {
    /** Tentativi falliti consentiti nella finestra, per email e per IP. */
    private const MAX_ATTEMPTS_EMAIL = 5;
    private const MAX_ATTEMPTS_IP    = 20;
    /** Ampiezza della finestra mobile, in minuti. */
    private const WINDOW_MINUTES     = 15;
    /** Oltre questa età i tentativi vengono ripuliti. */
    private const RETENTION_HOURS    = 48;

    private static bool $schemaReady = false;

    public static function ensureSchema(): void {
        if (self::$schemaReady) return;
        self::$schemaReady = true;
        try {
            DB::execute("CREATE TABLE IF NOT EXISTS login_attempts (
                id           BIGINT AUTO_INCREMENT PRIMARY KEY,
                email        VARCHAR(255) NOT NULL,
                ip           VARCHAR(45) NOT NULL,
                succeeded    TINYINT NOT NULL DEFAULT 0,
                attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_login_attempts_email_time (email, attempted_at),
                INDEX idx_login_attempts_ip_time (ip, attempted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (Throwable $e) {
            if (class_exists('Logger')) Logger::warn('auth', 'login_attempts non creabile', ['error' => $e->getMessage()]);
        }
    }

    public static function clientIp(): string {
        return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    }

    /**
     * Quanti secondi mancano prima di poter ritentare. 0 = via libera.
     * In caso di errore del database restituisce 0: un guasto alle statistiche
     * non deve impedire l'accesso agli utenti legittimi.
     */
    public static function retryAfter(string $email, string $ip): int {
        self::ensureSchema();
        $window = self::WINDOW_MINUTES;
        try {
            $byEmail = DB::fetch(
                "SELECT COUNT(*) c, MAX(attempted_at) last_at FROM login_attempts
                 WHERE email=? AND succeeded=0 AND attempted_at >= DATE_SUB(NOW(), INTERVAL $window MINUTE)",
                [$email]
            ) ?: [];
            $byIp = DB::fetch(
                "SELECT COUNT(*) c, MAX(attempted_at) last_at FROM login_attempts
                 WHERE ip=? AND succeeded=0 AND attempted_at >= DATE_SUB(NOW(), INTERVAL $window MINUTE)",
                [$ip]
            ) ?: [];
        } catch (Throwable $e) {
            return 0;
        }

        $blocked = ((int)($byEmail['c'] ?? 0) >= self::MAX_ATTEMPTS_EMAIL)
                || ((int)($byIp['c'] ?? 0) >= self::MAX_ATTEMPTS_IP);
        if (!$blocked) return 0;

        $lastAt = max(
            strtotime((string)($byEmail['last_at'] ?? '')) ?: 0,
            strtotime((string)($byIp['last_at'] ?? '')) ?: 0
        );
        if ($lastAt <= 0) return $window * 60;
        return max(1, ($lastAt + $window * 60) - time());
    }

    public static function record(string $email, string $ip, bool $succeeded): void {
        self::ensureSchema();
        try {
            DB::execute('INSERT INTO login_attempts (email, ip, succeeded) VALUES (?,?,?)',
                [mb_substr($email, 0, 255), $ip, $succeeded ? 1 : 0]);
            // Un accesso riuscito azzera il conteggio: chi ricorda la password
            // non deve restare bloccato dai propri errori precedenti.
            if ($succeeded) {
                DB::execute('DELETE FROM login_attempts WHERE email=? AND succeeded=0', [$email]);
            }
            // Pulizia opportunistica, senza bisogno di un cron dedicato.
            if (random_int(1, 50) === 1) {
                $hours = self::RETENTION_HOURS;
                DB::execute("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL $hours HOUR)");
            }
        } catch (Throwable $e) {
            if (class_exists('Logger')) Logger::warn('auth', 'Tentativo di login non registrato', ['error' => $e->getMessage()]);
        }
    }
}
