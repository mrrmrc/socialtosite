import React, { useState, useEffect } from 'react';
import { apiFetch, detectPlatformFromUrl, SOCIAL } from '../utils/api';
import { SocialIcon } from '../components/SocialIcon';

export function ConnectScreen({ token, onDone }) {
  const [connections, setConnections] = useState([]);
  const [sources, setSources] = useState([]);
  const [addUrl, setAddUrl] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addMsg, setAddMsg] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);

  useEffect(() => {
    // Controlla parametri URL per callback OAuth
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const oauthError = params.get('error');
    if (connected) {
      window.history.replaceState({}, '', window.location.pathname);
      setAddMsg({ ok: true, text: `✅ Connessione OAuth completata con successo!` });
    } else if (oauthError) {
      const platform = params.get('platform') || 'il social';
      setAddMsg({ ok: false, text: `Connessione a ${platform} non riuscita (${oauthError}). Riprova.` });
      window.history.replaceState({}, '', window.location.pathname);
    }
    loadChannels();
  }, []);

  async function loadChannels() {
    setLoadingChannels(true);
    try {
      const [connData, srcData] = await Promise.all([
        apiFetch('/api/index.php?action=social-connections', {}, token),
        apiFetch('/api/index.php?action=social-sources-get', {}, token)
      ]);
      setConnections(connData);
      setSources(srcData);
    } catch (e) {
      console.error(e);
    }
    setLoadingChannels(false);
  }

  async function handleAddChannel(e) {
    e.preventDefault();
    setAddMsg(null);
    const url = addUrl.trim();
    if (!url) return;
    const platform = detectPlatformFromUrl(url);
    if (!platform) {
      setAddMsg({ ok: false, text: 'URL non riconosciuto. Inserisci il link al tuo profilo su Instagram, TikTok, YouTube, Facebook o il tuo sito web.' });
      return;
    }
    setAddLoading(true);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: addLabel || (SOCIAL[platform]?.label || platform), url })
      }, token);
      setAddMsg({ ok: true, text: `✅ Profilo ${SOCIAL[platform]?.label || platform} aggiunto!` });
      setAddUrl('');
      setAddLabel('');
      await loadChannels();
    } catch (err) {
      setAddMsg({ ok: false, text: err.message });
    }
    setAddLoading(false);
  }

  async function connectOAuth(platform) {
    window.location.href = `/api/auth/oauth_redirect.php?platform=${platform}&token=${localStorage.getItem('sts_token') || ''}`;
  }

  async function removeChannel(channel) {
    if (!window.confirm(`Rimuovere il canale "${channel.label || channel.platform}"?`)) return;
    if (channel.type === 'scraping') {
      await apiFetch('/api/index.php?action=social-source-delete', { method: 'POST', body: JSON.stringify({ id: channel.sourceId }) }, token);
    } else {
      await apiFetch('/api/index.php?action=social-disconnect', { method: 'POST', body: JSON.stringify({ platform: channel.rawPlatform }) }, token);
    }
    await loadChannels();
  }

  // Costruisci lista unificata
  const allChannels = [];
  connections.filter(c => c.active).forEach(c => {
    allChannels.push({
      key: 'oauth_' + c.platform,
      type: 'oauth',
      platform: c.platform === 'instagram_login' ? 'instagram' : c.platform,
      rawPlatform: c.platform,
      handle: c.handle,
      label: c.handle ? `@${c.handle}` : '',
    });
  });
  sources.forEach(s => {
    const hasOAuth = connections.some(c => c.active && (c.platform === s.platform || (c.platform === 'instagram_login' && s.platform === 'instagram')));
    allChannels.push({
      key: 'src_' + s.id,
      type: 'scraping',
      platform: s.platform,
      rawPlatform: s.platform,
      sourceId: s.id,
      url: s.url,
      label: s.label,
      hasDuplicateOAuth: hasOAuth,
    });
  });

  const connectedCount = allChannels.length;
  const detectedPlatform = detectPlatformFromUrl(addUrl);
  const connByPlatform = connections.reduce((acc, c) => ({ ...acc, [c.platform]: c }), {});

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '32px', color: 'var(--primary)', textShadow: '0 0 10px var(--primary-light)' }}>Incolla i tuoi canali</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: 500 }}>
            Incolla qui i link (Instagram, TikTok, YouTube, ecc.) e lascia che l'AI li trasformi nel tuo sito web in automatico.
          </p>
        </div>

        {/* Form Aggiungi Canale */}
        <div className="glass-modal" style={{ marginBottom: '2rem', padding: '2rem' }}>
          <form onSubmit={handleAddChannel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                placeholder="es: https://www.instagram.com/tuoprofilo/"
                value={addUrl}
                onChange={e => { setAddUrl(e.target.value); setAddMsg(null); }}
                style={{ paddingLeft: detectedPlatform ? '56px' : '20px', fontSize: '18px', padding: '20px', width: '100%' }}
              />
              {detectedPlatform && (
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <img src={SOCIAL[detectedPlatform]?.icon || ''} alt="" style={{ width: 24, height: 24, opacity: 0.8 }} />
                </span>
              )}
            </div>
            
            {detectedPlatform && (
              <div style={{ fontSize: '13px', color: 'var(--primary)', padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', fontWeight: 700, border: '1px solid rgba(0,240,255,0.2)' }}>
                ✓ Perfetto! Rilevato: {SOCIAL[detectedPlatform]?.label || detectedPlatform}
              </div>
            )}
            
            <button type="submit" className="btn btn-primary" disabled={addLoading || !addUrl.trim()} style={{ padding: '18px', fontSize: '16px', marginTop: '8px' }}>
              {addLoading ? '⟳ Attendere...' : '+ AGGIUNGI CANALE'}
            </button>
          </form>
          {addMsg && (
            <div style={{ marginTop: '16px', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 600,
              background: addMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
              color: addMsg.ok ? 'var(--teal)' : 'var(--red)', border: `1px solid ${addMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(255,59,48,0.3)'}` }}>
              {addMsg.text}
            </div>
          )}
        </div>

        {/* Canali Aggiunti */}
        {allChannels.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>I Tuoi Canali</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allChannels.map(channel => (
                <div key={channel.key} className="glass-modal" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderRadius: 'var(--radius)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SocialIcon platform={channel.platform} size={28} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '16px' }}>{channel.label || channel.platform}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {channel.type === 'oauth' ? 'Connesso via App Ufficiale' : channel.url}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeChannel(channel)} style={{ background: 'var(--red-light)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--red)', cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: '8px 16px', borderRadius: '20px' }}>
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connessioni OAuth (YouTube, Facebook) */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Preferisci il login sicuro ufficiale?
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['youtube', 'facebook', 'tiktok'].map(platform => {
              const conn = connByPlatform[platform];
              const isConnected = !!conn && conn.active;
              return (
                <button key={platform}
                  className={`btn ${isConnected ? 'btn-outline' : 'btn-primary'}`}
                  onClick={() => isConnected ? removeChannel({ type: 'oauth', rawPlatform: platform, platform }) : connectOAuth(platform)}
                  style={{ flex: '1 1 140px', background: isConnected ? 'var(--surface)' : SOCIAL[platform]?.color, color: isConnected ? 'var(--text)' : '#fff', border: isConnected ? '1px solid var(--border)' : 'none', fontWeight: 700 }}>
                  <SocialIcon platform={platform} size={18} />
                  {isConnected ? 'Scollega' : `Connetti`}
                </button>
              );
            })}
          </div>
        </div>

        <button className="btn btn-primary" onClick={onDone} disabled={connectedCount === 0} style={{ width: '100%', padding: '20px', fontSize: '18px', fontWeight: 800 }}>
          {connectedCount === 0 ? 'Aggiungi un canale per iniziare' : 'GENERA IL MIO SITO WEB →'}
        </button>

      </div>
    </div>
  );
}
