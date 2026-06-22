<?php
function checkSyntax($file) {
    $code = file_get_contents($file);
    try {
        token_get_all($code, TOKEN_PARSE);
        echo "OK: $file\n";
    } catch (ParseError $e) {
        echo "ERROR in $file on line " . $e->getLine() . ": " . $e->getMessage() . "\n";
    }
}

checkSyntax(__DIR__ . '/../api/index.php');
checkSyntax(__DIR__ . '/../api/services/ai.php');
checkSyntax(__DIR__ . '/../api/services/ingest.php');
checkSyntax(__DIR__ . '/../api/services/sync.php');
checkSyntax(__DIR__ . '/../api/middleware/jwt.php');
checkSyntax(__DIR__ . '/../public/site.php');
