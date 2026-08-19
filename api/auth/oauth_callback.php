<?php
// Le connessioni Meta sono state sostituite dalla pipeline URL + Apify.
http_response_code(410);
header('Content-Type: text/plain; charset=utf-8');
echo "Facebook e Instagram non usano piu' OAuth/Graph API. Incolla nell'applicazione il link pubblico del profilo.";
exit;
