import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { LiaAvatar } from './LiaAvatar';
import { LiaTaskPanel } from './LiaTaskPanel';
import './LiaWorkspace.css';

const STARTERS = ['Non so da dove iniziare', 'Scriviamo un contenuto', 'Aggiorniamo il sito'];
const TARGETS = new Set(['profile', 'sources', 'site', 'publicsite', 'seo', 'security']);
const LENGTHS = ['400-600 parole', '600-900 parole', '900-1200 parole'];
const FIELD_LABELS = { title: 'Titolo del sito', bio: 'Presentazione', role_mission: 'Obiettivo della tua attività' };
let sequence = 0;
const uid = () => `lia-${Date.now().toString(36)}-${++sequence}`;
const text = (value, limit = 4000) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const welcome = () => ({ id: uid(), role: 'assistant', text: 'Sono LIA, la tua assistente. Possiamo partire da un’idea, preparare un contenuto o migliorare come ti presenti.', question: 'Cosa vorresti fare adesso?', options: STARTERS, actions: [], local: 'start' });

function initialState(ownerId, previous) {
  if (!previous || previous.ownerId !== ownerId || !Array.isArray(previous.messages) || !previous.messages.length) return { version: 1, ownerId, messages: [welcome()], intent: previous?.ownerId === ownerId ? previous.intent || 'general' : 'general', input: previous?.ownerId === ownerId ? text(previous.input, 2000) : '', pendingChat: false, chatFailure: null };
  return { ...previous, pendingChat: false, messages: previous.messages.map(message => ({ ...message, actions: (message.actions || []).map(action => ({ ...action, status: ['preparing', 'saving'].includes(action.status) ? 'error' : action.status, error: ['preparing', 'saving'].includes(action.status) ? 'L’operazione è stata interrotta. La proposta è conservata.' : action.error, savePending: false, saveUncertain: Boolean(action.saveUncertain || action.savePending), saveError: action.savePending ? 'La conferma del salvataggio è stata interrotta. Il testo resta qui: controlla le bozze prima di salvare di nuovo.' : action.saveError })) })), chatFailure: previous.pendingChat ? { message: 'La risposta è stata interrotta. Puoi riprovare dalla stessa domanda.' } : previous.chatFailure };
}

function normalizeAction(value, index) {
  if (!value || typeof value !== 'object') return null;
  const common = { id: text(value.id, 80) || `action-${index}`, label: text(value.label, 100), status: 'idle' };
  if (value.type === 'navigate' && TARGETS.has(value.target)) return { ...common, type: 'navigate', target: value.target };
  if (value.type === 'prepare_article' && text(value.brief?.subject)) return { ...common, type: 'prepare_article', brief: { subject: text(value.brief.subject), objective: text(value.brief.objective, 300), audience: text(value.brief.audience, 600), style: text(value.brief.style, 600), title: text(value.brief.title, 240), length: LENGTHS.includes(value.brief.length) ? value.brief.length : LENGTHS[0], revise_current: value.brief.revise_current === true, instructions: text(value.brief.instructions, 800), source_text: value.brief.revise_current === true ? text(value.brief.source_text, 12000) : '' } };
  if (value.type === 'propose_profile') {
    const changes = {};
    for (const [field, limit] of Object.entries({ title: 120, bio: 2000, role_mission: 4000 })) if (typeof value.changes?.[field] === 'string') changes[field] = value.changes[field].trim().slice(0, limit);
    if (Object.keys(changes).length) return { ...common, type: 'propose_profile', changes };
  }
  return null;
}

