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
  
  // Per la guida
  const [activeGuideTab, setActiveGuideTab] = useState('instagram');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const oauthError = params.get('error');
    if (connected) {
      window.history.replaceState({}, '', window.location.pathname);
      setAddMsg({ ok: true, text: `✅ Connessione completata con successo!` });
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
        apiFetch('/api/index.php?action=social-sources', {}, token)
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
      setAddMsg({ ok: false, text: 'URL non riconosciuto. Assicurati che sia un link valido a Instagram, TikTok, YouTube o Facebook.' });
      return;
    }
    setAddLoading(true);
    try {
      await apiFetch('/api/index.php?action=social-source-upsert', {
        method: 'POST',
        body: JSON.stringify({ platform, label: addLabel || (SOCIAL[platform]?.label || platform), url })
      }, token);
      setAddMsg({ ok: true, text: `✅ Profilo aggiunto con successo!` });
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
    if (!window.confirm(`Sei sicuro di voler rimuovere "${channel.label || channel.platform}"?`)) return;
    if (channel.type === 'scraping') {
      await apiFetch('/api/index.php?action=social-source-delete', { method: 'POST', body: JSON.stringify({ id: channel.sourceId }) }, token);
    } else {
      await apiFetch('/api/index.php?action=social-disconnect', { method: 'POST', body: JSON.stringify({ platform: channel.rawPlatform }) }, token);
    }
    await loadChannels();
  }

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
    <div style={{ minHeight: '100vh', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg)' }}>
      
      {/* Header Semplificato */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '2rem', maxWidth: '700px' }}>
        <h1 style={{ fontSize: '36px', color: 'var(--primary)', marginBottom: '16px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Iniziamo! Aggiungi i tuoi Social
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '18px', fontWeight: 500, lineHeight: 1.5 }}>
          Incolla i link dei tuoi profili (Instagram, TikTok, YouTube). Noi ci occuperemo di trasformare i tuoi video e post in un vero sito web, in modo del tutto automatico.
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Box Principale di Inserimento */}
        <div className="glass-modal" style={{ padding: '2.5rem', border: '1px solid var(--border-strong)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
          <form onSubmit={handleAddChannel} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Incolla qui il link del tuo profilo social:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="url"
                placeholder="es: https://www.instagram.com/tuoprofilo/"
                value={addUrl}
                onChange={e => { setAddUrl(e.target.value); setAddMsg(null); setShowGuide(false); }}
                style={{ 
                  paddingLeft: detectedPlatform ? '60px' : '24px', 
                  fontSize: '18px', 
                  padding: '24px', 
                  width: '100%',
                  borderRadius: '16px',
                  border: '2px solid var(--border-strong)',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'var(--text)',
                  transition: 'all 0.3s'
                }}
              />
              {detectedPlatform && (
                <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <img src={SOCIAL[detectedPlatform]?.icon || ''} alt="" style={{ width: 28, height: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
                </span>
              )}
            </div>
            
            {detectedPlatform && (
              <div style={{ fontSize: '14px', color: 'var(--primary)', padding: '12px 16px', background: 'var(--primary-light)', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>✨</span> Riconosciuto automaticamente come {SOCIAL[detectedPlatform]?.label || detectedPlatform}!
              </div>
            )}
            
            <button type="submit" className="btn btn-primary" disabled={addLoading || !addUrl.trim()} style={{ padding: '20px', fontSize: '18px', fontWeight: 800, borderRadius: '16px', marginTop: '8px', boxShadow: '0 4px 15px rgba(0, 240, 255, 0.3)' }}>
              {addLoading ? '⏳ Sto verificando il profilo...' : '➕ AGGIUNGI QUESTO PROFILO'}
            </button>
          </form>

          {addMsg && (
            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px',
              background: addMsg.ok ? 'var(--teal-light)' : 'var(--red-light)',
              color: addMsg.ok ? 'var(--teal)' : 'var(--red)', border: `1px solid ${addMsg.ok ? 'rgba(16,185,129,0.3)' : 'rgba(255,59,48,0.3)'}` }}>
              {addMsg.text}
            </div>
          )}

          {/* Sezione Aiuto / Tutorial */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-strong)', paddingTop: '1.5rem', textAlign: 'center' }}>
            <button 
              onClick={() => setShowGuide(!showGuide)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
              {showGuide ? 'Nascondi la guida' : 'Non sai come trovare il tuo link? Clicca qui per la guida'}
            </button>

            {showGuide && (
              <div style={{ marginTop: '1.5rem', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text)' }}>Come copiare il link del tuo profilo:</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {['instagram', 'tiktok', 'youtube', 'facebook'].map(plat => (
                    <button key={plat} onClick={() => setActiveGuideTab(plat)} style={{
                      padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      background: activeGuideTab === plat ? SOCIAL[plat]?.color || 'var(--primary)' : 'var(--surface)',
                      color: activeGuideTab === plat ? '#fff' : 'var(--text-muted)',
                      border: 'none', transition: 'all 0.2s'
                    }}>
                      <SocialIcon platform={plat} size={16} /> {SOCIAL[plat]?.label}
                    </button>
                  ))}
                </div>
                
                <div style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, padding: '1rem', background: 'var(--surface)', borderRadius: '12px' }}>
                  {activeGuideTab === 'instagram' && (
                    <ol style={{ paddingLeft: '20px', margin: 0 }}>
                      <li style={{ marginBottom: '8px' }}>Apri l'app di <strong>Instagram</strong> sul tuo telefono.</li>
                      <li style={{ marginBottom: '8px' }}>Vai sul tuo profilo (cliccando in basso a destra).</li>
                      <li style={{ marginBottom: '8px' }}>Clicca sul pulsante <strong>"Condividi profilo"</strong>.</li>
                      <li>Clicca su <strong>"Copia link"</strong> e incollalo qui sopra!</li>
                    </ol>
                  )}
                  {activeGuideTab === 'tiktok' && (
                    <ol style={{ paddingLeft: '20px', margin: 0 }}>
                      <li style={{ marginBottom: '8px' }}>Apri l'app di <strong>TikTok</strong> sul tuo telefono.</li>
                      <li style={{ marginBottom: '8px' }}>Vai sul tuo profilo (cliccando su "Profilo" in basso a destra).</li>
                      <li style={{ marginBottom: '8px' }}>Clicca sul menu a tre righe in alto a destra e seleziona <strong>"Impostazioni e privacy"</strong>.</li>
                      <li style={{ marginBottom: '8px' }}>Clicca su <strong>"Condividi profilo"</strong>.</li>
                      <li>Seleziona <strong>"Copia link"</strong> e incollalo qui sopra!</li>
                    </ol>
                  )}
                  {activeGuideTab === 'youtube' && (
                    <ol style={{ paddingLeft: '20px', margin: 0 }}>
                      <li style={{ marginBottom: '8px' }}>Apri l'app di <strong>YouTube</strong> sul tuo telefono.</li>
                      <li style={{ marginBottom: '8px' }}>Tocca l'icona del tuo profilo in basso a destra.</li>
                      <li style={{ marginBottom: '8px' }}>Tocca <strong>"Visualizza canale"</strong>.</li>
                      <li style={{ marginBottom: '8px' }}>Tocca i tre puntini verticali in alto a destra.</li>
                      <li style={{ marginBottom: '8px' }}>Seleziona <strong>"Condividi"</strong>.</li>
                      <li>Tocca <strong>"Copia link"</strong> e incollalo qui!</li>
                    </ol>
                  )}
                  {activeGuideTab === 'facebook' && (
                    <ol style={{ paddingLeft: '20px', margin: 0 }}>
                      <li style={{ marginBottom: '8px' }}>Apri l'app di <strong>Facebook</strong>.</li>
                      <li style={{ marginBottom: '8px' }}>Vai sul tuo Profilo o sulla tua Pagina.</li>
                      <li style={{ marginBottom: '8px' }}>Clicca sui <strong>tre puntini (...)</strong> accanto al pulsante "Modifica profilo".</li>
                      <li style={{ marginBottom: '8px' }}>Scorri in basso fino a "Link al tuo profilo".</li>
                      <li>Clicca su <strong>"Copia link"</strong> e incollalo qui sopra!</li>
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canali Aggiunti (Mostrati come card visive) */}
        {allChannels.length > 0 && (
          <div>
            <h3 style={{ fontSize: '16px', color: 'var(--text)', marginBottom: '16px', fontWeight: 800 }}>I Tuoi Social Aggiunti ({allChannels.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {allChannels.map(channel => (
                <div key={channel.key} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '16px 20px', borderRadius: '16px', background: 'var(--surface)', border: '1px solid var(--border-strong)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SocialIcon platform={channel.platform} size={28} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {channel.label || channel.platform}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {channel.type === 'oauth' ? 'Connesso in modo sicuro' : channel.url}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeChannel(channel)} style={{ 
                    background: 'rgba(255,59,48,0.1)', border: 'none', color: 'var(--red)', cursor: 'pointer', 
                    fontSize: '13px', fontWeight: 800, padding: '8px 12px', borderRadius: '10px', flexShrink: 0 
                  }}>
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottone Finale di Generazione */}
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={onDone} disabled={connectedCount === 0} style={{ 
            width: '100%', padding: '24px', fontSize: '20px', fontWeight: 900, borderRadius: '20px', 
            background: connectedCount > 0 ? 'linear-gradient(135deg, var(--primary), var(--teal))' : 'var(--surface)',
            color: connectedCount > 0 ? '#000' : 'var(--text-muted)',
            boxShadow: connectedCount > 0 ? '0 10px 30px rgba(0, 240, 255, 0.4)' : 'none',
            border: connectedCount === 0 ? '2px dashed var(--border-strong)' : 'none',
            transition: 'all 0.3s'
          }}>
            {connectedCount === 0 ? '👆 Aggiungi almeno un social per continuare' : '🚀 PROCEDI E GENERA IL MIO SITO WEB'}
          </button>
          {connectedCount > 0 && (
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Cliccando procederai alla creazione automatica del sito in base ai contenuti trovati.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
