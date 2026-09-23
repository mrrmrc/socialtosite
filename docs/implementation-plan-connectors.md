# AllSocialToWeb — Piano di implementazione dei connettori

Data: 23 settembre 2026. Stato: implementazione autorizzata; primo incremento WordPress preparato localmente. Distribuzione non eseguita.

Avanzamento effettivo e limiti: [Connettore pilota](connectors-pilot.md). Target concordati: [Target di prodotto](product-targets.md). Il piano complessivo non è ancora completato: multisito, Wix, quote e pagamenti restano aperti.

## 1. Obiettivo e proposta di valore

Consentire al cliente di usare AllSocialToWeb per acquisire i propri contenuti, elaborarli e inviarli al sito che possiede già, a partire da WordPress e successivamente Wix Blog.

Messaggio: «Hai già un sito? AllSocialToWeb trasforma i tuoi contenuti social in articoli per il tuo sito».

Restano disponibili i siti ospitati sulla piattaforma. Non diventiamo un servizio di manutenzione WordPress e non realizziamo un plugin universale: realizziamo un motore comune di distribuzione con adattatori specifici.

## 2. Decisioni emerse e proposte ancora aperte

| Tema | Orientamento | Stato |
|---|---|---|
| Base | Una presenza web | Base del piano |
| Pro | Fino a 3 siti, con consumi condivisi | Richiesta dell'utente |
| Agency | N clienti, ciascuno con piano Pro | Futuro, escluso dal rilascio |
| Connettori | WordPress e Wix, estensibili in seguito | Direzione richiesta |
| Accesso ai connettori | Incluso nel Pro; Base solo ospitato | Proposta da confermare |
| Prova | Base limitato per 30 giorni, carta e primo addebito successivo | Orientamento discusso; dettagli da approvare |
| Prezzi | Ultima ipotesi: Base 12,90 €/mese o 129 €/anno; Pro 29,90 €/mese o 299 €/anno, IVA esclusa | Non definitivo; validare costi e margini |
| Quote | Plafond per account, distinto per acquisizione e AI | Quantità da misurare e approvare |
| Scadenza | Stop elaborazioni; sospensione del sito ospitato; eventuale eliminazione dopo recupero | Tempi e condizioni non definitivi |

La prova Base non permetterebbe di valutare il connettore Pro: proporre una demo guidata o un'abilitazione pilota limitata di un connettore per 30 giorni, con lo stesso tetto di costo. Non attivare automaticamente un rinnovo Pro per chi ha accettato Base.

## 3. Riscontri nel repository

- `db/schema.sql`: `sites.user_id` è UNIQUE; oggi il modello prevede un sito per utente.
- `posts`, `social_sources`, `content_sources`, profili e statistiche sono prevalentemente associati a `user_id`.
- `api/services/sync.php`: sincronizzazione, copertina e punteggi lavorano per utente.
- `api/index.php`: molte azioni risolvono il sito tramite utente; controlli del piano distribuiti in singoli endpoint.
- `frontend/src/App.jsx`, `DashboardScreen.jsx` e `components/PlanExperience.jsx`: esperienze Base/Pro esistenti, senza selettore completo di più siti.
- `api/services/provider_config.php`: cifratura delle connessioni provider e registrazione dei consumi già presenti; non sono ancora un sistema di quote transazionale per abbonamento.
- `cron/sync.php`: intervallo globale; non applica le frequenze per piano descritte nella landing.
- `api/routes/auth.php`: registrazione pubblica disabilitata.
- Esistono flussi `raw_contents` e `posts`: il connettore deve ricevere una versione editoriale approvata, mai pubblicare direttamente il payload grezzo della fonte.

Questi riscontri derivano da lettura del codice. Non attestano configurazione o corretto funzionamento della produzione.

## 4. Perimetro del primo rilascio

Incluso:

- Pro con massimo 3 siti complessivi, ospitati oppure esterni.
- Primo connettore WordPress per installazioni compatibili con il plugin.
- Un articolo appartiene a un sito; una destinazione primaria per sito.
- Titolo, testo con formattazione essenziale, estratto, immagine principale, testo alternativo e categoria esistente.
- Invio esplicito come bozza; pubblicazione soltanto su comando esplicito successivo.
- Stato della consegna, collegamento all'articolo remoto e ripetizione sicura degli invii.
- Connessione revocabile; articoli e immagini già trasferiti restano sul CMS alla disdetta.

