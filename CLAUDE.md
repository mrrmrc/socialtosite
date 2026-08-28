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

## Regola di deploy
La sola parola riservata `deployvps` autorizza il deploy di produzione. Il
comando crea un commit su `main` contenente `[deployvps]`, sincronizza e invia
il branch; `.github/workflows/deploy.yml` esegue controlli, build e upload
FTP/FTPS. Un normale push non pubblica nulla. Vedi `AGENTS.md`.

## Sicurezza
- Credenziali deploy e OAuth: esclusivamente GitHub Secrets o file locali
  ignorati. `config/deploy.env`, `config/config.php` e `config/keys.php` non
  devono mai essere committati.
- `config/config.php` e `config/keys.php` vivono **solo sul server**, non nel
  repo. I modelli sono `config.example.php` e `keys.example.php`.
- Il deploy usa una **lista di inclusione** (`api/`, `public/`, `cron/`,
  build Vite, `.htaccess`, `robots.txt`): un file nuovo NON finisce
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
