import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import { LiaAvatar } from './LiaAvatar';
import { LiaTaskPanel } from './LiaTaskPanel';
import { LiaAgenda } from './LiaAgenda';
import './LiaWorkspace.css';

const STARTERS = ['Non so da dove iniziare', 'Scriviamo un contenuto', 'Aggiorniamo il sito'];
const TARGETS = new Set(['profile', 'sources', 'site', 'publicsite', 'seo', 'security']);
const LENGTHS = ['400-600 parole', '600-900 parole', '900-1200 parole'];
const FIELD_LABELS = { title: 'Titolo del sito', bio: 'Presentazione', role_mission: 'Obiettivo della tua attività' };
let sequence = 0;
const uid = () => `lia-${Date.now().toString(36)}-${++sequence}`;
const text = (value, limit = 4000) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const welcome = () => ({ id: uid(), role: 'assistant', text: 'Sono LIA, la tua assistente. Ti accompagno un passo alla volta e uso quello che so già della tua attività.', question: null, options: STARTERS, actions: [], local: 'start' });

function initialState(ownerId, previous) {
  if (!previous || previous.ownerId !== ownerId || !Array.isArray(previous.messages) || !previous.messages.length) return { version: 1, ownerId, messages: [welcome()], intent: previous?.ownerId === ownerId ? previous.intent || 'general' : 'general', input: previous?.ownerId === ownerId ? text(previous.input, 2000) : '', pendingChat: false, chatFailure: null };
  return { ...previous, briefingStatus: previous.briefingStatus === 'pending' ? 'error' : previous.briefingStatus, pendingChat: false, messages: previous.messages.map(message => ({ ...message, actions: (message.actions || []).map(action => ({ ...action, status: ['preparing', 'saving'].includes(action.status) ? 'error' : action.status, error: ['preparing', 'saving'].includes(action.status) ? 'L’operazione è stata interrotta. La proposta è conservata.' : action.error, savePending: false, saveUncertain: Boolean(action.saveUncertain || action.savePending), saveError: action.savePending ? 'La conferma del salvataggio è stata interrotta. Il testo resta qui: controlla le bozze prima di salvare di nuovo.' : action.saveError })) })), chatFailure: previous.pendingChat ? { message: 'La risposta è stata interrotta. Puoi riprovare dalla stessa domanda.' } : previous.chatFailure };
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
  if (value.type === 'social_draft' && ['instagram','facebook','linkedin','tiktok','x'].includes(value.platform) && text(value.caption,3000)) return {...common,type:'social_draft',platform:value.platform,caption:[text(value.caption,3000),(Array.isArray(value.hashtags)?value.hashtags:[]).filter(tag=>typeof tag==='string').join(' ')].filter(Boolean).join('\n\n')};
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
      if (action.type === 'social_draft' && action.caption) return {article:{title:`Bozza ${action.platform}`,content:action.caption}};
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

export function LiaWorkspace({ user, data, site: siteProp, sources: sourcesProp, posts: postsProp, token, state, onStateChange, onNavigate, onRefresh, onPostEdit, onWrite, knowledge, panel = '', onPanelChange, statistics, loading = false, error = '' }) {
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
  const briefing = messages.find(message => message.kind === 'briefing');
  const conversationMessages = messages.filter(message => message.kind !== 'briefing');
  const conversationStarted = conversationMessages.some(message => message.role === 'user' || message.kind === 'briefing-history');

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
    if (busyRef.current || workspaceRef.current.messages.filter(item => item.kind !== 'briefing').at(-1)?.id !== message.id) return;
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

  function startTask(prompt, postId = null, intent = 'general') {
    if (busyRef.current) return;
    onPanelChange?.('');
    update(current => ({ ...current, intent, contextPostId: postId, workFrom: current.messages.length, pendingRequest: null }));
    ask(prompt);
    logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const handledRequest = useRef(null);
  // Parent state preserves the report while switching sections: one automatic briefing per session.
  useEffect(() => {
    if (loading || error || !token || !ownerId || workspace.briefingStatus || state?.pendingRequest || busyRef.current) return;
    const timer = setTimeout(() => { if (!busyRef.current && !workspaceRef.current.briefingStatus) prepareBriefing(); }, 0);
    return () => clearTimeout(timer);
  }, [loading, error, token, ownerId, workspace.briefingStatus, state?.pendingRequest, busy]);

  async function prepareBriefing() {
    const operation = begin('Sto scegliendo da dove iniziare…');
    if (!operation) return;
    update(current => ({ ...current, briefingStatus: 'pending', briefingError: '' }));
    const timer = setTimeout(() => operation.controller.abort(), 90000);
    try {
      const result = await apiFetch('/api/index.php?action=lia-assistant', { method: 'POST', signal: operation.controller.signal, body: JSON.stringify({ intent: 'briefing', messages: [{ role: 'user', text: 'Guarda la mia attività e quello che abbiamo già fatto. Scegli una sola cosa utile da fare adesso e spiegami in modo semplice perché. Accompagnami nel prossimo passo.' }] }) }, token);
      if (operation.revision !== generation.current) return;
      if (!text(result.reply, 8000)) throw new Error('Il consiglio non è ancora disponibile. Puoi riprovare.');
      const nextStep = result.next_step && text(result.next_step.title,140) && text(result.next_step.prompt,1200) ? { title:text(result.next_step.title,140),reason:text(result.next_step.reason,300),prompt:text(result.next_step.prompt,1200),postId:Number.isSafeInteger(result.next_step.context_post_id) && result.next_step.context_post_id > 0 ? result.next_step.context_post_id : null } : null;
      const message = { id: uid(), kind: 'briefing', role: 'assistant', text: text(result.reply, 8000), nextStep, actions: (Array.isArray(result.actions) ? result.actions : []).map(normalizeAction).filter(Boolean).slice(0, 2), createdAt: new Date().toISOString() };
      update(current => {
        const previous = current.messages.find(item => item.kind === 'briefing');
        // Keep work started from a report in the conversation before replacing it.
        // Never insert/remove messages before workFrom: it marks the selected task's context.
        const preserveWork = previous?.actions.some(action => action.article || action.caption || action.status !== 'idle');
        const nextMessages = current.messages.map(item => item !== previous ? item : preserveWork ? { ...item, kind: 'briefing-history' } : message);
        if (!previous || preserveWork) nextMessages.push(message);
        return { ...current, briefingStatus: 'ready', messages: nextMessages };
      });
    } catch (failure) {
      if (operation.revision === generation.current) update(current => ({ ...current, briefingStatus: 'error', briefingError: failure.name === 'AbortError' ? 'Mi serve più tempo per preparare il consiglio. Puoi riprovare.' : failure.message }));
    } finally { clearTimeout(timer); finish(operation); }
  }

  useEffect(() => {
    const request = state?.pendingRequest;
    if (!request || request.id === handledRequest.current || state.ownerId !== ownerId || busyRef.current) return;
    const timer = setTimeout(() => {
      if (busyRef.current || handledRequest.current === request.id) return;
      handledRequest.current = request.id;
      startTask(request.input);
    }, 0);
    return () => clearTimeout(timer);
  }, [state?.pendingRequest?.id, ownerId, busy]);

  async function ask(value, retry = false) {
    const clean = text(value, 2000);
    if ((!clean && !retry) || busyRef.current) return;
    const operation = begin('LIA sta preparando la risposta…');
    if (!operation) return;
    const nextMessages = retry ? workspaceRef.current.messages : [...workspaceRef.current.messages, { id: uid(), role: 'user', text: clean }];
    const work = latestArticleWork(nextMessages.slice(workspaceRef.current.workFrom || 0));
    update(current => ({ ...current, input: '', pendingChat: true, chatFailure: null, messages: nextMessages }));
    const timer = setTimeout(() => operation.controller.abort(), 90000);
    try {
      const result = await apiFetch('/api/index.php?action=lia-assistant', { method: 'POST', signal: operation.controller.signal, body: JSON.stringify({ intent: workspaceRef.current.intent, context_post_id: workspaceRef.current.contextPostId || null, ...(work ? { work } : {}), messages: nextMessages.filter(message => message.role === 'assistant' || message.role === 'user').slice(-12).map(message => ({ role: message.role, text: message.text + (message.question ? `\n${message.question}` : '') })) }) }, token);
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
    if (action.type === 'social_draft') return <section className="lw-proposal" key={action.id} data-lia-proposal="social_draft"><span className="lw-eyebrow">SOCIAL MEDIA MANAGER · {action.platform}</span><h3>La tua bozza social</h3><label htmlFor={`caption-${message.id}-${action.id}`}>Testo del post</label><textarea id={`caption-${message.id}-${action.id}`} rows={7} maxLength={3500} value={action.caption} disabled={Boolean(busy)||!!action.savedPost} onChange={event=>changeAction(message.id,action.id,{caption:event.target.value})}/><div className="lw-actions"><button type="button" className="lw-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(action.caption);changeAction(message.id,action.id,{copyMessage:'Testo copiato',error:''})}catch{changeAction(message.id,action.id,{error:'Copia non disponibile. Puoi selezionare il testo dal campo.'})}}}>Copia il testo</button>{action.savedPost?<span className="lw-success">Bozza salvata nei contenuti.</span>:<button type="button" className="lw-primary" disabled={Boolean(busy)||action.saveUncertain||!action.caption.trim()} onClick={()=>{const el=document.createElement('div');el.textContent=action.caption;saveDraft(message.id,{...action,article:{title:`${action.platform} · ${action.caption.slice(0,80)}`,content:`<p>${el.innerHTML.replace(/\n/g,'<br>')}</p>`,excerpt:action.caption.slice(0,155),tags:[]}})}}>Salva la bozza social</button>}</div><small>Testo pronto da rivedere e usare nel tuo social. Il salvataggio lo conserva in AllSocialToWeb.</small>{action.copyMessage&&<p role="status">{action.copyMessage}</p>}{(action.error||action.saveError)&&<p role="alert" className="lw-error">{action.error||action.saveError}</p>}</section>;
    if (action.type === 'prepare_article') return <section className="lw-proposal" key={action.id} data-lia-proposal="prepare_article">
      {!action.article ? <><span className="lw-eyebrow">La proposta di LIA</span><h3>{action.brief.title || action.brief.subject}</h3><p>{action.brief.subject}</p>{action.brief.objective && <p><strong>Obiettivo:</strong> {action.brief.objective}</p>}<small>{action.brief.length}. La bozza sarà mostrata qui per la tua revisione.</small><button type="button" className="lw-primary" data-lia-action="prepare_article" disabled={Boolean(busy)} onClick={() => prepareArticle(message.id, action)}>{action.status === 'preparing' ? 'Preparazione in corso…' : action.status === 'error' ? 'Riprova' : action.label || 'Prepara bozza'}</button>{action.error && <p className="lw-error" role="alert">{action.error}</p>}</> : <><span className="lw-eyebrow">{action.savedPost ? 'Salvata · non pubblicata' : 'Anteprima · non ancora salvata'}</span><h3>La tua bozza</h3><h4>{action.article.title}</h4>{action.article.excerpt && <p className="lw-excerpt">{action.article.excerpt}</p>}<div className="lw-draft-body" data-lia-preview="article">{articleText(action.article.content)}</div><div className="lw-actions">{action.savedPost ? <><span className="lw-success" role="status">Bozza salvata. Potrai pubblicarla dopo averla rivista.</span><button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => onPostEdit ? onPostEdit(action.savedPost) : onNavigate?.('site')}>Apri nell’editor</button></> : action.saveUncertain ? <button type="button" className="lw-secondary" disabled={Boolean(busy)} onClick={() => onNavigate?.('site')}>Controlla le bozze</button> : <button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => saveDraft(message.id, action)}>{action.savePending ? 'Salvataggio…' : 'Salva bozza'}</button>}</div>{action.saveError && <p className="lw-error" role="alert">{action.saveError}</p>}</>}
    </section>;
    if (action.type === 'propose_profile') return <section className="lw-proposal" key={action.id} data-lia-action="propose_profile"><span className="lw-eyebrow">Proposta da approvare</span><h3>La tua nuova presentazione</h3><p className="lw-public-notice">Questi testi cambiano la presentazione del tuo sito pubblico.</p><div className="lw-comparison">{Object.entries(action.changes).map(([field, value]) => <section key={field}><h4>{FIELD_LABELS[field]}</h4><div><span>Adesso</span><p>{text(site[field]) || 'Non ancora compilato'}</p></div><div className="is-proposed"><span>Proposta di LIA</span><p>{value || 'Campo vuoto'}</p></div></section>)}</div>{action.status === 'saved' ? <p className="lw-success" role="status">Presentazione aggiornata sul tuo sito.</p> : <button type="button" className="lw-primary" disabled={Boolean(busy)} onClick={() => savePresentation(message.id, action)}>{action.status === 'saving' ? 'Salvataggio…' : 'Conferma e salva la presentazione'}</button>}{action.error && <p className="lw-error" role="alert">{action.error}</p>}</section>;
    return null;
  }

  if (workspace.ownerId !== ownerId) return <section className="lia-workspace" role="status">Caricamento del tuo spazio…</section>;
  return <section className="lia-workspace lia-guided-home" aria-labelledby="lia-workspace-title">
    <header className="lw-heading"><div className="lw-identity"><LiaAvatar size={64} knowledge={knowledge} thinking={Boolean(busy)} /><div><span>Sono LIA, la tua assistente</span><h1 id="lia-workspace-title">{{plan:'Il piano delle attività',content:'Miglioriamo un contenuto',statistics:'Le statistiche del tuo sito'}[panel] || 'Facciamo un passo insieme.'}</h1></div></div>{panel ? <button type="button" className="lw-text-button" onClick={() => onPanelChange?.('')}>← Torna al consiglio di LIA</button> : <p>Una cosa alla volta. Ti accompagno io.</p>}</header>
    <div className="lw-home-content" style={panel ? {display:'none'} : undefined}>
    {error && <div className="lw-context-warning" role="alert"><p>Non riesco ad aggiornare i dati del tuo spazio: {error}</p><button type="button" className="lw-secondary" disabled={Boolean(busy) || loading} onClick={onRefresh}>Aggiorna i dati</button></div>}
    <details className={`lw-recommendation${conversationStarted ? ' has-conversation' : ''}`} open={!conversationStarted}><summary>Il consiglio di LIA</summary><section className="lw-briefing" aria-labelledby="lia-briefing-title" aria-busy={workspace.briefingStatus === 'pending'}>
      <div className="lw-briefing-heading"><div><span className="lw-eyebrow">TI CONSIGLIO DI PARTIRE DA QUI</span><h2 id="lia-briefing-title">{briefing?.nextStep?.title || 'Scegliamo il prossimo passo'}</h2></div></div>
      {briefing ? <><p className="lw-briefing-report">{briefing.text}</p>{briefing.nextStep?.reason && <p className="lw-step-reason">{briefing.nextStep.reason}</p>}<button type="button" className="lw-primary lw-start-together" disabled={Boolean(busy) || loading || Boolean(error)} onClick={() => startTask(briefing.nextStep?.prompt || `Aiutami a fare il prossimo passo che mi hai consigliato: ${briefing.text}. Scegli una sola attività e accompagnami a svolgerla, con una domanda alla volta se serve.`,briefing.nextStep?.postId || null)}>Facciamolo insieme <span aria-hidden="true">→</span></button><p className="lw-step-help">Ti guido qui, un passo alla volta. Prima di cambiare qualcosa, te lo mostro.</p>{Boolean(briefing.actions.length) && <div className="lw-action-list">{briefing.actions.map(action => renderAction(briefing, action))}</div>}<details className="lw-report-details"><summary>Rivedi il consiglio di LIA</summary>{briefing.createdAt && <p>Preparato il {new Date(briefing.createdAt).toLocaleString('it-IT', { day:'numeric',month:'long',hour:'2-digit',minute:'2-digit' })}.</p>}<button type="button" className="lw-text-button" disabled={Boolean(busy) || loading || Boolean(error)} onClick={prepareBriefing}>Scegli di nuovo il prossimo passo</button></details></> : <p role="status">{loading ? 'Un momento: guardo le informazioni della tua attività…' : workspace.briefingStatus === 'pending' ? 'Sto scegliendo una cosa utile da fare insieme. Non devi compilare nulla.' : 'Puoi scrivermi qui sotto anche mentre il consiglio non è disponibile.'}</p>}
      {workspace.briefingStatus === 'error' && <div role="alert"><p className="lw-error">{workspace.briefingError || 'Non sono riuscita a preparare il consiglio. Puoi riprovare o scrivermi qui sotto.'}</p><button type="button" className="lw-secondary" disabled={Boolean(busy) || loading || Boolean(error)} onClick={prepareBriefing}>Riprova a consigliarmi</button></div>}
    </section></details>
    <details className="lw-conversation-entry" open={conversationStarted || workspace.briefingStatus === 'error'}><summary>Vuoi chiedermi un’altra cosa?</summary>
    <div className="lw-work-area"><div className="lw-conversation"><header className="lw-conversation-heading"><div><strong>{conversationStarted ? 'Continuiamo insieme' : 'Vuoi dirmi qualcosa?'}</strong><small>{busy || (conversationStarted ? 'Ti rispondo qui sotto.' : 'Puoi scrivermi con parole tue.')}</small></div><button type="button" className="lw-text-button" disabled={Boolean(busy)} onClick={() => { update({ ...initialState(ownerId, null), briefingStatus: workspace.briefingStatus, briefingError: workspace.briefingError, messages: [...(briefing ? [briefing] : []), welcome()] }); inputRef.current?.focus(); }}>Nuova conversazione</button></header>
      {workspace.contextPostId && <div className="lw-working-context"><span>Al lavoro su <strong>{posts.find(post => Number(post.id) === Number(workspace.contextPostId))?.edited_title || posts.find(post => Number(post.id) === Number(workspace.contextPostId))?.generated_title || `Contenuto #${workspace.contextPostId}`}</strong></span><button type="button" disabled={Boolean(busy)} onClick={() => update(current => ({ ...current, contextPostId: null, workFrom: current.messages.length }))}>Cambia argomento</button></div>}
      <div className="lw-log" style={conversationStarted ? undefined : {display:'none'}} ref={logRef} role="log" aria-label="Conversazione con LIA" aria-live="polite" aria-relevant="additions text">
        {conversationMessages.map((message, index) => message.local === 'start' ? null : <article key={message.id} className={`lw-message is-${message.role}`}><span className="lw-message-author">{message.role === 'assistant' ? 'LIA' : 'Tu'}</span><div className="lw-message-content"><p>{message.text}</p>{message.question && <p className="lw-question">{message.question}</p>}{index === conversationMessages.length - 1 && Boolean(message.options?.length) && <div className="lw-options">{message.options.map((option, optionIndex) => <button key={`${option}-${optionIndex}`} type="button" disabled={Boolean(busy)} onClick={() => message.local ? localChoice(message, option) : ask(option)}>{option}</button>)}</div>}{message.warnings?.map((warning, warningIndex) => <p className="lw-note" key={warningIndex}>{warning}</p>)}{Boolean(message.actions?.length) && <div className="lw-action-list">{message.actions.map(action => renderAction(message, action))}</div>}</div></article>)}
        {busy && <div className="lw-thinking" role="status"><LiaAvatar size={32} knowledge={knowledge} thinking /><span>{busy}</span></div>}
        {workspace.chatFailure && <div className="lw-chat-failure" role="alert"><p>{workspace.chatFailure.message}</p><button type="button" className="lw-secondary" disabled={Boolean(busy)} onClick={() => ask('', true)}>Riprova</button></div>}
      </div>
      {!conversationStarted && <details className="lw-start-choices"><summary>Preferisco fare altro</summary><div className="lw-options">{STARTERS.map(choice => <button key={choice} type="button" disabled={Boolean(busy)} onClick={() => localChoice(conversationMessages.at(-1),choice)}>{choice}</button>)}</div></details>}
      <form className="lw-composer" onSubmit={event => { event.preventDefault(); ask(workspaceRef.current.input); }}><label htmlFor="lia-workspace-input">Scrivi a LIA</label><textarea id="lia-workspace-input" ref={inputRef} rows={2} maxLength={2000} value={workspace.input || ''} onChange={event => update(current => ({ ...current, input: event.target.value }))} placeholder="Scrivimi come parleresti a una persona. Per esempio: non so cosa fare, aiutami tu." disabled={Boolean(busy)} /><div><small>{conversationStarted ? 'Puoi chiedermi di spiegare meglio o di cambiare la proposta.' : 'Se preferisci, raccontami qui quello che ti serve.'}</small><button type="submit" className="lw-primary" disabled={Boolean(busy) || !text(workspace.input, 2000)}>Invia a LIA</button></div></form>
    </div>
    </div></details>
    </div>
    <div className="lw-more-tools" style={panel === 'plan' ? undefined : {display:'none'}}><LiaAgenda token={token} site={site} posts={posts} loading={loading} busy={Boolean(busy)} onWork={startTask}/></div>
    <div className="lw-content-tools" style={panel === 'content' ? undefined : {display:'none'}}><LiaTaskPanel sources={sources} posts={posts} loading={loading} busy={Boolean(busy)} onChoose={startTask} onPostEdit={onPostEdit}/>{onWrite && <button type="button" className="lw-secondary" onClick={() => onWrite('')}>Scrivi senza assistente</button>}</div>
    <div className="lw-statistics-panel" style={panel === 'statistics' ? undefined : {display:'none'}}>{statistics}</div>
  </section>;
}