Escluso dal primo rilascio:

- Pubblicazione automatica senza revisione e calendario di invio.
- Sincronizzazione bidirezionale e modifica automatica di articoli già consegnati.
- Invio dello stesso articolo a più siti, importazione retroattiva del blog esterno.
- Temi WordPress, page builder, e-commerce, campi personalizzati e compatibilità universale con plugin SEO.
- Analisi visite del sito esterno: mostriamo consegne e pubblicazioni, non inventiamo metriche di traffico.
- Domini personalizzati sui siti ospitati, nuova gestione DNS/HTTPS e manutenzione hosting esterni.
- Agency, marketplace pubblico e altri CMS.

## 5. Architettura proposta

Flusso: fonte → archivio originale → elaborazione AI → revisione → versione pronta → coda di consegna → adattatore → CMS → ricevuta.

Componenti:

1. **Contesto sito**: risolve `site_id`, proprietario, piano e permessi in ogni operazione.
2. **Regole del piano**: limite siti, accesso connettori e quote, applicati nel backend.
3. **Formato editoriale comune**: titolo, blocchi supportati, estratto, media, categoria e versione; conversione dall'HTML editoriale attuale con sanitizzazione.
4. **Coda MariaDB**: consegne persistenti elaborate da un worker PHP CLI avviato da cron. Non richiede Docker o un nuovo servizio di messaggistica.
5. **Adattatori**: interfaccia comune per verificare connessione, leggere categorie, preparare media, creare bozza, pubblicare e riconciliare l'esito, con capacità dichiarate per provider.
6. **Storico operativo**: eventi comprensibili all'utente e log tecnici senza credenziali.

La consegna è asincrona: la schermata conferma «In coda», non «Pubblicato» prima della ricevuta effettiva.

## 6. Modello dati e migrazione

| Oggetto | Cambiamento proposto |
|---|---|
| `sites` | Rimuovere unicità di `user_id` dopo il backfill; aggiungere tipo destinazione e identificatore stabile del sito |
| Contenuti, fonti, profili, statistiche | Introdurre `site_id`, mantenendo il proprietario e adeguando indici/unicità al sito |
| `site_connections` | Provider, sito remoto, stato, modalità, credenziali cifrate, versione protocollo e ultima verifica |
| `content_versions` | Copia immutabile del contenuto autorizzato, hash e autore dell'azione |
| `publication_jobs` | Connessione, versione, azione, chiave univoca di invio, stato, tentativi e lease del worker |
| `remote_publications` | Associazione articolo locale/remoto, URL, stato, hash e identificativi media |
| `publication_events` | Cronologia di consegne, errori e riconciliazioni |
| `usage_ledger` | Prenotazioni, consumi e rilasci per account, sito, periodo e operazione |

Inventariare tutte le tabelle operative e i percorsi pubblici prima di fissare lo schema finale: non basta modificare `posts`.

Sequenza di migrazione:

1. Backup verificato e prova della migrazione su copia dei dati.
2. Aggiunta dei nuovi campi nullable e delle nuove tabelle, senza eliminazioni.
3. Assegnazione dei dati esistenti all'unico sito corrente dell'utente; segnalazione di righe orfane e anomalie.
4. Aggiornamento di API, worker, profili AI, query pubbliche, statistiche e cache al contesto sito.
5. Conservazione degli URL pubblici esistenti; i nuovi siti ottengono identificatori univoci propri.
6. Verifica di isolamento, conteggi e corrispondenza dei dati, poi vincoli e indici definitivi.
7. Rimozione del vincolo un sito/utente e attivazione graduale dei siti aggiuntivi.

Il fallback al sito predefinito serve soltanto ai percorsi legacy durante la transizione. Per account con più siti, nessuna scelta implicita nelle operazioni di scrittura.

