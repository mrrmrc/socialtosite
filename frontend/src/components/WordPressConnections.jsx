import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './WordPressConnections.css';

const defaultFilters = { scope: 'all', platforms: [], since_date: '', until_date: '', batch_size: 20 };

export function WordPressConnections({ token }) {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ endpoint: '', secret: '' });
  const [terms, setTerms] = useState(null);
  const [settings, setSettings] = useState({ enabled: false, post_status: 'draft', category_id: 0, mappings: {} });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [library, setLibrary] = useState({ posts: [], has_more: false, next_cursor: 0 });
  const stopSync = useRef(false);
  const ownerFilters = useRef(defaultFilters);
  const endpointEdited = useRef(false);
  const call = (action, payload) => apiFetch(`/api/index.php?action=wordpress-${action}`, payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }, token);
  const readLibrary = async (cursor = 0) => {
    const data = await apiFetch(`/api/index.php?action=wordpress-library&cursor=${cursor}`, {}, token);
    setLibrary(previous => ({ ...data, posts: cursor ? [...previous.posts, ...(data.posts || [])] : (data.posts || []) }));
  };
  const readTerms = async () => {
    setReady(false); setSaved(false);
    const data = await call('prepare', {});
    setTerms(data);
    setSettings({ enabled: false, post_status: 'draft', category_id: 0, mappings: {}, ...data.settings, filters: ownerFilters.current });
    setReady(!!data.ready);
    setSaved(!!data.ready && !!data.settings?.post_status && !!data.archive_available);
    return data;
  };
  useEffect(() => {
    let active = true;
    endpointEdited.current = false;
    call('status').then(async data => { if (active) { setStatus(data); setForm(f => ({ ...f, endpoint: endpointEdited.current ? f.endpoint : data.endpoint || '' })); ownerFilters.current = { ...defaultFilters, ...data.filters }; await readLibrary(); if (data.connected) await readTerms(); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; stopSync.current = true; };
  }, [token]);
  const run = async operation => {
    setBusy(true); setError(''); setMessage('');
    try { await operation(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const change = update => { setSettings(s => ({ ...s, ...update })); setSaved(false); };
  const filters = { ...defaultFilters, ...settings.filters };
  const changeFilters = update => change({ filters: { ...filters, ...update } });
  const map = (topic, field, value) => change({ mappings: { ...settings.mappings, [topic]: { ...settings.mappings[topic], [field]: Number(value) } } });
  const topics = [...new Set([...(status?.topics || []), ...Object.keys(settings.mappings || {})])];
  return <section id="wordpress-connector" className="card wordpress-workspace" aria-labelledby="wordpress-title">
    <div className="wordpress-heading"><div><h2 id="wordpress-title">Connettore WordPress</h2><p>Collega tutto il tuo archivio di contenuti: pubblicati, bozze e testi acquisiti. Gestisci qui fonti, periodo, categorie e tag.</p></div><a className="btn btn-outline" href="/public/downloads/allsocialtoweb-connector.zip" download>Scarica il plugin WordPress</a></div>
    <ol><li>In WordPress apri Plugin → Aggiungi plugin → Carica plugin e installa lo ZIP.</li><li>In Impostazioni → AllSocialToWeb genera il codice e inseriscilo qui.</li><li>Leggi categorie e tag, abbina gli argomenti e scegli come importare.</li></ol>
    {error && <p className="wordpress-error" role="alert">{error}</p>}
    {message && <p className="wordpress-notice" role="status">{message}</p>}
    <details className="wordpress-library"><summary>Il tuo archivio completo ({status?.archive?.total ?? 0} contenuti)</summary><p>Questa lista include tutti i tuoi articoli, anche bozze e contenuti con sole foto o video. I filtri sotto si applicano al trasferimento.</p>{library.posts.map(post => <article key={post.id}><strong>{post.title}</strong><span>{post.platform} · {post.article_ready ? 'Articolo pronto per WordPress' : 'Bozza WordPress da completare'}{post.media_type === 'video' ? ' · Video' : post.media_url ? ' · Foto' : ''}</span></article>)}{library.has_more && <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run(() => readLibrary(library.next_cursor))}>Carica altri articoli</button>}{!library.has_more && <small>Fine archivio: {library.posts.length} contenuti leggibili.</small>}</details>
    {!status?.connected ? <form className="wordpress-connect" onSubmit={e => { e.preventDefault(); run(async () => {
      await call('connect', form);
      const connectedStatus = await call('status'); setStatus(connectedStatus); ownerFilters.current = { ...defaultFilters, ...connectedStatus.filters }; setForm(f => ({ ...f, secret: '' }));
      await readTerms(); setMessage('Collegamento completo: l’archivio è già leggibile dal plugin WordPress. Puoi personalizzare categorie, tag e modalità di importazione.');
    }); }}>
      <label>Indirizzo WordPress<input type="url" required placeholder="https://www.iltuosito.it" value={form.endpoint} onChange={e => { endpointEdited.current = true; setForm({ ...form, endpoint: e.target.value }); }} /></label>
      <label>Codice generato dal plugin<input type="password" required autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value.trim() })} /></label>
      <button className="btn btn-primary" disabled={busy || !status}>Verifica e collega</button>
    </form> : <>
      <p className="wordpress-archive">Archivio disponibile: <strong>{status.archive?.total ?? 0}</strong> contenuti · {status.archive?.published ?? 0} pubblicati · {status.archive?.drafts ?? 0} bozze o da elaborare.</p>
      <div className="wordpress-actions"><strong>{ready ? 'Archivio collegato' : 'Collegamento da completare'}: {status.endpoint}</strong><button className="btn btn-outline" disabled={busy} onClick={() => run(async () => { await readTerms(); setMessage('Archivio collegato. Categorie e tag aggiornati da WordPress.'); })}>{terms ? 'Rileggi categorie e tag' : 'Completa collegamento'}</button><button className="btn btn-outline" disabled={busy} onClick={() => run(async () => { await call('disconnect', {}); setStatus(await call('status')); setTerms(null); setSaved(false); setReady(false); setMessage('Collegamento disabilitato. I post in WordPress rimangono disponibili.'); })}>Disconnetti</button></div>
      {terms && !terms.archive_available && <p role="alert">Per collegare tutto l’archivio, aggiorna WordPress installando il plugin 0.3.0 dal pulsante Scarica il plugin WordPress.</p>}
      {terms && !terms.media_available && <p role="alert">Aggiorna il plugin WordPress alla versione 0.4.0 per conservare anche foto, gallerie e video nei post e consultare l’archivio dal pannello WordPress.</p>}
      {terms && !terms.article_updates_available && <p role="alert">Installa il plugin 0.5.0 per creare automaticamente gli articoli da tutto l’archivio e aggiornare le bozze con il testo definitivo. I plugin precedenti ricevono solo gli articoli già elaborati.</p>}
      {terms && <form onSubmit={e => { e.preventDefault(); run(async () => { await call('settings', settings); ownerFilters.current = filters; setSaved(true); setMessage('Abbinamenti salvati. Puoi sincronizzare ora. Le regole si applicano ai nuovi post importati.'); }); }}>
        <h3>Contenuti da collegare</h3>
        <div className="wordpress-options">
          <label>Archivio da sincronizzare<select value={filters.scope} onChange={e => changeFilters({ scope: e.target.value })}><option value="all">Tutto l’archivio, comprese bozze e contenuti acquisiti</option><option value="published">Solo contenuti pubblicati</option><option value="drafts">Solo bozze e contenuti non pubblicati</option></select></label>
          <label>Contenuti per passaggio<input type="number" min="1" max="20" value={filters.batch_size} onChange={e => changeFilters({ batch_size: Number(e.target.value) })} /></label>
          <label>Dalla data<input type="date" value={filters.since_date} onChange={e => changeFilters({ since_date: e.target.value })} /></label>
          <label>Fino alla data<input type="date" min={filters.since_date || undefined} value={filters.until_date} onChange={e => changeFilters({ until_date: e.target.value })} /></label>
        </div>
        <fieldset className="wordpress-sources"><legend>Fonti incluse</legend><p>Lascia tutte le fonti per includere anche i nuovi canali aggiunti in futuro.</p><label className="wordpress-check"><input type="checkbox" checked={!filters.platforms.length} onChange={() => changeFilters({ platforms: [] })} />Tutte le fonti</label>{(status.archive?.platforms || []).map(platform => <label className="wordpress-check" key={platform}><input type="checkbox" checked={filters.platforms.includes(platform)} onChange={e => changeFilters({ platforms: e.target.checked ? [...filters.platforms, platform] : filters.platforms.filter(p => p !== platform) })} />{platform === 'manual' ? 'Contenuti manuali' : platform}</label>)}</fieldset>
        <h3>Pubblicazione e categorie associate</h3>
        <div className="wordpress-options">
          <label>Importa i contenuti come<select value={settings.post_status} onChange={e => change({ post_status: e.target.value })}><option value="draft">Bozze WordPress</option><option value="publish">Post pubblicati</option></select></label>
          <label>Categoria per argomenti senza abbinamento<select value={settings.category_id} onChange={e => change({ category_id: Number(e.target.value) })}><option value="0">Predefinita WordPress</option>{(terms.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </div>
        <label className="wordpress-check"><input type="checkbox" checked={!!settings.enabled} onChange={e => change({ enabled: e.target.checked })} />Sincronizzazione automatica ogni 5 minuti tramite WordPress</label>
        <p>Puoi trasferire anche i contenuti non pubblicati: scegli qui se crearli come bozze o post su WordPress. Ogni argomento può assegnare una categoria e un tag già presenti in WordPress. Ogni contenuto diventa un articolo nella sezione Articoli di WordPress. Quelli ancora da elaborare restano bozze; il testo definitivo aggiorna automaticamente le bozze non modificate in WordPress. Le modifiche locali e gli articoli già pubblicati vengono conservati.</p>
        <div className="wordpress-mappings">{topics.length === 0 ? <p>Gli argomenti compariranno dopo aver acquisito i primi contenuti.</p> : topics.map(topic => <div className="wordpress-mapping" key={topic}><strong>{topic}</strong><label>Categoria<select value={settings.mappings?.[topic]?.category_id || 0} onChange={e => map(topic, 'category_id', e.target.value)}><option value="0">Nessun abbinamento</option>{(terms.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tag<select value={settings.mappings?.[topic]?.tag_id || 0} onChange={e => map(topic, 'tag_id', e.target.value)}><option value="0">Nessun abbinamento</option>{(terms.tags || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>)}</div>
        <div className="wordpress-actions"><button className="btn btn-primary" disabled={busy}>Salva abbinamenti e modalità</button><button type="button" className="btn btn-outline" disabled={busy || !saved} onClick={() => run(async () => {
          stopSync.current = false; setSyncing(true);
          let imported = 0, updated = 0, skipped = 0, more = true, first = true;
          try {
            while (more && !stopSync.current) {
              const result = await call('sync', { restart: first }); first = false;
              imported += Number(result.imported || 0); updated += Number(result.updated || 0); skipped += Number(result.skipped || 0); more = !!result.has_more;
              setMessage(`Sincronizzazione archivio: ${imported} nuovi post, ${updated} bozze aggiornate, ${skipped} già importati. ${more ? 'Continuo con i prossimi contenuti…' : 'Archivio completato.'}`);
            }
            if (stopSync.current && more) setMessage(`Sincronizzazione interrotta dopo il passaggio corrente: ${imported} nuovi post. Puoi riprenderla senza creare duplicati.`);
          } catch (error) {
            setMessage(`Sincronizzazione interrotta: ${imported} nuovi post trasferiti, ${skipped} già presenti. Puoi riprovare senza creare duplicati.`);
            throw error;
          } finally { setSyncing(false); }
          const refreshedTerms = await call('taxonomies'); setTerms(refreshedTerms);
        })}>{busy ? 'Operazione in corso…' : 'Sincronizza WordPress'}</button>{syncing && <button type="button" className="btn btn-outline" onClick={() => { stopSync.current = true; }}>Interrompi dopo questo passaggio</button>}</div>
        {!saved && <small>Salva le impostazioni per applicarle alla sincronizzazione.</small>}
        <p><small>L’aggiornamento automatico usa WP-Cron e dipende dalle visite al sito WordPress. Il comando Sincronizza WordPress percorre automaticamente tutto l’archivio selezionato, a blocchi della dimensione impostata.</small></p>
        {terms.last_sync?.at && <p><small>Ultimo passaggio: {new Date(terms.last_sync.at).toLocaleString('it-IT')}{terms.last_sync.error ? ` · ${terms.last_sync.error}` : ''}</small></p>}
      </form>}
    </>}
  </section>;
}
