import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './PublicationConnections.css';

const labels = { queued: 'In coda', sending: 'Invio in corso', draft: 'Bozza consegnata', published: 'Pubblicato', uncertain: 'Da verificare', failed: 'Non consegnato', cancelled: 'Annullato' };

export function PublicationConnections({ token }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ endpoint: '', secret: '', label: 'WordPress' });
  const [connection, setConnection] = useState('');
  const [post, setPost] = useState('');
  const [category, setCategory] = useState('0');
  const [categories, setCategories] = useState([]);
  const [image, setImage] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const panel = useRef(null);
  const opener = useRef(null);
  const call = (action, payload) => apiFetch(`/api/index.php?action=publication-${action}`, payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload) }, token);
  const refresh = async () => setData(await call('list'));
  useEffect(() => {
    let active = true;
    call('capabilities').then(d => { if (active) setEnabled(d.enabled); }).catch(() => {});
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    if (!open) return;
    refresh().catch(e => setError(e.message));
    const timer = setInterval(() => refresh().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [open, token]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; opener.current?.focus(); };
  }, [open]);
  useEffect(() => {
    let active = true;
    setConfirmed(false); setCategory('0'); setCategories([]);
    if (connection) call('categories', { connection_id: Number(connection) }).then(d => { if (active) setCategories(d.categories || []); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [connection]);
  const run = async (operation) => {
    setBusy(true); setError('');
    try { await operation(); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  if (!enabled) return null;
  const selected = data?.connections.find(c => String(c.id) === connection);
  return <div className="publication-entry">
    <button ref={opener} className="btn" onClick={() => setOpen(true)}>Collega WordPress · Pilota</button>
    {open && <div className="publication-overlay" onKeyDown={e => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        const nodes = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}>
      <section ref={panel} className="publication-panel" role="dialog" aria-modal="true" aria-labelledby="publication-title">
        <header><div><h2 id="publication-title">Il tuo sito collegato</h2><p>Invia una bozza a WordPress, poi controllala prima di pubblicare.</p></div><button className="btn" onClick={() => setOpen(false)} autoFocus>Chiudi</button></header>
        {error && <p role="alert" className="publication-error">{error}</p>}
        {!data ? <p>Caricamento…</p> : <>
          <form onSubmit={e => { e.preventDefault(); run(async () => { await call('connect', { ...form, site_id: data.sites[0]?.id }); setForm(f => ({ ...f, secret: '' })); }); }}>
            <h3>Collega il sito</h3><p>Installa il plugin AllSocialToWeb e genera il codice nelle impostazioni di WordPress. Il collegamento non crea articoli.</p>
            <label>Indirizzo WordPress<input type="url" required placeholder="https://www.iltuosito.it" value={form.endpoint} onChange={e => setForm({ ...form, endpoint: e.target.value })} /></label>
            <label>Codice del plugin<input type="password" required autoComplete="off" value={form.secret} onChange={e => setForm({ ...form, secret: e.target.value })} /></label>
            <button className="btn btn-primary" disabled={busy || !data.sites.length}>Verifica e collega</button>
          </form>
          {data.connections.map(c => <div className="publication-connection" key={c.id}><strong>{c.label}</strong><span>{c.endpoint} · {c.status === 'connected' ? 'Connesso' : 'Disconnesso'}</span>{c.status === 'connected' && <button className="btn" disabled={busy} onClick={() => { if (window.confirm('Interrompere il collegamento? Gli articoli su WordPress rimangono. Un invio già in corso potrebbe completarsi.')) run(() => call('disconnect', { connection_id: c.id })); }}>Disconnetti</button>}</div>)}
          <form onSubmit={e => { e.preventDefault(); run(async () => { await call('queue', { connection_id: Number(connection), post_id: Number(post), category_id: Number(category), image, confirmed }); setConfirmed(false); }); }}>
            <h3>Invia un articolo</h3><p>Sono disponibili gli articoli elaborati e non pubblicati sul sito AllSocialToWeb. Il testo consegnato si modifica poi in WordPress.</p>
            <label>Destinazione<select required value={connection} onChange={e => setConnection(e.target.value)}><option value="">Scegli il sito</option>{data.connections.filter(c => c.status === 'connected').map(c => <option key={c.id} value={c.id}>{c.endpoint}</option>)}</select></label>
            <label>Articolo<select required value={post} onChange={e => { setPost(e.target.value); setConfirmed(false); }}><option value="">Scegli una bozza</option>{data.posts.map(p => <option key={p.id} value={p.id}>{p.title || `Articolo ${p.id}`}</option>)}</select></label>
            <label>Categoria<select value={category} onChange={e => { setCategory(e.target.value); setConfirmed(false); }}><option value="0">Predefinita WordPress</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Immagine principale facoltativa (JPEG, PNG, WebP; massimo 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
              setImage(null); setConfirmed(false); const file = e.target.files?.[0]; if (!file) return;
              if (file.size > 2097152) { setError('Immagine troppo grande: massimo 2 MB.'); return; }
              setReadingImage(true);
              try { const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); setImage({ data: encoded.split(',')[1], alt: '' }); } catch { setError('Impossibile leggere l’immagine.'); } finally { setReadingImage(false); }
            }} /></label>
            {image && <label>Descrizione dell’immagine<input value={image.alt} onChange={e => setImage({ ...image, alt: e.target.value })} /></label>}
            <label className="publication-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Ho revisionato l’articolo e voglio inviarlo come bozza a {selected?.endpoint || 'questa destinazione'}.</label>
            <button className="btn btn-primary" disabled={busy || readingImage || !confirmed || !post || !connection}>Invia come bozza</button>
          </form>
          <h3>Consegne</h3>{data.jobs.length === 0 && <p>Nessun invio effettuato.</p>}
          {data.jobs.map(job => <article className="publication-job" key={job.id}><strong>Articolo {job.post_id} · {labels[job.state] || job.state}</strong><p>{job.last_error}</p>
            {job.remote_url && <a href={job.remote_url} target="_blank" rel="noopener noreferrer">Apri articolo sul sito</a>}
            {job.state === 'draft' && <button className="btn" disabled={busy} onClick={() => { if (window.confirm('Pubblicare la versione attualmente presente in WordPress? Sarà visibile al pubblico.')) run(() => call('publish', { job_id: job.id, confirmed: true })); }}>Pubblica su WordPress</button>}
            {['uncertain', 'failed'].includes(job.state) && job.attempts < 5 && <button className="btn" disabled={busy} onClick={() => run(() => call('retry', { job_id: job.id, confirmed: true }))}>Verifica e riprova</button>}
          </article>)}
          <p>Wix e la gestione indipendente di tre siti saranno disponibili dopo il collaudo delle fasi successive.</p>
        </>}
      </section>
    </div>}
  </div>;
}
