import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';

const CONCEPTS = [
  ['pulse', '01', 'Pulse Wall', 'Tutto ciò che è vivo, subito.', 'Scoperta rapida e ritorni frequenti', 'Molti stimoli insieme', [5, 4, 3]],
  ['stories', '02', 'Storie', 'Un racconto alla volta, a schermo pieno.', 'Emozione e uso da smartphone', 'Consultazione meno rapida', [4, 5, 4]],
  ['constellation', '03', 'Costellazione', 'I contenuti si incontrano per affinità.', 'Esplorazione e relazioni inattese', 'Richiede curiosità', [5, 5, 2]],
  ['timeline', '04', 'Memoria', 'Il luogo raccontato nel tempo.', 'Storia, stagioni e autorevolezza', 'Meno orientata all’azione', [3, 4, 5]],
  ['compass', '05', 'Bussola', 'Parti da ciò che vuoi fare.', 'Utenti con un bisogno preciso', 'Dipende da intenti ben definiti', [4, 3, 5]],
  ['mixer', '06', 'Mixer', 'Scegli il linguaggio, non la pagina.', 'Pubblici e formati differenti', 'Più funzionale che emotiva', [4, 3, 5]],
  ['cinema', '07', 'Cinema', 'Prima vivi, poi approfondisci.', 'Patrimonio fotografico e video', 'Esige media di qualità', [3, 5, 4]],
  ['answers', '08', 'Risposte', 'Entri attraverso una domanda reale.', 'Utilità, Google e decisioni', 'Meno sorprendente visivamente', [4, 3, 5]],
  ['atlas', '09', 'Atlante', 'Esplora il mondo di San Germano.', 'Offerta ampia e temi riconoscibili', 'Serve una tassonomia curata', [5, 4, 4]],
  ['adaptive', '10', 'Adesso', 'Lo spazio cambia con ciò che conta ora.', 'Rilevanza, eventi e stagionalità', 'Richiede regole editoriali', [5, 4, 5]],
].map(([id, n, name, line, best, risk, scores]) => ({ id, n, name, line, best, risk, scores }));

const FALLBACK = [
  { id: 1, generated_title: 'Il sapore della campagna, vicino a Roma', generated_excerpt: 'Un’esperienza fatta di cucina, natura e accoglienza.', platform: 'instagram', tags: ['ristorante', 'natura'] },
  { id: 2, generated_title: 'Una giornata da vivere senza fretta', generated_excerpt: 'Scopri gli spazi, le persone e i ritmi di San Germano.', platform: 'facebook', tags: ['esperienze'] },
  { id: 3, generated_title: 'Dalla terra alla tavola', generated_excerpt: 'Dietro ogni piatto c’è una storia che nasce qui.', platform: 'instagram', tags: ['cucina'] },
];

const title = post => post?.generated_title || 'Una storia da scoprire';
const text = post => post?.generated_excerpt || 'Apri il contenuto e lasciati guidare dentro il mondo di San Germano.';
const date = value => value ? new Date(value).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Dal patrimonio social';
const bg = post => post?.media_url ? { backgroundImage: `linear-gradient(180deg, transparent, rgba(15,18,24,.88)), url("${post.media_url}")` } : {};

function Card({ post, wide = false }) {
  return <article className={`sv-card ${post?.media_url ? 'has-media' : ''} ${wide ? 'wide' : ''}`} style={bg(post)}><small>{post.platform || 'storia'}</small><h3>{title(post)}</h3><p>{text(post)}</p></article>;
}

