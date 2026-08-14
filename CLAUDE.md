# LinkSeoWeb — Note per Claude

App **PHP + MySQL** che importa i contenuti dai social (Instagram, Facebook,
TikTok, YouTube), li trascrive/riscrive in chiave SEO con AI (Whisper + Claude)
e li pubblica come sito personale (`/s/<slug>`).

## Struttura
- `api/` — backend PHP (router `index.php`, auth, middleware JWT/CORS/crypto, services sync+ai)
- `public/site.php` — sito pubblico + sitemap XML
- `frontend/index.html` — dashboard React (servita nella root del dominio)
- `cron/sync.php` — sync automatico via cron job
- `db/schema.sql` — schema MySQL (importato a mano, NON deployato)
- `config/config.php` — credenziali (NON committato, vive solo sul server)

## Regola di DEPLOY (importante)
Il deploy SFTP (`.github/workflows/deploy.yml`) preleva il codice da **GitHub `main`**,
non dal PC né dall'ambiente locale. Quindi **GitHub deve sempre essere aggiornato
prima del deploy**.

**Ogni volta che l'utente scrive "deploy":**
1. Commit di tutte le modifiche in sospeso.
2. Push e **merge su `main`** (GitHub allineato).
3. Il deploy parte **da solo** al push su `main` (trigger automatico).
   In alternativa è avviabile a mano da Actions → "Run workflow".

> Nota: l'integrazione non può premere "Run workflow" via API (403). Con il
> trigger automatico su push non serve: aggiornare `main` avvia il deploy.

## Sicurezza
- Credenziali deploy: il workflow usa i **Secrets** GitHub (`FTP_HOST`,
  `FTP_USER`, `FTP_PASS`) se impostati, altrimenti ricade su
  `config/deploy.env`, che al momento è **committato in chiaro**.
  ⚠️ **Debito aperto (rilievo A1)**: quella password è nella history di git e
  va ruotata. Appena i Secrets sono impostati, cancellare `config/deploy.env`
  e rimetterlo in `.gitignore` — il workflow non richiede altre modifiche.
- `config/config.php` e `config/keys.php` vivono **solo sul server**, non nel
  repo. I modelli sono `config.example.php` e `keys.example.php`.
- Il deploy usa una **lista di inclusione** (`api/`, `public/`, `cron/`,
  `scraper/`, build Vite, `.htaccess`, `robots.txt`): un file nuovo NON finisce
  online per default. Gli script di servizio stanno in `tools/`, escluso.
- **Confine di autenticazione**: in `api/index.php` tutto ciò che sta sopra la
  riga `JWT::require()` è pubblico. Sopra sono ammessi solo `track`, `login`,
  `register` e `openclaw-webhook`. `$isAdmin` è definito sotto quella riga:
  chiamare `requireAdmin()` più in alto non protegge nulla.
- Il corpo degli articoli passa sempre da `bodySanitizeHtml()` in `site.php`
  (whitelist di tag e attributi) più una CSP con nonce. Test di regressione:
  `tools/test_html_sanitizer.php`.
- Token social cifrati a riposo (AES-256-GCM, `api/middleware/crypto.php`).
- Sessioni revocabili: incrementare `users.token_version` invalida all'istante
  tutti i token già emessi (`revokeSessions()`, endpoint `logout-all`).
- Mai committare password/chiavi né incollarle in chat.
