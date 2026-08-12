#!/bin/sh
set -eu

# Esegue una sincronizzazione all'avvio e poi ogni sei ore. Il processo eredita
# direttamente le variabili Docker, incluse le credenziali del database/API.
while :; do
    php /var/www/html/cron/sync.php
    sleep 21600
done

