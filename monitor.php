<?php
/**
 * monitor.php
 *
 * Pannello di monitoraggio per l'amministratore di allsocialtoweb.com.
 * Mostra lo stato di salute dell'app (CPU, RAM, disco, DB, cron job) e
 * fornisce un endpoint JSON (?json=1) usato per l'auto-refresh via fetch()
 * e riutilizzabile da cron/check_alerts.php.
 *
 * Login autonomo: riusa la tabella users esistente (email + password
 * hash), consente l'accesso solo a chi ha role = 'admin'.
 *
 * Nessuna dipendenza esterna: solo PHP standard + PDO.
 */

declare(strict_types=1);

require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/api/services/monitor_status.php';
require_once __DIR__ . '/api/services/monitor_settings.php';

session_name('monitor_sid');
session_start();

$error = null;

// --- Logout -----------------------------------------------------------
if (isset($_GET['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: monitor.php');
    exit;
}

// --- Login --------------------------------------------------------------
// Nota: la password puo' essere ancora nel formato legacy "$sha256$<hex>"
// usato dal bootstrap iniziale (vedi api/services/admin_console.php) prima
// che venga sostituito con un digest nativo password_hash() al primo
// accesso riuscito (stessa logica di api/routes/auth.php, per coerenza).
if (!empty($_POST['email']) && !empty($_POST['password'])) {
    $email = trim((string)$_POST['email']);
    $password = (string)$_POST['password'];
    try {
        $user = DB::fetch('SELECT id, email, name, password, role FROM users WHERE email = ? OR slug = ? LIMIT 1', [$email, $email]);
    } catch (\Throwable $e) {
        $user = null;
    }
    $storedPassword = (string)($user['password'] ?? '');
    $legacySha = str_starts_with($storedPassword, '$sha256$');
    $validPassword = $user && ($legacySha
        ? hash_equals(substr($storedPassword, 8), hash('sha256', $password))
        : password_verify($password, $storedPassword));

    if ($validPassword && ($user['role'] ?? '') === 'admin') {
        if ($legacySha) {
            try {
                DB::execute('UPDATE users SET password = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            } catch (\Throwable $e) {
                // Non blocca il login se l'aggiornamento del digest fallisce.
            }
        }
        session_regenerate_id(true);
        $_SESSION['monitor_admin_id'] = (int)$user['id'];
        $_SESSION['monitor_admin_email'] = $user['email'];
        $_SESSION['monitor_admin_name'] = $user['name'] ?? $user['email'];
    } else {
        $error = 'Credenziali non valide o utente non amministratore.';
    }
}

$isLoggedIn = !empty($_SESSION['monitor_admin_id']);

// --- Impostazioni alert (solo se autenticato) ----------------------------
$settings = [];
$settingsMessage = null;
$settingsErrors = [];

if ($isLoggedIn) {
    $settings = monitor_settings_get();

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        if ($_POST['action'] === 'save_settings') {
            $result = monitor_settings_save($_POST);
            if ($result['ok']) {
                $settingsMessage = 'Impostazioni salvate correttamente.';
                $settings = monitor_settings_get();
            } else {
                $settingsErrors = $result['errors'];
                // Riflette nel form quanto l'admin ha appena digitato, cosi' non perde le modifiche.
                $settings = array_merge($settings, $_POST);
            }
        } elseif ($_POST['action'] === 'send_test') {
            // Usa i valori correnti nel form (anche se non ancora salvati) per il test.
            $testSettings = array_merge($settings, $_POST);
            $testResult = monitor_send_test_email($testSettings);
            if ($testResult['ok']) {
                $settingsMessage = 'Email di test inviata correttamente a ' . $testSettings['alert_to'] . '.';
            } else {
                $settingsErrors = [$testResult['error'] ?? "Invio fallito per un motivo sconosciuto."];
            }
            $settings = array_merge($settings, $_POST);
        }
    }
}

$thresholdOverrides = $isLoggedIn ? [
    'cpu_warning' => (int)$settings['cpu_warning_pct'],
    'cpu_critical' => (int)$settings['cpu_critical_pct'],
    'mem_warning' => (int)$settings['mem_warning_pct'],
    'mem_critical' => (int)$settings['mem_critical_pct'],
    'disk_warning' => (int)$settings['disk_warning_pct'],
    'disk_critical' => (int)$settings['disk_critical_pct'],
] : [];

// --- JSON endpoint (solo se autenticato) --------------------------------
if ($isLoggedIn && isset($_GET['json'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(monitor_collect_status($thresholdOverrides), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// --- Rendering HTML ------------------------------------------------------
function h(?string $s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function badge(string $status): string
{
    $map = [
        'ok' => ['#16a34a', 'OK'],
        'warning' => ['#d97706', 'ATTENZIONE'],
        'critical' => ['#dc2626', 'CRITICO'],
        'unknown' => ['#6b7280', 'SCONOSCIUTO'],
    ];
    [$color, $label] = $map[$status] ?? $map['unknown'];
    return '<span style="background:' . $color . ';color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;letter-spacing:.03em;">' . $label . '</span>';
}

function fmtAge(?int $s): string
{
    if ($s === null) return '—';
    if ($s < 60) return $s . 's fa';
    if ($s < 3600) return round($s / 60) . 'm fa';
    if ($s < 86400) return round($s / 3600, 1) . 'h fa';
    return round($s / 86400, 1) . 'g fa';
}

?><!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Monitor · allsocialtoweb.com</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px; min-height: 100vh;
    background: #0b0f17; color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .sub { color: #9ca3af; font-size: 13px; margin-bottom: 24px; }
  .card {
    background: #131a26; border: 1px solid #1f2937; border-radius: 12px;
    padding: 18px 20px; margin-bottom: 16px;
  }
  .card h2 { font-size: 14px; margin: 0 0 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
  .metric { background: #0e141f; border-radius: 8px; padding: 12px 14px; }
  .metric .val { font-size: 22px; font-weight: 700; }
  .metric .lbl { font-size: 12px; color: #9ca3af; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1f2937; }
  th { color: #9ca3af; font-weight: 600; font-size: 12px; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  .top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .logout { color: #9ca3af; font-size: 13px; text-decoration: none; }
  .logout:hover { color: #e5e7eb; }
  form.login { max-width: 340px; margin: 80px auto; background: #131a26; border: 1px solid #1f2937; border-radius: 12px; padding: 28px; }
  form.login label { display: block; font-size: 13px; color: #9ca3af; margin: 14px 0 6px; }
  form.login input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #374151; background: #0e141f; color: #e5e7eb; font-size: 14px; }
  form.login button { width: 100%; margin-top: 20px; padding: 11px; border: none; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 14px; }
  form.login button:hover { background: #1d4ed8; }
  .err { background: #7f1d1d; color: #fecaca; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 14px; }
  code { background: #0e141f; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .updated { color: #6b7280; font-size: 12px; }
  .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px 16px; margin-bottom: 6px; }
  .field label { display: block; font-size: 12px; color: #9ca3af; margin-bottom: 5px; }
  .field input[type=text], .field input[type=email], .field input[type=password], .field input[type=number], .field select {
    width: 100%; padding: 9px 11px; border-radius: 8px; border: 1px solid #374151; background: #0e141f; color: #e5e7eb; font-size: 13px;
  }
  .field small { display: block; color: #6b7280; font-size: 11px; margin-top: 4px; }
  .field.checkbox { display: flex; align-items: center; gap: 8px; }
  .field.checkbox label { margin-bottom: 0; color: #e5e7eb; font-size: 13px; }
  .field.wide { grid-column: 1 / -1; }
  .thresholds-group { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .settings-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .btn { padding: 10px 18px; border-radius: 8px; border: none; font-weight: 600; font-size: 13px; cursor: pointer; }
  .btn-primary { background: #2563eb; color: #fff; }
  .btn-primary:hover { background: #1d4ed8; }
  .btn-secondary { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; }
  .btn-secondary:hover { background: #263041; }
  .ok-msg { background: #14532d; color: #bbf7d0; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 14px; }
  .settings-meta { color: #6b7280; font-size: 12px; margin-top: 14px; }
  fieldset { border: 1px solid #1f2937; border-radius: 10px; padding: 14px 16px; margin: 0 0 16px; }
  fieldset legend { padding: 0 6px; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; }
</style>
</head>
<body>
<div class="wrap">
<?php if (!$isLoggedIn): ?>
  <form class="login" method="post" action="monitor.php" autocomplete="off">
    <h1>Monitor allsocialtoweb.com</h1>
    <div class="sub">Accesso riservato agli amministratori</div>
    <label for="email">Email</label>
    <input id="email" name="email" type="text" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" required>
    <button type="submit">Accedi</button>
    <?php if ($error): ?><div class="err"><?= h($error) ?></div><?php endif; ?>
  </form>
<?php else:
  $status = monitor_collect_status($thresholdOverrides);
?>
  <div class="top">
    <div>
      <h1>Monitor allsocialtoweb.com <?= badge($status['overall']) ?></h1>
      <div class="sub">Connesso come <?= h($_SESSION['monitor_admin_email']) ?> · <span class="updated" id="updated">aggiornato: <?= h($status['generated_at']) ?></span></div>
    </div>
    <a class="logout" href="monitor.php?logout=1">Esci</a>
  </div>

  <div class="card">
    <h2>Risorse container</h2>
    <div class="grid">
      <div class="metric">
        <div class="val" id="m-cpu"><?= $status['cpu_percent'] !== null ? $status['cpu_percent'] . '%' : '—' ?></div>
        <div class="lbl">CPU</div>
      </div>
      <div class="metric">
        <div class="val" id="m-mem"><?= $status['memory']['percent'] !== null ? $status['memory']['percent'] . '%' : '—' ?></div>
        <div class="lbl">RAM <?= $status['memory']['used_mb'] !== null ? '(' . $status['memory']['used_mb'] . ' / ' . ($status['memory']['limit_mb'] ?? '?') . ' MB)' : '' ?></div>
      </div>
      <div class="metric">
        <div class="val" id="m-disk"><?= $status['disk']['percent'] !== null ? $status['disk']['percent'] . '%' : '—' ?></div>
        <div class="lbl">Disco <?= $status['disk']['used_gb'] !== null ? '(' . $status['disk']['used_gb'] . ' / ' . $status['disk']['total_gb'] . ' GB)' : '' ?></div>
      </div>
      <div class="metric">
        <div class="val" id="m-load"><?= $status['load']['load1'] ?? '—' ?></div>
        <div class="lbl">Load avg (1m) · <?= $status['load']['apache_workers'] ?> worker Apache</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Database</h2>
    <div class="grid">
      <div class="metric">
        <div class="val"><?= $status['db']['ok'] ? badge('ok') : badge('critical') ?></div>
        <div class="lbl">Connessione</div>
      </div>
      <div class="metric">
        <div class="val"><?= $status['db']['latency_ms'] !== null ? $status['db']['latency_ms'] . ' ms' : '—' ?></div>
        <div class="lbl">Latenza</div>
      </div>
      <div class="metric">
        <div class="val"><?= $status['db']['connections'] ?? '—' ?></div>
        <div class="lbl">Connessioni attive</div>
      </div>
      <div class="metric">
        <div class="val"><?= $status['db']['uptime_s'] !== null ? fmtAge($status['db']['uptime_s']) : '—' ?></div>
        <div class="lbl">Uptime server DB</div>
      </div>
    </div>
    <?php if (!$status['db']['ok']): ?><div class="err">Errore DB: <?= h($status['db']['error']) ?></div><?php endif; ?>
  </div>

  <div class="card">
    <h2>Cron job (demone: <?= $status['cron_daemon']['running'] ? badge('ok') : badge('critical') ?>)</h2>
    <table>
      <tr><th>Job</th><th>Stato</th><th>Ultima esecuzione</th><th>Ultimo output</th></tr>
      <?php foreach ($status['cron_jobs'] as $key => $job): ?>
      <tr>
        <td><?= h($job['label']) ?><br><code><?= h($key) ?>.php</code></td>
        <td><?= badge($job['status']) ?><br><span class="updated"><?= fmtAge($job['age_s']) ?></span></td>
        <td><?= h($job['last_run'] ?? '—') ?></td>
        <td><?= h($job['last_line'] ?? '—') ?></td>
      </tr>
      <?php endforeach; ?>
    </table>
  </div>

  <div class="card">
    <h2>Configurazione alert via email</h2>
    <div class="sub" style="margin-bottom:16px;">Ogni installazione configura qui i propri parametri (server SMTP, destinatari, soglie) — nulla è fissato nel codice.</div>

    <?php if ($settingsMessage): ?><div class="ok-msg"><?= h($settingsMessage) ?></div><?php endif; ?>
    <?php if ($settingsErrors): ?>
      <div class="err">
        <?php foreach ($settingsErrors as $e): ?>
          <?= h($e) ?><br>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <form method="post" action="monitor.php" autocomplete="off">
      <fieldset>
        <legend>Attivazione</legend>
        <div class="field checkbox">
          <input type="checkbox" id="enabled" name="enabled" value="1" <?= !empty($settings['enabled']) ? 'checked' : '' ?>>
          <label for="enabled">Invia alert via email quando lo stato cambia (attenzione / critico / rientro)</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Server SMTP</legend>
        <div class="settings-grid">
          <div class="field">
            <label for="smtp_host">Host SMTP</label>
            <input type="text" id="smtp_host" name="smtp_host" value="<?= h($settings['smtp_host'] ?? '') ?>" placeholder="smtp.gmail.com">
          </div>
          <div class="field">
            <label for="smtp_port">Porta</label>
            <input type="number" id="smtp_port" name="smtp_port" value="<?= h((string)($settings['smtp_port'] ?? 587)) ?>" min="1" max="65535">
          </div>
          <div class="field">
            <label for="smtp_secure">Sicurezza</label>
            <select id="smtp_secure" name="smtp_secure">
              <?php foreach (['tls' => 'STARTTLS (consigliato, porta 587)', 'ssl' => 'SSL/TLS diretto (porta 465)', 'none' => 'Nessuna (sconsigliato)'] as $val => $label): ?>
                <option value="<?= h($val) ?>" <?= ($settings['smtp_secure'] ?? 'tls') === $val ? 'selected' : '' ?>><?= h($label) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field">
            <label for="smtp_user">Utente SMTP</label>
            <input type="text" id="smtp_user" name="smtp_user" value="<?= h($settings['smtp_user'] ?? '') ?>" placeholder="es. indirizzo@dominio.it">
          </div>
          <div class="field">
            <label for="smtp_pass">Password SMTP</label>
            <input type="password" id="smtp_pass" name="smtp_pass" value="" placeholder="<?= !empty($settings['smtp_pass']) ? '•••••••• (lasciare vuoto per non modificarla)' : '' ?>">
            <small>Per Gmail usare una App Password, non la password dell'account.</small>
          </div>
          <div class="field">
            <label for="smtp_from_email">Email mittente</label>
            <input type="email" id="smtp_from_email" name="smtp_from_email" value="<?= h($settings['smtp_from_email'] ?? '') ?>" placeholder="monitor@tuodominio.it">
          </div>
          <div class="field">
            <label for="smtp_from_name">Nome mittente</label>
            <input type="text" id="smtp_from_name" name="smtp_from_name" value="<?= h($settings['smtp_from_name'] ?? 'Monitor') ?>">
          </div>
          <div class="field wide">
            <label for="alert_to">Destinatari alert</label>
            <input type="text" id="alert_to" name="alert_to" value="<?= h($settings['alert_to'] ?? '') ?>" placeholder="admin@tuodominio.it, altro@tuodominio.it">
            <small>Uno o più indirizzi separati da virgola.</small>
          </div>
        </div>
      </fieldset>

      
    <fieldset>
      <legend>Servizi da monitorare (notifiche via mail)</legend>
      <div style="display:flex;gap:15px;flex-wrap:wrap;font-size:13px;align-items:center;padding:5px 0;">
        <label><input type="checkbox" name="alert_on_cpu" value="1" <?= $settings['alert_on_cpu'] ? 'checked' : '' ?>> CPU</label>
        <label><input type="checkbox" name="alert_on_mem" value="1" <?= $settings['alert_on_mem'] ? 'checked' : '' ?>> RAM</label>
        <label><input type="checkbox" name="alert_on_disk" value="1" <?= $settings['alert_on_disk'] ? 'checked' : '' ?>> Disco</label>
        <label><input type="checkbox" name="alert_on_db" value="1" <?= $settings['alert_on_db'] ? 'checked' : '' ?>> Database offline</label>
        <label><input type="checkbox" name="alert_on_cron" value="1" <?= $settings['alert_on_cron'] ? 'checked' : '' ?>> Cron bloccato</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Soglie di allarme (%)</legend>
        <div class="thresholds-group">
          <div class="field">
            <label for="cpu_warning_pct">CPU — attenzione</label>
            <input type="number" id="cpu_warning_pct" name="cpu_warning_pct" value="<?= h((string)($settings['cpu_warning_pct'] ?? 80)) ?>" min="1" max="100">
          </div>
          <div class="field">
            <label for="cpu_critical_pct">CPU — critico</label>
            <input type="number" id="cpu_critical_pct" name="cpu_critical_pct" value="<?= h((string)($settings['cpu_critical_pct'] ?? 95)) ?>" min="1" max="100">
          </div>
          <div class="field">
            <label for="mem_warning_pct">RAM — attenzione</label>
            <input type="number" id="mem_warning_pct" name="mem_warning_pct" value="<?= h((string)($settings['mem_warning_pct'] ?? 85)) ?>" min="1" max="100">
          </div>
          <div class="field">
            <label for="mem_critical_pct">RAM — critico</label>
            <input type="number" id="mem_critical_pct" name="mem_critical_pct" value="<?= h((string)($settings['mem_critical_pct'] ?? 95)) ?>" min="1" max="100">
          </div>
          <div class="field">
            <label for="disk_warning_pct">Disco — attenzione</label>
            <input type="number" id="disk_warning_pct" name="disk_warning_pct" value="<?= h((string)($settings['disk_warning_pct'] ?? 90)) ?>" min="1" max="100">
          </div>
          <div class="field">
            <label for="disk_critical_pct">Disco — critico</label>
            <input type="number" id="disk_critical_pct" name="disk_critical_pct" value="<?= h((string)($settings['disk_critical_pct'] ?? 97)) ?>" min="1" max="100">
          </div>
        </div>
      </fieldset>

      <div class="settings-actions">
        <button class="btn btn-primary" type="submit" name="action" value="save_settings">Salva impostazioni</button>
        <button class="btn btn-secondary" type="submit" name="action" value="send_test">Invia email di test</button>
      </div>

      <?php if (!empty($settings['last_alert_at'])): ?>
        <div class="settings-meta">Ultimo alert inviato: <?= h((string)$settings['last_alert_at']) ?> (stato: <?= h((string)($settings['last_state'] ?? '—')) ?>)</div>
      <?php endif; ?>
    </form>
  </div>

  <script>
    // Auto-refresh dei dati ogni 30s senza ricaricare la pagina.
    async function refresh() {
      try {
        const res = await fetch('monitor.php?json=1', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById('updated').textContent = 'aggiornato: ' + data.generated_at;
        if (data.cpu_percent !== null) document.getElementById('m-cpu').textContent = data.cpu_percent + '%';
        if (data.memory.percent !== null) document.getElementById('m-mem').textContent = data.memory.percent + '%';
        if (data.disk.percent !== null) document.getElementById('m-disk').textContent = data.disk.percent + '%';
        if (data.load.load1 !== null) document.getElementById('m-load').textContent = data.load.load1;
      } catch (e) { /* silenzioso */ }
    }
    setInterval(refresh, 30000);
  </script>
<?php endif; ?>
</div>
</body>
</html>
