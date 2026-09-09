import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './profile.css';

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
  ['importing', 'Importazione'], ['profiling', 'Profilazione'], ['completed', 'Completata'],
];

function periodDate(period, customDate) {
  if (period === 'all') return null;
  if (period === 'custom') return customDate || null;
  const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - Number(period));
  return date.toISOString().slice(0, 10);
}

function previewImage(item) {
  try {
    const images = JSON.parse(item.image_urls || '[]');
    if (Array.isArray(images) && images[0]) return images[0];
  } catch (_) { /* Un vecchio record può non avere JSON immagini. */ }
  return item.media_type === 'image' ? item.media_url : '';
}

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
        <label>Username o email<input type="text" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="username" /></label>
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

function UserProfile({ profile, questions, onAnswer, onRefresh, busy }) {
  const [answers, setAnswers] = useState({});
  if (!profile) return <section className="profile-section"><div className="section-title"><span>04</span><div><h2>Profilo editoriale</h2><p>Analisi dell’identità, dei temi e del pubblico.</p></div></div><div className="profile-empty"><span>✦</span><div><h3>Il profilo non è stato ancora creato</h3><p>Posso analizzare subito i contenuti già presenti nel database.</p></div><button className="primary" onClick={onRefresh} disabled={busy}>{busy ? 'Analisi in corso…' : 'Crea il profilo'}</button></div></section>;
  const openQuestions = (questions || []).filter(item => item.status === 'open');
  const chips = [...(profile.topics || []), ...(profile.audiences || [])].slice(0, 10);
  return <section className="profile-section">
    <div className="profile-head"><div className="section-title"><span>04</span><div><h2>Profilo editoriale</h2><p>Inferito dalle sorgenti e dalle tue risposte, senza modificare i contenuti.</p></div></div><button className="ghost" onClick={onRefresh} disabled={busy}>Rianalizza</button></div>
    {profile.status === 'error' && <div className="notice error">Profilazione non completata: {profile.error_message}</div>}
    {['pending', 'analyzing'].includes(profile.status) ? <div className="profile-empty"><span>✦</span><div><h3>Profilazione in preparazione</h3><p>Avvia l’analisi dei contenuti già acquisiti.</p></div><button className="primary" onClick={onRefresh} disabled={busy}>{busy ? 'Analisi in corso…' : 'Analizza ora'}</button></div> : <div className="profile-grid"><div><p className="kicker">Identità rilevata</p><h3>{profile.display_name || 'Identità da chiarire'}</h3><strong className="activity">{profile.activity_type || 'Attività non ancora definita'}</strong><p>{profile.summary || 'Servono altri contenuti per costruire un profilo affidabile.'}</p><div className="chips">{chips.map((chip, index) => <span key={`${chip}-${index}`}>{chip}</span>)}</div></div><div className="confidence"><strong>{Math.round((profile.confidence || 0) * 100)}%</strong><span>confidenza</span><small>{profile.content_count || 0} contenuti · {profile.source_count || 0} sorgenti</small></div></div>}
    {openQuestions.length > 0 && <div className="questions"><p className="kicker">Mi serve il tuo aiuto</p><h3>Alcune cose non sono ancora chiare</h3>{openQuestions.map(question => <form key={question.id} onSubmit={event => { event.preventDefault(); onAnswer(question.id, answers[question.id] || ''); }}><label>{question.question}<small>{question.reason}</small><textarea value={answers[question.id] || ''} onChange={event => setAnswers(old => ({ ...old, [question.id]: event.target.value }))} required /></label><button className="primary" disabled={busy}>Salva risposta</button></form>)}</div>}
  </section>;
}

function SourcePeriod({ source, onSave, busy }) {
  const [value, setValue] = useState(source.since_date || '');
  useEffect(() => setValue(source.since_date || ''), [source.since_date]);
  return <span className="period-editor"><input aria-label={`Data iniziale ${source.label}`} type="date" max={new Date().toISOString().slice(0, 10)} value={value} onChange={event => setValue(event.target.value)} /><button type="button" onClick={() => onSave(source.id, value || null)} disabled={busy}>Salva periodo</button><small>Vuoto = tutto; non elimina i contenuti già acquisiti</small></span>;
}