Rollback: disattivare nuove connessioni e invii tramite configurazione; mantenere i dati. Dopo la creazione di più siti non è sicuro ripristinare alla cieca la vecchia applicazione: prevedere una versione compatibile o recupero concordato da backup.

## 7. WordPress: prima integrazione

Scelta proposta: plugin minimo dedicato per collegamento guidato e controllo degli invii duplicati. Le REST API native possono servire al prototipo; da sole non risolvono tutta l'esperienza di associazione e riconciliazione.

Prototipo da validare prima di stabilizzare il protocollo:

- Collegamento avviato da un amministratore WordPress e confermato nell'account AllSocialToWeb.
- Codice monouso a breve scadenza e legame esplicito fra account, sito e installazione remota.
- Credenziale revocabile per singola installazione, mai la password principale dell'amministratore.
- Endpoint del plugin autenticati e limitati alle operazioni previste; richieste firmate con timestamp e protezione dal riutilizzo.
- Trasferimento delle immagini nella libreria media WordPress, con verifica formato e dimensioni.
- Registro remoto con unicità della chiave di consegna, prenotazione prima della creazione e riconciliazione anche dopo interruzioni fra creazione articolo e salvataggio ricevuta.
- Invio bozza, lettura dell'esito e pubblicazione esplicita dell'articolo remoto corrente.
- Disconnessione da entrambi i lati e gestione della disattivazione del plugin.

Il plugin non contiene AI, non gestisce abbonamenti e non modifica temi o altri plugin. Prima del pilota dichiarare versioni WordPress/PHP testate e prerequisiti HTTPS/REST raggiungibili. WordPress.com richiede una verifica separata di piano e possibilità di installazione; non promettere supporto indiscriminato.

Gli aggiornamenti dell'articolo dopo il primo invio restano nel CMS nella prima versione. AllSocialToWeb indica «Già consegnato» e non crea silenziosamente una seconda copia.

## 8. Wix: secondo connettore

Wix richiede un'integrazione propria, non l'installazione del plugin WordPress.

Prova tecnica obbligatoria su sito Wix di test:

- Registrazione/configurazione di un'app Wix e verifica del percorso di installazione/distribuzione applicabile.
- Autorizzazione per il sito corretto e permessi Blog; gestione del ciclo di vita dei token previsto dal tipo di app scelto.
- Controllo presenza di Wix Blog e risoluzione dell'autore: la creazione da app terza richiede `memberId`.
- Conversione dei blocchi editoriali nel formato rich content Wix; gestione delle immagini e delle categorie esistenti.
- Creazione bozza, persistenza immediata dell'ID remoto e pubblicazione separata.
- Verifica disinstallazione, autorizzazione revocata, rate limit e risposta persa dopo la creazione.

Non assumere che Wix supporti una chiave idempotente arbitraria. Se dopo un timeout non possiamo stabilire se una bozza sia stata creata, il job passa a «Esito da verificare»: riconciliazione prima di ogni nuovo tentativo di creazione.

Rilascio Wix subordinato a prova completa e requisiti di distribuzione; eventuali approvazioni della piattaforma non hanno una durata stimabile qui.

## 9. Esperienza utente

Nuova area «I miei siti» con contatore 1/3, selettore persistente e schede sito.

Percorso: aggiungi sito → ospitato / WordPress / Wix → collega → verifica → scegli categoria → invia una bozza di prova esplicitamente autorizzata.

Nell'editor mostrare sempre nome e dominio destinatari. Azioni: «Invia come bozza», «Apri nel CMS», «Pubblica sul sito». Non creare bozza sul CMS come effetto collaterale del solo test di connessione.

Stati: non collegato, connesso, da riconnettere; articolo pronto, in coda, in invio, consegnato come bozza, pubblicato, da verificare, fallito, annullato.

Errori distinguibili: quota esaurita, credenziale revocata, sito irraggiungibile, contenuto non supportato. Ogni errore deve indicare il prossimo passo senza esporre dettagli sensibili.

Il sito esterno è la destinazione primaria: evitare di rendere automaticamente pubblica anche la copia ospitata da noi. Nella prima versione la copia locale resta editoriale e privata.

## 10. Affidabilità e sicurezza

