# Container LinkSeoWeb Content Import

Il nuovo stack comprende due servizi:

- `app`: interfaccia React e API PHP per acquisizione grezza.
- `db`: MariaDB 11.4 con volume persistente `socialtosite_db_data`.

Nginx Proxy Manager resta infrastruttura separata e inoltra il traffico verso
l'applicazione. Il vecchio servizio `cron` non fa più parte dello stack: ogni
acquisizione viene avviata esplicitamente dall'interfaccia.

## Configurazione

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose ps
```

Sono obbligatori password database, `JWT_SECRET` e `REFETCHER_API_KEY`. Il
backend crea automaticamente le tre nuove tabelle di importazione. Il volume
database esistente non viene cancellato e mantiene recuperabili i dati legacy.

Non usare `docker compose down -v`: eliminerebbe il volume del database.

La pubblicazione in produzione usa il flusso GitHub Actions/FTP definito in
`AGENTS.md`; non sostituirlo con operazioni Docker manuali.
