<?php
$payload = [
    'sub' => 1,
    'iat' => time(),
    'exp' => time() + 3600
];
$header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
$payload = json_encode($payload);
$base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
$base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
$signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, 'staging_secret_key_1234567890', true);
$base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
$jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
echo $jwt;
