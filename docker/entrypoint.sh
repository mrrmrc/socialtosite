#!/bin/sh
set -eu

for required_name in DB_PASS JWT_SECRET ENCRYPTION_KEY ANALYTICS_SALT; do
    eval "required_value=\${$required_name:-}"
    if [ -z "$required_value" ]; then
        echo "Variabile obbligatoria mancante: $required_name" >&2
        exit 1
    fi
done

if ! printf '%s' "$ENCRYPTION_KEY" | grep -Eq '^[0-9a-fA-F]{64}$'; then
    echo "ENCRYPTION_KEY deve contenere esattamente 64 caratteri esadecimali." >&2
    exit 1
fi
if [ "${#JWT_SECRET}" -lt 32 ] || [ "${#ANALYTICS_SALT}" -lt 32 ]; then
    echo "JWT_SECRET e ANALYTICS_SALT devono contenere almeno 32 caratteri." >&2
    exit 1
fi

mkdir -p /var/www/html/public/media
chown -R www-data:www-data /var/www/html/public/media

exec "$@"
