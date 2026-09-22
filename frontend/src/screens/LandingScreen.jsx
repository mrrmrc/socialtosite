import React, { useState } from 'react';

const examples = {
  hospitality: {
    tab: 'Agriturismo', label: 'OSPITALITÀ · UMBRIA', name: 'La Quercia',
    title: 'La campagna,\ncome dovrebbe essere.',
    description: 'Camere tra gli ulivi, cucina della terra e giornate che seguono un ritmo più lento.',
    action: 'Verifica disponibilità', paths: ['Dormire', 'Mangiare', 'Esperienze'],
    stories: ['Una colazione fatta qui', 'Il sentiero degli ulivi'], theme: 'earth',
  },
  legal: {
    tab: 'Studio legale', label: 'DIRITTO D’IMPRESA · MILANO', name: 'Studio Ferri',
    title: 'Chiarezza nelle\ndecisioni importanti.',
    description: 'Competenza legale, ascolto e una direzione concreta per imprese e professionisti.',
    action: 'Richiedi un colloquio', paths: ['Competenze', 'Professionisti', 'Approfondimenti'],
    stories: ['Nuove regole per le imprese', 'Contratti senza zone grigie'], theme: 'ink',
  },
  editorial: {
    tab: 'Blog', label: 'CULTURA DIGITALE · IDEE', name: 'Fuori Margine',
    title: 'Le idee non devono\nsparire nel feed.',
    description: 'Storie, strumenti e punti di vista per capire come cambia il nostro modo di creare.',
    action: 'Esplora gli articoli', paths: ['Storie', 'Strumenti', 'Prospettive'],
    stories: ['La creatività dopo l’algoritmo', 'Costruire un archivio vivo'], theme: 'paper',
  },
};

