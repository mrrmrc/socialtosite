# LinkSeoWeb — PHP + MySQL

## Modello pubblico e SEO

Ogni profilo pubblico fa parte della rete editoriale LinkSeoWeb e usa lo stesso tema accessibile e riconoscibile. Le personalizzazioni grafiche legacy restano disponibili agli amministratori, ma non modificano più il rendering pubblico.

La pipeline SEO crea automaticamente, quando esistono prove sufficienti nei contenuti importati, pagine fondamentali come `chi-siamo`, `cosa-offriamo`, `per-chi` e FAQ. Ogni sezione generata dall'AI deve citare ID di post pubblicati realmente; affermazioni non verificabili vengono escluse e trasformate in domande da confermare. Le pagine `contenuti` e `contatti` sono deterministiche e collegano rispettivamente gli articoli e i canali ufficiali.

La sitemap principale è un indice che include la sitemap dell'hub `/scopri` e una sitemap dedicata per ogni profilo. Il rebuild della fondazione SEO avviene dopo la sincronizzazione, dopo l'analisi della scheda business e dopo le correzioni dell'utente.

## Struttura del progetto

```
linkseoweb-php/
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

## Configurazione e deploy

Per una nuova installazione importa `db/schema.sql`, crea localmente
`config/config.php` da `config/config.example.php` e `config/keys.php` da
`config/keys.example.php`. Questi file contengono segreti e sono ignorati da
Git. Il cron consigliato è `0 */6 * * * php /percorso/cron/sync.php`.

La produzione usa esclusivamente il workflow FTP/FTPS canonico. Un normale
push su `main` non pubblica il sito: il deploy parte soltanto da un commit che
contiene `[deployvps]` oppure da un avvio manuale esplicitamente confermato.
Vedi `AGENTS.md` e `.github/workflows/deploy.yml`.

Secrets GitHub richiesti: `FTP_HOST`, `FTP_USER`, `FTP_PASS`, le otto
credenziali OAuth elencate in `config/keys.example.php` e gli eventuali segreti
AI. `FTP_REMOTE_DIR` è una variabile repository opzionale.

---

## URL del sito

- **Dashboard:** `https://allsocialtoweb.com/`
- **Sito pubblico:** `https://allsocialtoweb.com/s/nomeutente`
- **Sitemap:** `https://allsocialtoweb.com/s/nomeutente/sitemap.xml`
- **Hub pubblico del dominio padre:** `/scopri` collega profili e articoli recenti con HTML server-rendered; `/scopri/tema/{argomento}` crea cluster tematici e `/scopri/sitemap.xml` viene incluso nella sitemap globale.
- **API:** `https://allsocialtoweb.com/api/index.php?action=...`

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

### Meta

- Facebook Pages: abilita Facebook Login for Business e i permessi
  `pages_show_list`, `pages_read_engagement`. Callback:
  `https://allsocialtoweb.com/api/auth/callback.php?platform=facebook`.
- Instagram: abilita Instagram API with Instagram Login e il permesso
  `instagram_business_basic`. Sono collegabili soltanto account Creator o
  Business autorizzati dal proprietario. Callback:
  `https://allsocialtoweb.com/api/auth/callback.php?platform=instagram`.

### TikTok

Abilita Login Kit e Display API con gli scope `user.info.basic` e
`video.list`. Callback (TikTok non accetta query string negli URI registrati):
`https://allsocialtoweb.com/api/auth/tiktok_callback.php`.

### Google / YouTube

Abilita YouTube Data API v3 e configura il consenso OAuth con lo scope
`youtube.readonly`. Callback:
`https://allsocialtoweb.com/api/auth/callback.php?platform=youtube`.