function Experience({ type, posts, topics, selected, setSelected, filter, setFilter, intent, setIntent }) {
  const focus = posts[selected % posts.length];
  if (type === 'pulse') {
    const visible = filter === 'Tutto' ? posts : posts.filter(p => (p.tags || []).includes(filter));
    return <div className="sv-scene sv-pulse"><header><div><small>AGGIORNATO ORA</small><h2>Vivi San Germano</h2></div><strong>{visible.length} storie vive</strong></header><nav>{['Tutto', ...topics.slice(0, 5)].map(x => <button className={filter === x ? 'active' : ''} onClick={() => setFilter(x)} key={x}>{x}</button>)}</nav><main>{visible.slice(0, 9).map((p, i) => <Card key={p.id} post={p} wide={i === 0 || i === 5} />)}</main></div>;
  }
  if (type === 'stories') return <div className="sv-scene sv-stories" style={bg(focus)}><div className="sv-progress">{posts.slice(0, 6).map((_, i) => <i className={i === selected % 6 ? 'active' : ''} key={i} />)}</div><button className="sv-side left" onClick={() => setSelected((selected - 1 + posts.length) % posts.length)} aria-label="Precedente" /><button className="sv-side right" onClick={() => setSelected((selected + 1) % posts.length)} aria-label="Successiva" /><main><small>{focus.platform} · {date(focus.published_at)}</small><h2>{title(focus)}</h2><p>{text(focus)}</p><button>Scopri la storia →</button></main></div>;
  if (type === 'constellation') return <div className="sv-scene sv-constellation"><main><div><small>ORA STAI ESPLORANDO</small><strong>{title(focus)}</strong></div>{topics.slice(0, 6).map((x, i) => <button style={{ '--i': i }} key={x} onClick={() => setSelected(i)}>{x}</button>)}</main><aside><small>CONNESSIONI TROVATE</small><h2>Ogni storia apre nuove strade</h2><p>{text(focus)}</p>{posts.slice(0, 3).map((p, i) => <button key={p.id} onClick={() => setSelected(i)}><span>0{i + 1}</span>{title(p)}</button>)}</aside></div>;
  if (type === 'timeline') return <div className="sv-scene sv-timeline"><header><small>MEMORIA VIVA</small><h2>San Germano, nel tempo</h2><p>Non un archivio: la storia continua di un luogo.</p></header><main>{posts.slice(0, 7).map((p, i) => <article key={p.id}><time>{date(p.published_at)}</time><i /><div>{p.media_url && <img src={p.media_url} alt="" />}<small>CAPITOLO {String(i + 1).padStart(2, '0')}</small><h3>{title(p)}</h3><p>{text(p)}</p></div></article>)}</main></div>;
  if (type === 'compass') {
    const choices = [['eat', 'Voglio mangiare bene'], ['live', 'Voglio vivere un’esperienza'], ['nature', 'Voglio stare nella natura'], ['know', 'Voglio conoscere il luogo']];
    return <div className="sv-scene sv-compass"><header><small>NON CERCARE UNA PAGINA</small><h2>Cosa vuoi vivere?</h2><p>Lo spazio costruisce il percorso intorno al tuo desiderio.</p></header><nav>{choices.map(([id, label]) => <button className={intent === id ? 'active' : ''} onClick={() => setIntent(id)} key={id}><i />{label}<span>→</span></button>)}</nav><main><small>IL TUO PERCORSO</small><h2>{choices.find(x => x[0] === intent)?.[1]}</h2><div>{posts.slice(0, 4).map(p => <Card key={p.id} post={p} />)}</div></main></div>;
  }
  if (type === 'mixer') {
    const groups = [['Da guardare', posts.filter(p => p.media_url)], ['Da leggere', posts.filter(p => !p.media_url)], ['Dai social', posts.filter(p => p.platform)]];
    return <div className="sv-scene sv-mixer"><header><small>IL TUO MIX PERSONALE</small><h2>Come vuoi entrare?</h2><p>Lo stesso mondo, nel linguaggio che preferisci.</p></header><main>{groups.map(([name, list], i) => <section key={name}><h3><span>0{i + 1}</span>{name}</h3>{(list.length ? list : posts).slice(0, 4).map(p => <button key={p.id}>{p.media_url && <img src={p.media_url} alt="" />}<strong>{title(p)}</strong><i>↗</i></button>)}</section>)}</main></div>;
  }
  if (type === 'cinema') {
    const media = posts.filter(p => p.media_url).length ? posts.filter(p => p.media_url) : posts;
    const hero = media[selected % media.length];
    return <div className="sv-scene sv-cinema"><main style={bg(hero)}><b>SAN GERMANO / VISIONI</b><div><small>IN PRIMO PIANO</small><h2>{title(hero)}</h2><p>{text(hero)}</p><button>▶ Guarda e scopri</button></div></main><nav>{media.slice(0, 6).map((p, i) => <button className={i === selected % media.length ? 'active' : ''} key={p.id} onClick={() => setSelected(i)} style={bg(p)}><span>0{i + 1}</span><strong>{title(p)}</strong></button>)}</nav></div>;
  }
  if (type === 'answers') {
    const qs = ['Cosa si può vivere a San Germano?', 'Dove mangiare vicino Roma?', 'Cosa rende speciale questo luogo?', 'Quali esperienze posso prenotare?', 'Cosa c’è di nuovo questo mese?'];
    return <div className="sv-scene sv-answers"><header><small>CHIEDI AL LUOGO</small><h2>Da dove vuoi cominciare?</h2><div>⌕ <strong>{qs[selected % qs.length]}</strong><button>Chiedi</button></div></header><main><nav>{qs.map((q, i) => <button className={i === selected % qs.length ? 'active' : ''} onClick={() => setSelected(i)} key={q}>{q}<span>→</span></button>)}</nav><article><small>RISPOSTA COSTRUITA DAI CONTENUTI</small><h3>{title(focus)}</h3><p>{text(focus)}</p><em>✓ Fonte: contenuto pubblicato su {focus.platform || 'Spazio Vivo'}</em><button>Apri l’approfondimento →</button></article></main></div>;
  }
  if (type === 'atlas') {
    const regions = (topics.length ? topics : ['Cucina', 'Natura', 'Esperienze', 'Territorio']).slice(0, 6);
    return <div className="sv-scene sv-atlas"><header><div><small>ATLANTE DI SAN GERMANO</small><h2>Un luogo, molti mondi.</h2></div><p>Scegli un territorio tematico e attraversalo.</p></header><main><nav>{regions.map((x, i) => <button className={i === selected % regions.length ? 'active' : ''} onClick={() => setSelected(i)} key={x} style={{ '--i': i }}><span>0{i + 1}</span>{x}</button>)}</nav><article style={bg(focus)}><small>STAI ESPLORANDO</small><h2>{regions[selected % regions.length]}</h2><p>{title(focus)}</p><button>Entra nel territorio →</button></article></main></div>;
  }
  return <div className="sv-scene sv-adaptive"><header><div><small>SABATO · PER TE ADESSO</small><h2>Buongiorno da San Germano.</h2></div><strong><i /> SPAZIO VIVO</strong></header><main><article style={bg(posts[0])}><div><small>DA NON PERDERE ORA</small><h2>{title(posts[0])}</h2><p>{text(posts[0])}</p><button>Scopri adesso →</button></div></article><aside><section><small>IN BASE AL MOMENTO</small><h3>Il prossimo passo giusto</h3>{posts.slice(1, 4).map((p, i) => <button key={p.id}><span>0{i + 1}</span><strong>{title(p)}</strong><i>→</i></button>)}</section><section className="sv-why"><span>✦</span><div><small>PERCHÉ LO VEDI</small><strong>Freschezza, stagione e interessi si combinano.</strong></div></section></aside></main></div>;
}