function PostEditor({ item, onClose, onSave, onGenerate, busy }) {
  const hasDraft = Boolean(item.draft_updated_at);
  const [title, setTitle] = useState(hasDraft ? (item.draft_title || '') : (item.title || ''));
  const [body, setBody] = useState(hasDraft ? (item.draft_body || '') : (item.body_text || ''));
  const [imageUrl, setImageUrl] = useState(hasDraft ? (item.draft_image_url || '') : previewImage(item));
  useEffect(() => {
    setTitle(item.draft_updated_at ? (item.draft_title || '') : (item.title || ''));
    setBody(item.draft_updated_at ? (item.draft_body || '') : (item.body_text || ''));
    setImageUrl(item.draft_updated_at ? (item.draft_image_url || '') : previewImage(item));
  }, [item]);
  return <div className="editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="post-editor" role="dialog" aria-modal="true" aria-label="Modifica post potenziale"><div className="editor-head"><div><p className="kicker">SUPERVISORE EDITORIALE</p><h2>Articolo per il sito</h2><p>Il contenuto originale resta intatto; la bozza viene costruita a parte.</p></div><button className="close-editor" onClick={onClose} aria-label="Chiudi">×</button></div><div className="editor-supervisor"><button type="button" className="ai-generate" onClick={() => onGenerate(item.id)} disabled={busy}>✦ {busy ? 'Il supervisore sta lavorando…' : 'Trasforma in articolo SEO'}</button>{item.editorial_notes && <span>{item.editorial_notes}</span>}{item.seo_score > 0 && <b>SEO {item.seo_score}/100</b>}</div><div className="editor-layout"><form onSubmit={event => { event.preventDefault(); onSave(item.id, { title, body, image_url: imageUrl }); }}><label>Titolo<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Titolo dell’articolo" /></label><label>Testo completo<textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Corpo dell’articolo" /></label><label>Immagine<input type="url" value={imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://…" /></label><div className="editor-actions"><button type="button" className="ghost" onClick={onClose}>Annulla</button><button className="primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Salva bozza'}</button></div></form><aside className="post-preview">{imageUrl ? <img src={imageUrl} alt="Anteprima" /> : <div className="preview-placeholder">Nessuna immagine</div>}<small>ANTEPRIMA ARTICOLO</small><h3>{title || 'Titolo dell’articolo'}</h3><p>{body ? body.replace(/<[^>]+>/g, ' ') : 'Il testo comparirà qui.'}</p><a href={item.source_url} target="_blank" rel="noreferrer">Vedi originale sul social ↗</a></aside></div><details className="original-data"><summary>Leggi tutto il contenuto originale importato</summary><h4>{item.title || 'Senza titolo'}</h4><p>{item.body_text || 'Nessun testo originale disponibile.'}</p></details></section></div>;
}

