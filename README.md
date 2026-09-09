# LinkSeoWeb Content Import

Applicazione per collegare sorgenti pubbliche tramite URL, conservarne il
contenuto originale in MariaDB e trasformarlo, su richiesta, in una bozza
editoriale separata e ottimizzata per la ricerca. L'originale non viene mai
sovrascritto.

## Funzioni

- Login degli utenti esistenti.
- Collegamento di siti web, YouTube, Instagram, Facebook, TikTok e X.
- Acquisizione manuale con stato visibile: connessione, ricerca, importazione.
- Deduplica sul link originale.
- Archivio degli ultimi contenuti importati.
- Persistenza del payload originale restituito dalla sorgente.
- Supervisore editoriale AI con controllo di fedelta, intento di ricerca,
  struttura dell'articolo e metadati SEO.
- Pannello amministrativo protetto da ruolo per utenti, accesso assistito alle
  loro aree, agenti AI, connessioni cifrate, budget e consumi.

## Dati

Il nuovo flusso utilizza esclusivamente:

- `content_sources`: URL collegati dall'utente.
- `import_runs`: stato e contatori di ogni acquisizione.
- `raw_contents`: testo, media, metadati e payload originali.

Le vecchie tabelle non vengono eliminate automaticamente. Il runtime aggiorna
in modo incrementale lo schema necessario alle funzioni attive.

## Sviluppo frontend

```bash
cd frontend
npm ci
npm run dev
```

## Container

```bash
cp .env.docker.example .env
docker compose up -d --build
```

Lo stack applicativo contiene soltanto `app` e `db`. La chiave
`REFETCHER_API_KEY` è necessaria per le sorgenti social; i siti web vengono
acquisiti direttamente attraverso feed, sitemap o pagina pubblica.

La produzione segue esclusivamente il flusso descritto in `AGENTS.md`.
