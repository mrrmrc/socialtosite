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

export function BrandMark({ compact = false, iconOnly = false }) {
  if (iconOnly) {
    return <img src="/logo-cropped.png" alt="All Social To Web" className="astw-mark-img" />;
  }
  return (
    <span className={`astw-brand${compact ? ' is-compact' : ''}`}>
      <img src="/logo-cropped.png" alt="All Social To Web" className="astw-mark-img" />
      <span className="astw-brand-text"><strong>All Social</strong><b>To Web</b></span>
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
      <header className="public-header glass-header">
        <a href="/" className="public-logo" aria-label="All Social To Web, homepage"><BrandMark /></a>
        <nav aria-label="Navigazione principale">
          <a href="#come-funziona">Funzionamento</a>
          <a href="#layout-unico">Design</a>
          <a href="#piani">Piani</a>
          <a href="/scopri">Esplora</a>
        </nav>
        <div className="public-header-actions">
          {!isLoggedIn && <a className="public-login" href="/accedi">Accedi</a>}
          <button className="public-button public-button-dark" onClick={primaryAction}>
            {isLoggedIn ? 'Dashboard' : 'Inizia ora'} <ArrowIcon />
          </button>
        </div>
      </header>

      <main className="public-main-content">
        {/* COMPACT HERO + FLOW + PROCESS (Bento-style layout) */}
        <section className="public-hero-bento">
          <div className="public-hero-orbit orbit-one" aria-hidden="true" />
          <div className="public-hero-orbit orbit-two" aria-hidden="true" />
          
          <div className="public-hero-copy glass-panel-hero">
            <span className="public-kicker"><i /> Dai social a uno spazio che resta</span>
            <h1>I tuoi contenuti,<br /><em>oltre le 24 ore.</em></h1>
            <p>Trasforma post, video e storie in un sito web proprietario, organizzato dall'AI e sempre aggiornato automaticamente.</p>
            
            <div className="public-hero-actions">
              <button className="public-button public-button-coral" onClick={primaryAction}>
                {isLoggedIn ? 'Apri il tuo spazio' : 'Crea il tuo sito'} <ArrowIcon />
              </button>
              <div className="public-channel-row">
                <span>Da</span>
                <b className="channel-instagram">IG</b><b className="channel-tiktok">TT</b><b className="channel-youtube">YT</b><b className="channel-facebook">FB</b>
              </div>
            </div>
          </div>

          <div className="public-hero-visual glass-panel-hero">
             <div className="flow-site-card">
              <div className="flow-browser"><i /><i /><i /><span>iltuospazio.it</span></div>
              <div className="flow-site-hero"><small>IL TUO SPAZIO UFFICIALE</small><strong>Quello che fai,<br/>organizzato.</strong></div>
              <div className="flow-site-grid"><span /><span /><span /><span /></div>
            </div>
            
            <div className="flow-source flow-source-one float-item"><span>IG</span><div><small>NUOVO POST</small></div></div>
            <div className="flow-source flow-source-two float-item"><span>▶</span><div><small>NUOVO VIDEO</small></div></div>
            <div className="flow-status float-item"><i /> Pubblicato online</div>
          </div>
          
          <div className="public-process-bento" id="come-funziona">
             <article className="glass-panel-feature">
               <div className="process-icon"><i className="process-nodes" /></div>
               <div className="process-text">
                 <h3>1. Collega i canali</h3>
                 <p>Indica i profili social che raccontano la tua attività.</p>
               </div>
             </article>
             <article className="glass-panel-feature">
               <div className="process-icon"><i className="process-spark" /></div>
               <div className="process-text">
                 <h3>2. Struttura AI</h3>
                 <p>L'intelligenza artificiale li trasforma in pagine web utili.</p>
               </div>
             </article>
             <article className="glass-panel-feature">
               <div className="process-icon"><i className="process-window" /></div>
               <div className="process-text">
                 <h3>3. Il sito prende vita</h3>
                 <p>Uno spazio sempre aggiornato senza nessuno sforzo.</p>
               </div>
             </article>
          </div>
        </section>

        {/* SHOWCASE SECTION */}
        <section className="public-showcase-compact" id="layout-unico">
          <div className="showcase-content">
            <div className="showcase-header">
              <span className="public-kicker">Regia unificata. Identità uniche.</span>
              <h2>Lo stesso formato.<br />Mille anime diverse.</h2>
              <div className="showcase-tabs" role="tablist">
                {Object.entries(examples).map(([key, item]) => (
                  <button key={key} role="tab" className={activeExample === key ? 'active' : ''} aria-selected={activeExample === key} onClick={() => setActiveExample(key)}>
                    {item.tab}
                  </button>
                ))}
              </div>
            </div>

            <div className={`signature-preview glass-panel theme-${example.theme}`} aria-live="polite">
              <div className="signature-topbar"><strong>{example.name}</strong><div><span>Storia</span><span>Contenuti</span><b>Contatti</b></div></div>
              <div className="signature-visual">
                <div className="signature-landscape" aria-hidden="true"><i /><i /><i /></div>
                <div className="signature-overlay" />
                <div className="signature-content">
                  <small>{example.label}</small>
                  <h3>{example.title.split('\n').map((line, i) => <React.Fragment key={line}>{i > 0 && <br />}{line}</React.Fragment>)}</h3>
                  <button>{example.action} <span>→</span></button>
                </div>
              </div>
              <div className="signature-bottom">
                <div className="signature-paths">
                  <small>ESPLORA PERCORSI</small>
                  <div>{example.paths.map((path, index) => <span key={path}><i>0{index + 1}</i>{path}</span>)}</div>
                </div>
                <div className="signature-stories">{example.stories.map((story, index) => <article key={story}><div className={`story-art story-${index + 1}`} /><strong>{story}</strong></article>)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPACT PRICING E CTA */}
        <div className="public-bottom-grid">
          <section className="public-pricing-compact" id="piani">
            <header className="public-section-heading">
               <h2>Tre soluzioni per crescere.</h2>
            </header>
            <div className="pricing-grid-compact">
              <article className="pricing-card glass-panel">
                <div className="pricing-head">
                  <h3>Base</h3>
                  <p>Sincronizzazione 1/giorno.</p>
                </div>
                <button className="public-button public-button-outline" onClick={primaryAction}>Inizia</button>
              </article>
              <article className="pricing-card pricing-card-featured glass-panel-featured">
                <div className="pricing-badge">Più scelto</div>
                <div className="pricing-head">
                  <h3>Professional</h3>
                  <p>Control Room editoriale, Tuning AI, aggiornamenti ogni 2h.</p>
                </div>
                <button className="public-button public-button-coral" onClick={primaryAction}>Scegli Pro</button>
              </article>
              <article className="pricing-card glass-panel">
                <div className="pricing-head">
                  <h3>Agency</h3>
                  <p>Spazi e brand illimitati.</p>
                </div>
                <button className="public-button public-button-outline" onClick={primaryAction}>Contattaci</button>
              </article>
            </div>
          </section>

          <section className="public-network-cta glass-panel">
            <div className="network-rings" aria-hidden="true"><i /><i /><i /></div>
            <div className="cta-content">
              <h2>Il tuo spazio web,<br/>automaticamente.</h2>
              <div className="cta-actions">
                <button className="public-button public-button-light" onClick={primaryAction}>{isLoggedIn ? 'Vai alla dashboard' : 'Crea il tuo spazio'} <ArrowIcon /></button>
                <a href="/scopri">Esplora gli spazi già online</a>
              </div>
            </div>
          </section>
        </div>
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
