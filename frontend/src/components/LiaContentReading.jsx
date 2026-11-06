import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './LiaContentReading.css';

const platforms = { website: 'Sito esterno', manual: 'Il tuo sito', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok', x: 'X', youtube: 'YouTube' };
const statuses = { never_verified: 'Lettura da verificare', error: 'Ultima lettura non riuscita', imported: 'Estratti disponibili', no_sample: 'Nessun estratto leggibile' };

export function LiaContentReading({ token, busy, onNavigate, onRefresh, onAnalyze }) {
  const [reading, setReading] = useState(null);
  const [operation, setOperation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(null);
  const sequence = useRef(0);
  useEffect(() => {
    const revision = ++sequence.current;
    const controller = new AbortController();
    active.current = controller;
    setReading(null); setError(''); setNotice(''); setOperation('loading');
    apiFetch('/api/index.php?action=lia-reading', { signal: controller.signal }, token)
      .then(data => { if (!controller.signal.aborted && revision === sequence.current) { if (!Array.isArray(data.reading?.samples) || !Array.isArray(data.reading?.sources)) throw new Error('Non riesco ancora a verificare quali contenuti posso leggere.'); setReading(data.reading); } })
      .catch(failure => { if (!controller.signal.aborted && revision === sequence.current) setError(failure.message); })
      .finally(() => { if (revision === sequence.current) setOperation(''); });
    return () => { sequence.current++; controller.abort(); active.current?.abort(); };
  }, [token]);

  async function refresh(scan = true) {
    if (operation || busy) return;
    const revision = ++sequence.current;
    const controller = new AbortController(); active.current = controller;
    const timer = setTimeout(() => controller.abort(), 180000);
    setOperation(scan ? 'scan' : 'loading'); setError(''); setNotice('');
    try {
      let failures = [];
      if (scan) {
        const result = await apiFetch('/api/index.php?action=sync', { method: 'POST', body: JSON.stringify({ limit: 10 }), signal: controller.signal }, token);
        if (revision !== sequence.current) return;
        if (!Array.isArray(result.results) || !result.results.length) throw new Error('Nessun canale disponibile da leggere. Collega i tuoi canali o il sito.');
        failures = result.results.filter(source => source.error);
      }
      const data = await apiFetch('/api/index.php?action=lia-reading', { signal: controller.signal }, token);
      if (revision !== sequence.current) return;
      if (!Array.isArray(data.reading?.samples) || !Array.isArray(data.reading?.sources)) throw new Error('La verifica degli estratti non è riuscita.');
      setReading(data.reading);
      if(scan) {
        setNotice(failures.length ? `Lettura parziale: ${failures.length} canali non sono stati aggiornati. Controlla il dettaglio delle fonti prima di proseguire.` : 'Lettura terminata. Guarda gli estratti disponibili e chiedi a LIA di analizzarli.');
        await onRefresh?.();
      }
    } catch (failure) {
      if (revision === sequence.current) setError(failure.name === 'AbortError' ? 'La lettura richiede più tempo. Controlla gli estratti o riprova; non considero i canali aggiornati.' : failure.message);
    } finally { clearTimeout(timer); if (revision === sequence.current) setOperation(''); }
  }

  const sources = reading?.sources || [];
  const samples = reading?.samples || [];
  const disabled = Boolean(operation || busy);
  return <section className="lia-reading" aria-labelledby="lia-reading-title" aria-busy={Boolean(operation)}>
    <span className="lw-eyebrow">PRIMA LEGGIAMO, POI DECIDIAMO</span>
    <h2 id="lia-reading-title">Partiamo da quello che racconti già.</h2>
    <p>Leggo i contenuti disponibili del tuo sito e dei canali collegati. Poi ti mostro cosa ho capito e ti propongo cosa migliorare o creare.</p>
    {reading && <p className="lia-reading-summary">{samples.length === 1 ? '1 estratto leggibile disponibile' : samples.length > 1 ? `${samples.length} estratti leggibili disponibili` : 'Non ho ancora estratti sufficienti per analizzare la tua comunicazione.'} · {sources.length} fonti collegate.</p>}
    <div className="lw-actions">
      {!reading && error ? <button type="button" className="lw-primary" disabled={disabled} onClick={() => refresh(false)}>Riprova il controllo</button> : sources.length > 0 ? <button type="button" className="lw-primary" disabled={disabled} onClick={() => refresh(true)}>{operation === 'scan' ? 'Leggo sito e social…' : 'Leggi sito e social'}</button> : <button type="button" className="lw-primary" disabled={disabled} onClick={() => onNavigate?.('sources')}>Collega sito e social</button>}
      {samples.length > 0 && <button type="button" className="lw-secondary" disabled={disabled} onClick={() => onAnalyze?.('Analizza i testi che hai letto sul mio sito e sui social. Dimmi cosa ho già raccontato, un punto di forza e cosa manca. Poi proponimi un solo passo concreto, senza ripetere i contenuti esistenti.')}>Analizza ciò che hai letto</button>}
    </div>
    {operation === 'loading' && <p role="status">Controllo quali contenuti sono disponibili…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="lw-error">{error}</p>}
    {reading && <details className="lia-reading-details"><summary>Cosa può leggere LIA ({samples.length} estratti)</summary>
      <p>Sono campioni dei testi acquisiti, non una lettura completa o in tempo reale. L’ultima scansione indica un tentativo, anche quando il canale non è accessibile. I video richiedono una trascrizione leggibile.</p>
      <ul className="lia-reading-sources">{sources.map((source, index) => <li key={source.id || index}><strong>{source.name || platforms[source.platform] || source.platform}</strong><span>{statuses[source.status] || 'Stato da verificare'} · {source.sample_count || 0} estratti{source.sample_scope === 'platform' ? ' della piattaforma; account esatto da verificare' : ''}</span>{source.last_scan_at && <small>Ultimo tentativo: {source.last_scan_at}</small>}{source.last_scan_note && <small>{source.last_scan_note}</small>}</li>)}</ul>
      <ol className="lia-reading-samples">{samples.map((sample, index) => <li key={sample.id || index}><span>{platforms[sample.platform] || sample.platform}{sample.imported_at ? ` · Acquisito: ${sample.imported_at}` : ''}</span>{sample.content_origin === 'stored_site_rewrite' && <small>Rielaborazione salvata: il testo originale del sito non è disponibile.</small>}<strong>{sample.title || 'Contenuto senza titolo'}</strong><p>{sample.text}</p></li>)}</ol>
      {(reading.warnings || []).map((warning, index) => <p key={index}>{warning}</p>)}
    </details>}
  </section>;
}