// Stesso simbolo del brand ovunque nel prodotto (landing pubblica e
// dashboard): prima erano due loghi diversi (un'immagine statica nella
// dashboard, questo marchio disegnato in CSS qui). iconOnly lascia al
// chiamante il testo/sottotitolo, per non dover rifare il markup esistente.
export function BrandMark({ compact = false, iconOnly = false }) {
  const icon = <span className="astw-mark" aria-hidden="true"><i /><i /><i /></span>;
  if (iconOnly) return icon;
  return (
    <span className={`astw-brand${compact ? ' is-compact' : ''}`}>
      {icon}
      <span><strong>All Social</strong><b>To Web</b></span>
    </span>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>;
}

export function LandingScreen({ onGetStarted, isLoggedIn = false }) {
  const [activeExample, setActiveExample] = useState('hospitality');
  const example = examples[activeExample];
  const primaryAction = () => {
    if (isLoggedIn) window.location.href = '/dashboard';
    else if (onGetStarted) onGetStarted();
    else window.location.href = '/accedi';
  };

  return (
    <div className="public-site">
      <header className="public-header">
        <a href="/" className="public-logo" aria-label="All Social To Web, homepage"><BrandMark /></a>
        <nav aria-label="Navigazione principale">
          <a href="#come-funziona">Come funziona</a>
          <a href="#layout-unico">Il formato</a>
          <a href="/scopri">Esplora la rete</a>
        </nav>
        <div className="public-header-actions">
          {!isLoggedIn && <a className="public-login" href="/accedi">Accedi</a>}
          <button className="public-button public-button-dark" onClick={primaryAction}>
            {isLoggedIn ? 'Vai alla dashboard' : 'Crea il tuo spazio'} <ArrowIcon />
          </button>
        </div>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-hero-orbit orbit-one" aria-hidden="true" />
          <div className="public-hero-orbit orbit-two" aria-hidden="true" />
          <div className="public-hero-copy">
            <span className="public-kicker"><i /> Dai social a uno spazio che resta</span>
            <h1>I tuoi contenuti meritano <em>più di 24 ore.</em></h1>
            <p>All Social To Web trasforma post, video e storie in un sito proprietario, organizzato e pronto per essere trovato.</p>
            <div className="public-hero-actions">
              <button className="public-button public-button-coral" onClick={primaryAction}>
                {isLoggedIn ? 'Apri il tuo spazio' : 'Porta i tuoi social sul web'} <ArrowIcon />
              </button>
              <a className="public-text-link" href="#layout-unico">Guarda come cambia <span>↓</span></a>
            </div>
            <div className="public-channel-row" aria-label="Canali supportati">
              <span>Collega</span>
              <b className="channel-instagram">IG</b><b className="channel-tiktok">TT</b><b className="channel-youtube">YT</b><b className="channel-facebook">FB</b><b className="channel-web">WWW</b>
            </div>
          </div>

          <div className="public-flow-demo" aria-label="I contenuti social diventano un sito organizzato">
            <div className="flow-source flow-source-one"><span>IG</span><div><small>NUOVO POST</small><strong>Una storia da raccontare</strong></div></div>
            <div className="flow-source flow-source-two"><span>▶</span><div><small>NUOVO VIDEO</small><strong>Contenuto acquisito</strong></div></div>
            <div className="flow-line" aria-hidden="true"><i /><i /><i /></div>
            <div className="flow-site-card">
              <div className="flow-browser"><i /><i /><i /><span>iltuospazio.it</span></div>
              <div className="flow-site-hero"><small>IL TUO SPAZIO UFFICIALE</small><strong>Quello che fai, finalmente insieme.</strong><span>Esplora i contenuti →</span></div>
              <div className="flow-site-grid"><span /><span /><span /></div>
            </div>
            <div className="flow-status"><i /> Pubblicato e organizzato</div>
          </div>
        </section>

        <section className="public-statement" aria-label="La promessa di All Social To Web">
          <p>I social sono il momento.</p>
          <h2>Il tuo sito è la memoria.</h2>
          <span>Ogni contenuto entra in un sistema ordinato, navigabile e davvero tuo.</span>
        </section>

        <section className="public-process" id="come-funziona">
          <header className="public-section-heading">
            <span className="public-kicker">Un flusso semplice</span>
            <h2>Tu continui a pubblicare.<br />Il tuo spazio continua a crescere.</h2>
          </header>
          <div className="public-process-grid">
            <article><span>01</span><div className="process-icon"><i className="process-nodes" /></div><h3>Collega i canali</h3><p>Indichi i profili e le fonti che raccontano davvero la tua attività.</p></article>
            <article><span>02</span><div className="process-icon"><i className="process-spark" /></div><h3>L’AI dà struttura</h3><p>Comprende argomenti e obiettivi, poi trasforma i contenuti in pagine utili.</p></article>
            <article><span>03</span><div className="process-icon"><i className="process-window" /></div><h3>Il sito prende vita</h3><p>Articoli, percorsi e informazioni diventano uno spazio pubblico sempre aggiornato.</p></article>
          </div>
        </section>

        <section className="public-showcase" id="layout-unico">
          <div className="showcase-copy">
            <span className="public-kicker">Un formato. Infinite identità.</span>
            <h2>La stessa regia.<br />Mai lo stesso carattere.</h2>
            <p>Un’architettura proprietaria, perfezionata per tutti. L’identità dell’attività decide atmosfera, contenuti, percorsi e azione principale.</p>
            <div className="showcase-tabs" role="tablist" aria-label="Esempi di sito">
              {Object.entries(examples).map(([key, item]) => (
                <button key={key} role="tab" aria-selected={activeExample === key} onClick={() => setActiveExample(key)}>
                  <i />{item.tab}<span>→</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`signature-preview theme-${example.theme}`} aria-live="polite">
            <div className="signature-topbar"><strong>{example.name}</strong><div><span>Storia</span><span>Contenuti</span><b>Contatti</b></div></div>
            <div className="signature-visual">
              <div className="signature-landscape" aria-hidden="true"><i /><i /><i /></div>
              <div className="signature-overlay" />
              <div className="signature-content"><small>{example.label}</small><h3>{example.title.split('\n').map((line, i) => <React.Fragment key={line}>{i > 0 && <br />}{line}</React.Fragment>)}</h3><p>{example.description}</p><button>{example.action} <span>→</span></button></div>
            </div>
            <div className="signature-paths">
              <small>DA DOVE VUOI COMINCIARE?</small>
              <div>{example.paths.map((path, index) => <span key={path}><i>0{index + 1}</i>{path}<b>↗</b></span>)}</div>
            </div>
            <div className="signature-stories">{example.stories.map((story, index) => <article key={story}><div className={`story-art story-${index + 1}`} /><small>DALLE STORIE</small><strong>{story}</strong><span>Leggi →</span></article>)}</div>
          </div>
        </section>

        <section className="public-pricing" id="piani">
          <header className="public-section-heading">
            <span className="public-kicker">Scegli la tua dimensione</span>
            <h2>Tre soluzioni per crescere.</h2>
          </header>
          <div className="pricing-grid">
            <article className="pricing-card">
              <h3>Base</h3>
              <p>Sincronizzazione standard da social, senza sforzo.</p>
              <ul>
                <li><span>✓</span> Creazione sito automatica</li>
                <li><span>✓</span> Aggiornamento 1 volta al giorno</li>
                <li><span>✓</span> Template intelligente standard</li>
              </ul>
              <button className="public-button public-button-outline" onClick={primaryAction}>Inizia ora</button>
            </article>
            <article className="pricing-card pricing-card-featured">
              <div className="pricing-badge">Più scelto</div>
              <h3>Professional</h3>
              <p>Per creator e professionisti che esigono il pieno controllo.</p>
              <ul>
                <li><span>✓</span> Aggiornamento prioritario (ogni 2 ore)</li>
                <li><span>✓</span> Control Room editoriale e revisione</li>
                <li><span>✓</span> Tuning AI e tone of voice</li>
              </ul>
              <button className="public-button public-button-coral" onClick={primaryAction}>Scegli Professional</button>
            </article>
            <article className="pricing-card">
              <h3>Agency</h3>
              <p>Per chi gestisce molteplici brand o clienti.</p>
              <ul>
                <li><span>✓</span> Spazi web e brand illimitati</li>
                <li><span>✓</span> Controllo cron e priorità dedicate</li>
                <li><span>✓</span> Supporto premium dedicato</li>
              </ul>
              <button className="public-button public-button-outline" onClick={primaryAction}>Inizia ora</button>
            </article>
          </div>
        </section>

        <section className="public-network-cta">
          <div className="network-rings" aria-hidden="true"><i /><i /><i /></div>
          <span className="public-kicker">Il prossimo spazio può essere il tuo</span>
          <h2>Trasforma ciò che hai già pubblicato in qualcosa che continua a lavorare per te.</h2>
          <div>
            <button className="public-button public-button-light" onClick={primaryAction}>{isLoggedIn ? 'Vai alla dashboard' : 'Crea il tuo spazio'} <ArrowIcon /></button>
            <a href="/scopri">Esplora gli spazi già online</a>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <BrandMark compact />
        <p>Dai social a uno spazio che resta.</p>
        <nav><a href="/scopri">Esplora la rete</a><a href="/privacy">Privacy</a><a href="/terms">Termini</a><a href="/accedi">Accedi</a></nav>
        <small>© {new Date().getFullYear()} All Social To Web</small>
      </footer>
    </div>
  );
}
