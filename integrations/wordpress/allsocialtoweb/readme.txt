=== AllSocialToWeb Connector ===
Requires at least: 6.0
Requires PHP: 8.0
Stable tag: 0.2.0
License: GPLv2 or later

Importa come post i contenuti pubblicati nella tua pagina AllSocialToWeb.

== Installazione ==
1. Carica lo ZIP da Plugin > Aggiungi plugin > Carica plugin e attivalo.
2. Apri Impostazioni > AllSocialToWeb e genera il codice di collegamento.
3. Nella tua area personale AllSocialToWeb apri Canali > WordPress.
4. Inserisci indirizzo HTTPS di WordPress e codice, quindi verifica il collegamento.
5. Leggi categorie e tag, abbina gli argomenti e salva la modalità di importazione.
6. Premi Sincronizza WordPress o abilita la sincronizzazione automatica.

== Comportamento ==
Solo i contenuti pubblicati su AllSocialToWeb e già elaborati sono importabili.
Puoi importarli come bozze o come post pubblicati.
Ogni argomento può assegnare una categoria e un tag WordPress già esistenti.
La categoria predefinita si applica ai post senza un abbinamento di categoria.
Gli abbinamenti si applicano alle nuove importazioni.
I post già importati non sono duplicati e le modifiche fatte nel CMS sono conservate.
La rimozione di un contenuto dalla piattaforma non elimina il post WordPress.
Ogni passaggio controlla 20 contenuti; alla fine ricomincia per recuperare anche
articoli meno recenti che vengono pubblicati in un secondo momento.
WP-Cron esegue i passaggi ogni 5 minuti quando il sito riceve visite.
Per una puntualità indipendente dalle visite configura WP-Cron sul tuo hosting.
Disconnettere dalla piattaforma revoca subito l'accesso al feed privato.
Il collegamento richiede HTTPS valido su WordPress e AllSocialToWeb.
Le credenziali non vengono inserite negli URL del feed.

== Privacy ==
Il plugin legge un feed privato dalla piattaforma scelta durante il collegamento.
Condivide categorie, tag e stato di sincronizzazione con l'account che possiede
il codice di collegamento. Nessun altro servizio esterno è necessario.
