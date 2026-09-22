<?php
// api/middleware/logger.php — Logger centralizzato del backend All Social To Web
// Scrive log su file JSON Lines (JSONL) con rotazione automatica.
// Accessibile via ?action=logs (admin) o ?action=logs-clear (admin).

class Logger {

    private static string $logFile = '';
    private static int    $maxBytes = 512 * 1024; // 512 KB per file prima della rotazione
    private static int    $maxFiles = 5;           // max 5 file storici

    private static function logPath(): string {
        if (!self::$logFile) {
            self::$logFile = __DIR__ . '/../../public/backend.log.jsonl';
        }
        return self::$logFile;
    }

    /**
     * Scrive una riga di log.
     * @param string $level  'info' | 'warn' | 'error' | 'debug'
     * @param string $context  Chi sta loggando: 'scan', 'ingest', 'apify', 'ai', 'sync', 'auth', ...
     * @param string $message  Messaggio leggibile
     * @param array  $data     Dati strutturati aggiuntivi (opzionale)
     */
    public static function log(string $level, string $context, string $message, array $data = []): void {
        try {
            $path = self::logPath();
            $dir  = dirname($path);
            if (!is_dir($dir)) return;

            // Rotazione: se il file supera maxBytes, sposta a .1, .2, ...
            if (file_exists($path) && filesize($path) > self::$maxBytes) {
                self::rotate($path);
            }

            $entry = json_encode([
                'ts'      => date('Y-m-d H:i:s'),
                'level'   => $level,
                'ctx'     => $context,
                'msg'     => $message,
                'data'    => $data ?: null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            file_put_contents($path, $entry . "\n", FILE_APPEND | LOCK_EX);
        } catch (Throwable $e) {
            // Il logger non deve mai crashare l'applicazione
        }
    }

    public static function info(string $context, string $message, array $data = []): void {
        self::log('info', $context, $message, $data);
    }

    public static function warn(string $context, string $message, array $data = []): void {
        self::log('warn', $context, $message, $data);
    }

    public static function error(string $context, string $message, array $data = []): void {
        self::log('error', $context, $message, $data);
    }

    public static function debug(string $context, string $message, array $data = []): void {
        self::log('debug', $context, $message, $data);
    }

    /** Legge le ultime N righe del log (tutte le rotazioni combinate, dalla più recente) */
    public static function read(int $lines = 200): array {
        $path = self::logPath();
        $entries = [];

        // Leggi file corrente + storici (dal più recente)
        $files = [$path];
        for ($i = 1; $i <= self::$maxFiles; $i++) {
            $f = $path . '.' . $i;
            if (file_exists($f)) $files[] = $f;
        }

        foreach ($files as $f) {
            if (!file_exists($f)) continue;
            $raw = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($raw === false) continue;
            foreach (array_reverse($raw) as $line) {
                $decoded = json_decode($line, true);
                if ($decoded) $entries[] = $decoded;
                if (count($entries) >= $lines) break 2;
            }
        }

        return $entries; // già ordinati dalla più recente alla più vecchia
    }

    /** Svuota tutti i file di log */
    public static function clear(): int {
        $path = self::logPath();
        $cleared = 0;
        $files = [$path];
        for ($i = 1; $i <= self::$maxFiles; $i++) {
            $files[] = $path . '.' . $i;
        }
        foreach ($files as $f) {
            if (file_exists($f)) {
                @unlink($f);
     * @param string $message  Messaggio leggibile
     * @param array  $data     Dati strutturati aggiuntivi (opzionale)
     */
    public static function log(string $level, string $context, string $message, array $data = []): void {
        try {
            $path = self::logPath();
            $dir  = dirname($path);
            if (!is_dir($dir)) return;

            // Rotazione: se il file supera maxBytes, sposta a .1, .2, ...
            if (file_exists($path) && filesize($path) > self::$maxBytes) {
                self::rotate($path);
            }

            $entry = json_encode([
                'ts'      => date('Y-m-d H:i:s'),
                'level'   => $level,
                'ctx'     => $context,
                'msg'     => $message,
                'data'    => $data ?: null,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            file_put_contents($path, $entry . "\n", FILE_APPEND | LOCK_EX);
        } catch (Throwable $e) {
            // Il logger non deve mai crashare l'applicazione
        }
    }

    public static function info(string $context, string $message, array $data = []): void {
        self::log('info', $context, $message, $data);
    }

    public static function warn(string $context, string $message, array $data = []): void {
        self::log('warn', $context, $message, $data);
    }

    public static function error(string $context, string $message, array $data = []): void {
        self::log('error', $context, $message, $data);
    }

    public static function debug(string $context, string $message, array $data = []): void {
        self::log('debug', $context, $message, $data);
    }

    /** Legge le ultime N righe del log (tutte le rotazioni combinate, dalla più recente) */
    public static function read(int $lines = 200): array {
        $path = self::logPath();
        $entries = [];

        // Leggi file corrente + storici (dal più recente)
        $files = [$path];
        for ($i = 1; $i <= self::$maxFiles; $i++) {
            $f = $path . '.' . $i;
            if (file_exists($f)) $files[] = $f;
        }

        foreach ($files as $f) {
            if (!file_exists($f)) continue;
            $raw = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($raw === false) continue;
            foreach (array_reverse($raw) as $line) {
                $decoded = json_decode($line, true);
                if ($decoded) $entries[] = $decoded;
                if (count($entries) >= $lines) break 2;
            }
        }

        return $entries; // già ordinati dalla più recente alla più vecchia
    }

    /** Svuota tutti i file di log */
    public static function clear(): int {
        $path = self::logPath();
        $cleared = 0;
        $files = [$path];
        for ($i = 1; $i <= self::$maxFiles; $i++) {
            $files[] = $path . '.' . $i;
        }
        foreach ($files as $f) {
            if (file_exists($f)) {
                @unlink($f);
                $cleared++;
            }
        }
        return $cleared;
    }

    private static function rotate(string $path): void {
        // Sposta: .4→.5, .3→.4, ..., corrente→.1
        for ($i = self::$maxFiles - 1; $i >= 1; $i--) {
            $from = $path . '.' . $i;
            $to   = $path . '.' . ($i + 1);
            if (file_exists($from)) @rename($from, $to);
        }
        @rename($path, $path . '.1');
    }

    /** Elimina una specifica riga di log cercandola per timestamp e messaggio */
    public static function deleteLine(string $ts, string $msg): bool {
        $path = self::logPath();
        $files = [$path];
        for ($i = 1; $i <= self::$maxFiles; $i++) {
            $f = $path . '.' . $i;
            if (file_exists($f)) $files[] = $f;
        }

        $deleted = false;
        foreach ($files as $f) {
            if (!file_exists($f)) continue;
            $raw = file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($raw === false) continue;

            $newLines = [];
            $modified = false;
            foreach ($raw as $line) {
                $decoded = json_decode($line, true);
                if ($decoded && ($decoded['ts'] ?? '') === $ts && ($decoded['msg'] ?? '') === $msg) {
                    $modified = true;
                    $deleted = true;
                    continue; // salta questa riga
                }
                $newLines[] = $line;
            }

            if ($modified) {
                file_put_contents($f, implode("\n", $newLines) . "\n", LOCK_EX);
                // Continuiamo a cercare in caso di duplicati esatti
            }
        }
        return $deleted;
    }
}
