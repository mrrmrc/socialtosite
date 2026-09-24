<?php
/**
 * api/services/monitor_status.php
 *
 * Raccoglie lo stato di salute dell'applicazione allsocialtoweb.com:
 * risorse del container (CPU/RAM/disco), stato del database, e freschezza
 * dei cron job. Usato sia dal pannello /monitor.php sia dallo script
 * cron/check_alerts.php per decidere se inviare un alert via email.
 *
 * Nessuna dipendenza esterna (niente Composer): solo PHP standard + PDO.
 */

require_once __DIR__ . '/../../config/db.php';

/** Legge un file cgroup v2 (es. /sys/fs/cgroup/memory.current) come intero. */
function monitor_read_cgroup_int(string $path): ?int
{
    if (!is_readable($path)) return null;
    $raw = trim((string)@file_get_contents($path));
    if ($raw === '' || $raw === 'max') return null;
    return (int)$raw;
}

/** Percentuale di CPU usata dal container, calcolata su una finestra breve. */
function monitor_cpu_percent(): ?float
{
    $statPath = '/sys/fs/cgroup/cpu.stat';
    if (!is_readable($statPath)) return null;

    $readUsage = function () use ($statPath): ?int {
        $raw = @file_get_contents($statPath);
        if ($raw === false) return null;
        if (preg_match('/usage_usec\s+(\d+)/', $raw, $m)) return (int)$m[1];
        return null;
    };

    $cpusRaw = @file_get_contents('/sys/fs/cgroup/cpu.max');
    $ncpu = 1;
    if ($cpusRaw && preg_match('/^(\S+)\s+(\d+)/', $cpusRaw, $m) && $m[1] !== 'max') {
        $ncpu = max(1, (float)$m[1] / (float)$m[2]);
    } else {
        $ncpu = (int)(@shell_exec('nproc') ?: 1);
    }

    $u1 = $readUsage();
    if ($u1 === null) return null;
    usleep(200000); // 0.2s
    $u2 = $readUsage();
    if ($u2 === null) return null;

    $deltaUsec = $u2 - $u1;
    $windowUsec = 200000 * $ncpu;
    if ($windowUsec <= 0) return null;
    return round(($deltaUsec / $windowUsec) * 100, 1);
}

/** Stato memoria del container (usata/limite in MB + percentuale). */
function monitor_memory(): array
{
    $used = monitor_read_cgroup_int('/sys/fs/cgroup/memory.current');
    $limit = monitor_read_cgroup_int('/sys/fs/cgroup/memory.max');

    if ($used === null) {
        // Fallback: /proc/meminfo (non isolato al container, ma meglio di niente).
        $info = @file_get_contents('/proc/meminfo');
        $total = $avail = null;
        if ($info) {
            if (preg_match('/MemTotal:\s+(\d+)/', $info, $m)) $total = (int)$m[1] * 1024;
            if (preg_match('/MemAvailable:\s+(\d+)/', $info, $m)) $avail = (int)$m[1] * 1024;
        }
        if ($total !== null && $avail !== null) {
            $used = $total - $avail;
            $limit = $total;
        }
    }

    if ($used === null) {
        return ['used_mb' => null, 'limit_mb' => null, 'percent' => null];
    }

    $limitMb = $limit !== null ? round($limit / 1048576, 1) : null;
    $usedMb = round($used / 1048576, 1);
    $percent = ($limit !== null && $limit > 0) ? round(($used / $limit) * 100, 1) : null;

    return ['used_mb' => $usedMb, 'limit_mb' => $limitMb, 'percent' => $percent];
}

/** Spazio disco del filesystem che contiene il codice applicativo. */
function monitor_disk(): array
{
    $path = '/var/www/html';
    $total = @disk_total_space($path);
    $free = @disk_free_space($path);
    if ($total === false || $free === false) {
        return ['used_gb' => null, 'total_gb' => null, 'percent' => null];
    }
    $used = $total - $free;
    return [
        'used_gb' => round($used / 1073741824, 2),
        'total_gb' => round($total / 1073741824, 2),
        'percent' => $total > 0 ? round(($used / $total) * 100, 1) : null,
    ];
}

/** Load average + numero di processi apache attivi. */
function monitor_load(): array
{
    $load = function_exists('sys_getloadavg') ? sys_getloadavg() : null;
    $apacheWorkers = 0;
    $psOut = @shell_exec('ps aux 2>/dev/null');
    if ($psOut) {
        $apacheWorkers = substr_count($psOut, 'apache2');
    }
    return [
        'load1' => $load ? round($load[0], 2) : null,
        'load5' => $load ? round($load[1], 2) : null,
        'load15' => $load ? round($load[2], 2) : null,
        'apache_workers' => $apacheWorkers,
    ];
}

/** Verifica connessione DB + latenza + uptime del server MySQL/MariaDB. */
function monitor_db(): array
{
    $start = microtime(true);
    try {
        DB::fetch('SELECT 1');
        $latencyMs = round((microtime(true) - $start) * 1000, 1);

        $uptime = null;
        try {
            $row = DB::fetch("SHOW STATUS LIKE 'Uptime'");
            if ($row && isset($row['Value'])) $uptime = (int)$row['Value'];
        } catch (\Throwable $e) {
            // non bloccante
        }

        $conns = null;
        try {
            $row = DB::fetch("SHOW STATUS LIKE 'Threads_connected'");
            if ($row && isset($row['Value'])) $conns = (int)$row['Value'];
        } catch (\Throwable $e) {
        }

        return [
            'ok' => true,
            'latency_ms' => $latencyMs,
            'uptime_s' => $uptime,
            'connections' => $conns,
            'error' => null,
        ];
    } catch (\Throwable $e) {
        return [
            'ok' => false,
            'latency_ms' => null,
            'uptime_s' => null,
            'connections' => null,
            'error' => $e->getMessage(),
        ];
    }
}