- Verifica proprietà del sito in tutte le API; test negativi fra utenti e fra siti dello stesso account.
- Credenziali cifrate lato server con chiave dedicata e piano di rotazione; nessun token nel browser o nei log. Valutare il riuso delle primitive esistenti, non della chiave JWT per nuovi segreti.
- Richieste a siti WordPress protette da SSRF: HTTPS, blocco reti private/loopback/link-local, controllo DNS e redirect, timeout e limiti di risposta. Stesse protezioni per download media.
- Contenuti HTML sanitizzati, conversione con elenco di elementi supportati e segnalazione delle parti non trasferibili.
- Worker con acquisizione atomica, lease a scadenza e recupero dei job abbandonati.
- Retry limitati per errori transitori, attesa crescente e rispetto dei rate limit; nessun retry cieco di una creazione dall'esito incerto.
- Stato abbonamento, autorizzazione e validità della connessione ricontrollati all'esecuzione del job.
- Disconnessione annulla i job non avviati; un invio già in corso potrebbe completarsi e va riconciliato, senza prometterne l'annullamento remoto.

## 11. Piani, quote e ciclo commerciale

Separare il progetto connettori dal progetto pagamenti: il pilota può usare account Pro abilitati dall'amministratore, senza attendere il checkout completo.

Necessario già nel pilota:

- Limite 1 sito Base / 3 Pro nel backend, verificato anche con richieste concorrenti.
- Quote condivise per account e contabilità per sito; prenotazione atomica prima di operazioni a costo.
- Nessun nuovo costo AI per ritentare l'invio di una versione già generata.
- Costi misurati per acquisizioni, AI, media e assistenza; eventuale budget massimo delle prove.

Prima dell'apertura commerciale autonoma:

- Definizione di prezzi e quote sostenibili; piano annuale pagato anticipatamente ma quote rinnovate mensilmente, salvo scelta esplicita diversa.
- Provider di pagamento da scegliere; checkout, webhook verificati/idempotenti, promemoria e gestione pagamenti falliti.
- Stati abbonamento: prova, attivo, pagamento da recuperare, sospeso, cessato.
- Registrazione e recupero accesso pronti per utenti autonomi; regole antiabuso della prova.
- Downgrade Pro → Base: scelta del sito ospitato da conservare e sospensione degli altri; nessuna cancellazione automatica di siti remoti.
- A fine abbonamento, stop invii e revoca credenziali secondo procedura. Articoli e media già sul CMS restano disponibili.
- Sospensione/cancellazione dei dati ospitati solo con politica esplicita e approvata, avvisi e finestra di recupero. I 15 giorni discussi sono un'ipotesi, non una regola già autorizzata.

## 12. Fasi e criteri di completamento

| Fase | Risultato | Criterio per proseguire |
|---|---|---|
| 0 — Specifica e prove API | Decisioni prodotto, sito WordPress di test, prova Wix, inventario dati | Una bozza con immagine creata e ritrovata per ciascun provider; vincoli documentati |
| 1 — Più siti e regole Pro | Migrazione, contesto sito, selettore, quote | Dati legacy conservati; tre siti isolati; quarto sito bloccato anche via API |
| 2 — Motore consegne | Versioni, coda, worker e adattatore simulato | Concorrenza, interruzioni e retry non producono invii duplicati nel protocollo verificato |
| 3 — WordPress | Plugin, collegamento e interfaccia | Bozza con media e pubblicazione esplicita; revoca e timeout gestiti su installazioni pilota |
| 4 — Pilota | Piccolo gruppo di utenti assistiti | Costi misurati; nessuna perdita/incrocio di dati nei test; problemi critici risolti |
| 5 — Wix | Adattatore e autorizzazione | Conversione, autore, media, revoca ed esiti incerti verificati su siti reali di test |
| 6 — Vendita autonoma | Checkout, prova, rinnovo e assistenza | Percorsi di attivazione, disdetta, mancato pagamento e downgrade collaudati |

Fasi 0 → 1 → 2 → 3 → 4 costituiscono il primo obiettivo distribuibile. La fase commerciale può essere sviluppata dopo la definizione delle regole senza bloccare il pilota. Wix non deve ritardare il collaudo WordPress.

