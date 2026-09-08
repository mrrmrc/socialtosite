import React, { useCallback, useEffect, useMemo, useState } from 'react';

const API = '/api/index.php?action=';
const PLATFORM = {
  website: { label: 'Sito web', mark: 'WWW' },
  youtube: { label: 'YouTube', mark: 'YT' },
  instagram: { label: 'Instagram', mark: 'IG' },
  facebook: { label: 'Facebook', mark: 'FB' },
  tiktok: { label: 'TikTok', mark: 'TK' },
  x: { label: 'X', mark: 'X' },
};
const STEPS = [
  ['queued', 'In coda'], ['connecting', 'Connessione'], ['discovering', 'Ricerca'],
  ['importing', 'Importazione'], ['completed', 'Completata'],
];

async function request(action, token, options = {}) {
  const response = await fetch(`${API}${action}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Errore server (${response.status})`);
  return data;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await request('login', null, { method: 'POST', body: JSON.stringify({ email, password }) });
      onLogin(data.token, data.user);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-copy">
      <div className="brand"><span className="brand-dot" /> LinkSeoWeb</div>
      <p className="eyebrow">CONTENT IMPORT / 01</p>
      <h1>Un solo posto per tutti i tuoi contenuti.</h1>
      <p className="lead">Collega un profilo, un canale YouTube o un sito. Noi importiamo il materiale originale nel database, senza modificarlo.</p>
      <div className="platform-row">{['YT', 'IG', 'FB', 'TK', 'X', 'WWW'].map(x => <span key={x}>{x}</span>)}</div>
    </section>
    <section className="login-panel">
      <form className="auth-card" onSubmit={submit}>
        <p className="kicker">Area riservata</p><h2>Accedi al raccoglitore</h2>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <div className="notice error">{error}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Accesso…' : 'Entra'}</button>
      </form>
    </section>
  </main>;
}

function Progress({ run }) {
  if (!run) return <div className="empty-process"><span>◎</span><p>Nessuna acquisizione avviata.</p><small>Collega una sorgente e premi “Acquisisci”.</small></div>;
  const current = run.phase === 'failed' ? -1 : STEPS.findIndex(([key]) => key === run.phase);
  return <div className="process-card">
    <div className="process-head"><div><p className="kicker">Ultima acquisizione</p><h3>{run.source_label}</h3></div><span className={`status ${run.status}`}>{run.status}</span></div>
    <div className="timeline">{STEPS.map(([key, label], index) => <div className={`step ${index <= current ? 'done' : ''} ${index === current ? 'active' : ''}`} key={key}><i /> <span>{label}</span></div>)}</div>
    <p className="run-message">{run.error_message || run.message}</p>
    <div className="metrics"><span><strong>{run.found_count || 0}</strong> trovati</span><span><strong>{run.imported_count || 0}</strong> importati</span><span><strong>{run.duplicate_count || 0}</strong> già presenti</span></div>
  </div>;
}

