import React, { useMemo, useRef, useState } from 'react';
import './OnlinePresenceMap.css';

function publicUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, base); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function buildPresenceMap({ posts = [], foundationPages = [], sources = [], siteUrl, siteTitle }) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  return {
    root: { id: 'site', title: siteTitle || 'Il tuo sito', type: 'Sito pubblico', url: publicUrl(base, base) },
    groups: [
      { id: 'pages', title: 'Pagine', color: '#6c5ce7', items: foundationPages.map((page, index) => ({ id: `page-${index}`, title: page.title || page.slug || 'Pagina', type: 'Pagina del sito', url: publicUrl(page.slug ? `${base}/${encodeURIComponent(String(page.slug).replace(/^\//, ''))}` : base, base) })) },
      { id: 'articles', title: 'Articoli pubblicati', color: '#087f8c', items: posts.filter(post => Number(post.published) === 1).map((post, index) => ({ id: `post-${post.id ?? index}`, title: post.edited_title || post.generated_title || 'Articolo', type: 'Articolo pubblicato', url: post.slug ? publicUrl(`${base}/${encodeURIComponent(post.slug)}`, base) : '', description: String(post.edited_excerpt || post.generated_excerpt || '').replace(/<[^>]*>/g, '') })) },
      { id: 'sources', title: 'Canali collegati', color: '#b45f06', items: sources.map((source, index) => ({ id: `source-${source.id ?? index}`, title: source.label || source.platform || 'Canale', type: source.platform || 'Canale collegato', url: publicUrl(source.url, base) })) },
    ],
  };
}

