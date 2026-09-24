<?php
/**
 * api/services/monitor_settings.php
 *
 * Impostazioni di alerting configurabili dall'amministratore via /monitor.php:
 * server SMTP, destinatari, soglie di allarme. Salvate nel DB (tabella
 * monitor_alert_settings, riga singola id=1) cosi ogni installazione
 * (ogni cliente) puo' configurare i propri parametri da solo, senza
 * toccare codice o variabili d'ambiente, e portarseli dietro se l'app
 * viene spostata su un altro server (bastano i dati, non serve altro).
 */

require_once __DIR__ . '/../../config/db.php';

/** Crea la tabella se non esiste (idempotente, safe da richiamare ad ogni request). */
function monitor_settings_ensure_schema(): void
{
    DB::execute("
        CREATE TABLE IF NOT EXISTS monitor_alert_settings (
            id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            smtp_host VARCHAR(255) NULL,
            smtp_port SMALLINT UNSIGNED NULL DEFAULT 587,
            smtp_secure VARCHAR(10) NULL DEFAULT 'tls',
            smtp_user VARCHAR(255) NULL,
            smtp_pass VARCHAR(255) NULL,
            smtp_from_email VARCHAR(255) NULL,
            smtp_from_name VARCHAR(255) NULL DEFAULT 'Monitor',
            alert_to VARCHAR(500) NULL,
            cpu_warning_pct SMALLINT NULL DEFAULT 80,
            cpu_critical_pct SMALLINT NULL DEFAULT 95,
            mem_warning_pct SMALLINT NULL DEFAULT 85,
            mem_critical_pct SMALLINT NULL DEFAULT 95,
            disk_warning_pct SMALLINT NULL DEFAULT 90,
            disk_critical_pct SMALLINT NULL DEFAULT 97,
            last_state VARCHAR(20) NULL,
            last_alert_at DATETIME NULL,
            updated_at DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

/** Valori di default usati finche' l'admin non salva nulla. */
function monitor_settings_defaults(): array
{
    return [
        'id' => 1,
        'enabled' => 0,
        'smtp_host' => '',
        'smtp_port' => 587,
        'smtp_secure' => 'tls',
        'smtp_user' => '',
        'smtp_pass' => '',
        'smtp_from_email' => '',
        'smtp_from_name' => 'Monitor allsocialtoweb',
        'alert_to' => '',
        'cpu_warning_pct' => 80,
        'cpu_critical_pct' => 95,
        'mem_warning_pct' => 85,
        'mem_critical_pct' => 95,
        'disk_warning_pct' => 90,
        'disk_critical_pct' => 97,
        'last_state' => null,
        'last_alert_at' => null,
        'updated_at' => null,
    ];
}

/** Legge le impostazioni correnti (con default se non ancora configurate). */
function monitor_settings_get(): array
{
    monitor_settings_ensure_schema();
    try {
        $row = DB::fetch('SELECT * FROM monitor_alert_settings WHERE id = 1');
    } catch (\Throwable $e) {
        $row = null;
    }
    if (!$row) {
        return monitor_settings_defaults();
    }
    return array_merge(monitor_settings_defaults(), $row);
}

/** Salva le impostazioni (upsert sulla riga id=1). Ritorna esito + eventuali errori di validazione. */
function monitor_settings_save(array $input): array
{
    monitor_settings_ensure_schema();

    $errors = [];
    $enabled = !empty($input['enabled']) ? 1 : 0;
    $smtpHost = trim((string)($input['smtp_host'] ?? ''));
    $smtpPort = (int)($input['smtp_port'] ?? 587);
    $smtpSecure = in_array($input['smtp_secure'] ?? 'tls', ['tls', 'ssl', 'none'], true) ? $input['smtp_secure'] : 'tls';
    $smtpUser = trim((string)($input['smtp_user'] ?? ''));
    $smtpPassRaw = (string)($input['smtp_pass'] ?? '');
    $smtpFromEmail = trim((string)($input['smtp_from_email'] ?? ''));
    $smtpFromName = trim((string)($input['smtp_from_name'] ?? '')) ?: 'Monitor';
    $alertTo = trim((string)($input['alert_to'] ?? ''));

    if ($enabled) {
        if ($smtpHost === '') $errors[] = 'Host SMTP obbligatorio.';
        if ($smtpFromEmail === '' || !filter_var($smtpFromEmail, FILTER_VALIDATE_EMAIL)) $errors[] = 'Email mittente non valida.';
        if ($alertTo === '') {
            $errors[] = "Almeno un destinatario e' obbligatorio.";
        } else {
            foreach (array_map('trim', explode(',', $alertTo)) as $addr) {
                if ($addr !== '' && !filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = "Destinatario non valido: {$addr}";
                }
            }
        }
    }

    $thresholds = [];
    foreach (['cpu_warning_pct', 'cpu_critical_pct', 'mem_warning_pct', 'mem_critical_pct', 'disk_warning_pct', 'disk_critical_pct'] as $key) {
        $v = (int)($input[$key] ?? 0);
        if ($v < 1 || $v > 100) $errors[] = "Soglia {$key} deve essere tra 1 e 100.";
        $thresholds[$key] = $v;
    }
    if (!$errors) {
        if ($thresholds['cpu_warning_pct'] >= $thresholds['cpu_critical_pct']) $errors[] = 'Soglia CPU: warning deve essere minore di critical.';
        if ($thresholds['mem_warning_pct'] >= $thresholds['mem_critical_pct']) $errors[] = 'Soglia RAM: warning deve essere minore di critical.';
        if ($thresholds['disk_warning_pct'] >= $thresholds['disk_critical_pct']) $errors[] = 'Soglia Disco: warning deve essere minore di critical.';
    }

    if ($errors) {
        return ['ok' => false, 'errors' => $errors];
    }

    // Mantiene la password SMTP precedente se il campo e' lasciato vuoto (l'admin non deve re-inserirla ogni volta).
    $current = monitor_settings_get();
    $smtpPass = $smtpPassRaw !== '' ? $smtpPassRaw : ($current['smtp_pass'] ?? '');

    DB::execute(
        "INSERT INTO monitor_alert_settings
            (id, enabled, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from_email, smtp_from_name, alert_to,
             cpu_warning_pct, cpu_critical_pct, mem_warning_pct, mem_critical_pct, disk_warning_pct, disk_critical_pct, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
            enabled = VALUES(enabled), smtp_host = VALUES(smtp_host), smtp_port = VALUES(smtp_port),
            smtp_secure = VALUES(smtp_secure), smtp_user = VALUES(smtp_user), smtp_pass = VALUES(smtp_pass),
            smtp_from_email = VALUES(smtp_from_email), smtp_from_name = VALUES(smtp_from_name), alert_to = VALUES(alert_to),
            cpu_warning_pct = VALUES(cpu_warning_pct), cpu_critical_pct = VALUES(cpu_critical_pct),
            mem_warning_pct = VALUES(mem_warning_pct), mem_critical_pct = VALUES(mem_critical_pct),
            disk_warning_pct = VALUES(disk_warning_pct), disk_critical_pct = VALUES(disk_critical_pct),
            updated_at = VALUES(updated_at)",
        [
            $enabled, $smtpHost ?: null, $smtpPort, $smtpSecure, $smtpUser ?: null, $smtpPass ?: null,
            $smtpFromEmail ?: null, $smtpFromName, $alertTo ?: null,
            $thresholds['cpu_warning_pct'], $thresholds['cpu_critical_pct'],
            $thresholds['mem_warning_pct'], $thresholds['mem_critical_pct'],
            $thresholds['disk_warning_pct'], $thresholds['disk_critical_pct'],
        ]
    );

    return ['ok' => true, 'errors' => []];
}

/** Aggiorna solo lo stato dell'ultimo alert inviato (usato da cron/check_alerts.php). */
function monitor_settings_record_alert(string $state): void
{
    monitor_settings_ensure_schema();
    DB::execute('UPDATE monitor_alert_settings SET last_state = ?, last_alert_at = NOW() WHERE id = 1', [$state]);
}

/**
 * Client SMTP minimale in puro PHP (niente Composer/PHPMailer disponibili
 * in questo progetto). Supporta AUTH LOGIN e STARTTLS/SSL diretto:
 * sufficiente per Gmail, provider hosting e la maggior parte dei server
 * SMTP standard. Ritorna ['ok' => bool, 'error' => ?string].
 */
function monitor_smtp_send(array $settings, string $to, string $subject, string $body): array
{
    $host = $settings['smtp_host'] ?? '';
    $port = (int)($settings['smtp_port'] ?? 587);
    $secure = $settings['smtp_secure'] ?? 'tls';
    $user = $settings['smtp_user'] ?? '';
    $pass = $settings['smtp_pass'] ?? '';
    $fromEmail = $settings['smtp_from_email'] ?? '';
    $fromName = $settings['smtp_from_name'] ?? 'Monitor';

    if ($host === '' || $fromEmail === '') {
        return ['ok' => false, 'error' => 'Configurazione SMTP incompleta.'];
    }

    $transport = $secure === 'ssl' ? 'ssl://' : '';
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($transport . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        return ['ok' => false, 'error' => "Connessione fallita: {$errstr} ({$errno})"];
    }
    stream_set_timeout($fp, 15);

    $expect = function (int $wantCode) use ($fp): array {
        $resp = '';
        while (($line = fgets($fp, 515)) !== false) {
            $resp .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $code = (int)substr($resp, 0, 3);
        return [$code === $wantCode || ($wantCode === 250 && $code >= 200 && $code < 300), $resp];
    };
    $send = function (string $cmd) use ($fp): void {
        fwrite($fp, $cmd . "\r\n");
    };

    [$ok, $resp] = $expect(220);
    if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "Saluto SMTP inatteso: {$resp}"]; }

    $heloHost = gethostname() ?: 'localhost';
    $send('EHLO ' . $heloHost);
    [$ok, $resp] = $expect(250);
    if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "EHLO fallito: {$resp}"]; }

    if ($secure === 'tls') {
        $send('STARTTLS');
        [$ok, $resp] = $expect(220);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "STARTTLS fallito: {$resp}"]; }
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            return ['ok' => false, 'error' => 'Handshake TLS fallito.'];
        }
        $send('EHLO ' . $heloHost);
        [$ok, $resp] = $expect(250);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "EHLO (TLS) fallito: {$resp}"]; }
    }

    if ($user !== '') {
        $send('AUTH LOGIN');
        [$ok, $resp] = $expect(334);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "AUTH LOGIN rifiutato: {$resp}"]; }
        $send(base64_encode($user));
        [$ok, $resp] = $expect(334);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "Utente SMTP rifiutato: {$resp}"]; }
        $send(base64_encode($pass));
        [$ok, $resp] = $expect(235);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "Autenticazione SMTP fallita: {$resp}"]; }
    }

    $send('MAIL FROM:<' . $fromEmail . '>');
    [$ok, $resp] = $expect(250);
    if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "MAIL FROM rifiutato: {$resp}"]; }

    $recipients = array_filter(array_map('trim', explode(',', $to)));
    foreach ($recipients as $rcpt) {
        $send('RCPT TO:<' . $rcpt . '>');
        [$ok, $resp] = $expect(250);
        if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "RCPT TO rifiutato ({$rcpt}): {$resp}"]; }
    }

    $send('DATA');
    [$ok, $resp] = $expect(354);
    if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "DATA rifiutato: {$resp}"]; }

    $headers = [];
    $headers[] = 'From: ' . ($fromName !== '' ? mb_encode_mimeheader($fromName, 'UTF-8') . " <{$fromEmail}>" : $fromEmail);
    $headers[] = 'To: ' . $to;
    $headers[] = 'Subject: ' . mb_encode_mimeheader($subject, 'UTF-8');
    $headers[] = 'Date: ' . date('r');
    $headers[] = 'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . $heloHost . '>';
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';

    $escapedBody = preg_replace('/^\./m', '..', $body);
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $escapedBody . "\r\n.";
    $send($message);
    [$ok, $resp] = $expect(250);
    if (!$ok) { fclose($fp); return ['ok' => false, 'error' => "Invio rifiutato: {$resp}"]; }

    $send('QUIT');
    fclose($fp);

    return ['ok' => true, 'error' => null];
}

/** Invia una email di test con le impostazioni indicate (anche non ancora salvate). */
function monitor_send_test_email(array $settings): array
{
    $to = $settings['alert_to'] ?? '';
    if (trim((string)$to) === '') {
        return ['ok' => false, 'error' => "Nessun destinatario indicato nel campo 'Destinatari alert'."];
    }
    $subject = '[Monitor allsocialtoweb] Email di test';
    $body = "Questa e' una email di test inviata dal pannello di monitoraggio di allsocialtoweb.com.\n\n"
        . "Se la ricevi, la configurazione SMTP e' corretta e gli alert automatici funzioneranno.\n\n"
        . 'Inviata il: ' . date('Y-m-d H:i:s');
    return monitor_smtp_send($settings, (string)$to, $subject, $body);
}
