<?php
// ─────────────────────────────────────────────────────────────────────────
// reset-y9n3caBpL4E75yW.php — Reset password TEMPORANEO e monouso.
// Protetto da codice segreto. VA RIMOSSO subito dopo l'uso.
// Imposta la password con password_hash(BCRYPT), compatibile col login.
// ─────────────────────────────────────────────────────────────────────────

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

const RESET_SECRET = 'y9n3caBpL4E75yWwEBw67Ju959Mlg_Uc';

$k = $_GET['k'] ?? $_POST['k'] ?? '';
if (!hash_equals(RESET_SECRET, (string)$k)) {
    http_response_code(404);
    echo 'Not found';
    exit;
}

require_once __DIR__ . '/config/db.php';

$msg = '';
$ok  = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $pw    = $_POST['password'] ?? '';
    $pw2   = $_POST['password2'] ?? '';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $msg = 'Email non valida.';
    } elseif (strlen($pw) < 8) {
        $msg = 'La password deve avere almeno 8 caratteri.';
    } elseif ($pw !== $pw2) {
        $msg = 'Le due password non coincidono.';
    } else {
        $user = DB::fetch('SELECT id FROM users WHERE email=?', [$email]);
        if (!$user) {
            $msg = 'Nessun account con questa email.';
        } else {
            $hash = password_hash($pw, PASSWORD_BCRYPT);
            DB::execute('UPDATE users SET password=? WHERE email=?', [$hash, $email]);
            $ok  = true;
            $msg = 'Password aggiornata. Ora puoi accedere. Avvisa di rimuovere questa pagina.';
        }
    }
}
?><!doctype html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reset password</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0B0F19;color:#F8FAFC;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  .box{background:#111827;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;max-width:360px;width:100%}
  h1{font-size:18px;margin:0 0 16px}
  label{display:block;font-size:13px;margin:12px 0 4px;color:#94A3B8}
  input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:#0B0F19;color:#fff;box-sizing:border-box}
  button{margin-top:18px;width:100%;padding:12px;border:none;border-radius:9px;background:#4F46E5;color:#fff;font-weight:700;cursor:pointer}
  .m{margin-top:14px;padding:10px 12px;border-radius:8px;font-size:13px}
  .ok{background:rgba(16,185,129,.15);color:#34D399}
  .err{background:rgba(239,68,68,.15);color:#F87171}
</style></head><body>
<div class="box">
  <h1>🔐 Reset password</h1>
  <?php if ($ok): ?>
    <div class="m ok"><?= htmlspecialchars($msg) ?></div>
  <?php else: ?>
    <?php if ($msg): ?><div class="m err"><?= htmlspecialchars($msg) ?></div><?php endif; ?>
    <form method="post">
      <input type="hidden" name="k" value="<?= htmlspecialchars($k) ?>">
      <label>Email</label>
      <input type="email" name="email" value="duemme.mail@gmail.com" required>
      <label>Nuova password (min 8)</label>
      <input type="password" name="password" required minlength="8" autocomplete="new-password">
      <label>Ripeti password</label>
      <input type="password" name="password2" required minlength="8" autocomplete="new-password">
      <button type="submit">Imposta nuova password</button>
    </form>
  <?php endif; ?>
</div>
</body></html>
