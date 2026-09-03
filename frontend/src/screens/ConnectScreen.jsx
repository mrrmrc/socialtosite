import React, { useEffect, useState } from 'react';
import { apiFetch, SOCIAL, detectPlatformFromUrl } from '../utils/api';
import { SocialIcon } from '../components/SocialIcon';

export function ConnectScreen({ token, onDone }) {
  const [sources, setSources] = useState([]);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadSources(); }, []);

  async function loadSources() {
    try {
      const result = await apiFetch('/api/index.php?action=social-sources', {}, token);
      setSources(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    }
  }

  async function addSource(event) {
    event.preventDefault();
    const platform = detectPlatformFromUrl(url);
    if (!platform) {
      setMessage({ ok: false, text: 'Inserisci un URL pubblico di Facebook, Instagram, TikTok, YouTube, X oppure di un sito web.' });
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const result = await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: label.trim() || SOCIAL[platform]?.label || 'Fonte', url: url.trim() }),
      }, token);
      const report = result?.scan_report;
      const detail = report ? ` Trovati ${report.found || 0} contenuti; ${report.imported || 0} importati.` : '';
      setUrl(''); setLabel('');
      setMessage({ ok: true, text: `Fonte aggiunta.${detail}` });
      await loadSources();
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  }

  const detected = detectPlatformFromUrl(url);
  return (
    <div style={{ minHeight: '100vh', padding: '3rem 1rem', background: 'var(--bg)' }}>
      <main style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>Aggiungi le tue fonti</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 17 }}>Incolla un profilo, un canale o un singolo post pubblico. SocialToSite lo legge tramite Refetch(er), senza chiederti accessi social.</p>
        </header>

        {message && <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: message.ok ? 'var(--teal-light)' : 'var(--red-light)', color: message.ok ? '#0F6E56' : 'var(--red)' }}>{message.text}</div>}

        <section className="card">
          <form onSubmit={addSource} style={{ display: 'grid', gap: 12 }}>
            <label><span style={{ display: 'block', marginBottom: 6 }}>URL pubblico</span><input type="url" required placeholder="https://www.instagram.com/nome/" value={url} onChange={event => setUrl(event.target.value)} style={{ width: '100%' }} /></label>
            {detected && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}><SocialIcon platform={detected} size={18} /> {SOCIAL[detected]?.label} riconosciuto</div>}
            <label><span style={{ display: 'block', marginBottom: 6 }}>Etichetta (opzionale)</span><input value={label} onChange={event => setLabel(event.target.value)} placeholder="Es. Canale principale" style={{ width: '100%' }} /></label>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Leggo la fonte…' : 'Aggiungi e acquisisci'}</button>
          </form>
        </section>

        <section className="card" style={{ marginTop: 20, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Fonti attive</h2>
          {sources.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Non hai ancora aggiunto fonti.</p>}
          {sources.map(source => <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}><SocialIcon platform={source.platform} size={22} /><a href={source.url} target="_blank" rel="noopener">{source.label || source.url}</a></div>)}
        </section>

        <button className="btn btn-primary" onClick={onDone} disabled={sources.length === 0} style={{ width: '100%', marginTop: 24, padding: 18 }}>Continua con {sources.length} {sources.length === 1 ? 'fonte' : 'fonti'}</button>
      </main>
    </div>
  );
}