function Dashboard({ token, user, onLogout }) {
  const [data, setData] = useState({ sources: [], contents: [], latest_run: null });
  const [url, setUrl] = useState(''); const [label, setLabel] = useState('');
  const [run, setRun] = useState(null); const [busySource, setBusySource] = useState(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const next = await request('dashboard', token); setData(next); setRun(old => old || next.latest_run);
  }, [token]);
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [load]);

  useEffect(() => {
    if (!run?.id || !['queued', 'running'].includes(run.status)) return undefined;
    const poll = setInterval(async () => {
      try {
        const next = (await request(`import-status&run_id=${run.id}`, token)).run; setRun(next);
        if (['completed', 'failed'].includes(next.status)) { clearInterval(poll); await load(); setBusySource(null); }
      } catch (e) { setError(e.message); clearInterval(poll); setBusySource(null); }
    }, 800);
    return () => clearInterval(poll);
  }, [run?.id, run?.status, token, load]);

  async function addSource(event) {
    event.preventDefault(); setError('');
    try { await request('sources', token, { method: 'POST', body: JSON.stringify({ url, label }) }); setUrl(''); setLabel(''); await load(); }
    catch (e) { setError(e.message); }
  }
  async function importSource(source) {
    setError(''); setBusySource(source.id);
    try {
      const created = (await request('import-start', token, { method: 'POST', body: JSON.stringify({ source_id: source.id }) })).run;
      setRun(created);
      request('import-execute', token, { method: 'POST', body: JSON.stringify({ run_id: created.id, limit: 20 }) }).catch(e => setError(e.message));
    } catch (e) { setError(e.message); setBusySource(null); }
  }
  const total = useMemo(() => data.sources.reduce((sum, item) => sum + Number(item.content_count || 0), 0), [data.sources]);
  if (loading) return <div className="loading">Caricamento archivio…</div>;
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-dot" /> LinkSeoWeb <em>Import</em></div><div className="user"><span>{user.name || user.email}</span><button onClick={onLogout}>Esci</button></div></header>
    <main className="workspace">
      <section className="hero"><div><p className="eyebrow">RACCOGLITORE CONTENUTI</p><h1>Collega. Acquisisci.<br />Conserva l’originale.</h1></div><div className="hero-stat"><strong>{total}</strong><span>contenuti grezzi<br />nel database</span></div></section>
      {error && <div className="notice error">{error}</div>}
      <div className="grid-main">
        <section className="panel connect-panel"><div className="section-title"><span>01</span><div><h2>Collega una sorgente</h2><p>Incolla il link pubblico di un profilo, canale o sito.</p></div></div>
          <form className="source-form" onSubmit={addSource}><label>URL della sorgente<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/@canale" required /></label><label>Nome <small>opzionale</small><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Il mio canale" /></label><button className="primary">Collega sorgente <b>→</b></button></form>
          <p className="support">Supportati: siti web, YouTube, Instagram, Facebook, TikTok e X.</p>
        </section>
        <section className="panel"><div className="section-title"><span>02</span><div><h2>Processo di acquisizione</h2><p>Ogni passaggio è visibile. Nessuna elaborazione AI.</p></div></div><Progress run={run} /></section>
      </div>
      <section className="sources-section"><div className="section-title"><span>03</span><div><h2>Le tue sorgenti</h2><p>{data.sources.length} collegamenti attivi</p></div></div>
        <div className="source-list">{data.sources.length === 0 ? <div className="empty-wide">Le sorgenti collegate appariranno qui.</div> : data.sources.map(source => { const meta = PLATFORM[source.platform] || PLATFORM.website; return <article className="source-card" key={source.id}><div className={`platform-icon ${source.platform}`}>{meta.mark}</div><div className="source-info"><strong>{source.label}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a><small>{source.content_count || 0} contenuti · {source.last_message || 'Pronta per la prima acquisizione'}</small></div><span className={`dot ${source.status}`} /><button onClick={() => importSource(source)} disabled={busySource !== null}>{busySource === source.id ? 'Acquisizione…' : 'Acquisisci'}</button></article>; })}</div>
      </section>
      <section className="archive"><div className="archive-head"><div className="section-title"><span>04</span><div><h2>Archivio grezzo</h2><p>Ultimi 100 contenuti importati, senza trasformazioni.</p></div></div><span className="database-pill">● DATABASE LIVE</span></div>
        {data.contents.length === 0 ? <div className="empty-wide">Nessun contenuto importato.</div> : <div className="content-table"><div className="table-row table-head"><span>Sorgente</span><span>Contenuto originale</span><span>Data</span><span>Link</span></div>{data.contents.map(item => <div className="table-row" key={item.id}><span><b>{PLATFORM[item.platform]?.mark || 'WWW'}</b>{item.source_label}</span><span><strong>{item.title || 'Contenuto senza titolo'}</strong><small>{item.body_text || 'Payload acquisito'}</small></span><span>{new Date(item.published_at || item.imported_at).toLocaleDateString('it-IT')}</span><span><a className="open-link" href={item.source_url} target="_blank" rel="noreferrer">Apri ↗</a></span></div>)}</div>}
      </section>
    </main>
    <footer>LinkSeoWeb Content Import <span>•</span> Acquisizione diretta <span>•</span> Nessuna elaborazione</footer>
  </div>;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lsw_token'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('lsw_user') || 'null'));
  function login(nextToken, nextUser) { localStorage.setItem('lsw_token', nextToken); localStorage.setItem('lsw_user', JSON.stringify(nextUser)); setToken(nextToken); setUser(nextUser); }
  function logout() { localStorage.removeItem('lsw_token'); localStorage.removeItem('lsw_user'); setToken(null); setUser(null); }
  return token && user ? <Dashboard token={token} user={user} onLogout={logout} /> : <Login onLogin={login} />;
}
