import React, { useEffect, useState } from 'react';
import { apiFetch, SOCIAL } from '../utils/api';
import { SocialIcon } from '../components/SocialIcon';

const OFFICIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'youtube'];

export function ConnectScreen({ token, onDone }) {
  const [connections, setConnections] = useState([]);
  const [sources, setSources] = useState([]);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'connected') setMessage({ ok: true, text: `${params.get('platform') || 'Canale'} collegato correttamente.` });
    if (params.get('oauth') === 'error') setMessage({ ok: false, text: params.get('message') || 'Collegamento non completato.' });
    if (params.has('oauth')) window.history.replaceState({}, '', window.location.pathname);
    loadChannels();
  }, []);

  async function loadChannels() {
    try {
      const [connected, websites] = await Promise.all([
        apiFetch('/api/index.php?action=social-connections', {}, token),
        apiFetch('/api/index.php?action=social-sources', {}, token),
      ]);
      setConnections(Array.isArray(connected) ? connected : []);
      setSources((Array.isArray(websites) ? websites : []).filter(source => source.platform === 'website'));
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    }
  }

  async function connect(platform) {
    setBusy(platform); setMessage(null);
    try {
      const result = await apiFetch(`/api/index.php?action=social-auth-url&platform=${encodeURIComponent(platform)}&return_to=${encodeURIComponent('/connect')}`, {}, token);
      window.location.assign(result.url);
    } catch (error) {
      setMessage({ ok: false, text: error.message }); setBusy('');
    }
  }

  async function disconnect(platform) {
    if (!window.confirm(`Scollegare ${SOCIAL[platform]?.label || platform}?`)) return;
    setBusy(platform); setMessage(null);
    try {
      await apiFetch('/api/index.php?action=social-disconnect', { method: 'POST', body: JSON.stringify({ platform }) }, token);
      setMessage({ ok: true, text: `${SOCIAL[platform]?.label || platform} scollegato.` });
      await loadChannels();
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy('');
    }
  }

  async function addWebsite(event) {
    event.preventDefault();
    setBusy('website'); setMessage(null);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST', body: JSON.stringify({ platform: 'website', label: 'Sito web', url: websiteUrl.trim() }),
      }, token);
      setWebsiteUrl(''); setMessage({ ok: true, text: 'Sito web aggiunto.' }); await loadChannels();
    } catch (error) { setMessage({ ok: false, text: error.message }); }
    finally { setBusy(''); }
  }

  const active = new Map(connections.filter(item => item.active).map(item => [item.platform, item]));
  const connectedCount = active.size + sources.length;

  return (
    <div style={{ minHeight: '100vh', padding: '3rem 1rem', background: 'var(--bg)' }}>
      <main style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1>Collega le tue fonti</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 17 }}>Autorizza i canali che possiedi. SocialToSite userà i contenuti come base per il tuo editor e il tuo sito.</p>
        </header>

        {message && <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: message.ok ? 'var(--teal-light)' : 'var(--red-light)', color: message.ok ? '#0F6E56' : 'var(--red)' }}>{message.text}</div>}

        <section className="card" style={{ display: 'grid', gap: 12 }}>
          {OFFICIAL_PLATFORMS.map(platform => {
            const connection = active.get(platform);
            return <div key={platform} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 14, border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <SocialIcon platform={platform} size={28} />
                <div><strong>{SOCIAL[platform]?.label || platform}</strong><div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{connection ? `Connesso come ${connection.handle || 'account autorizzato'}` : platform === 'instagram' ? 'Richiede un account Creator o Business' : 'Connessione ufficiale e sicura'}</div></div>
              </div>
              {connection
                ? <button className="btn btn-outline" onClick={() => disconnect(platform)}>Scollega</button>
                : <button className="btn btn-primary" disabled={busy === platform} onClick={() => connect(platform)}>{busy === platform ? 'Apro…' : `Collega ${SOCIAL[platform]?.label || platform}`}</button>}
            </div>;
          })}
        </section>

        <section className="card" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Aggiungi il sito web</h2>
          <p style={{ color: 'var(--text-muted)' }}>Il sito viene letto tramite feed RSS/Atom o, se assente, dalla pagina indicata.</p>
          <form onSubmit={addWebsite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input type="url" required placeholder="https://www.esempio.it" value={websiteUrl} onChange={event => setWebsiteUrl(event.target.value)} style={{ flex: '1 1 320px' }} />
            <button className="btn btn-primary" disabled={busy === 'website'}>{busy === 'website' ? 'Verifico…' : 'Aggiungi sito'}</button>
          </form>
          {sources.map(source => <div key={source.id} style={{ marginTop: 12, fontSize: 14 }}>✓ {source.url}</div>)}
        </section>

        <button className="btn btn-primary" onClick={onDone} disabled={connectedCount === 0} style={{ width: '100%', marginTop: 24, padding: 18 }}>Continua con {connectedCount} {connectedCount === 1 ? 'fonte' : 'fonti'}</button>
      </main>
    </div>
  );
}
