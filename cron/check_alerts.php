<?php
/**
 * cron/check_alerts.php
 *
 * Eseguito periodicamente dal crontab del server (es. ogni 5 o 10 minuti).
 * Valuta lo stato di salute dell'app e invia notifiche via email se ci sono
 * problemi (basandosi sulle preferenze configurate in monitor.php).
 */

declare(strict_types=1);

require_once __DIR__ . '/../api/services/monitor_status.php';
require_once __DIR__ . '/../api/services/monitor_settings.php';

$settings = monitor_settings_get();

// Se l'alerting via email non è abilitato, o se mancano i destinatari/host, usciamo
if (!$settings['enabled'] || empty($settings['smtp_host']) || empty($settings['alert_to'])) {
    echo "Alerting disabilitato o non configurato.\n";
    exit(0);
}

// 1. Raccogliamo lo stato corrente (fornendo gli override delle soglie configurati)
$thresholdOverrides = [
    'cpu_warning' => (int)$settings['cpu_warning_pct'],
    'cpu_critical' => (int)$settings['cpu_critical_pct'],
    'mem_warning' => (int)$settings['mem_warning_pct'],
    'mem_critical' => (int)$settings['mem_critical_pct'],
    'disk_warning' => (int)$settings['disk_warning_pct'],
    'disk_critical' => (int)$settings['disk_critical_pct'],
];
$status = monitor_collect_status($thresholdOverrides);

// 2. Filtriamo gli alert in base alle preferenze
$activeIssues = [];

// CPU
if (!empty($settings['alert_on_cpu'])) {
    $cpuPct = $status['cpu_percent'];
    if ($cpuPct !== null) {
        if ($cpuPct >= $thresholdOverrides['cpu_critical']) {
            $activeIssues[] = "CPU Critical: $cpuPct% (soglia " . $thresholdOverrides['cpu_critical'] . "%)";
        } elseif ($cpuPct >= $thresholdOverrides['cpu_warning']) {
            $activeIssues[] = "CPU Warning: $cpuPct% (soglia " . $thresholdOverrides['cpu_warning'] . "%)";
        }
    }
}

// RAM
if (!empty($settings['alert_on_mem'])) {
    $memPct = $status['memory']['percent'];
    if ($memPct !== null) {
        if ($memPct >= $thresholdOverrides['mem_critical']) {
            $activeIssues[] = "RAM Critical: $memPct% (soglia " . $thresholdOverrides['mem_critical'] . "%)";
        } elseif ($memPct >= $thresholdOverrides['mem_warning']) {
            $activeIssues[] = "RAM Warning: $memPct% (soglia " . $thresholdOverrides['mem_warning'] . "%)";
        }
    }
}

// Disk
if (!empty($settings['alert_on_disk'])) {
    $diskPct = $status['disk']['percent'];
    if ($diskPct !== null) {
        if ($diskPct >= $thresholdOverrides['disk_critical']) {
            $activeIssues[] = "Disco Critical: $diskPct% (soglia " . $thresholdOverrides['disk_critical'] . "%)";
        } elseif ($diskPct >= $thresholdOverrides['disk_warning']) {
            $activeIssues[] = "Disco Warning: $diskPct% (soglia " . $thresholdOverrides['disk_warning'] . "%)";
        }
    }
}

// Database
if (!empty($settings['alert_on_db'])) {
    if (!$status['db']['ok']) {
        $activeIssues[] = "Database Offline/Errore: " . $status['db']['error'];
    }
}

// Cron
if (!empty($settings['alert_on_cron'])) {
    if (!$status['cron_daemon']['running']) {
        $activeIssues[] = "Demone Cron: Non risulta in esecuzione.";
    }
    foreach ($status['cron_jobs'] as $key => $job) {
        if ($job['status'] === 'critical') {
            $activeIssues[] = "Cron Job '{$job['label']}': Bloccato o non eseguito di recente (ultimo run: " . ($job['last_run'] ?? 'mai') . ")";
        }
    }
}

// 3. Valutazione finale
$currentState = count($activeIssues) > 0 ? 'critical' : 'ok';
$lastState = $settings['last_state'] ?? 'ok';
$lastAlertAt = $settings['last_alert_at'] ? strtotime($settings['last_alert_at']) : 0;
$timeSinceLastAlert = time() - $lastAlertAt;

// Logica di notifica:
// Inviamo una mail se passiamo da OK a CRITICAL, oppure se siamo sempre CRITICAL ma sono passate più di 2 ore dall'ultima mail.
// Se passiamo da CRITICAL a OK, inviamo una mail di ripristino ("Keep alive / Tutto risolto").
$shouldAlert = false;
$subject = '';
$body = '';

if ($currentState === 'critical') {
    if ($lastState === 'ok' || $timeSinceLastAlert > 7200) { // 2 ore = 7200 secondi
        $shouldAlert = true;
        $subject = '[Monitor allsocialtoweb] ALERT: Problemi rilevati sul server';
        $body = "Il sistema di monitoraggio ha rilevato le seguenti anomalie:\n\n";
        foreach ($activeIssues as $issue) {
            $body .= "- $issue\n";
        }
        $body .= "\nSi prega di verificare la dashboard per maggiori dettagli.";
    }
} else {
    if ($lastState === 'critical') {
        $shouldAlert = true;
        $subject = '[Monitor allsocialtoweb] OK: Allarme rientrato';
        $body = "Tutti i parametri monitorati sono tornati alla normalita'. Il sistema e' operativo.";
    }
}

if ($shouldAlert) {
    echo "Invio notifica email (Stato: $currentState)...\n";
    $result = monitor_smtp_send($settings, $settings['alert_to'], $subject, $body);
    if ($result['ok']) {
        monitor_settings_record_alert($currentState);
        echo "Email inviata con successo.\n";
    } else {
        echo "Errore invio email: " . $result['error'] . "\n";
    }
} else {
    echo "Nessuna notifica da inviare. Stato: $currentState\n";
}
