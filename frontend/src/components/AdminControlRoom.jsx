import React, { useEffect, useState } from 'react';
import './AdminControlRoom.css';

function parsed(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
}
function readable(value) {
  if (!value) return 'Non ancora disponibile';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
function dateLabel(value) {
  if (!value) return 'Mai eseguita';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

export function AdminControlRoom({ users, selectedId, onSelect, room, loading, loadError, prompts, currentUserId, busy, onRefresh, onRun, onImpersonate, onNoindex, onOpenAgents, onOpenQueue }) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('situation');
  useEffect(() => setSection('situation'), [selectedId]);
  const filtered = users.filter(user => [user.name, user.email, user.slug].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));
  const user = room?.user;
  const ready = user && String(user.id) === String(selectedId) && !loading && !loadError;
  const settings = parsed(user?.editorial_settings);
  const stats = room?.stats || {};
  const required = Math.max(3, Number(settings.min_posts) || 8);
  const eligible = Number(stats.eligible_posts ?? 0);
  const canRun = ready && settings.enabled !== false && settings.enabled !== 0 && Math.min(eligible, 60) >= required;
  const prompt = prompts.find(item => item.agent_name === user?.harmonize_agent);
  const sources = room?.sources || [];
  const state = parsed(user?.editorial_engine_state);
  let diagnosis = { title: 'Pronto per l’analisi', text: 'I contenuti disponibili sono sufficienti per aggiornare l’analisi editoriale.', tone: 'ready' };
  if (settings.enabled === false || settings.enabled === 0) diagnosis = { title: 'Analisi disattivata', text: 'Il motore editoriale è disattivato nelle impostazioni di questo cliente.', tone: 'warning' };
  else if (Math.min(eligible, 60) < required) diagnosis = { title: 'Servono altri contenuti', text: `${eligible} articoli elaborati e pubblicati disponibili; ne servono almeno ${required}.`, tone: 'warning' };
  else if (Number(stats.failed_posts) > 0) diagnosis = { title: 'Elaborazioni da controllare', text: `${stats.failed_posts} contenuti hanno un’elaborazione non riuscita. Controlla la coda prima di proseguire.`, tone: 'warning' };
  else if (user?.editorial_last_run) diagnosis = { title: 'Analisi già eseguita', text: state.reason || 'Puoi consultare i risultati o avviare una nuova analisi dei contenuti.', tone: 'ready' };

  return <div className="control-room">
    <header className="cr-heading"><div><h2>Control Room</h2><p>Scegli un cliente, controlla la situazione e intervieni dove serve.</p></div></header>
    <div className="cr-workspace">
      <aside className="cr-clients" aria-label="Seleziona cliente">
        <div className="cr-clients-heading"><strong>Clienti</strong><span>{users.length}</span></div>
        <label className="cr-search"><span>Cerca cliente</span><input type="search" placeholder="Nome, email o indirizzo…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <div className="cr-client-list">{filtered.map(item => <button type="button" key={item.id} aria-pressed={String(item.id) === String(selectedId)} onClick={() => onSelect(String(item.id))} className={String(item.id) === String(selectedId) ? 'is-selected' : ''}>
          <strong>{item.name || item.email}</strong><span>{item.email}</span><small>{item.plan === 'professional' || item.plan === 'pro' ? 'Pro' : item.plan === 'agency' ? 'Agency' : 'Base'} · {Number(item.sources_count ?? item.sources?.length ?? 0)} fonti · {Number(item.posts_count || 0)} pubblicati</small>
        </button>)}</div>
        {!filtered.length && <p className="cr-empty">{users.length ? 'Nessun cliente corrisponde alla ricerca.' : 'Nessun cliente disponibile.'}</p>}
      </aside>
      <section className="cr-detail" aria-busy={loading} aria-label="Dettaglio cliente">
        {loading ? <div className="cr-empty" role="status">Caricamento del cliente…</div> : loadError ? <div className="cr-empty" role="alert"><h3>Impossibile caricare il cliente</h3><p>{loadError}</p><button className="btn btn-outline" onClick={onRefresh}>Riprova</button></div> : !ready ? <div className="cr-empty">Seleziona un cliente per iniziare.</div> : <>
          <header className="cr-customer-header"><div><span className="cr-eyebrow">Cliente selezionato</span><h3>{user.name || user.email}</h3><p>{user.site_title || user.email}</p></div><div className="cr-header-actions"><button className="btn btn-outline" disabled={Boolean(busy)} onClick={onRefresh}>Aggiorna</button><button className="btn btn-outline" disabled={Boolean(busy) || Number(user.id) === Number(currentUserId)} onClick={() => onImpersonate(user.id)}>Apri area cliente</button></div></header>
          <nav className="cr-sections" aria-label="Sezioni del cliente">{[['situation','Situazione'],['contents','Contenuti'],['configuration','Configurazione AI']].map(([id, label]) => <button key={id} aria-current={section === id ? 'page' : undefined} className={section === id ? 'is-active' : ''} onClick={() => setSection(id)}>{label}</button>)}</nav>
          {section === 'situation' && <div className="cr-body">
            <section className={`cr-diagnosis ${diagnosis.tone}`}><div><span className="cr-eyebrow">Prossimo passo</span><h4>{diagnosis.title}</h4><p>{diagnosis.text}</p><small>Ultima analisi: {dateLabel(user.editorial_last_run)}</small></div><div className="cr-next-actions">{Number(stats.failed_posts) > 0 && <button className="btn btn-outline" onClick={onOpenQueue}>Controlla la coda</button>}<button className="btn btn-primary" disabled={!canRun || Boolean(busy)} onClick={onRun}>{busy === 'editorial-run' ? 'Analisi in corso…' : 'Esegui analisi editoriale'}</button><small>L’analisi usa l’AI. Non pubblica nuovi articoli.</small></div></section>
            <div className="cr-metrics"><div><strong>{sources.length}</strong><span>Fonti attive</span></div><div><strong>{stats.published_posts ?? '—'}</strong><button onClick={() => setSection('contents')}>Articoli pubblicati →</button></div><div><strong>{stats.pending_posts ?? '—'}</strong><span>In elaborazione / attesa</span></div><div><strong>{stats.failed_posts ?? '—'}</strong><span>Elaborazioni fallite</span></div></div>
            <section className="cr-block"><div className="cr-block-heading"><h4>Fonti collegate</h4><span>{sources.length}</span></div>{sources.length ? <ul className="cr-source-list">{sources.map(source => <li key={source.id}><div><strong>{source.label || source.platform}</strong><span>{source.platform}{source.topic_summary ? ` · ${source.topic_summary}` : ''}</span></div>{/^https?:\/\//i.test(source.url || '') && <a href={source.url} target="_blank" rel="noopener noreferrer">Apri fonte ↗</a>}</li>)}</ul> : <p className="cr-empty">Nessuna fonte collegata. Apri l’area cliente per aggiungerne una.</p>}</section>
          </div>}
          {section === 'contents' && <div className="cr-body"><div className="cr-block-heading"><div><h4>Articoli pubblicati di recente</h4><p>Ultimi {room.posts?.length || 0} di {stats.published_posts ?? '—'}. “Indicizzabile” non significa già presente su Google.</p></div></div>{room.posts?.length ? <div className="cr-posts">{room.posts.map(post => <article key={post.id}><div><span className="cr-eyebrow">{dateLabel(post.published_at)}</span><h4>{post.edited_title || post.generated_title || 'Senza titolo'}</h4><p>{post.generated_excerpt || 'Nessuna descrizione disponibile.'}</p><small>SEO: {post.seo_score ?? '—'} · #{post.id}</small></div><button className="btn btn-outline" disabled={Boolean(busy)} onClick={() => onNoindex(post)} aria-label={`${Number(post.noindex) === 1 ? 'Consenti' : 'Escludi'} indicizzazione: ${post.edited_title || post.generated_title || post.id}`}>{busy === `noindex-${post.id}` ? 'Salvataggio…' : Number(post.noindex) === 1 ? 'Consenti indicizzazione' : 'Escludi da Google'}</button></article>)}</div> : <p className="cr-empty">Questo cliente non ha ancora articoli pubblicati.</p>}</div>}
          {section === 'configuration' && <div className="cr-body">
            <section className="cr-block"><div className="cr-block-heading"><div><h4>Profilo editoriale</h4><p>Le informazioni usate per scrivere per questo cliente.</p></div></div><dl className="cr-profile">{[['Profilo',user.profile_summary],['Obiettivo',user.role_mission],['Strategia',user.content_strategy],['Tono di voce',user.brand_voice_profile]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{readable(value)}</dd></div>)}</dl></section>
            <section className="cr-block"><div className="cr-block-heading"><div><h4>Agente assegnato</h4><p>{prompt?.label || user.harmonize_agent || 'content_editor'}</p></div><button className="btn btn-outline" onClick={onOpenAgents}>Gestisci agenti</button></div><p className="cr-muted">Le istruzioni degli agenti sono condivise. Modificarle può influire anche su altri clienti.</p><details><summary>Leggi le istruzioni attive</summary><pre>{prompt?.instructions || 'Istruzioni personalizzate non disponibili in questa vista.'}</pre></details></section>
            <details className="cr-technical"><summary>Dati tecnici e diagnostica</summary><p>Valori salvati dal sistema per questo cliente.</p>{[['Comprensione del profilo',user.site_understanding],['DNA editoriale',user.editorial_dna],['Memoria editoriale',user.editorial_memory],['Impostazioni',user.editorial_settings],['Stato motore',user.editorial_engine_state],['Design AI',user.site_ai_data]].map(([label,value]) => <details key={label}><summary>{label}</summary><pre>{value ? JSON.stringify(parsed(value), null, 2) : 'Nessun dato disponibile'}</pre></details>)}</details>
          </div>}
        </>}
      </section>
    </div>
  </div>;
}
