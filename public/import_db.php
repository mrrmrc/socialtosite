<?php
require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['dump'])) {
    $sql = file_get_contents($_FILES['dump']['tmp_name']);
    $pdo = DB::get();
    
    // Disattiva i controlli delle chiavi esterne per evitare errori di ordine
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0;');
    
    // Svuota completamente il database prima di importare
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $t) {
        $pdo->exec("DROP TABLE `$t`");
    }
    
    try {
        // Esegue il mega-dump tutto insieme
        $pdo->exec($sql);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1;');
        
        echo "<h1 style='color:green;font-family:sans-serif;'>Importazione Completata! 🎉</h1>";
        echo "<p style='font-family:sans-serif;'>Il database di staging ora ha tutti i dati di produzione.</p>";
        echo "<a style='font-family:sans-serif;' href='/'>Vai alla Home dello Staging</a>";
    } catch (Exception $e) {
        echo "<h1 style='color:red;font-family:sans-serif;'>Errore durante l'importazione ❌</h1>";
        echo "<pre style='background:#f4f4f4;padding:10px;border:1px solid #ccc;'>" . htmlspecialchars($e->getMessage()) . "</pre>";
    }
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Importa Database in Staging</title>
    <style>
        body { font-family: sans-serif; padding: 40px; background: #1a1a1a; color: white; text-align: center; }
        .box { background: #2a2a2a; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        button { background: #e74c3c; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 15px; }
        button:hover { background: #c0392b; }
        input[type="file"] { margin: 15px 0; }
    </style>
</head>
<body>
    <div class="box">
        <h2>🛠️ Importa DB in Staging</h2>
        <p>Seleziona il file <b>produzione.sql</b> che hai appena scaricato.</p>
        <form method="POST" enctype="multipart/form-data">
            <input type="file" name="dump" required accept=".sql"><br>
            <button type="submit">Avvia Importazione</button>
        </form>
        <p style="color:#aaa;font-size:12px;margin-top:20px;">Questa operazione cancellerà gli eventuali dati finti esistenti nello staging<br>e li rimpiazzerà con i dati veri.</p>
    </div>
</body>
</html>
