#!/bin/sh
set -eu

for required_name in DB_PASS JWT_SECRET REFETCHER_API_KEY; do
    eval "required_value=\${$required_name:-}"
    if [ -z "$required_value" ]; then
        echo "Variabile obbligatoria mancante: $required_name" >&2
        exit 1
    fi
done

if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo "JWT_SECRET deve contenere almeno 32 caratteri." >&2
    exit 1
fi

exec "$@"