Non assegnare una data di lancio prima dell'inventario delle query per utente e delle prove dei provider. La migrazione a più siti è il rischio di lavoro maggiore; stimare ogni fase dopo la fase 0 con responsabile, giorni/persona e margine per incompatibilità.

## 13. Verifiche necessarie

- Migrazione su copia dati: conteggi, righe orfane, unicità e URL precedenti.
- Isolamento: contenuti, fonti, profili AI, media, statistiche e job non attraversano siti/utenti.
- Due invii simultanei, timeout dopo creazione remota, arresto worker e ripresa.
- Trasferimento media parzialmente riuscito senza duplicazione incontrollata degli allegati.
- Revoca credenziale, abbonamento sospeso e downgrade con job in coda.
- Modifica nel CMS dopo consegna: nessuna sovrascrittura al retry.
- Payload malevolo, destinazioni private e redirect: richieste bloccate.
- Percorso reale contenuto → revisione → bozza CMS → pubblicazione → URL verificato.
- Regressione siti ospitati, test PHP pertinenti già presenti, nuovi test mirati e build Vite.
- Metriche di pilota: tempo al primo invio, consegne riuscite, errori per provider, costo per account e richieste di assistenza.

## 14. Organizzazione indicativa del codice

- `api/services/site_context.php`: risoluzione e autorizzazione sito.
- `api/services/plan_policy.php`: limiti e funzionalità dei piani.
- `api/services/publication/`: contenuto comune, adattatori, coda e riconciliazione.
- `api/routes/`: endpoint dedicati, registrati dopo i controlli di autenticazione corretti.
- `cron/publish.php`: worker consegne, distinto dall'acquisizione social.
- `integrations/wordpress/allsocialtoweb/`: plugin e confezionamento ZIP separato dalla release del sito.
- `frontend/src/components/`: selettore siti, collegamenti e stato consegne.
- `db/migration_*`: migrazioni versionate e ripetibili.
- `tools/`: test mirati per migrazione, permessi e protocollo.

Nomi indicativi, da adattare in implementazione. Evitare di aggiungere tutto al già ampio `api/index.php`.

## 15. Rilascio e limiti operativi

Funzioni inizialmente disabilitate e attivate per singolo account pilota. Limitare separatamente WordPress, Wix e pubblicazione remota.

Il piano non esegue migrazioni, invii a CMS, pagamenti o deploy. Il rilascio futuro segue esclusivamente AGENTS.md: quando richiesto con `deployvps`, commit su main con `[deployvps]`, sincronizzazione, push e verifica GitHub Actions/FTP-FTPS. Nessuna sostituzione con Docker o SSH.

La distribuzione del plugin ai tester va pianificata separatamente: installazione volontaria di ZIP versionato; marketplace pubblico e aggiornamenti automatici sono un progetto successivo.

## 16. Decisioni da prendere prima di iniziare

1. Confermare connettori solo nel Pro e una destinazione primaria per ciascuno dei tre siti.
2. Confermare WordPress come primo rilascio e Wix come secondo.
3. Scegliere come far provare il connettore a chi non ha ancora acquistato Pro.
4. Approvare il primo perimetro: bozza, immagine, categoria e pubblicazione esplicita; modifiche successive nel CMS.
5. Stabilire quote con misurazioni, poi prezzi definitivi e politica di scadenza.
6. Identificare installazioni e account di test autorizzati per entrambi i provider.

## 17. Riferimenti ufficiali verificati

- WordPress, articoli REST: https://developer.wordpress.org/rest-api/reference/posts/
- WordPress, autenticazione REST: https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- Wix, creazione bozze: https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/create-draft-post
- Wix, pubblicazione bozze: https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/publish-draft-post
- Webflow, ciclo di pubblicazione CMS (estensione futura): https://developers.webflow.com/data/docs/working-with-the-cms/publishing

Le API confermano la fattibilità delle operazioni di base, non una compatibilità già collaudata del nostro prodotto. Autorizzazione, distribuzione dell'app, formati, limiti e comportamento nei guasti devono essere verificati nella fase 0.
