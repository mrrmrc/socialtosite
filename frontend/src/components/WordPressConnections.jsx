import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import './WordPressConnections.css';

export function WordPressConnections({ token }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ endpoint: '', secret: '' });
  const [terms, setTerms] = useState(null);
  const [settings, setSettings] = useState({ enabled: false, post_status: 'draft', category_id: 0, mappings: {} });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const call = (action, payload) => apiFetch(`/api/index.php?action=wordpress-${action}`, payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }, token);
  const readTerms = async () => {
    const data = await call('taxonomies');
    setTerms(data);
    setSettings({ enabled: false, post_status: 'draft', category_id: 0, mappings: {}, ...data.settings });
    setSaved(!!data.settings?.post_status);
    return data;
  };
  useEffect(() => {
    let active = true;
    call('status').then(data => { if (active) { setStatus(data); setForm(f => ({ ...f, endpoint: data.endpoint })); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [token]);
  const run = async operation => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const change = update => { setSettings(s => ({ ...s, ...update })); setSaved(false); };
  const map = (topic, field, value) => change({ mappings: { ...settings.mappings, [topic]: { ...settings.mappings[topic], [field]: Number(value) } } });
  const topics = [...new Set([...(status?.topics || []), ...Object.keys(settings.mappings || {})])];
  return <section className="card wordpress-workspace" aria-labelledby="wordpress-title">
    <div className="wordpress-heading"><div><h2 id="wordpress-title">WordPress</h2><p>Trasforma i contenuti pubblicati su AllSocialToWeb in post del tuo sito WordPress.</p></div><a className="btn btn-outline" href="/public/downloads/allsocialtoweb-connector.zip" download>Scarica il plugin WordPress</a></div>
    <ol><li>In WordPress apri Plugin → Aggiungi plugin → Carica plugin e installa lo ZIP.</li><li>In Impostazioni → AllSocialToWeb genera il codice e inseriscilo qui.</li><li>Leggi categorie e tag, abbina gli argomenti e scegli come importare.</li></ol>
    {error && <p className="wordpress-error" role="alert">{error}</p>}
    {message && <p className="wordpress-notice" role="status">{message}</p>}
    {!status?.connected ? <form className="wordpress-connect" onSubmit={e => { e.preventDefault(); run(async () => {
      await call('connect', form);
      setStatus(await call('status')); setForm(f => ({ ...f, secret: '' }));
      await readTerms(); setMessage('Sito collegato. Ora salva gli abbinamenti e la modalità di importazione.');
    }); }}>
      <label>Indirizzo WordPress<input type="url" required placeholder="https://www.iltuosito.it" value={form.endpoint} onChange={e => setForm({ ...form, endpoint: e.target.value })} /></label>
      <label>Codice generato dal plugin<input type="password" required autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value.trim() })} /></label>
      <button className="btn btn-primary" disabled={busy || !status}>Verifica e collega</button>
    </form> : <>
      <div className="wordpress-actions"><strong>Collegato: {status.endpoint}</strong><button className="btn btn-outline" disabled={busy} onClick={() => run(async () => { await readTerms(); setMessage('Categorie e tag aggiornati da WordPress.'); })}>{terms ? 'Rileggi categorie e tag' : 'Leggi categorie e tag'}</button><button className="btn btn-outline" disabled={busy} onClick={() => run(async () => { await call('disconnect', {}); setStatus(await call('status')); setTerms(null); setSaved(false); setMessage('Collegamento disabilitato. I post in WordPress rimangono disponibili.'); })}>Disconnetti</button></div>
      {terms && <form onSubmit={e => { e.preventDefault(); run(async () => { await call('settings', settings); setSaved(true); setMessage('Abbinamenti salvati. Puoi sincronizzare ora. Le regole si applicano ai nuovi post importati.'); }); }}>
        <div className="wordpress-options">
          <label>Importa i contenuti come<select value={settings.post_status} onChange={e => change({ post_status: e.target.value })}><option value="draft">Bozze WordPress</option><option value="publish">Post pubblicati</option></select></label>
          <label>Categoria per argomenti senza abbinamento<select value={settings.category_id} onChange={e => change({ category_id: Number(e.target.value) })}><option value="0">Predefinita WordPress</option>{(terms.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="wordpress-check"><input type="checkbox" checked={!!settings.enabled} onChange={e => change({ enabled: e.target.checked })} />Sincronizzazione automatica ogni 5 minuti tramite WordPress</label>
        <p>Vengono importati solo i contenuti pubblicati su AllSocialToWeb. Ogni argomento può assegnare una categoria e un tag già presenti in WordPress. Gli articoli già importati conservano le modifiche fatte in WordPress.</p>
        <div className="wordpress-mappings">{topics.length === 0 ? <p>Gli argomenti compariranno dopo aver acquisito i primi contenuti.</p> : topics.map(topic => <div className="wordpress-mapping" key={topic}><strong>{topic}</strong><label>Categoria<select value={settings.mappings?.[topic]?.category_id || 0} onChange={e => map(topic, 'category_id', e.target.value)}><option value="0">Nessun abbinamento</option>{(terms.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tag<select value={settings.mappings?.[topic]?.tag_id || 0} onChange={e => map(topic, 'tag_id', e.target.value)}><option value="0">Nessun abbinamento</option>{(terms.tags || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>)}</div>
        <div className="wordpress-actions"><button className="btn btn-primary" disabled={busy}>Salva abbinamenti e modalità</button><button type="button" className="btn btn-outline" disabled={busy || !saved} onClick={() => run(async () => {
          const result = await call('sync', {});
          setMessage(`Sincronizzazione completata: ${result.imported || 0} nuovi post, ${result.skipped || 0} già importati.${result.has_more ? ' Ci sono altri contenuti: premi di nuovo Sincronizza WordPress per continuare.' : ''}`);
          const updated = await call('taxonomies'); setTerms(updated);
        })}>{busy ? 'Operazione in corso…' : 'Sincronizza WordPress'}</button></div>
        {!saved && <small>Salva le impostazioni per applicarle alla sincronizzazione.</small>}
        <p><small>L’aggiornamento automatico usa WP-Cron e dipende dalle visite al sito WordPress. Ogni passaggio controlla fino a 20 contenuti.</small></p>
        {terms.last_sync?.at && <p><small>Ultimo passaggio: {new Date(terms.last_sync.at).toLocaleString('it-IT')}{terms.last_sync.error ? ` · ${terms.last_sync.error}` : ''}</small></p>}
      </form>}
    </>}
  </section>;
}
