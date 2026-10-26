import React, { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/api';
import './AdminOperations.css';

const labels = { all: 'Tutti gli stati', queue: 'Tutta la coda', published: 'Pubblicati', draft: 'Bozze pronte', pending: 'In attesa', processing: 'In elaborazione', failed: 'Falliti' };

export function AdminOperations({ token, queue = false, onClient, users = [], selectedUserId = '', onUserSelect }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(queue ? 'queue' : 'all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  useEffect(() => { setPage(1); setNotice(''); }, [selectedUserId]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const id = ++request.current;
    const controller = new AbortController();
    setLoading(true); setError('');
    apiFetch(`/api/index.php?action=admin-content-list&status=${status}&page=${page}&q=${encodeURIComponent(query)}${selectedUserId ? `&user_id=${encodeURIComponent(selectedUserId)}` : ''}`, { signal: controller.signal }, token)
      .then(result => { if (id === request.current) setData(result); })
      .catch(e => { if (id === request.current && e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (id === request.current) setLoading(false); });
    return () => controller.abort();
  }, [token, status, page, query, revision, selectedUserId]);

  async function change(item, operation) {
    const messages = { publish: 'Pubblicare questo articolo sul sito del cliente?', unpublish: 'Ritirare questo articolo dal sito pubblico?', retry: 'Rimettere in coda questo contenuto? La prossima elaborazione può consumare credito AI.', noindex: 'Escludere questo articolo dai motori di ricerca?', index: 'Consentire l’indicizzazione di questo articolo?' };
    if (busy || !window.confirm(messages[operation])) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiFetch('/api/index.php?action=admin-content-action', { method: 'POST', body: JSON.stringify({ id: item.id, operation }) }, token);
      setNotice(operation === 'retry' ? 'Contenuto rimesso in attesa. Verrà elaborato dal normale flusso di sincronizzazione.' : 'Contenuto aggiornato.');
      setRevision(value => value + 1);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <section className="card admin-operations" aria-label={queue ? 'Gestione coda' : 'Gestione contenuti'}>
    <div className="admin-section-heading"><div><span>{queue ? 'Recupero elaborazioni' : 'Archivio completo'}</span><h3>{queue ? 'Coda e recupero errori' : 'Gestione contenuti'}</h3><p>{queue ? 'Controlla tentativi e stato. Puoi recuperare errori e lavorazioni ferme da oltre 10 minuti.' : 'Cerca in tutti i contenuti, gestisci pubblicazione e indicizzazione, apri il cliente.'}</p></div><button className="btn btn-outline" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}>Aggiorna elenco</button></div>
    {onUserSelect && <div className="ao-scope"><label>Ambito del controllo<select aria-label="Filtra contenuti per cliente" value={selectedUserId} disabled={busy} onChange={e => { setPage(1); setNotice(''); onUserSelect(e.target.value); }}><option value="">Tutti i clienti e account</option>{users.map(user => <option key={user.id} value={user.id}>{user.name || user.email} · {user.email}</option>)}</select></label><small>{selectedUserId ? 'Operazioni limitate al cliente selezionato.' : 'Stai consultando i contenuti di tutta la piattaforma.'}</small></div>}
    <div className="ao-filters"><label>Cerca contenuti o clienti<input type="search" value={search} placeholder="Titolo, nome, email o ID" onChange={e => setSearch(e.target.value)} /></label><label>Stato<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>{Object.entries(labels).filter(([key]) => queue ? ['queue','pending','processing','failed'].includes(key) : key !== 'queue').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    {error && <p role="alert" className="admin-warning">{error} <button className="btn btn-outline" onClick={() => setRevision(value => value + 1)}>Riprova</button></p>}
    {notice && <p role="status">{notice}</p>}
    <div aria-busy={loading}>
      {loading ? <p role="status">Caricamento contenuti…</p> : !error && <>
        <p>{data?.total ?? 0} risultati · pagina {data?.page ?? 1} di {data?.pages ?? 1}</p>
        <div className="ao-items">{(data?.items || []).map(item => {
          const published = Number(item.published) === 1;
          const canRetry = !published && Number(item.seo_score) === -1 && (item.processing_status === 'failed' || Number(item.stale) === 1);
          const canPublish = !published && item.processing_status === 'done' && Number(item.seo_score) >= 0 && Number(item.has_content) === 1;
          return <article key={item.id}><div className="ao-item-body"><small>#{item.id} · {item.platform || 'Origine sconosciuta'}</small><h4>{item.edited_title || item.generated_title || 'Contenuto da elaborare'}</h4><button className="ao-client" onClick={() => onClient(String(item.user_id))}>{item.name || item.email || `Cliente #${item.user_id}`}</button><p><span className={`badge ${published ? 'badge-green' : item.processing_status === 'failed' ? 'badge-red' : 'badge-amber'}`}>{published ? 'Pubblicato' : labels[item.processing_status] || item.processing_status || 'Bozza'}</span> {Number(item.stale) === 1 && '· Lavorazione da recuperare'} · {Number(item.processing_attempts || 0)} tentativi · SEO {Number(item.seo_score) < 0 ? 'in attesa' : item.seo_score ?? '—'}</p></div><div className="ao-actions">{canRetry && <button className="btn btn-primary" disabled={busy} onClick={() => change(item, 'retry')}>Rimetti in coda</button>}{canPublish && <button className="btn btn-primary" disabled={busy} onClick={() => change(item, 'publish')}>Pubblica</button>}{published && <button className="btn btn-outline" disabled={busy} onClick={() => change(item, 'unpublish')}>Ritira pubblicazione</button>}{published && <button className="btn btn-outline" disabled={busy} onClick={() => change(item, Number(item.noindex) === 1 ? 'index' : 'noindex')}>{Number(item.noindex) === 1 ? 'Consenti indicizzazione' : 'Escludi da Google'}</button>}</div></article>;
        })}</div>
        {!data?.items?.length && <p>Nessun contenuto corrisponde ai filtri.</p>}
        <div className="ao-pagination"><button className="btn btn-outline" disabled={busy || (data?.page ?? 1) <= 1} onClick={() => setPage(data.page - 1)}>Precedente</button><button className="btn btn-outline" disabled={busy || (data?.page ?? 1) >= (data?.pages ?? 1)} onClick={() => setPage(data.page + 1)}>Successiva</button></div>
      </>}
    </div>
  </section>;
}
