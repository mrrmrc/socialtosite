import React, { useState } from 'react';
import { LiaAvatar } from './LiaAvatar';
import { homeSuggestion, homeCounts } from '../utils/guidedHome.mjs';
import './GuidedHome.css';
import { OpportunityWorkspace } from './OpportunityWorkspace';

export function GuidedHome({ data, error, loading, knowledge, syncing, strategy, onNavigate, onRetry, onAcquire, siteUrl, onEditSite, token, onCreateWeb, onCreateSocial, onOpenPost }) {
  const [skipped, setSkipped] = useState(false);
  const suggestion = homeSuggestion({ data, error, loading, knowledge, syncing, strategy, skipped });
  const counts = homeCounts(data?.posts || []);
  function follow() {
    if (suggestion.target === 'retry') return onRetry();
    if (suggestion.target === 'acquire') return onAcquire();
    onNavigate(suggestion.target);
  }
  return <div className="guided-home">
    <header className="guided-home-heading"><span>{data?.site?.title || 'Il tuo spazio'}</span><h1>Il valore di ciò che fai, più facile da trovare.</h1><p>LIA comprende la tua attività. IDEA prepara i contenuti per il web e i social.</p></header>
    {data && !error && Array.isArray(data.opportunities) && <OpportunityWorkspace data={data} token={token} onNavigate={onNavigate} onRefresh={onRetry} onCreateWeb={onCreateWeb} onCreateSocial={onCreateSocial} onOpenPost={onOpenPost} />}
    <section className="guided-home-next" aria-labelledby="guided-home-next-title" aria-busy={loading || syncing}>
      <div className="guided-home-assistant"><LiaAvatar size={56} knowledge={knowledge} thinking={loading || syncing} /><div><strong>LIA</strong><span>Il tuo prossimo passo</span></div></div>
      <div aria-live="polite"><h2 id="guided-home-next-title">{suggestion.title}</h2><p>{suggestion.message}</p></div>
      <div className="guided-home-actions"><button type="button" className="btn btn-primary" disabled={suggestion.disabled} onClick={follow}>{suggestion.label}</button>{suggestion.skippable && <button type="button" className="btn btn-ghost" onClick={() => setSkipped(true)}>Lo faccio più tardi</button>}</div>
      <small>{suggestion.note || 'Puoi rivedere ogni proposta prima di pubblicare.'}</small>
    </section>
    {data && !error && <>
      <nav className="guided-home-shortcuts" aria-label="Il tuo lavoro">
        <button type="button" onClick={() => onNavigate('site')}><span aria-hidden="true">≡</span><div><strong>I miei contenuti</strong><p>{counts.ready ? `${counts.ready} ${counts.ready === 1 ? 'bozza da rivedere' : 'bozze da rivedere'}` : 'Ritrova bozze e articoli pubblicati.'}</p></div><span aria-hidden="true">→</span></button>
        <button type="button" onClick={onEditSite}><span aria-hidden="true">▣</span><div><strong>Il mio sito</strong><p>Rivedi testi, immagini e aspetto.</p></div><span aria-hidden="true">→</span></button>
      </nav>
      <details className="guided-home-details"><summary>Dettagli e impostazioni del progetto</summary>
        <dl><div><dt>Social collegati</dt><dd>{data.sources?.length || 0}</dd></div><div><dt>Contenuti raccolti</dt><dd>{data.posts?.length || 0}</dd></div><div><dt>Articoli pubblicati</dt><dd>{counts.published}</dd></div></dl>
        <div className="guided-home-settings"><button type="button" onClick={() => onNavigate('profile')}>Il mio profilo e intervista</button><button type="button" onClick={() => onNavigate('sources')}>Gestisci i social</button><button type="button" onClick={() => onNavigate('seo')}>Visite e visibilità</button><a href={siteUrl} target="_blank" rel="noopener noreferrer">Apri il sito pubblico ↗</a></div>
      </details>
    </>}
  </div>;
}
