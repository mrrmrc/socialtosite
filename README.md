# SocialToSite — PHP + MySQL

## Modello pubblico e SEO

Ogni profilo pubblico fa parte della rete editoriale AllSocialToWeb e usa lo stesso tema accessibile e riconoscibile. Le personalizzazioni grafiche legacy restano disponibili agli amministratori, ma non modificano più il rendering pubblico.

La pipeline SEO crea automaticamente, quando esistono prove sufficienti nei contenuti importati, pagine fondamentali come `chi-siamo`, `cosa-offriamo`, `per-chi` e FAQ. Ogni sezione generata dall'AI deve citare ID di post pubblicati realmente; affermazioni non verificabili vengono escluse e trasformate in domande da confermare. Le pagine `contenuti` e `contatti` sono deterministiche e collegano rispettivamente gli articoli e i canali ufficiali.

La sitemap principale è un indice che include la sitemap dell'hub `/scopri` e una sitemap dedicata per ogni profilo. Il rebuild della fondazione SEO avviene dopo la sincronizzazione, dopo l'analisi della scheda business e dopo le correzioni dell'utente.

## Struttura del progetto

```
socialtosite-php/
├── .htaccess              ← Routing Apache (carica nella root)
├── config/
│   ├── config.example.php ← RINOMINA in config.php e compila
│   └── db.php             ← Classe DB (PDO MySQL)
├── api/
│   ├── index.php          ← Router API principale
│   ├── auth/
│   │   └── callback.php   ← OAuth callback social
│   ├── middleware/
│   │   ├── jwt.php        ← JWT puro PHP
│   │   └── response.php   ← Helper JSON/CORS
│   ├── routes/
│   │   └── auth.php       ← Register/Login
│   └── services/
│       ├── ai.php         ← Whisper + Claude API
│       └── sync.php       ← Importa contenuti social
├── public/
│   └── site.php           ← Pagina pubblica + sitemap XML
├── cron/
│   └── sync.php           ← Sync automatico (cron job)
├── frontend/
│   └── index.html         ← App React (già inclusa)
└── db/
    └── schema.sql         ← Schema MySQL da importare
```

---

## Setup su GitHub

1. Crea un repo su GitHub (es. `socialtosite`)
2. Carica tutti i file del progetto
3. **Non caricare** `config/config.php` — aggiungilo a `.gitignore`

```
# .gitignore
config/config.php
*.log
```

---

## Deploy via FTP

### 1. Database MySQL

Nel pannello del tuo hosting (cPanel / Plesk):
- Crea un database MySQL
- Crea un utente e assegnagli tutti i permessi
- Apri **phpMyAdmin**, seleziona il database
- Tab "Importa" → carica `db/schema.sql`

### 2. Configura il file config

```bash
# Rinomina il file esempio
cp config/config.example.php config/config.php

# Apri config.php e compila:
# - DB_HOST, DB_NAME, DB_USER, DB_PASS (dal pannello hosting)
# - JWT_SECRET (genera: php -r "echo bin2hex(random_bytes(32));")
# - OPENAI_API_KEY
# - ANTHROPIC_API_KEY
# - BASE_URL (es: https://socialtosite.it)
# - Credenziali OAuth social
```

### 3. Carica via FTP

Usa FileZilla o il file manager del tuo hosting:

```
Carica nella root del dominio (public_html o www):
  ├── .htaccess
  ├── config/         (incluso config.php compilato)
  ├── api/
  ├── public/
  ├── cron/
  └── frontend/
```

⚠️ **Non caricare** `db/` (contiene solo lo schema, già importato)

### 4. Cron job automatico

Nel pannello hosting, aggiungi un cron job:
```
0 */6 * * *   php /home/tuoutente/public_html/cron/sync.php
```

---

## Workflow GitHub → IDX → FTP

