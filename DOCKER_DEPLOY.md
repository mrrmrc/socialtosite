# Deploy Docker su VPS

Il pannello `https://213.32.22.252:10000` è verosimilmente Webmin. La porta
`10000` va lasciata al pannello. Anche `8080` è già usata da Adminer sul VPS:
LinkSeoWeb viene quindi esposto inizialmente sulla porta `8081`, oppure dietro
un reverse proxy HTTPS quando sarà disponibile un dominio.

## Prima installazione

Sul server installa Docker Engine con il plugin Compose, quindi clona il
repository e prepara l'ambiente:

```bash
git clone https://github.com/mrrmrc/socialtosite.git linkseoweb
cd linkseoweb
cp .env.docker.example .env
nano .env
mkdir -p secrets
chmod 700 secrets
chmod 600 .env
```

Genera due segreti diversi con `openssl rand -hex 32` e inseriscili in
`JWT_SECRET` e `ANALYTICS_SALT`. Configura anche `REFETCHER_API_KEY` e password
diverse e robuste per l'utente e per root MariaDB.

Avvia e verifica:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
```

Il container `cron` controlla all'avvio e poi periodicamente soltanto i profili
con sincronizzazione automatica attiva. L'intervallo predefinito è di sei ore;
può essere modificato nel file `.env` con `SYNC_INTERVAL_SECONDS` (minimo 300).

L'app risponderà su `http://213.32.22.252:8081`. Se il firewall del VPS blocca
la porta, abilita temporaneamente TCP `8081` dal pannello. La prima
registrazione su un database nuovo diventa amministratore.

## Dati persistenti e file opzionali

Il database e i media caricati sono conservati nei volumi Docker `db_data` e
`media_data`: un rebuild dell'immagine non li cancella. Non usare
`docker compose down -v` in produzione perché elimina entrambi i volumi.

Se vuoi trasferire anche utenti, articoli e contenuti già presenti nel vecchio
hosting, esporta il database in `backup.sql` e scarica la vecchia cartella
`public/media`. Dopo il primo avvio importa e copia i dati:

```bash
docker compose exec -T db sh -c \
  'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < backup.sql
docker compose cp ./media/. app:/var/www/html/public/media/
docker compose exec app chown -R www-data:www-data /var/www/html/public/media
```

Per Search Console copia le credenziali nel server come
`secrets/gcp-credentials.json`; il file è montato in sola lettura e il container
usa automaticamente quel percorso.

## Aggiornamenti

```bash
git pull --ff-only
docker compose up -d --build
docker image prune -f
```

Prima di aggiornamenti importanti crea un backup:

```bash
docker compose exec -T db sh -c \
  'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' \
  > backup.sql
```

## HTTPS e dominio

Per l'uso reale serve un dominio HTTPS. Punta il record DNS al
VPS e configura Nginx, Apache o Caddy come reverse proxy verso
`127.0.0.1:8081`; poi aggiorna `BASE_URL` e `ALLOWED_ORIGIN` nel `.env` con il
dominio `https://...` e ricrea i container.
