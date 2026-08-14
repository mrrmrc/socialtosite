# SocialToSite — Istruzioni operative per assistenti AI

App PHP + MySQL che importa contenuti social, li elabora in chiave SEO con AI e li pubblica come sito personale.

## Struttura essenziale
- `api/` — backend PHP
- `public/site.php` — sito pubblico
- `frontend/` — dashboard React/Vite
- `cron/sync.php` — sincronizzazione automatica
- `db/` — schema e migrazioni, NON pubblicati automaticamente
- `config/config.php` e `config/keys.php` — segreti server, NON committati e NON sovrascritti

# COMANDO CANONICO: deployvps

La parola esatta `deployvps` ha un significato vincolante e identico per Claude, Codex, Antigravity, ChatGPT e qualsiasi altro agente che lavori sul repository.

Quando l'utente scrive `deployvps`, eseguire ESCLUSIVAMENTE questa procedura:

1. Salvare su disco tutti i file modificati nell'ambiente di lavoro locale.
2. Verificare sintassi/test/build disponibili prima della pubblicazione.
3. Sincronizzare il lavoro con Git: aggiungere le modifiche intenzionali, creare un commit e portare `main` allo stato da pubblicare senza perdere modifiche locali.
4. Il commit che deve andare in produzione DEVE contenere il marcatore `[deployvps]` nel messaggio. Esempio: `Update dashboard [deployvps]`.
5. Push di `main` su GitHub. Il workflow `.github/workflows/deploy.yml` riconosce il marcatore, compila la release e la pubblica via FTP/FTPS sul VPS.
6. Attendere e verificare l'esito del workflow e la verifica della release sul sito pubblico.

## Destinazione produzione

- Sito pubblico: `https://213.32.22.252/`
- Trasporto di pubblicazione: FTP/FTPS (`lftp`)
- Host FTP, utente, password e directory remota devono provenire dai GitHub Secrets/Variables, non devono essere inventati a partire dall'URL HTTPS.
- La directory FTP remota è configurata tramite `FTP_REMOTE_DIR` (Repository Variable). Se non impostata il workflow usa `.`.

## DIVIETO ASSOLUTO durante deployvps

Durante `deployvps` NON eseguire, neppure come scorciatoia:
- `docker compose down`, `docker compose up`, `docker compose build`, `docker restart`, `docker rm`;
- rebuild/recreate/smontaggio dei container;
- `docker cp` per pubblicare il codice;
- modifica manuale dei file dentro un container;
- SSH/rsync/SCP come sostituto dell'FTP;
- deploy da un branch diverso da `main`.

Docker può essere amministrato solo se l'utente chiede ESPLICITAMENTE un'operazione Docker distinta da `deployvps`.

## Regola GitHub

Un normale push su `main` salva il codice ma NON deve essere interpretato come richiesta di pubblicazione VPS. La pubblicazione automatica avviene solo quando il messaggio del commit HEAD contiene `[deployvps]`, oppure tramite avvio manuale del workflow con conferma esplicita.

## Sicurezza

- Usare GitHub Secrets: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
- Usare Repository Variable opzionale `FTP_REMOTE_DIR` per la directory FTP servita dalla produzione.
- `config/deploy.env` è legacy e contiene/ha contenuto credenziali: non usarlo come sorgente canonica e rimuoverlo dopo aver configurato i Secrets e ruotato le credenziali.
- `config/config.php` e `config/keys.php` vivono solo sul server e non devono essere sovrascritti.
- Il deploy usa una lista di inclusione: file di debug, SQL, env e segreti non devono entrare nella release.

## Applicazione

Se un agente non dispone dell'accesso al filesystem locale, al terminale o alle credenziali necessarie, NON deve simulare `deployvps` e NON deve sostituirlo con Docker. Deve eseguire solo le fasi realmente disponibili e dichiarare chiaramente quale fase manca.