export function SpazioVivoLab({ token, adminPreview = false, onConfirmed }) {
  const [data, setData] = useState(); const [error, setError] = useState(''); const [active, setActive] = useState('pulse');
  const [selected, setSelected] = useState(0); const [filter, setFilter] = useState('Tutto'); const [intent, setIntent] = useState('eat');
  const [fullscreen, setFullscreen] = useState(false); const [shortlist, setShortlist] = useState([]);
  const [confirmed, setConfirmed] = useState(''); const [saving, setSaving] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const endpoint = adminPreview ? 'admin-spazio-vivo-lab' : 'spazio-vivo-modes'; apiFetch(`/api/index.php?action=${endpoint}`, {}, token).then(result => { const savedMode = result.profile?.living_space_mode || ''; setData(result); setConfirmed(savedMode); if (savedMode && CONCEPTS.some(x => x.id === savedMode)) setActive(savedMode); }).catch(e => setError(e.message)); }, [token, adminPreview]);
  useEffect(() => { setSelected(0); setFilter('Tutto'); }, [active]);
  useEffect(() => { const close = e => e.key === 'Escape' && setFullscreen(false); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const posts = data?.posts?.length ? data.posts : FALLBACK;
  const realPostCount = data?.posts?.length || 0;
  const topics = useMemo(() => { const counts = {}; posts.forEach(p => (p.tags || []).forEach(t => { if (t && t.length < 28) counts[t] = (counts[t] || 0) + 1; })); const found = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(x => x[0]); return found.length ? found : ['Cucina', 'Natura', 'Esperienze', 'Territorio', 'Persone', 'Eventi']; }, [posts]);
  const concept = CONCEPTS.find(x => x.id === active); const chosen = shortlist.includes(active);
  const toggle = () => setShortlist(old => chosen ? old.filter(x => x !== active) : [...old, active]);
  const confirmMode = async () => { setSaving(true); setMessage(''); try { await apiFetch('/api/index.php?action=spazio-vivo-mode', { method: 'POST', body: JSON.stringify({ mode: active }) }, token); setConfirmed(active); setMessage(`${concept.name} è ora la modalità pubblica del tuo Spazio Vivo.`); if (onConfirmed) onConfirmed(active); } catch (e) { setMessage(e.message); } finally { setSaving(false); } };
  if (error) return <div className="glass-modal sv-lab-message"><strong>Laboratorio non disponibile</strong><p>{error}</p></div>;
  if (!data) return <div className="glass-modal sv-lab-message"><i /><strong>Sto costruendo le 10 esperienze con i contenuti di San Germano…</strong></div>;
  return <section className={`sv-lab ${fullscreen ? 'is-fullscreen' : ''}`}>
    <header className="sv-lab-head"><div><span>{adminPreview ? 'LAB PRIVATO · SOLO ADMIN · CAVIA: SANGERMANO' : 'IL TUO SPAZIO VIVO · SCEGLI COME FAR ENTRARE LE PERSONE'}</span><h2>10 modi di entrare in uno Spazio Vivo</h2><p>{adminPreview ? 'Non template di siti web, ma dieci architetture di fruizione. Provale e valuta come cambia la scoperta dei contenuti.' : 'Prova liberamente tutte le anteprime. Il sito cambia soltanto quando confermi la modalità che preferisci.'}</p></div><div><strong>{realPostCount || posts.length}</strong><span>{realPostCount ? 'contenuti reali' : 'contenuti dimostrativi'}<br />in anteprima</span></div></header>
    <nav className="sv-picker">{CONCEPTS.map(x => <button className={x.id === active ? 'active' : ''} onClick={() => setActive(x.id)} key={x.id}><span>{x.n}</span><strong>{x.name}</strong><small>{x.line}</small>{shortlist.includes(x.id) && <i>★</i>}</button>)}</nav>
    <div className="sv-decision"><div><span>PROPOSTA {concept.n}{confirmed === active ? ' · ATTIVA' : ''}</span><strong>{concept.name}</strong><p>{concept.line}</p></div><dl><div><dt>Ideale per</dt><dd>{concept.best}</dd></div><div><dt>Attenzione</dt><dd>{concept.risk}</dd></div></dl><section>{['Scoperta', 'Impatto', 'Orientamento'].map((label, i) => <div key={label}><span>{label}</span><i>{[0, 1, 2, 3, 4].map(n => <b className={n < concept.scores[i] ? 'on' : ''} key={n} />)}</i></div>)}</section><aside>{adminPreview && <button className={chosen ? 'chosen' : ''} onClick={toggle}>{chosen ? '★ In selezione' : '☆ Metti in selezione'}</button>}<button onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? 'Riduci' : 'Schermo intero'} ↗</button>{!adminPreview && <button className="sv-confirm" onClick={confirmMode} disabled={saving || confirmed === active}>{saving ? 'Conferma…' : confirmed === active ? '✓ Modalità attiva' : 'Conferma questa modalità'}</button>}</aside></div>
    <div className="sv-preview"><div className="sv-chrome"><span><i /><i /><i /></span><strong>Anteprima interattiva · {data.profile?.name}</strong><em>{concept.name}</em></div><Experience type={active} posts={posts} topics={topics} selected={selected} setSelected={setSelected} filter={filter} setFilter={setFilter} intent={intent} setIntent={setIntent} /></div>
    <footer className="sv-lab-foot">{adminPreview ? <><strong>La tua selezione</strong>{shortlist.length ? shortlist.map(id => { const x = CONCEPTS.find(c => c.id === id); return <button onClick={() => setActive(id)} key={id}>{x.n} · {x.name}</button>; }) : <span>Nessuna finalista selezionata.</span>}</> : <><strong>Modalità pubblica</strong><span>{CONCEPTS.find(x => x.id === confirmed)?.name || 'Da scegliere'}</span>{message && <em>{message}</em>}<a href={`/${data.profile?.slug || ''}`} target="_blank" rel="noopener">Apri lo Spazio Vivo ↗</a></>}<small>{adminPreview ? 'Nessuna prova modifica lo Spazio Vivo pubblico.' : 'Le anteprime non modificano il sito. Serve sempre una conferma.'}</small></footer>
  </section>;
}