export function SiteMapGraph(props) {
  const map = useMemo(() => buildPresenceMap(props), [props.posts, props.foundationPages, props.sources, props.siteUrl, props.siteTitle]);
  const [expanded, setExpanded] = useState('pages');
  const [selectedId, setSelectedId] = useState('site');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const svg = useRef(null);
  const groups = map.groups.map((group, index) => ({ ...group, x: 410, y: 125 + index * 215, filtered: group.items.filter(item => item.title.toLowerCase().includes(search.toLowerCase())) }));
  const branch = groups.find(group => group.id === expanded);
  const items = branch?.filtered.slice(offset, offset + 8) || [];
  const nodes = [{ ...map.root, x: 130, y: 340, color: '#263b63' }, ...groups.map(group => ({ ...group, type: 'Ramo della mappa', x: group.x, y: group.y })), ...items.map((item, index) => ({ ...item, color: branch.color, x: 810, y: 340 + (index - (items.length - 1) / 2) * 77 }))];
  const selected = nodes.find(node => node.id === selectedId) || map.groups.flatMap(group => group.items).find(node => node.id === selectedId) || map.root;
  const selectedGroup = groups.find(group => group.id === selectedId);
  function choose(node) {
    setSelectedId(node.id);
    if (groups.some(group => group.id === node.id)) { setExpanded(expanded === node.id ? null : node.id); setOffset(0); }
  }
  function reset() { setZoom(1); setPan({ x: 0, y: 0 }); }
  const curve = (from, to) => `M${from.x + 90},${from.y} C${from.x + 185},${from.y} ${to.x - 185},${to.y} ${to.x - 90},${to.y}`;

  return <div className="online-map">
    <div className="online-map-tools">
      <label>Cerca nella mappa<input value={search} placeholder="Titolo, pagina o canale…" onChange={event => { const value = event.target.value; setSearch(value); setOffset(0); const match = map.groups.find(group => group.items.some(item => item.title.toLowerCase().includes(value.toLowerCase()))); if (value && match) setExpanded(match.id); }} /></label>
      <div className="online-map-zoom" aria-label="Controlli della mappa"><button type="button" aria-label="Riduci mappa" onClick={() => setZoom(value => Math.max(.5, value - .2))}>−</button><output>{Math.round(zoom * 100)}%</output><button type="button" aria-label="Ingrandisci mappa" onClick={() => setZoom(value => Math.min(2.4, value + .2))}>+</button><button type="button" onClick={reset}>Centra</button></div>
    </div>
    <p className="online-map-help">Apri un ramo, seleziona un nodo o trascina lo sfondo per spostarti. I collegamenti mostrano la struttura dei dati del tuo sito.</p>
    <div className="online-map-workspace">
      <div className="online-map-canvas">
        <svg ref={svg} viewBox="0 0 1100 700" aria-label="Mappa concettuale della presenza online" onPointerDown={event => {
          if (event.target.closest('[data-map-node]')) return;
          drag.current = { x: event.clientX, y: event.clientY, start: pan, scale: Math.min(svg.current.getBoundingClientRect().width / 1100, svg.current.getBoundingClientRect().height / 700) };
          event.currentTarget.setPointerCapture(event.pointerId);
        }} onPointerMove={event => { if (drag.current) setPan({ x: drag.current.start.x + (event.clientX - drag.current.x) / drag.current.scale, y: drag.current.start.y + (event.clientY - drag.current.y) / drag.current.scale }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <g transform={`translate(${550 * (1 - zoom) + pan.x} ${350 * (1 - zoom) + pan.y}) scale(${zoom})`}>
            {groups.map(group => <path key={group.id} d={curve(nodes[0], group)} fill="none" stroke={group.color} strokeWidth="2" opacity=".55" />)}
            {items.map((item, index) => <path key={item.id} d={curve(branch, { x: 810, y: 340 + (index - (items.length - 1) / 2) * 77 })} fill="none" stroke={branch.color} strokeWidth="1.5" opacity=".45" />)}
            {nodes.map(node => <g key={node.id} data-map-node role="button" tabIndex="0" aria-label={`${node.title}${node.items ? `, ${node.items.length} elementi` : ''}`} aria-expanded={node.items ? expanded === node.id : undefined} aria-pressed={selectedId === node.id} onClick={() => choose(node)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(node); } }} className="online-map-node" transform={`translate(${node.x - 90} ${node.y - 29})`}>
              <title>{node.title}</title><rect width="180" height="58" rx="13" fill={selectedId === node.id ? node.color : 'var(--surface,white)'} stroke={node.color} strokeWidth={selectedId === node.id ? 3 : 1.5} />
              <text x="12" y="24" fill={selectedId === node.id ? 'white' : 'var(--text,#182236)'} fontSize="13" fontWeight="600">{node.title.length > 23 ? node.title.slice(0, 22) + '…' : node.title}</text>
              <text x="12" y="43" fill={selectedId === node.id ? 'white' : node.color} fontSize="11">{node.items ? `${node.items.length} elementi · ${expanded === node.id ? 'chiudi ramo' : 'apri ramo'}` : node.type}</text>
            </g>)}
          </g>
        </svg>
        {branch && <div className="online-map-pagination"><span>{branch.title}: {branch.filtered.length ? `${offset + 1}–${Math.min(offset + 8, branch.filtered.length)} di ${branch.filtered.length}` : 'nessun elemento'}</span><button type="button" disabled={offset === 0} aria-label="Nodi precedenti" onClick={() => setOffset(value => Math.max(0, value - 8))}>←</button><button type="button" disabled={offset + 8 >= branch.filtered.length} aria-label="Nodi successivi" onClick={() => setOffset(value => value + 8)}>→</button></div>}
      </div>
      <aside className="online-map-details" aria-label="Dettagli del nodo" aria-live="polite"><span>{selectedGroup ? 'Ramo della mappa' : selected.type}</span><h4>{selected.title}</h4>{selected.description && <p>{selected.description}</p>}{selectedGroup ? <p>{selectedGroup.items.length} elementi. Seleziona un nodo del ramo per aprirne i dettagli.</p> : selected.url ? <a href={selected.url} target="_blank" rel="noopener noreferrer">Apri la pagina ↗</a> : <p>Nessun indirizzo pubblico disponibile per questo nodo.</p>}<p className="online-map-note">La presenza nella mappa non indica che Google abbia indicizzato la pagina.</p></aside>
    </div>
  </div>;
}
