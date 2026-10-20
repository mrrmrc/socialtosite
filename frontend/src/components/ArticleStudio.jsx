import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './ArticleStudio.css';

export function ArticleStudio({ token, onOpenEditor, onWrite, state, onStateChange }) {
  const [mode, setMode] = useState(state?.mode || 'proposals');
  const [brief, setBrief] = useState(state?.brief || { subject: '', objective: '', channel: 'Articolo web', instructions: '', length: '400-600 parole' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(state?.result || null);
  const controller = useRef(null);
  const resultsRef = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { onStateChange?.({ mode, brief, result }); }, [mode, brief, result, onStateChange]);
  useEffect(() => { if (result) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [result]);
  const set = (key, value) => setBrief(current => ({ ...current, [key]: value }));
  async function generate(event, proposal = null) {
    event?.preventDefault();
    if (busy) return;
    const request = { ...brief, mode: proposal ? 'articles' : mode, ...(proposal ? { proposal, subject: `${proposal.title}\n${proposal.angle}\n${proposal.outline.join('\n')}` } : {}) };
    if (request.mode === 'articles' && !request.subject.trim()) { setError('Spiega di cosa devono parlare gli articoli.'); return; }
    setBusy(true); setError(''); setResult(null);
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 160000);
    try {
      const response = await apiFetch('/api/index.php?action=article-studio', { method: 'POST', body: JSON.stringify(request), signal: controller.current.signal }, token);
      const entries = request.mode === 'proposals' ? response.proposals : response.articles;
      if (!Array.isArray(entries) || entries.length !== (proposal ? 1 : 2)) throw new Error('La risposta è incompleta. Le indicazioni inserite sono conservate: riprova.');
      setResult(response);
    } catch (err) { setError(err.name === 'AbortError' ? 'La generazione ha richiesto troppo tempo. Le tue indicazioni restano qui: puoi riprovare.' : err.message); }
    finally { clearTimeout(timer); setBusy(false); }
  }
  return <section className="article-studio" aria-labelledby="article-studio-title">
    <header><span className="section-eyebrow">IDEA · il tuo studio di scrittura</span><h2 id="article-studio-title">Come vuoi creare il tuo articolo?</h2><p>Scegli il punto di partenza. Ogni testo si apre nell’editor completo e diventa una bozza salvata solo quando lo decidi tu.</p></header>
    <div className="article-studio-paths" role="group" aria-label="Come creare un articolo">
      <button type="button" aria-pressed={mode === 'proposals'} disabled={busy} onClick={() => { setMode('proposals'); setError(''); }}><strong>1. Trova 2 proposte per me</strong><span>Temi specifici per la tua attività e il tuo profilo, collegati a fonti recenti. Scegli quale far scrivere.</span></button>
      <button type="button" aria-pressed={mode === 'articles'} disabled={busy} onClick={() => { setMode('articles'); setError(''); }}><strong>2. Descrivi e genera 2 articoli</strong><span>Spiega di cosa devono occuparsi: l’IA scrive subito due articoli completi, con due tagli distinti.</span></button>
      <button type="button" disabled={busy} onClick={() => onWrite()}><strong>3. Scrivi liberamente</strong><span>Apri l’editor completo: formattazione, immagini, link, elenchi, citazioni, sintesi e tag. Senza IA.</span></button>
    </div>
    <form className="article-studio-form card" onSubmit={generate} aria-busy={busy}><fieldset disabled={busy} style={{ display: 'grid', gap: 20, minWidth: 0, padding: 0, border: 0, margin: 0 }}>
      <h3>{mode === 'proposals' ? 'Due proposte basate su profilo e attualità' : 'Racconta all’IA quali articoli vuoi'}</h3>
      <label>{mode === 'proposals' ? 'Tema da privilegiare (facoltativo)' : 'Di cosa devono parlare i due articoli?'}<textarea aria-label={mode === 'proposals' ? 'Tema da privilegiare (facoltativo)' : 'Di cosa devono parlare i due articoli?'} rows={4} maxLength={4000} required={mode === 'articles'} value={brief.subject} onChange={event => set('subject', event.target.value)} placeholder={mode === 'proposals' ? 'Lascia vuoto per partire dalla tua attività, oppure indica un tema preciso.' : 'Spiega il tema, i punti da trattare, i fatti e gli esempi da usare. Per esempio: due articoli su come la sonificazione aiuta a comprendere i dati.'} /></label>
      <div className="article-studio-fields"><label>Obiettivo<input value={brief.objective} maxLength={300} onChange={event => set('objective', event.target.value)} placeholder="Per esempio: spiegare, far riflettere, ricevere richieste" /></label><label>Destinazione<select aria-label="Destinazione" value={brief.channel} onChange={event => set('channel', event.target.value)}><option>Articolo web</option><option>LinkedIn</option><option>Facebook</option><option>Instagram</option><option>Newsletter</option></select></label><label>Lunghezza per articolo<select aria-label="Lunghezza per articolo" value={brief.length} onChange={event => set('length', event.target.value)}><option>400-600 parole</option><option>600-900 parole</option><option>900-1200 parole</option></select></label></div>
      <label>Indicazioni da rispettare<textarea aria-label="Indicazioni da rispettare" rows={3} maxLength={4000} value={brief.instructions} onChange={event => set('instructions', event.target.value)} placeholder="Pubblico, tono, esempi, cosa includere e cosa evitare. Queste indicazioni hanno priorità sul profilo." /></label>
      {error && <p role="alert" className="editor-save-error">{error}</p>}
      <div className="guided-home-actions"><button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'IDEA sta lavorando…' : mode === 'proposals' ? 'Genera 2 proposte specifiche' : 'Scrivi i 2 articoli completi'}</button><small>{busy ? 'La richiesta è in elaborazione. Puoi restare qui: nessun articolo sarà pubblicato.' : 'Il profilo orienta la scrittura. Argomento, obiettivo e indicazioni inseriti qui hanno precedenza.'}</small></div>
    </fieldset></form>
    {result && <section ref={resultsRef} className="article-studio-results" aria-label="Risultati di IDEA" aria-live="polite"><h3>{result.articles ? `${result.articles.length === 1 ? 'Il tuo articolo è pronto' : 'I due articoli sono pronti'}` : 'Le due proposte: scegli quale sviluppare'}</h3><details><summary>Indicazioni usate per questa generazione</summary><p><strong>Argomento:</strong> {result.brief?.subject || 'Dal profilo e dalle fonti recenti'}</p><p><strong>Obiettivo:</strong> {result.brief?.objective || 'Dal profilo'}</p><p><strong>Destinazione:</strong> {result.brief?.channel}</p><p><strong>Indicazioni:</strong> {result.brief?.instructions || 'Nessuna aggiunta'}</p></details><div className="article-studio-result-grid">
      {(result.proposals || result.articles || []).map((entry, index) => <article className="card" key={`${index}-${entry.title}`}><span className="section-eyebrow">{result.articles ? `Articolo ${index + 1} · ${entry.word_count} parole` : `Proposta ${index + 1}`}</span><h3>{entry.title}</h3>{result.proposals ? <><p>{entry.reason}</p><p><strong>Il taglio:</strong> {entry.angle}</p><ul>{entry.outline.map(point => <li key={point}>{point}</li>)}</ul><p><a href={entry.source_url} target="_blank" rel="noopener noreferrer">Fonte recente: {entry.source_title}</a><br /><small>{entry.published_at}</small></p><button type="button" className="btn btn-primary" disabled={busy} onClick={() => generate(null, entry)}>Scrivi questo articolo completo</button></> : <><p>{entry.excerpt}</p><div className="article-studio-preview" dangerouslySetInnerHTML={{ __html: entry.content }} /><button type="button" className="btn btn-primary" disabled={busy} onClick={() => onOpenEditor(entry)}>Apri nell’editor completo</button></>}</article>)}
    </div></section>}
  </section>;
}
