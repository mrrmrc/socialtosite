#!/usr/bin/env bash
# Deploy di produzione dalla macchina locale, alternativo alla pipeline GitHub.
#
# Perche' esiste: dai runner GitHub ogni file costa ~12 secondi, e un deploy da
# 37 file impiega ~14 minuti. Dalla macchina di casa una connessione completa
# allo stesso server costa 169 ms. Il collo di bottiglia e' il percorso di rete
# fra i runner e il server, non il server.
#
# Credenziali: le legge da config/deploy.env, che e' in .gitignore e non viene
# mai committato. Lo script non le stampa mai.
#
#   FTP_HOST=...
#   FTP_USER=...
#   FTP_PASS=...
#   FTP_REMOTE_DIR=www
#
# Uso:  bash tools/deploy-local.sh
#
# ATTENZIONE, cosa questo percorso NON fa rispetto alla pipeline:
#   - non esegue il controllo di sintassi PHP (qui non c'e' PHP installato);
#   - non rigenera config/runtime-secrets.php, quindi lascia intatto quello
#     gia' presente sul server: le chiavi Apify e Gemini non servono qui;
#   - non cancella i file remoti non piu' presenti nel rilascio.
# Per modifiche che toccano PHP conviene continuare a usare `deployvps`.

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="config/deploy.env"
[ -f "$ENV_FILE" ] || { echo "Manca $ENV_FILE. Crealo con FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR."; exit 1; }
# shellcheck disable=SC1090
set -a; . "./$ENV_FILE"; set +a
: "${FTP_HOST:?FTP_HOST mancante in $ENV_FILE}"
: "${FTP_USER:?FTP_USER mancante in $ENV_FILE}"
: "${FTP_PASS:?FTP_PASS mancante in $ENV_FILE}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:-www}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR#/}"; FTP_REMOTE_DIR="${FTP_REMOTE_DIR%/}"

COMMIT="$(git rev-parse HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Ci sono modifiche non committate: il footer mostrerebbe un commit che non corrisponde."
  read -r -p "Continuo lo stesso? [s/N] " risposta
  [ "$risposta" = "s" ] || [ "$risposta" = "S" ] || exit 1
fi

echo "==> Compilo il frontend"
( cd frontend && npm run build >/dev/null )

echo "==> Preparo il rilascio"
rm -rf release && mkdir -p release/api/middleware release/api/routes release/api/services release/config release/public/media
cp api/index.php release/api/
cp api/middleware/{jwt,response,ratelimit,logger}.php release/api/middleware/
cp api/routes/{auth,migrate,upload,setup_admin}.php release/api/routes/
cp api/services/{sync,ingest,editorial_engine,visibility,seo_foundation,reachability}.php release/api/services/
cp api/services/{raw_import,apify_client,website_source,profile_analyzer,admin_console,editorial_supervisor,provider_config,ai,content_ideas}.php release/api/services/
cp -r frontend/dist/. release/
cp .htaccess robots.txt release/
cp config/db.php release/config/
cp public/{site,discover,sitemap,site-professional}.php release/public/
cp google*.html release/ 2>/dev/null || true

printf '{\n  "deployed_at": "%s",\n  "timezone": "Europe/Rome",\n  "release": "locale-%s",\n  "commit": "%s",\n  "method": "deployvps-locale"\n}\n' \
  "$(TZ=Europe/Rome date '+%Y-%m-%d %H:%M:%S')" "${COMMIT:0:7}" "$COMMIT" > release/deploy-info.json

# Le stesse esclusioni della pipeline, piu' i file che vivono solo sul server.
if find release \( -name 'config.php' -o -name 'keys.php' -o -name '*.env' -o -name 'runtime-secrets.php' \) | grep -q .; then
  echo "Trovato un file vietato dentro release/. Interrompo."; exit 1
fi

TOTALE=$(find release -type f | wc -l)
echo "==> Carico $TOTALE file su $FTP_HOST/$FTP_REMOTE_DIR"

INIZIO=$(date +%s)
# Un'invocazione curl per cartella: la connessione viene riusata per tutti i
# file della stessa cartella, invece di aprirne una nuova per ogni file.
while IFS= read -r cartella; do
  rel="${cartella#release}"; rel="${rel#/}"
  mapfile -t elenco < <(find "$cartella" -maxdepth 1 -type f -printf '%f\n')
  [ "${#elenco[@]}" -gt 0 ] || continue
  destinazione="ftp://$FTP_HOST/$FTP_REMOTE_DIR${rel:+/$rel}/"
  lista=$(IFS=,; echo "${elenco[*]}")
  ( cd "$cartella" && curl --silent --show-error --fail \
      --ssl-reqd --insecure --ftp-create-dirs --disable-epsv \
      --connect-timeout 20 --max-time 300 \
      --user "$FTP_USER:$FTP_PASS" \
      -T "{$lista}" "$destinazione" )
  echo "    $((${#elenco[@]})) file -> ${rel:-/}"
done < <(find release -type d)
DURATA=$(( $(date +%s) - INIZIO ))

echo "==> Caricamento completato in ${DURATA}s"

echo "==> Verifico la produzione"
sleep 2
online=$(curl -s --max-time 20 "https://allsocialtoweb.com/deploy-info.json?t=$(date +%s)" | grep -oE '[a-f0-9]{40}' | head -1)
if [ "$online" != "$COMMIT" ]; then
  echo "ATTENZIONE: il sito riporta ${online:0:7}, atteso ${COMMIT:0:7}"; exit 1
fi
pagina=$(curl -s --max-time 20 https://allsocialtoweb.com/)
mancanti=0
for asset in $(echo "$pagina" | grep -oE '/assets/[^"]+\.(js|css)' | sort -u); do
  codice=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://allsocialtoweb.com$asset")
  echo "    $asset -> $codice"
  [ "$codice" = "200" ] || mancanti=$((mancanti + 1))
done
[ "$mancanti" -eq 0 ] || { echo "ATTENZIONE: $mancanti file referenziati non rispondono."; exit 1; }

echo "==> Fatto: ${COMMIT:0:7} online, ${DURATA}s di caricamento"