/**
 * Stato dei cron job: confronta l'ultima modifica del file di log con
 * l'intervallo atteso (+ un margine di tolleranza) per decidere se il
 * job sta girando regolarmente.
 *
 * status: 'ok' | 'warning' | 'critical' | 'unknown'
 */
function monitor_cron(): array
{
    $jobs = [
        'publish' => [
            'label' => 'Pubblicazione coda (publish.php)',
            'log' => '/var/log/cron/publish.log',
            'expected_s' => 60,       // ogni minuto
            'warning_s' => 5 * 60,    // 5 min senza scrittura = warning
            'critical_s' => 15 * 60,  // 15 min = critical
        ],
        'sync' => [
            'label' => 'Sync social (sync.php)',
            'log' => '/var/log/cron/sync.log',
            'expected_s' => 6 * 3600,
            'warning_s' => 7 * 3600,
            'critical_s' => 9 * 3600,
        ],
        'fetch_seo' => [
            'label' => 'Fetch SEO (fetch_seo.php)',
            'log' => '/var/log/cron/fetch_seo.log',
            'expected_s' => 24 * 3600,
            'warning_s' => 26 * 3600,
            'critical_s' => 30 * 3600,
        ],
    ];

    $now = time();
    $result = [];
    foreach ($jobs as $key => $job) {
        $path = $job['log'];
        if (!file_exists($path)) {
            $result[$key] = $job + ['status' => 'unknown', 'age_s' => null, 'last_run' => null, 'last_line' => null];
            continue;
        }
        $mtime = filemtime($path);
        $age = $now - $mtime;
        $status = 'ok';
        if ($age >= $job['critical_s']) $status = 'critical';
        elseif ($age >= $job['warning_s']) $status = 'warning';

        $lastLine = null;
        $fh = @fopen($path, 'r');
        if ($fh) {
            $lines = [];
            while (($l = fgets($fh)) !== false) {
                $l = trim($l);
                if ($l !== '') $lines[] = $l;
                if (count($lines) > 20) array_shift($lines);
            }
            fclose($fh);
            if ($lines) $lastLine = end($lines);
        }

        $result[$key] = $job + [
            'status' => $status,
            'age_s' => $age,
            'last_run' => date('Y-m-d H:i:s', $mtime),
            'last_line' => $lastLine,
        ];
    }
    return $result;
}

/** Cron a livello di sistema (verifica che il demone cron sia vivo). */
function monitor_cron_daemon(): array
{
    $psOut = @shell_exec('ps aux 2>/dev/null');
    $running = $psOut && (strpos($psOut, '/usr/sbin/cron') !== false || strpos($psOut, 'cron\n') !== false);
    return ['running' => (bool)$running];
}

/**
 * Calcola lo stato aggregato dell'intero sistema.
 * Ritorna un array pronto per essere trasformato in JSON o renderizzato in HTML.
 *
 * $thresholds (opzionale) permette di sovrascrivere le soglie di
 * CPU/RAM/disco usate per l'aggregazione — impostate dall'amministratore
 * nel pannello /monitor.php (vedi api/services/monitor_settings.php) cosi
 * ogni installazione puo' calibrarle come preferisce.
 */
function monitor_collect_status(?array $thresholds = null): array
{
    $t = array_merge([
        'cpu_warning' => 80, 'cpu_critical' => 95,
        'mem_warning' => 85, 'mem_critical' => 95,
        'disk_warning' => 90, 'disk_critical' => 97,
    ], $thresholds ?? []);

    $cpu = monitor_cpu_percent();
    $mem = monitor_memory();
    $disk = monitor_disk();
    $load = monitor_load();
    $db = monitor_db();
    $cron = monitor_cron();
    $cronDaemon = monitor_cron_daemon();

    $overall = 'ok';
    if (!$db['ok'] || !$cronDaemon['running']) {
        $overall = 'critical';
    } else {
        foreach ($cron as $j) {
            if ($j['status'] === 'critical') { $overall = 'critical'; break; }
            if ($j['status'] === 'warning' && $overall !== 'critical') $overall = 'warning';
        }
    }
    if ($cpu !== null) {
        if ($cpu >= $t['cpu_critical']) $overall = 'critical';
        elseif ($cpu >= $t['cpu_warning'] && $overall !== 'critical') $overall = 'warning';
    }
    if ($mem['percent'] !== null) {
        if ($mem['percent'] >= $t['mem_critical']) $overall = 'critical';
        elseif ($mem['percent'] >= $t['mem_warning'] && $overall !== 'critical') $overall = 'warning';
    }
    if ($disk['percent'] !== null) {
        if ($disk['percent'] >= $t['disk_critical']) $overall = 'critical';
        elseif ($disk['percent'] >= $t['disk_warning'] && $overall !== 'critical') $overall = 'warning';
    }

    return [
        'generated_at' => date('c'),
        'overall' => $overall,
        'thresholds' => $t,
        'cpu_percent' => $cpu,
        'memory' => $mem,
        'disk' => $disk,
        'load' => $load,
        'db' => $db,
        'cron_daemon' => $cronDaemon,
        'cron_jobs' => $cron,
    ];
}
