<?php
// api/middleware/crypto.php — Cifratura simmetrica per i token social (AES-256-GCM)
require_once __DIR__ . '/../../config/config.php';

class Crypto {
    private const PREFIX = 'enc:v1:';

    private static function key(): string {
        if (!defined('ENCRYPTION_KEY') || strlen(ENCRYPTION_KEY) !== 64) {
            throw new Exception('ENCRYPTION_KEY mancante o non valida (servono 64 caratteri hex)');
        }
        return hex2bin(ENCRYPTION_KEY);
    }

    public static function encrypt(string $plain): string {
        if ($plain === '') return '';
        $iv  = random_bytes(12);
        $tag = '';
        $ct  = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return self::PREFIX . base64_encode($iv . $tag . $ct);
    }

    public static function decrypt(string $value): string {
        if ($value === '') return '';
        // Compatibilità: valori salvati prima della cifratura restano leggibili
        if (!str_starts_with($value, self::PREFIX)) return $value;
        $raw = base64_decode(substr($value, strlen(self::PREFIX)), true);
        if ($raw === false || strlen($raw) < 28) return '';
        $iv  = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $ct  = substr($raw, 28);
        $pt  = openssl_decrypt($ct, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return $pt === false ? '' : $pt;
    }
}