function articleText(html) {
  const input = String(html || '').replace(/<\/(?:p|h[1-6]|li|blockquote)>/gi, '\n\n').replace(/<br\s*\/?\s*>/gi, '\n');
  if (typeof DOMParser === 'undefined') return input.replace(/<[^>]+>/g, '').trim();
  const document = new DOMParser().parseFromString(input, 'text/html');
  document.querySelectorAll('script,style,iframe,object,svg').forEach(element => element.remove());
  return (document.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function latestArticleWork(messages) {
  for (const message of [...messages].reverse()) {
    for (const action of [...(message.actions || [])].reverse()) {
      if (action.type !== 'prepare_article' || !action.article) continue;
      const title = text(action.article.title, 240);
      const content = text(articleText(action.article.content), 12000);
      if (title && content) return { article: { title, content } };
    }
  }
  return undefined;
}

function safeArticleHtml(value) {
  const document = new DOMParser().parseFromString(String(value || '').slice(0, 100000), 'text/html');
  document.querySelectorAll('script,style,iframe,object,svg,template').forEach(element => element.remove());
  const allowed = new Set(['P', 'H2', 'H3', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'BR']);
  const container = document.createElement('div');
  function append(parent, source) {
    if (source.nodeType === 3) { parent.appendChild(document.createTextNode(source.textContent)); return; }
    if (source.nodeType !== 1) return;
    const target = allowed.has(source.tagName) ? document.createElement(source.tagName.toLowerCase()) : parent;
    for (const child of [...source.childNodes]) append(target, child);
    if (target !== parent) parent.appendChild(target);
  }
  for (const child of [...document.body.childNodes]) append(container, child);
  return container.innerHTML;
}

export function LiaWorkspace({ user, data, site: siteProp, sources: sourcesProp, posts: postsProp, token, state, onStateChange, onNavigate, onRefresh, onPostEdit, onWrite, knowledge, loading = false, error = '' }) {
  const ownerId = String(user?.id || '');
  const site = siteProp || data?.site || {};
  const sources = sourcesProp || data?.sources || [];
  const posts = postsProp || data?.posts || [];
  const [workspace, setWorkspace] = useState(() => initialState(ownerId, state));
  const [busy, setBusy] = useState('');
  const workspaceRef = useRef(workspace);
  const busyRef = useRef(false);
  const controllerRef = useRef(null);
  const generation = useRef(0);
  const identity = useRef({ ownerId, token });
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const messages = workspace.messages;

  function update(change) {
    const next = typeof change === 'function' ? change(workspaceRef.current) : change;
    workspaceRef.current = next;
    setWorkspace(next);
    onStateChange?.(next);
  }
  function changeAction(messageId, actionId, patch) {
    update(current => ({ ...current, messages: current.messages.map(message => message.id !== messageId ? message : { ...message, actions: (message.actions || []).map(action => action.id === actionId ? { ...action, ...patch } : action) }) }));
  }
  useEffect(() => {
    if (identity.current.ownerId !== ownerId || identity.current.token !== token) {
      generation.current++;
      controllerRef.current?.abort();
      busyRef.current = false; setBusy('');
      identity.current = { ownerId, token };
      update(initialState(ownerId, null));
    }
  }, [ownerId, token]);
  useEffect(() => () => { generation.current++; controllerRef.current?.abort(); }, []);
  const actionSignature = messages.map(message => (message.actions || []).map(action => action.status).join(',')).join('|');
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages.length, busy, actionSignature]);

  function begin(label) {
    if (busyRef.current) return null;
    busyRef.current = true; setBusy(label);
    const controller = new AbortController(); controllerRef.current = controller;
    return { controller, revision: generation.current };
  }
  function finish(operation) {
    if (operation.revision !== generation.current) return;
    busyRef.current = false; setBusy(''); controllerRef.current = null;
  }
  async function refreshAfterSave() {
    try { await onRefresh?.(); } catch { /* The write succeeded; a refresh failure must not offer a duplicate write. */ }
  }
  function localChoice(message, choice) {
    if (busyRef.current || workspaceRef.current.messages.at(-1)?.id !== message.id) return;
    const next = [...workspaceRef.current.messages, { id: uid(), role: 'user', text: choice }];
    let answer;
    let intent = workspaceRef.current.intent;
    if (message.local === 'start') {
      if (choice === STARTERS[0]) { intent = 'general'; answer = { text: 'Partiamo dal risultato che conta per te. Ti aiuto a scegliere il primo passo.', question: 'Che cosa vorresti ottenere?', options: ['Farmi conoscere', 'Ricevere più richieste', 'Spiegare meglio cosa offro'], local: 'goal' }; }
      if (choice === STARTERS[1]) { intent = 'article'; answer = { text: 'Prepariamo un contenuto da leggere e rivedere insieme.', question: 'Di cosa vorresti parlare?', options: ['Presentare un servizio', 'Rispondere a una domanda frequente', 'Raccontare una novità'], local: 'article-topic' }; }
      if (choice === STARTERS[2]) { intent = 'site'; answer = { text: 'Possiamo rivedere la tua presentazione prima di cambiarla sul sito.', question: 'Che cosa vuoi migliorare?', options: ['Come presento la mia attività', 'I contatti e le informazioni', 'L’aspetto del sito'], local: 'site-goal' }; }
    } else if (message.local === 'article-topic') {
      answer = { text: choice === 'Presentare un servizio' ? 'Bene, partiamo da un servizio concreto.' : choice === 'Rispondere a una domanda frequente' ? 'Le domande dei clienti sono un ottimo punto di partenza.' : 'Raccontiamo una novità della tua attività.', question: choice === 'Presentare un servizio' ? 'Quale servizio vuoi presentare?' : choice === 'Rispondere a una domanda frequente' ? 'Quale domanda ti fanno più spesso?' : 'Qual è la novità che vuoi raccontare?', options: [], local: '' };
    }
    if (!answer) return ask(choice);
    update(current => ({ ...current, intent, input: '', chatFailure: null, messages: [...next, { id: uid(), role: 'assistant', actions: [], ...answer }] }));
    inputRef.current?.focus();
  }

  async function ask(value, retry = false) {
    const clean = text(value, 2000);
    if ((!clean && !retry) || busyRef.current) return;
    const operation = begin('LIA sta preparando la risposta…');
    if (!operation) return;
    const nextMessages = retry ? workspaceRef.current.messages : [...workspaceRef.current.messages, { id: uid(), role: 'user', text: clean }];
    const work = latestArticleWork(nextMessages);
    update(current => ({ ...current, input: '', pendingChat: true, chatFailure: null, messages: nextMessages }));
    const timer = setTimeout(() => operation.controller.abort(), 90000);
    try {
      const result = await apiFetch('/api/index.php?action=lia-assistant', { method: 'POST', signal: operation.controller.signal, body: JSON.stringify({ intent: workspaceRef.current.intent, ...(work ? { work } : {}), messages: nextMessages.filter(message => message.role === 'assistant' || message.role === 'user').slice(-12).map(message => ({ role: message.role, text: message.text + (message.question ? `\n${message.question}` : '') })) }) }, token);
      if (operation.revision !== generation.current) return;
      if (!text(result.reply, 8000)) throw new Error('LIA non ha restituito una risposta. La tua richiesta è conservata.');
      const reply = { id: uid(), role: 'assistant', text: text(result.reply, 8000), question: text(result.question, 1000), options: (Array.isArray(result.options) ? result.options : []).map(option => text(option, 180)).filter(Boolean).slice(0, 3), actions: (Array.isArray(result.actions) ? result.actions : []).map(normalizeAction).filter(Boolean).slice(0, 2), warnings: (Array.isArray(result.warnings) ? result.warnings : []).map(warning => text(warning, 500)).filter(Boolean).slice(0, 3) };
      update(current => ({ ...current, pendingChat: false, chatFailure: null, messages: [...current.messages, reply] }));
    } catch (failure) {
      if (operation.revision === generation.current) update(current => ({ ...current, pendingChat: false, chatFailure: { message: failure.name === 'AbortError' ? 'La risposta richiede più tempo del previsto. La tua domanda è conservata: puoi riprovare.' : failure.message } }));
    } finally { clearTimeout(timer); finish(operation); }
  }

  async function prepareArticle(messageId, action) {
    const operation = begin('LIA sta scrivendo la bozza…');
    if (!operation) return;
    changeAction(messageId, action.id, { status: 'preparing', error: '' });
    const timer = setTimeout(() => operation.controller.abort(), 120000);
    try {
      const brief = action.brief;
      const result = await apiFetch('/api/index.php?action=article-studio', { method: 'POST', signal: operation.controller.signal, body: JSON.stringify({ mode: 'articles', subject: brief.subject, objective: brief.objective, channel: 'Sito web', length: brief.length, ...(brief.revise_current ? { source_text: brief.source_text } : {}), instructions: [brief.instructions, brief.audience ? `Pubblico: ${brief.audience}` : '', brief.style ? `Tono: ${brief.style}` : ''].filter(Boolean).join('\n'), proposal: { title: brief.title || brief.subject.slice(0, 240), angle: brief.subject } }) }, token);
      if (operation.revision !== generation.current) return;
      const article = result.articles?.[0];
      if (!text(article?.title, 240) || !articleText(article?.content)) throw new Error('La bozza non è ancora completa. Il tuo argomento è conservato: puoi riprovare.');
      changeAction(messageId, action.id, { status: 'ready', error: '', article: { title: text(article.title, 240), excerpt: text(article.excerpt, 1000), content: safeArticleHtml(article.content), tags: Array.isArray(article.tags) ? article.tags.filter(tag => typeof tag === 'string').slice(0, 10) : [] } });
    } catch (failure) {
      if (operation.revision === generation.current) changeAction(messageId, action.id, { status: 'error', error: failure.name === 'AbortError' ? 'La preparazione richiede più tempo del previsto. L’argomento è conservato: puoi riprovare.' : failure.message });
    } finally { clearTimeout(timer); finish(operation); }
  }

  async function saveDraft(messageId, action) {
    if (action.savedPost || action.saveUncertain) return;
    const operation = begin('Salvataggio della bozza…');
    if (!operation) return;
    changeAction(messageId, action.id, { saveError: '', savePending: true });
    const timer = setTimeout(() => operation.controller.abort(), 45000);
    try {
      const article = action.article;
      const payload = { edited_title: article.title, edited_body: article.content, edited_excerpt: article.excerpt, tags: article.tags, noindex: 0 };
      const result = await apiFetch('/api/index.php?action=post-create', { method: 'POST', body: JSON.stringify(payload), signal: operation.controller.signal }, token);
      if (operation.revision !== generation.current) return;
      if (!Number.isInteger(Number(result.id)) || Number(result.id) <= 0) throw new Error('La conferma del salvataggio non è arrivata.');
      const savedPost = { ...payload, id: Number(result.id), platform: 'manual', published: 0, seo_score: 10, generated_title: '', generated_body: '', media_url: '', media_type: '' };
      changeAction(messageId, action.id, { savePending: false, savedPost, saveError: '' });
      await refreshAfterSave();
    } catch (failure) {
      if (operation.revision === generation.current) changeAction(messageId, action.id, { savePending: false, saveUncertain: true, saveError: `${failure.message || 'Conferma non ricevuta.'} Il testo resta qui. Controlla le bozze prima di salvare di nuovo.` });
    } finally { clearTimeout(timer); finish(operation); }
  }

  async function savePresentation(messageId, action) {
    if (action.status === 'saved') return;
    const operation = begin('Salvataggio della presentazione…');
    if (!operation) return;
    changeAction(messageId, action.id, { status: 'saving', error: '' });
    const timer = setTimeout(() => operation.controller.abort(), 45000);
    try {
      await apiFetch('/api/index.php?action=site-update', { method: 'POST', body: JSON.stringify(action.changes), signal: operation.controller.signal }, token);
      if (operation.revision !== generation.current) return;
      changeAction(messageId, action.id, { status: 'saved', error: '' });
      await refreshAfterSave();
    } catch (failure) { if (operation.revision === generation.current) changeAction(messageId, action.id, { status: 'error', error: failure.name === 'AbortError' ? 'Conferma non ricevuta. La proposta è conservata: aggiorna il sito o riprova a salvare questi testi.' : failure.message }); }
    finally { clearTimeout(timer); finish(operation); }
  }

  function renderAction(message, action) {
    if (action.type === 'navigate') return <button type="button" className="lw-secondary" key={action.id} disabled={Boolean(busy)} data-lia-action="navigate" onClick={() => onNavigate?.(action.target)}>{action.label || 'Apri il dettaglio'}</button>;
    if (action.type === 'prepare_article') return <section className="lw-proposal" key={action.id} data-lia-proposal="prepare_article">
      {!action.article ? <><span className="lw-eyebrow">La proposta di LIA</span><h3>{action.brief.title || action.brief.subject}</h3><p>{action.brief.subject}</p>{action.brief.objective && <p><strong>Obiettivo:</strong> {action.brief.objective}</p>}<small>{action.brief.length}. La bozza sarà mostrata qui per la tua revisione.</small><button type="button" className="lw-primary" data-lia-action="prepare_article" disabled={Boolean(busy)} onClick={() => prepareArticle(message.id, action)}>{action.status === 'preparing' ? 'Preparazione in corso…' : action.status === 'error' ? 'Riprova' : action.label || 'Prepara bozza'}</button>{action.error && <p className="lw-error" role="alert">{action.error}</p>}</> : <><span className="lw-eyebrow">{action.savedPost ? 'Salvata · non pubblicata' : 'Anteprima · non ancora salvata'}</span><h3>La tua bozza</h3><h4>{action.article.title}</h4>{action.article.excerpt && <p className="lw-excerpt">{action.article.excerpt}</p>}<div className="lw-draft-body" data-lia-preview="article">{articleText(action.article.content)}</div><div className="lw-actions">{action.savedPost ? <><span className="lw-success" role="status">Bozza salvata. Potrai pubblicarla dopo averla rivista.</span><button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => onPostEdit ? onPostEdit(action.savedPost) : onNavigate?.('site')}>Apri nell’editor</button></> : action.saveUncertain ? <button type="button" className="lw-secondary" disabled={Boolean(busy)} onClick={() => onNavigate?.('site')}>Controlla le bozze</button> : <button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => saveDraft(message.id, action)}>{action.savePending ? 'Salvataggio…' : 'Salva bozza'}</button>}</div>{action.saveError && <p className="lw-error" role="alert">{action.saveError}</p>}</>}
    </section>;
    if (action.type === 'propose_profile') return <section className="lw-proposal" key={action.id} data-lia-action="propose_profile"><span className="lw-eyebrow">Proposta da approvare</span><h3>La tua nuova presentazione</h3><p className="lw-public-notice">Questi testi cambiano la presentazione del tuo sito pubblico.</p><div className="lw-comparison">{Object.entries(action.changes).map(([field, value]) => <section key={field}><h4>{FIELD_LABELS[field]}</h4><div><span>Adesso</span><p>{text(site[field]) || 'Non ancora compilato'}</p></div><div className="is-proposed"><span>Proposta di LIA</span><p>{value || 'Campo vuoto'}</p></div></section>)}</div>{action.status === 'saved' ? <p className="lw-success" role="status">Presentazione aggiornata sul tuo sito.</p> : <button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => savePresentation(message.id, action)}>{action.status === 'saving' ? 'Salvataggio…' : 'Conferma e salva la presentazione'}</button>}{action.error && <p className="lw-error" role="alert">{action.error}</p>}</section>;
    return null;
  }

  if (workspace.ownerId !== ownerId) return <section className="lia-workspace" role="status">Caricamento del tuo spazio…</section>;
  return <section className="lia-workspace" aria-labelledby="lia-workspace-title">
    <header className="lw-heading"><div className="lw-identity"><LiaAvatar size={56} knowledge={knowledge} thinking={Boolean(busy)} /><div><span>LIA · Il tuo spazio di lavoro</span><h1 id="lia-workspace-title">Cosa facciamo oggi?</h1></div></div><p>Non serve sapere cosa scrivere. Scegli un punto di partenza oppure raccontamelo con le tue parole.</p></header>
    {error && <div className="lw-context-warning" role="alert"><p>Non riesco ad aggiornare i dati del tuo spazio: {error}</p><button type="button" className="lw-secondary" disabled={Boolean(busy) || loading} onClick={onRefresh}>Aggiorna i dati</button></div>}
    <div className="lw-work-area"><div className="lw-conversation"><header className="lw-conversation-heading"><div><strong>{site.title || user?.name || 'Il tuo progetto'}</strong><small>{loading ? 'Aggiornamento dati…' : 'Un passo alla volta, con le tue conferme.'}</small></div><button type="button" className="lw-text-button" disabled={Boolean(busy)} onClick={() => { update(initialState(ownerId, null)); inputRef.current?.focus(); }}>Nuova conversazione</button></header>
      <div className="lw-log" ref={logRef} role="log" aria-label="Conversazione con LIA" aria-live="polite" aria-relevant="additions text">
        {messages.map((message, index) => <article key={message.id} className={`lw-message is-${message.role}`}><span className="lw-message-author">{message.role === 'assistant' ? 'LIA' : 'Tu'}</span><div className="lw-message-content"><p>{message.text}</p>{message.question && <p className="lw-question">{message.question}</p>}{index === messages.length - 1 && Boolean(message.options?.length) && <div className="lw-options">{message.options.map((option, optionIndex) => <button key={`${option}-${optionIndex}`} type="button" disabled={Boolean(busy)} onClick={() => message.local ? localChoice(message, option) : ask(option)}>{option}</button>)}</div>}{message.warnings?.map((warning, warningIndex) => <p className="lw-note" key={warningIndex}>{warning}</p>)}{Boolean(message.actions?.length) && <div className="lw-action-list">{message.actions.map(action => renderAction(message, action))}</div>}</div></article>)}
        {busy && <div className="lw-thinking" role="status"><LiaAvatar size={32} knowledge={knowledge} thinking /><span>{busy}</span></div>}
        {workspace.chatFailure && <div className="lw-chat-failure" role="alert"><p>{workspace.chatFailure.message}</p><button type="button" className="lw-secondary" disabled={Boolean(busy)} onClick={() => ask('', true)}>Riprova</button></div>}
      </div>
      <form className="lw-composer" onSubmit={event => { event.preventDefault(); ask(workspaceRef.current.input); }}><label htmlFor="lia-workspace-input">Scrivi a LIA</label><textarea id="lia-workspace-input" ref={inputRef} rows={3} maxLength={2000} value={workspace.input || ''} onChange={event => update(current => ({ ...current, input: event.target.value }))} placeholder={workspace.intent === 'article' ? 'Per esempio: voglio spiegare ai miei clienti come scegliere il servizio giusto…' : workspace.intent === 'site' ? 'Per esempio: vorrei una presentazione più chiara e accogliente…' : 'Per esempio: aiutami a presentare meglio la mia attività…'} disabled={Boolean(busy)} /><div><small>Le proposte si preparano qui. Decidi tu cosa salvare o pubblicare.</small><button type="submit" className="lw-primary" disabled={Boolean(busy) || !text(workspace.input, 2000)}>Invia a LIA</button></div></form>
    </div>
    <LiaTaskPanel sources={sources} posts={posts} loading={loading} busy={Boolean(busy)} onChoose={prompt => { update(current => ({ ...current, input: prompt })); inputRef.current?.focus(); inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} /></div>
    <details className="lw-project-details"><summary>Il tuo spazio e gli strumenti</summary><p>{sources.length} fonti collegate · {posts.filter(post => Number(post.published) === 1).length} contenuti pubblicati · {posts.filter(post => Number(post.published) !== 1).length} bozze e lavorazioni.</p><div className="lw-actions"><button type="button" className="lw-secondary" onClick={() => onNavigate?.('site')}>Ritrova i tuoi contenuti</button><button type="button" className="lw-secondary" onClick={() => onNavigate?.('publicsite')}>Rivedi il sito</button>{onWrite && <button type="button" className="lw-secondary" onClick={() => onWrite('')}>Scrivi senza assistente</button>}</div></details>
  </section>;
}
