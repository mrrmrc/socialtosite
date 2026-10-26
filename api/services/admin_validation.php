<?php

/** Validation shared by administrative writes. No schema or data side effects. */
final class AdminValidation
{
    public static function amount($value, bool $nullable = false): ?float
    {
        if ($nullable && ($value === '' || $value === null)) return null;
        if (!is_scalar($value) || !is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || (float)$value > 999999999) {
            throw new InvalidArgumentException('Inserisci un importo valido, non negativo e inferiore a un miliardo.');
        }
        return (float)$value;
    }

    public static function settings(array $settings): array
    {
        $result = [];
        foreach ($settings as $key => $value) {
            if (!in_array($key, ['cron_interval_sync', 'cron_interval_seo'], true)) {
                throw new InvalidArgumentException('Impostazione non supportata.');
            }
            if (!is_scalar($value) || filter_var($value, FILTER_VALIDATE_INT) === false || (int)$value < 1 || (int)$value > 168) {
                throw new InvalidArgumentException('Gli intervalli devono essere ore intere da 1 a 168.');
            }
            $result[$key] = (string)(int)$value;
        }
        return $result;
    }

    public static function account(array $payload, int $targetId, int $adminId): void
    {
        foreach (['name' => 100, 'role_mission' => 10000, 'content_strategy' => 10000] as $field => $limit) {
            if (array_key_exists($field, $payload) && (!is_string($payload[$field]) || strlen($payload[$field]) > $limit)) throw new InvalidArgumentException('Testo non valido o troppo lungo: ' . $field);
        }
        if (isset($payload['role']) && !in_array($payload['role'], ['admin', 'user'], true)) throw new InvalidArgumentException('Ruolo non valido.');
        if (isset($payload['plan']) && !in_array($payload['plan'], ['base', 'professional', 'agency'], true)) throw new InvalidArgumentException('Piano non valido.');
        if ($targetId === $adminId && isset($payload['role']) && $payload['role'] !== 'admin') throw new InvalidArgumentException('Non puoi rimuovere il tuo ruolo amministratore.');
        if (array_key_exists('password', $payload) && $payload['password'] !== '') {
            if (!is_string($payload['password']) || strlen($payload['password']) < 8 || strlen($payload['password']) > 72) throw new InvalidArgumentException('La password deve contenere da 8 a 72 caratteri.');
        }
    }
}
