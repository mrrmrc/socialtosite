import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './OpportunityWorkspace.css';

const GOALS = ['Ricevere richieste', 'Far conoscere ciò che faccio', 'Aiutare il mio pubblico', 'Presentare lavori e competenze'];
const decode = value => { if (typeof value !== 'string') return value || {}; try { return JSON.parse(value) || {}; } catch { return {}; } };

export function OpportunityWorkspace({ data, token, onNavigate, onRefresh, onCreateWeb, onCreateSocial, onOpenPost, onWrite }) {
  const cards = data?.opportunities || [];
  const strategy = decode(data?.site?.site_understanding).declared_strategy || {};
  const savedGoal = strategy.primary_goal || '';
  const [goal, setGoal] = useState(savedGoal);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [answers, setAnswers] = useState({});
  const [platform, setPlatform] = useState('instagram');
  const abort = useRef(null);
  const proposal = useRef(null);
  useEffect(() => { setGoal(savedGoal); }, [savedGoal]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (prepared) { proposal.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); proposal.current?.focus({ preventScroll: true }); }
  }, [prepared?.id]);
  useEffect(() => {
    if (prepared && !cards.some(card => card.id === prepared.id)) { setPrepared(null); setAnswers({}); }
  }, [data]);

  async function saveGoal(event) {
    event.preventDefault();
    if (!goal.trim()) return;
    setSaving(true); setError('');
    try {
      await apiFetch('/api/index.php?action=site-update', { method: 'POST', body: JSON.stringify({ site_understanding_corrections: { declared_strategy: { primary_goal: goal.trim() } } }) }, token);
      await onRefresh();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function prepare(card) {
    if (card.next_action.type === 'navigate') return onNavigate(card.next_action.target);
    setBusy(card.id); setError(''); setPrepared(null); setAnswers({});
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const result = await apiFetch('/api/index.php?action=opportunity-prepare', { method: 'POST', body: JSON.stringify({ id: card.id }), signal: controller.signal }, token);
      setPrepared({ id: card.id, card: result.opportunity || card, brief: result.brief });
    } catch (err) { setError(err.name === 'AbortError' ? 'La preparazione sta richiedendo troppo tempo. Puoi riprovare: nessun contenuto è stato pubblicato.' : err.message); }
    finally { clearTimeout(timer); setBusy(''); }
  }

  async function execute(channel) {
    if (!prepared) return;
    const details = Object.entries(answers).filter(([, value]) => value.trim()).map(([question, value]) => `${question}: ${value.trim()}`).join('\n');
    const brief = { ...prepared.brief, reason: [prepared.brief.reason, details && `Informazioni confermate da me:\n${details}`].filter(Boolean).join('\n\n') };
    setBusy(channel); setError('');
    try {
      if (channel === 'update') onOpenPost(prepared.card.next_action.post_id, brief);
      else if (channel === 'social') {
        if (await onCreateSocial(brief, platform) === false) setError('La preparazione del post non è riuscita. Puoi riprovare: nessun contenuto è stato pubblicato.');
      } else if (await onCreateWeb(brief) === false) setError('La bozza non è pronta. Controlla il messaggio di LIA prima di riprovare.');
    } catch (err) { setError(err.message); }
    finally { setBusy(''); }
  }

  const questions = prepared?.brief.questions || [];
  const incomplete = questions.some(question => !String(answers[question] || '').trim());
  const update = prepared?.card.next_action.type === 'improve_content';
  const metrics = data?.visibility || {};
  const tracked = Boolean(metrics.tracking_started);
  return <section className="opportunity-workspace" aria-labelledby="opportunities-title">
    <div className="opportunity-heading"><div><span className="opportunity-eyebrow">LIA × IDEA</span><h2 id="opportunities-title">Il tuo prossimo passo per farti trovare.</h2><p>Parto da ciò che fai e dai tuoi contenuti. Scelgo un intervento utile per il web e i social, spiegandoti perché.</p></div><span className="opportunity-direction">Social ↔ Web</span></div>
    <form className="opportunity-goal" onSubmit={saveGoal}>
      <label htmlFor="opportunity-goal">Che cosa vuoi ottenere adesso?</label>
      <div><input id="opportunity-goal" list="opportunity-goals" value={goal} maxLength={300} onChange={event => setGoal(event.target.value)} placeholder="Per esempio: far conoscere un servizio, ricevere richieste…" /><datalist id="opportunity-goals">{GOALS.map(item => <option key={item} value={item} />)}</datalist><button className="btn btn-outline" disabled={saving || !goal.trim() || goal.trim() === savedGoal} type="submit">{saving ? 'Salvo…' : 'Salva obiettivo'}</button></div>
      <small>{savedGoal ? `Obiettivo attuale: ${savedGoal}` : 'Puoi scriverlo con parole tue. Nessuna categoria obbligatoria.'}</small>
    </form>
    <div className="opportunity-cards">{cards.map((card, index) => <article className="opportunity-card" key={card.id}>
      <header><span className="opportunity-number">0{index + 1}</span><span className={`opportunity-evidence ${card.evidence.kind === 'hypothesis' ? 'is-hypothesis' : ''}`}>{card.evidence.kind === 'hypothesis' ? 'Ipotesi da verificare' : 'Dai tuoi dati'}</span></header>
      <h3>{card.title}</h3><p>{card.reason}</p>
      <details><summary>Perché questa proposta</summary><p>{card.evidence.label}</p>{card.evidence.query && <p>«{card.evidence.query}» · {card.evidence.impressions} impression · {card.evidence.clicks} clic</p>}<p>{card.measurement}</p></details>
      <button type="button" className={`btn ${index === 0 ? 'btn-primary' : 'btn-outline'}`} disabled={Boolean(busy) || saving} onClick={() => prepare(card)}>{busy === card.id ? 'LIA prepara la proposta…' : card.next_action.type === 'navigate' ? 'Completa questo passo' : 'Prepara con LIA'}</button>
      {onWrite && card.next_action.type !== 'navigate' && <button type="button" className="btn btn-ghost" onClick={() => card.next_action.post_id ? onOpenPost(card.next_action.post_id) : onWrite(card.title)}>{card.next_action.post_id ? 'Apri e modifica tu' : 'Scrivi tu su questo tema'}</button>}
    </article>)}</div>
    {!cards.length && <p className="opportunity-empty">Collega un canale o racconta a LIA che cosa fai. Le proposte partiranno dalle tue informazioni, senza inventare ricerche o risultati.</p>}
    {error && <p className="opportunity-error" role="alert">{error}</p>}
    {prepared && <section ref={proposal} tabIndex={-1} className="opportunity-prepared" aria-label="Proposta preparata da LIA" aria-live="polite">
      <div className="opportunity-prepared-top"><strong>La proposta è pronta. Decidi tu dove usarla.</strong><button type="button" disabled={Boolean(busy)} onClick={() => setPrepared(null)} aria-label="Chiudi proposta">×</button></div>
      <label>Titolo<input value={prepared.brief.title} maxLength={200} onChange={event => setPrepared({ ...prepared, brief: { ...prepared.brief, title: event.target.value } })} /></label>
      <label>Intervento proposto<textarea value={prepared.brief.reason} maxLength={1200} rows={3} onChange={event => setPrepared({ ...prepared, brief: { ...prepared.brief, reason: event.target.value } })} /></label>
      <dl>{[['Obiettivo', prepared.brief.objective], ['Taglio social', prepared.brief.social_angle], ['Formato', prepared.brief.format]].filter(([, value]) => value).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
      {questions.length > 0 && <fieldset><legend>Per essere precisa, LIA ha bisogno di questi dettagli</legend>{questions.map(question => <label key={question}>{question}<input maxLength={600} value={answers[question] || ''} onChange={event => setAnswers({ ...answers, [question]: event.target.value })} /></label>)}</fieldset>}
      <div className="opportunity-delivery"><label>Social<select aria-label="Social per la proposta" value={platform} onChange={event => setPlatform(event.target.value)}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="linkedin">LinkedIn</option><option value="tiktok">TikTok</option></select></label><button type="button" className="btn btn-primary" disabled={Boolean(busy) || incomplete || !prepared.brief.title.trim()} onClick={() => execute('social')}>{busy === 'social' ? 'IDEA sta scrivendo…' : 'IDEA: prepara il post social'}</button><button type="button" className="btn btn-outline" disabled={Boolean(busy) || (!update && incomplete) || !prepared.brief.title.trim()} onClick={() => execute(update ? 'update' : 'web')}>{busy === 'web' ? 'Preparo la bozza…' : update ? 'Apri il contenuto con la proposta' : 'Prepara la bozza web'}</button></div>
      <small>Prepariamo una bozza da controllare. La pubblicazione e la condivisione richiedono una tua scelta. {update && 'Il testo esistente resta conservato: la proposta ti guida nella revisione.'}</small>
    </section>}
    <footer className="opportunity-results"><div><strong>{tracked ? Number(metrics.unique_visitors || 0).toLocaleString('it-IT') : '—'}</strong><span>Visitatori giornalieri stimati · somma su 30 gg</span></div><div><strong>{metrics.latest_search_date ? Number(metrics.clicks || 0).toLocaleString('it-IT') : '—'}</strong><span>Clic Google · {metrics.latest_search_date ? 'dati ricevuti' : 'dati non disponibili'}</span></div><div><strong>{tracked ? Number(metrics.actions || 0).toLocaleString('it-IT') : '—'}</strong><span>Clic sui contatti · non richieste confermate</span></div><button type="button" onClick={() => onNavigate('seo')}>Leggi i risultati →</button></footer>
  </section>;
}
