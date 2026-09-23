# Connettore WordPress — primo incremento locale

Stato: codice pilota, non distribuito, disabilitato per default. Non costituisce il completamento del piano generale.

## Implementato

- Target salvati in `product-targets.md`.
- Policy Base/Pro condivisa (1/3 siti e accesso connettori). Il limite di tre siti è una regola preparata, NON una migrazione già attiva.
- Migrazione additiva per connessioni, consegne immutabili e ricevute.
- Account pilota selezionati lato server, credenziali cifrate con chiave dedicata.
- Plugin WordPress 0.1.0: codice generato dall'amministratore, firma delle richieste, nonce anti-replay, bozze e pubblicazione esplicita.
- Un collegamento WordPress per l'unico sito attuale, nessun cambiamento alle query legacy.
- Interfaccia per connessione, categoria, invio, stato e disconnessione.
- Immagine principale caricabile esplicitamente, JPEG/PNG/WebP fino a 2 MB; trasferita come byte, senza download di URL da WordPress.
- Worker CLI, tentativi manuali limitati e riconciliazione prima della creazione.
- Nessuna sovrascrittura di un articolo consegnato. Immagini inline non supportate nel pilota.
- Test di sicurezza e contratto WordPress con simulazione delle funzioni/storage remoti.

## Attivazione futura del pilota

1. Preparare una copia di test con PHP 8+, cURL, OpenSSL, PDO MySQL, funzione getimagesizefromstring e MariaDB.
2. Eseguire il backup e applicare esplicitamente `db/migration_publication_connectors.sql` alla copia di test. Il runtime non esegue DDL automaticamente.
3. Configurare sull'app e sul worker la stessa `PUBLICATION_ENCRYPTION_KEY`, 32 byte casuali codificati in base64. Conservare backup della chiave separato dal DB; cambiarla senza ricifrare i dati rende inutilizzabili le connessioni.
4. Impostare `PUBLICATION_CONNECTORS_ENABLED=1` e `PUBLICATION_PILOT_USERS` con la lista degli ID autorizzati, separati da virgole. Richiesto piano Professional/Agency; il ruolo admin da solo non bypassa il piano.
5. Installare lo ZIP del plugin su WordPress di test. Richiesti HTTPS pubblico, API REST raggiungibili senza redirect e database con GET_LOCK disponibile. L'indirizzo deve essere la base effettiva degli endpoint REST, eventualmente in sottocartella.
6. Da Impostazioni → AllSocialToWeb generare un codice. Copiarlo nel pannello dell'account pilota. Non inviarlo via chat o commit.
7. Avviare `php cron/publish.php` manualmente per il collaudo, poi mediante scheduler ogni minuto se autorizzato. Una chiamata HTTP al worker è rifiutata.
8. Verificare bozza, immagine, pubblicazione, revoca, timeout e recupero con CMS e database reali prima di abilitare utenti.

Connettori disabilitati o account non ammesso: nessuna UI e nessun invio. Un DB non migrato restituisce un errore controllato, senza alterarlo.

## Pacchetto del plugin

Da PowerShell nella root:

```powershell
New-Item -ItemType Directory -Force artifacts
Compress-Archive -Path integrations/wordpress/allsocialtoweb -DestinationPath artifacts/allsocialtoweb-connector-0.1.0.zip -Force
```

Il plugin non richiede librerie esterne. WordPress.com, multisite e hosting con filtri REST non sono dichiarati compatibili finché non collaudati.

## Comportamenti intenzionali

- Si possono inviare solo articoli elaborati non pubblicati localmente. Il worker ricontrolla questa condizione prima di creare la bozza.
- Una sola consegna per articolo/destinazione. Un nuovo clic non sostituisce il contenuto già accodato.
- «Verifica e riprova» recupera la ricevuta remota; non rigenera il testo e non consuma AI.
- Un'interruzione durante la creazione può richiedere intervento umano: meglio segnalare esito incerto che creare un duplicato.
- «Pubblica» rende pubblica la versione presente nel CMS, comprese le modifiche del cliente.
- Disconnettere non elimina nulla su WordPress. Le credenziali locali vengono rimosse e i job in attesa annullati; richieste già partite possono completarsi.
- Per revocare anche il codice remoto usare il pulsante del plugin WordPress.
- Una destinazione esistente non può essere sostituita con un dominio diverso conservando lo stesso storico.
- Errori incerti richiedono un retry manuale, massimo cinque tentativi per azione: backoff automatico non incluso in questo incremento.
- Categoria e immagine non vengono sincronizzate dopo la consegna. Il trasferimento automatico dell'immagine originale è ancora da implementare.

## Lavoro ancora aperto rispetto al piano

1. Migrazione completa al contesto sito: fonti, articoli, profili AI, cache, cron, statistiche, URL pubblici e indici; poi rimozione del vincolo `sites.user_id` e selettore di tre siti.
2. Collegamento WordPress con codice monouso/scambio guidato: il pilota utilizza un segreto revocabile generato nell'amministrazione WordPress.
3. Ledger quote transazionale condiviso, frequenze per piano e monitoraggio costi; le regole numeriche non sono ancora decise.
4. Wix: app, autorizzazione, conversione rich content, media, coda e test del provider. Non è ancora implementato né mostrato come disponibile.
5. Pagamenti, prova 30 giorni, rinnovi, recupero pagamenti e conservazione: richiedono scelte commerciali e provider, non sono attivati.
6. Test reali MariaDB/WordPress, E2E browser e gestione degli aggiornamenti del plugin.

Gli ambienti esterni saranno configurati successivamente per scelta dell'utente. I test locali non certificano il comportamento di hosting, hook WordPress o API reali.
