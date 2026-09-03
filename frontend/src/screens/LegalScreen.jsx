import React from 'react';
import { Link } from 'react-router-dom';

const UPDATED_AT = '28 agosto 2026';

const privacySections = [
  ['1. Chi gestisce il servizio', <p key="operator">SocialToSite, prodotto LinkSeoWeb, gestisce la piattaforma. Per richieste sulla privacy puoi scrivere a <a href="mailto:support@ideesitiweb.it">support@ideesitiweb.it</a>.</p>],
  ['2. Dati trattati', <ul key="data"><li>Dati di registrazione e accesso, come nome, indirizzo e-mail e informazioni necessarie a proteggere l’account.</li><li>Dati dei canali collegati con il tuo consenso: identificativi del profilo, pagine Facebook, account Instagram professionali, profili e video TikTok, canali e video YouTube e relativi contenuti pubblici o autorizzati.</li><li>URL e contenuti dei siti web indicati dall’utente.</li><li>Bozze editoriali, preferenze, configurazioni e contenuti generati nella piattaforma.</li><li>Dati tecnici e log essenziali per sicurezza, diagnosi degli errori e funzionamento del servizio.</li></ul>],
  ['3. Perché utilizziamo i dati', <p key="purposes">Usiamo i dati per autenticare l’utente, collegare i canali richiesti, importare i contenuti autorizzati, generare bozze editoriali, pubblicare solo quando richiesto, offrire assistenza, prevenire abusi e mantenere sicuro il servizio.</p>],
  ['4. Base del trattamento', <p key="basis">Il trattamento è necessario per erogare il servizio richiesto. I contenuti social vengono letti soltanto da URL pubblici indicati dall’utente, senza accesso all’account social, cookie di sessione o token personali. Alcuni dati tecnici sono trattati per il legittimo interesse alla sicurezza e all’affidabilità della piattaforma.</p>],
  ['5. Servizi esterni', <p key="providers">Per le funzioni richieste possiamo utilizzare fornitori di hosting, database, intelligenza artificiale e Refetch(er) per acquisire contenuti social pubblici. Ogni fornitore tratta i dati secondo i propri termini e la propria informativa. Non vendiamo i dati personali.</p>],
  ['6. Conservazione e sicurezza', <p key="retention">Conserviamo i dati per il tempo necessario a fornire il servizio, rispettare obblighi applicabili e gestire contestazioni o sicurezza. I token di collegamento sono protetti e vengono eliminati o resi inutilizzabili quando il canale viene disconnesso o l’autorizzazione viene revocata, salvo obblighi tecnici o di legge.</p>],
  ['7. Diritti dell’utente', <p key="rights">Puoi chiedere accesso, rettifica, cancellazione, limitazione, opposizione o portabilità nei casi previsti dalla normativa applicabile. Puoi inoltre revocare i collegamenti social in qualsiasi momento. Per esercitare i tuoi diritti scrivi a <a href="mailto:support@ideesitiweb.it">support@ideesitiweb.it</a>.</p>],
  ['8. Aggiornamenti', <p key="changes">Questa informativa può essere aggiornata per riflettere modifiche del servizio o delle norme. La data riportata in alto indica l’ultima revisione.</p>],
];

const termsSections = [
  ['1. Il servizio', <p key="service">SocialToSite consente di collegare canali social e siti web autorizzati, importare contenuti e creare bozze editoriali destinate al sito associato al cliente. Funzioni e limiti possono dipendere dal piano scelto e dalle API dei fornitori.</p>],
  ['2. Account e autorizzazioni', <p key="account">Devi fornire informazioni corrette, custodire le credenziali e collegare soltanto account, pagine, canali e siti che possiedi o che sei autorizzato a gestire. Resti responsabile delle attività svolte dal tuo account.</p>],
  ['3. Contenuti dell’utente', <p key="content">Mantieni la titolarità dei tuoi contenuti. Concedi a SocialToSite solo i permessi tecnici necessari a importarli, elaborarli e pubblicarli secondo le azioni che richiedi. Devi assicurarti di avere i diritti necessari su testi, immagini, video, marchi e altri materiali.</p>],
  ['4. Contenuti generati con IA', <p key="ai">Le bozze generate automaticamente sono suggerimenti editoriali. Prima della pubblicazione devi verificarne accuratezza, liceità, tono, diritti e adeguatezza. Il servizio non sostituisce una revisione professionale o legale.</p>],
  ['5. Uso consentito', <p key="acceptable">Non puoi usare il servizio per violare leggi o diritti altrui, accedere a contenuti senza autorizzazione, diffondere materiale illecito o ingannevole, inviare spam, aggirare limiti tecnici, compromettere la sicurezza o interferire con il funzionamento della piattaforma.</p>],
  ['6. Piattaforme di terze parti', <p key="third">Facebook, Instagram, TikTok, YouTube, X, WordPress, Refetch(er) e gli altri servizi esterni sono indipendenti. Le loro condizioni, disponibilità e limitazioni possono cambiare o interrompere alcune funzioni.</p>],
  ['7. Disponibilità e responsabilità', <p key="liability">Ci impegniamo a mantenere il servizio affidabile, ma non garantiamo assenza assoluta di interruzioni o errori. Nei limiti consentiti dalla legge, SocialToSite non risponde di modifiche o indisponibilità di servizi terzi, né di contenuti pubblicati senza adeguata revisione dell’utente.</p>],
  ['8. Sospensione e chiusura', <p key="termination">Puoi disconnettere i canali in qualsiasi momento. Possiamo limitare o sospendere l’accesso in caso di uso illecito, rischi di sicurezza o violazione sostanziale di questi termini, informandoti quando ragionevolmente possibile.</p>],
  ['9. Modifiche e contatti', <p key="contact">I termini possono essere aggiornati quando cambiano il servizio o le regole applicabili. Per chiarimenti scrivi a <a href="mailto:support@ideesitiweb.it">support@ideesitiweb.it</a>.</p>],
];

export function LegalScreen({ type }) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Informativa sulla privacy' : 'Termini di servizio';
  const sections = isPrivacy ? privacySections : termsSections;

  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand" aria-label="Torna a SocialToSite">
          <img src="/logo-cropped.png?v=2" alt="LinkSeoWeb" />
          <span><strong>SocialToSite</strong><small>by LinkSeoWeb</small></span>
        </Link>
        <Link to="/login" className="btn btn-outline">Accedi</Link>
      </header>

      <article className="legal-document">
        <p className="legal-kicker">Trasparenza e controllo</p>
        <h1>{title}</h1>
        <p className="legal-updated">Ultimo aggiornamento: {UPDATED_AT}</p>
        <p className="legal-intro">
          {isPrivacy
            ? 'Questa informativa spiega quali dati utilizziamo quando colleghi i tuoi canali e come puoi mantenerne il controllo.'
            : 'Questi termini descrivono le regole essenziali per utilizzare SocialToSite in modo corretto e sicuro.'}
        </p>

        <nav className="legal-switch" aria-label="Documenti legali">
          <Link className={isPrivacy ? 'is-active' : ''} to="/privacy">Privacy</Link>
          <Link className={!isPrivacy ? 'is-active' : ''} to="/terms">Termini</Link>
        </nav>

        <div className="legal-sections">
          {sections.map(([heading, content]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              {content}
            </section>
          ))}
        </div>

        <aside className="legal-note">
          Questo testo descrive il funzionamento attuale della piattaforma. Prima del lancio commerciale è consigliata la revisione di un professionista legale sulla base del titolare effettivo e dei mercati serviti.
        </aside>
      </article>
    </main>
  );
}