```
1. Modifica il codice in IDX (o Claude Code)
2. git add . && git commit -m "aggiornamento"
3. git push origin main
4. Scarica le modifiche dal repo
5. Carica via FTP solo i file modificati
```

### Con GitHub Actions (automatizza il deploy FTP)

Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy via FTP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: ${{ secrets.FTP_HOST }}
          username: ${{ secrets.FTP_USER }}
          password: ${{ secrets.FTP_PASS }}
          local-dir: ./
          server-dir: /public_html/
          exclude: |
            **/.git*
            **/.git*/**
            **/node_modules/**
            config/config.php
```

Aggiungi nei Secrets del repo GitHub:
- `FTP_HOST` — host FTP del tuo hosting
- `FTP_USER` — utente FTP
- `FTP_PASS` — password FTP

Con questo, ogni `git push` deploya automaticamente via FTP. 🚀

---

## URL del sito

- **Dashboard:** `https://tuodominio.it/`
- **Sito pubblico:** `https://tuodominio.it/s/nomeutente`
- **Sitemap:** `https://tuodominio.it/s/nomeutente/sitemap.xml`
- **Hub pubblico del dominio padre:** `/scopri` collega profili e articoli recenti con HTML server-rendered; `/scopri/tema/{argomento}` crea cluster tematici e `/scopri/sitemap.xml` viene incluso nella sitemap globale.
- **API:** `https://tuodominio.it/api/index.php?action=...`

## Utenti e area amministrativa

- La registrazione pubblica crea nuovi utenti con ruolo `user`.
- Su un database nuovo, il primo account registrato diventa automaticamente `admin`.
- Gli amministratori vedono la scheda **Admin** nella dashboard e possono creare utenti, cambiare ruolo/piano, vedere quanti social e contenuti ha ogni utente ed eliminare account.
- Ogni utente gestisce solo il proprio spazio social, i propri contenuti e il proprio sito pubblico.

Per database gia esistenti, importa `db/migration_admin_users.sql` in phpMyAdmin dopo aver sostituito `admin@example.com` con l'email dell'account da promuovere ad amministratore.

Per abilitare i link dei canali/profili social e il collegamento al post originale, importa anche `db/migration_social_sources.sql`.
Per abilitare il profilo generato/editabile dalla scansione, importa anche `db/migration_profile_scan.sql`.
Per abilitare agente editoriale, deduplica semantica e 10 layout selezionabili, importa anche `db/migration_agentic_layouts.sql`.

## Metriche di visibilità

- La dashboard utente mostra pagine pubblicate, URL apparse in Google, impressioni, clic e azioni verso l'attività negli ultimi 30 giorni.
- Il pannello admin aggiunge copertura per profilo, query, pagine principali, stato del tracking e sincronizzazioni.
- Le azioni pubbliche sono conteggiate senza cookie e memorizzano solo un hash pseudonimo giornaliero; i bot noti vengono esclusi.
- I dati Google sono filtrati per il percorso del singolo profilo, così i totali del dominio non vengono attribuiti a ogni utente.
- Per Search Console salva `config/gcp-credentials.json` solo sul server e concedi al service account accesso alla property. Il cron social aggiorna automaticamente anche le metriche quando il file è presente.
- Su installazioni manuali è disponibile `db/migration_visibility_analytics.sql`; l'app crea comunque le tabelle mancanti al primo utilizzo.

---

## Registrazione app OAuth

### Meta (Instagram + Facebook)
1. https://developers.facebook.com → Crea App → Business
2. Redirect URI: `https://tuodominio.it/api/auth/callback.php?platform=instagram`

### TikTok
1. https://developers.tiktok.com → Crea app
2. Redirect URI: `https://tuodominio.it/api/auth/callback.php?platform=tiktok`

### Google / YouTube
1. https://console.cloud.google.com → Abilita YouTube Data API v3
2. Redirect URI: `https://tuodominio.it/api/auth/callback.php?platform=youtube`
