#!/bin/sh
set -eu

# Esegue una sincronizzazione all'avvio e poi all'intervallo configurato. Il
# processo eredita le variabili Docker, incluse le credenziali del database/API.
interval_seconds="${SYNC_INTERVAL_SECONDS:-21600}"
case "$interval_seconds" in
    ''|*[!0-9]*)
        echo "SYNC_INTERVAL_SECONDS deve essere un numero intero." >&2
        exit 1
        ;;
esac
if [ "$interval_seconds" -lt 300 ]; then
    echo "SYNC_INTERVAL_SECONDS deve essere almeno 300 secondi." >&2
    exit 1
fi

while :; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Controllo periodico dei canali attivi. Prossimo ciclo tra ${interval_seconds}s."
    if ! php /var/www/html/cron/sync.php; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sincronizzazione non completata; il timer continuerà al prossimo ciclo." >&2
    fi
    sleep "$interval_seconds"
done