function AdminPanel({ token, currentUser, onBack, onImpersonate }) {
  const [data, setData] = useState({ users: [], agents: [], providers: [], usage: [] });
  const [tab, setTab] = useState('users'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [passwords, setPasswords] = useState({});
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'user', plan: 'base' });
  const load = useCallback(() => request('admin-overview', token).then(setData).catch(e => setError(e.message)), [token]);
  useEffect(() => { load(); }, [load]);
  async function createUser(event) { event.preventDefault(); setBusy(true); setError(''); try { await request('admin-create-user', token, { method: 'POST', body: JSON.stringify(newUser) }); setNewUser({ email:'',name:'',password:'',role:'user',plan:'base' }); await load(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function saveUser(user, patch) { setBusy(true); try { await request('admin-update-user', token, { method:'POST', body:JSON.stringify({ id:user.id, name:user.name, role:user.role, plan:user.plan, ...patch }) }); await load(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function impersonate(id) { setBusy(true); try { onImpersonate(await request('admin-impersonate', token, { method:'POST', body:JSON.stringify({ id }) })); } catch(e) { setError(e.message); setBusy(false); } }
  async function saveAgent(agent, instructions) { setBusy(true); try { await request('admin-agent', token, { method:'POST', body:JSON.stringify({ ...agent, instructions }) }); await load(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  async function saveProvider(event, provider) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { await request('admin-provider', token, { method:'POST', body:JSON.stringify({ provider:provider.provider, model:form.get('model'), monthly_credit:form.get('credit'), credential:form.get('credential'), enabled:form.get('enabled') === 'on' }) }); event.currentTarget.reset(); await load(); } catch(e) { setError(e.message); } finally { setBusy(false); } }
  return <div className="app-shell admin-shell"><header><div className="brand"><span className="brand-dot" /> LinkSeoWeb <em>ADMIN</em></div><div className="user"><span>{currentUser.name || currentUser.email}</span><button onClick={onBack}>Torna all’area utente</button></div></header><main className="workspace admin-workspace"><div className="admin-title"><div><p className="eyebrow">CONTROL ROOM</p><h1>Pannello amministrativo</h1><p>Utenti, supervisori AI, connessioni e consumi in un’unica area protetta.</p></div><div className="admin-stats"><span><strong>{data.users.length}</strong> utenti</span><span><strong>{data.agents.length}</strong> agenti</span></div></div>{error && <div className="notice error">{error}</div>}<nav className="admin-tabs">{[['users','Utenti'],['agents','Agenti AI'],['providers','API e crediti'],['usage','Consumi']].map(([key,label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'users' && <section className="admin-grid"><form className="admin-card create-user" onSubmit={createUser}><p className="kicker">NUOVA UTENZA</p><h2>Crea un account</h2><input placeholder="Username o email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})} required/><input placeholder="Nome" value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/><input type="password" placeholder="Password (minimo 10 caratteri)" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})} required/><div className="form-row"><select value={newUser.role} onChange={e=>setNewUser({...newUser,role:e.target.value})}><option value="user">Utente</option><option value="admin">Admin</option></select><select value={newUser.plan} onChange={e=>setNewUser({...newUser,plan:e.target.value})}><option value="base">Base</option><option value="professional">Professional</option><option value="agency">Agency</option></select></div><button className="primary" disabled={busy}>Crea utente</button></form><div className="admin-card user-list"><p className="kicker">ACCESSI E PERMESSI</p><h2>Gestione utenti</h2>{data.users.map(u=><div className="admin-user" key={u.id}><div><strong>{u.name || u.email}</strong><small>{u.email} · {u.content_count} contenuti · {u.source_count} sorgenti</small></div><select value={u.role} onChange={e=>saveUser(u,{role:e.target.value})} disabled={u.id===currentUser.id}><option value="user">Utente</option><option value="admin">Admin</option></select><select value={u.plan} onChange={e=>saveUser(u,{plan:e.target.value})}><option value="base">Base</option><option value="professional">Professional</option><option value="agency">Agency</option></select><button onClick={()=>impersonate(u.id)} disabled={busy || u.id===currentUser.id}>Accedi come utente</button><div className="password-reset"><input type="password" placeholder="Nuova password" value={passwords[u.id]||''} onChange={e=>setPasswords({...passwords,[u.id]:e.target.value})}/><button onClick={()=>saveUser(u,{password:passwords[u.id]||''})} disabled={busy || !(passwords[u.id]||'')}>Reimposta</button></div></div>)}</div></section>}
    {tab === 'agents' && <section className="admin-stack">{data.agents.map(agent=><form className="admin-card agent-card" key={agent.id} onSubmit={e=>{e.preventDefault();saveAgent(agent,new FormData(e.currentTarget).get('instructions'));}}><div><p className="kicker">{agent.agent_name}</p><h2>{agent.label}</h2><p>{agent.description}</p></div><textarea name="instructions" defaultValue={agent.instructions}/><button className="primary" disabled={busy}>Salva istruzioni</button></form>)}</section>}
    {tab === 'providers' && <section className="admin-grid providers">{data.providers.map(provider=><form className="admin-card" key={provider.provider} onSubmit={e=>saveProvider(e,provider)}><div className="provider-head"><div><p className="kicker">CONNESSIONE API</p><h2>{provider.label}</h2></div><span className={provider.credential_configured ? 'connected' : 'disconnected'}>{provider.credential_configured ? 'Configurata' : 'Da configurare'}</span></div><label>Modello<input name="model" defaultValue={provider.model || ''}/></label><label>Nuova credenziale<input name="credential" type="password" placeholder={provider.credential_configured ? 'Lascia vuoto per non modificarla' : 'Inserisci API key'}/></label><label>Budget mensile (€)<input name="credit" type="number" min="0" step="0.01" defaultValue={provider.monthly_credit || ''}/></label><label className="check"><input name="enabled" type="checkbox" defaultChecked={Number(provider.enabled)===1}/> Connessione attiva</label><div className="provider-usage"><strong>{Number(provider.month_requests||0).toLocaleString('it-IT')}</strong> chiamate · {Number(provider.month_tokens||0).toLocaleString('it-IT')} token questo mese</div><button className="primary" disabled={busy}>Salva connessione</button></form>)}</section>}
    {tab === 'usage' && <section className="admin-card usage-table"><h2>Ultime chiamate AI</h2><div className="table-scroll"><table><thead><tr><th>Data</th><th>Utente</th><th>Provider</th><th>Operazione</th><th>Token</th><th>Costo stimato</th></tr></thead><tbody>{data.usage.map((row,i)=><tr key={i}><td>{row.created_at}</td><td>{row.email || 'sistema'}</td><td>{row.provider}</td><td>{row.action}</td><td>{Number(row.tokens_used).toLocaleString('it-IT')}</td><td>€ {Number(row.estimated_cost||0).toFixed(4)}</td></tr>)}</tbody></table></div></section>}
  </main></div>;
}

function Dashboard({ token, user, onLogout, onAdmin }) {
  const [data, setData] = useState({ sources: [], contents: [], latest_run: null, profile: null, profile_questions: [] });
  const [url, setUrl] = useState(''); const [label, setLabel] = useState('');
  const [period, setPeriod] = useState('90'); const [customDate, setCustomDate] = useState('');
  const [run, setRun] = useState(null); const [busySource, setBusySource] = useState(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [profileBusy, setProfileBusy] = useState(false);
  const [editingPost, setEditingPost] = useState(null); const [postBusy, setPostBusy] = useState(false); const autoProfile = useRef(false);
  const load = useCallback(async () => {
    const next = await request('dashboard', token); setData(next); setRun(old => old || next.latest_run);
  }, [token]);
  useEffect(() => { load().catch(e => setError(e.message)).finally(() => setLoading(false)); }, [load]);
  useEffect(() => {
    if (loading || !data.contents.length || data.profile || autoProfile.current) return;
    autoProfile.current = true; refreshProfile();
  }, [loading, data.contents.length, data.profile]);

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
    try { await request('sources', token, { method: 'POST', body: JSON.stringify({ url, label, since_date: periodDate(period, customDate) }) }); setUrl(''); setLabel(''); await load(); }
    catch (e) { setError(e.message); }
  }
  async function importSource(source) {
    setError(''); setBusySource(source.id);
    try {
      const created = (await request('import-start', token, { method: 'POST', body: JSON.stringify({ source_id: source.id }) })).run;
      setRun(created); setData(old => ({ ...old, sources: old.sources.map(item => item.id === source.id ? { ...item, status: 'importing', last_message: 'Acquisizione avviata' } : item) }));
      request('import-execute', token, { method: 'POST', body: JSON.stringify({ run_id: created.id }) }).catch(e => setError(e.message));
    } catch (e) { setError(e.message); setBusySource(null); }
  }
  async function refreshProfile() {
    setProfileBusy(true); setError('');
    try { const result = await request('profile-refresh', token, { method: 'POST', body: '{}' }); setData(old => ({ ...old, profile: result.profile, profile_questions: result.questions })); }
    catch (e) { setError(`Profilazione: ${e.message}`); await load().catch(() => {}); } finally { setProfileBusy(false); }
  }
  async function answerProfile(questionId, answer) {
    setProfileBusy(true); setError('');
    try { const result = await request('profile-answer', token, { method: 'POST', body: JSON.stringify({ question_id: questionId, answer }) }); setData(old => ({ ...old, profile: result.profile, profile_questions: result.questions })); }
    catch (e) { setError(e.message); } finally { setProfileBusy(false); }
  }
  async function saveSourcePeriod(sourceId, sinceDate) {
    setError('');
    try { const result = await request('source-period', token, { method: 'POST', body: JSON.stringify({ source_id: sourceId, since_date: sinceDate }) }); setData(old => ({ ...old, sources: old.sources.map(item => item.id === sourceId ? { ...item, since_date: result.source.since_date } : item) })); }
    catch (e) { setError(e.message); }
  }
  async function savePotentialPost(contentId, draft) {
    setPostBusy(true); setError('');
    try {
      const result = await request('potential-post', token, { method: 'POST', body: JSON.stringify({ content_id: contentId, ...draft }) });
      setData(old => ({ ...old, contents: old.contents.map(item => item.id === contentId ? { ...item, ...result.content } : item) }));
      setEditingPost(null);
    } catch (e) { setError(e.message); } finally { setPostBusy(false); }
  }
  async function generateArticle(contentId) {
    setPostBusy(true); setError('');
    try { const result = await request('editorial-generate', token, { method:'POST', body:JSON.stringify({ content_id:contentId }) }); setData(old=>({...old,contents:old.contents.map(item=>item.id===contentId?{...item,...result.content}:item)})); setEditingPost(old=>old?{...old,...result.content}:old); }
    catch(e) { setError(`Supervisore editoriale: ${e.message}`); } finally { setPostBusy(false); }
  }
  const total = useMemo(() => data.sources.reduce((sum, item) => sum + Number(item.content_count || 0), 0), [data.sources]);
  if (loading) return <div className="loading">Caricamento archivio…</div>;
  return <div className="app-shell">
    <header><div className="brand"><span className="brand-dot" /> LinkSeoWeb <em>Import</em></div><div className="user"><span>{user.name || user.email}</span>{user.role === 'admin' && <button className="admin-link" onClick={onAdmin}>Pannello admin</button>}<button onClick={onLogout}>Esci</button></div></header>
    <main className="workspace">
      <section className="hero"><div><p className="eyebrow">RACCOGLITORE CONTENUTI</p><h1>Collega. Acquisisci.<br />Conserva l’originale.</h1></div><div className="hero-stat"><strong>{total}</strong><span>contenuti grezzi<br />nel database</span></div></section>
      {error && <div className="notice error">{error}</div>}
      <div className="grid-main">
        <section className="panel connect-panel"><div className="section-title"><span>01</span><div><h2>Collega una sorgente</h2><p>Incolla il link pubblico di un profilo, canale o sito.</p></div></div>
          <form className="source-form" onSubmit={addSource}><label>URL della sorgente<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/@canale" required /></label><label>Acquisisci a partire da<select value={period} onChange={e => setPeriod(e.target.value)}><option value="30">Ultimi 30 giorni</option><option value="90">Ultimi 90 giorni</option><option value="365">Ultimo anno</option><option value="all">Tutto il disponibile</option><option value="custom">Data personalizzata</option></select></label>{period === 'custom' && <label>Data iniziale<input type="date" max={new Date().toISOString().slice(0, 10)} value={customDate} onChange={e => setCustomDate(e.target.value)} required /></label>}<label>Nome <small>opzionale</small><input value={label} onChange={e => setLabel(e.target.value)} placeholder="Il mio canale" /></label><button className="primary">Collega sorgente <b>→</b></button></form>
          <p className="support">Supportati: siti web, YouTube, Instagram, Facebook, TikTok e X. “Tutto” indica quanto reso disponibile dalla piattaforma e dal fornitore.</p>
        </section>
        <section className="panel"><div className="section-title"><span>02</span><div><h2>Processo di acquisizione</h2><p>Ogni passaggio è visibile; i contenuti non vengono riscritti.</p></div></div><Progress run={run} /></section>
      </div>
      <section className="sources-section"><div className="section-title"><span>03</span><div><h2>Le tue sorgenti</h2><p>{data.sources.length} collegamenti attivi</p></div></div>
        <div className="source-list">{data.sources.length === 0 ? <div className="empty-wide">Le sorgenti collegate appariranno qui.</div> : data.sources.map(source => { const meta = PLATFORM[source.platform] || PLATFORM.website; return <article className="source-card" key={source.id}><div className={`platform-icon ${source.platform}`}>{meta.mark}</div><div className="source-info"><strong>{source.label}</strong><a href={source.url} target="_blank" rel="noreferrer">{source.url}</a><small>{source.content_count || 0} contenuti · dal {source.since_date ? new Date(`${source.since_date}T12:00:00`).toLocaleDateString('it-IT') : 'primo disponibile'} · {source.last_message || 'Pronta per la prima acquisizione'}</small></div><SourcePeriod source={source} onSave={saveSourcePeriod} busy={busySource !== null} /><span className={`dot ${source.status}`} /><button onClick={() => importSource(source)} disabled={busySource !== null}>{busySource === source.id ? 'Acquisizione…' : 'Acquisisci'}</button></article>; })}</div>
      </section>
      <UserProfile profile={data.profile} questions={data.profile_questions} onAnswer={answerProfile} onRefresh={refreshProfile} busy={profileBusy} />
      <section className="archive"><div className="archive-head"><div className="section-title"><span>05</span><div><h2>Post potenziali</h2><p>Apri una scheda, modifica titolo, testo e immagine, poi salva la tua bozza.</p></div></div><span className="database-pill">● {data.contents.length} NEL DATABASE</span></div>
        {data.contents.length === 0 ? <div className="empty-wide">Nessun contenuto importato.</div> : <div className="post-grid">{data.contents.map(item => { const image = item.draft_updated_at ? item.draft_image_url : previewImage(item); const title = item.draft_updated_at ? item.draft_title : item.title; const body = item.draft_updated_at ? item.draft_body : item.body_text; return <article className="post-card" key={item.id}>{image ? <img src={image} alt="" loading="lazy" /> : <div className="post-no-image">{PLATFORM[item.platform]?.mark || 'WWW'}</div>}<div className="post-card-body"><div className="post-meta"><span>{item.source_label}</span><time>{new Date(item.published_at || item.imported_at).toLocaleDateString('it-IT')}</time></div><h3>{title || 'Contenuto senza titolo'}</h3><p>{body ? body.replace(/<[^>]+>/g,' ') : 'Nessun testo disponibile.'}</p><div className="post-card-actions"><button onClick={() => setEditingPost(item)}>{item.generated_at ? 'Apri articolo' : 'Supervisore AI'}</button><a href={item.source_url} target="_blank" rel="noreferrer">Originale ↗</a></div>{item.generated_at && <em>ARTICOLO SEO · {item.seo_score}/100</em>}</div></article>; })}</div>}
      </section>
    </main>
    {editingPost && <PostEditor item={editingPost} onClose={() => setEditingPost(null)} onSave={savePotentialPost} onGenerate={generateArticle} busy={postBusy} />}
    <footer>LinkSeoWeb <span>•</span> Originali invariati <span>•</span> Supervisione editoriale AI separata</footer>
  </div>;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lsw_token'));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('lsw_user') || 'null'));
  const [view, setView] = useState('dashboard');
  function login(nextToken, nextUser) { localStorage.setItem('lsw_token', nextToken); localStorage.setItem('lsw_user', JSON.stringify(nextUser)); setToken(nextToken); setUser(nextUser); }
  function logout() { localStorage.removeItem('lsw_token'); localStorage.removeItem('lsw_user'); setToken(null); setUser(null); setView('dashboard'); }
  function impersonate(data) { login(data.token,data.user); setView('dashboard'); }
  if (!token || !user) return <Login onLogin={login} />;
  if (view === 'admin' && user.role === 'admin') return <AdminPanel token={token} currentUser={user} onBack={()=>setView('dashboard')} onImpersonate={impersonate}/>;
  return <Dashboard token={token} user={user} onLogout={logout} onAdmin={()=>setView('admin')} />;
}
