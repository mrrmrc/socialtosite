import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { SITE_LAYOUTS } from '../utils/siteLayouts';
import { apiFetch } from '../utils/api';

/* ─── Constants ───────────────────────────────────────────────────────────── */

const FONTS = [
  'Inter', 'Outfit', 'Plus Jakarta Sans', 'Space Grotesk', 'Sora',
  'DM Sans', 'Source Sans 3', 'Cormorant Garamond', 'Fraunces',
];

const DEFAULT_STYLE = {
  design_archetype: 'tech-clarity',
  font_heading: 'Plus Jakarta Sans',
  font_body: 'Inter',
  color_palette: {
    background: '#f3f7fb', surface: '#ffffff', text: '#16202a',
    text_muted: '#5f6b76', primary: '#2563eb', secondary: '#dbe8ff',
    primary_gradient: 'linear-gradient(135deg, #4f8cff, #1d4ed8)',
  },
  ui_style: { radius: '16px', card_shadow: '0 10px 30px rgba(15,23,42,0.08)', glassmorphism: false },
  layout_recipe: {
    hero: 'product', nav: 'solid', cards: 'product', density: 'balanced',
    section_order: ['hero', 'latest', 'topics', 'info'], hidden_sections: [],
  },
  base_models: ['tech-clarity'],
  custom_css: '',
};

const HERO_CHOICES = [
  { id: 'product',   icon: '▤', title: 'Pulita e professionale', desc: 'Titolo chiaro, messaggio diretto e call to action.' },
  { id: 'split',     icon: '◫', title: 'Testo + immagine',       desc: 'Presentazione divisa in due parti, molto leggibile.' },
  { id: 'editorial', icon: 'T', title: 'Editoriale',             desc: 'Più elegante, con il testo al centro della scena.' },
  { id: 'immersive', icon: '▣', title: 'Immagine protagonista',  desc: 'Testata ampia e scenografica.' },
  { id: 'human',     icon: '☺', title: 'Profilo personale',      desc: 'Ideale per professionisti e personal brand.' },
];

const NAV_CHOICES = [
  { id: 'minimal',     icon: '☰', title: 'Solo pulsante',   desc: 'Nessuna barra: resta soltanto un pulsante menu discreto.', recommended: true },
  { id: 'floating',    icon: '◉', title: 'Flottante',        desc: 'Nome e menu diventano due piccoli controlli sospesi.' },
  { id: 'centered',    icon: '⌾', title: 'Centrato',         desc: 'Identità al centro e apertura menu separata.' },
  { id: 'solid',       icon: '▬', title: 'Compatto',         desc: 'Nome e menu raccolti in una piccola capsula.' },
  { id: 'transparent', icon: '▱', title: 'Trasparente',      desc: 'Controlli senza sfondo, integrati nella testata.' },
];

const CONTENT_CHOICES = [
  { id: 'editorial', icon: '▥', title: 'Magazine',       desc: 'Un contenuto guida gli altri. Ottimo per articoli e approfondimenti.' },
  { id: 'product',   icon: '▦', title: 'Griglia ordinata', desc: 'Tutti i contenuti hanno lo stesso peso e sono facili da scorrere.' },
  { id: 'cinematic', icon: '▣', title: 'Foto grandi',     desc: 'Più impatto visivo, ideale se immagini e video sono importanti.' },
  { id: 'soft',      icon: '▤', title: 'Raccolta morbida', desc: 'Card leggere e ariose, adatte a un sito personale.' },
  { id: 'bold',      icon: '▧', title: 'Compatta',        desc: 'Mostra più contenuti nello stesso spazio.' },
];

const DENSITY_CHOICES = [
  { id: 'compact',  icon: '▪▪▪', title: 'Compatto',    desc: 'Più info subito' },
  { id: 'balanced', icon: '▪ ▪',  title: 'Equilibrato', desc: 'La scelta più versatile' },
  { id: 'airy',     icon: '▪   ▪', title: 'Arioso',    desc: 'Più spazio e respiro' },
];

const SECTION_BLOCKS = [
  { id: 'hero',   icon: '✦', title: 'Apertura',         desc: 'Presentazione e contenuto in evidenza' },
  { id: 'latest', icon: '▦', title: 'Ultimi contenuti', desc: 'Articoli e aggiornamenti recenti' },
  { id: 'topics', icon: '#', title: 'Argomenti',        desc: 'Categorie utili per esplorare' },
  { id: 'info',   icon: '◎', title: 'Informazioni',     desc: 'Servizi, contatti e approfondimenti' },
];

const TOOLS = [
  { id: 'themes',    icon: '✨', label: 'Stile',     help: 'Scegli una base pronta' },
  { id: 'texts',     icon: 'T',  label: 'Testi',     help: 'Modifica ciò che si legge' },
  { id: 'structure', icon: '⠿',  label: 'Blocchi',   help: 'Trascina e riordina la pagina' },
  { id: 'header',    icon: '▣',  label: 'Testata',   help: 'Decidi come inizi la pagina' },
  { id: 'menu',      icon: '☰',  label: 'Menu',      help: 'Scegli la navigazione' },
  { id: 'content',   icon: '▦',  label: 'Contenuti', help: 'Disponi articoli e foto' },
  { id: 'colors',    icon: '●',  label: 'Colori',    help: 'Personalizza l\'aspetto' },
  { id: 'advanced',  icon: '⚙',  label: 'Avanzate',  help: 'Solo se ti servono' },
];

const BUILDER_LAYOUTS = SITE_LAYOUTS.filter(
  (layout, index, layouts) => layouts.findIndex(item => item.family === layout.family) === index,
);

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function normalize(raw, fallback = 'tech-clarity') {
  const preset = SITE_LAYOUTS.find(x => x.id === fallback) || SITE_LAYOUTS[0];
  const src = raw && typeof raw === 'object' ? raw : {};
  const defaultOrder = SECTION_BLOCKS.map(item => item.id);
  const requestedOrder = Array.isArray(src.layout_recipe?.section_order) ? src.layout_recipe.section_order : [];
  const sectionOrder = [
    ...requestedOrder.filter(id => defaultOrder.includes(id)),
    ...defaultOrder.filter(id => !requestedOrder.includes(id)),
  ];
  return {
    design_archetype: src.design_archetype || preset?.id || DEFAULT_STYLE.design_archetype,
    font_heading: src.font_heading || preset?.font_heading || DEFAULT_STYLE.font_heading,
    font_body: src.font_body || preset?.font_body || DEFAULT_STYLE.font_body,
    color_palette: { ...DEFAULT_STYLE.color_palette, ...(preset?.color_palette || {}), ...(src.color_palette || {}) },
    ui_style: { ...DEFAULT_STYLE.ui_style, ...(preset?.ui_style || {}), ...(src.ui_style || {}) },
    layout_recipe: {
      ...DEFAULT_STYLE.layout_recipe,
      ...(preset?.layout_recipe || {}),
      ...(src.layout_recipe || {}),
      section_order: sectionOrder,
      hidden_sections: Array.isArray(src.layout_recipe?.hidden_sections)
        ? src.layout_recipe.hidden_sections.filter(id => defaultOrder.includes(id))
        : [],
    },
    base_models: Array.isArray(src.base_models) ? src.base_models : (preset?.base_models || [preset?.id].filter(Boolean)),
    custom_css: src.custom_css || '',
  };
}

function encodePreview(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch { return ''; }
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function ToolIcon({ tool, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tool.label}
      aria-label={tool.label}
      aria-pressed={active}
      style={{
        width: 60,
        height: 60,
        borderRadius: 16,
        border: active ? '1.5px solid rgba(96,165,250,.6)' : '1.5px solid transparent',
        background: active
          ? 'linear-gradient(135deg, rgba(37,99,235,.35), rgba(37,99,235,.15))'
          : 'transparent',
        color: active ? '#93c5fd' : 'rgba(255,255,255,.48)',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        gap: 2,
        padding: '7px 3px',
        transition: 'all .18s ease',
        boxShadow: active ? '0 0 0 3px rgba(37,99,235,.12), inset 0 1px 0 rgba(255,255,255,.06)' : 'none',
        position: 'relative',
      }}
    >
      {active && (
        <span style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 24, borderRadius: '0 3px 3px 0',
          background: 'linear-gradient(180deg, #60a5fa, #2563eb)',
        }} />
      )}
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{tool.icon}</span>
      <small style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.1, letterSpacing: '.04em' }}>
        {tool.label}
      </small>
    </button>
  );
}

function ChoiceCard({ active, icon, title, desc, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', display: 'grid',
        gridTemplateColumns: '44px 1fr', gap: 12,
        padding: '13px 14px', borderRadius: 14, cursor: 'pointer', color: '#fff',
        border: active ? '1.5px solid rgba(96,165,250,.7)' : '1px solid rgba(255,255,255,.1)',
        background: active
          ? 'linear-gradient(135deg, rgba(37,99,235,.28), rgba(37,99,235,.1))'
          : 'rgba(255,255,255,.03)',
        boxShadow: active ? '0 0 0 3px rgba(37,99,235,.1)' : 'none',
        transition: 'all .15s ease',
      }}
    >
      <span style={{
        width: 44, height: 44, borderRadius: 11,
        display: 'grid', placeItems: 'center',
        background: active ? 'rgba(37,99,235,.25)' : 'rgba(255,255,255,.07)',
        fontSize: 20, color: active ? '#93c5fd' : '#fff',
        transition: 'all .15s ease',
      }}>{icon}</span>
      <span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 13, color: active ? '#dbeafe' : '#fff' }}>{title}</strong>
          {badge && (
            <em style={{
              fontStyle: 'normal', fontSize: 9, fontWeight: 800, letterSpacing: '.05em',
              padding: '3px 7px', borderRadius: 999,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff',
            }}>CONSIGLIATO</em>
          )}
        </span>
        <small style={{ display: 'block', opacity: .55, fontSize: 11, lineHeight: 1.4, marginTop: 4 }}>
          {desc}
        </small>
      </span>
    </button>
  );
}

function SectionHeader({ children, help }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 5px', fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{children}</h3>
      <p style={{ margin: 0, opacity: .52, fontSize: 12, lineHeight: 1.5 }}>{help}</p>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 10, padding: '10px 14px', borderRadius: 12,
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
      fontSize: 12, fontWeight: 700, color: '#cbd5e1', cursor: 'pointer',
      transition: 'background .12s ease',
    }}>
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: value || '#000',
          border: '2px solid rgba(255,255,255,.15)', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,.3)',
        }} />
        <input
          aria-label={label}
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
        />
        <span style={{ fontSize: 10, opacity: .45, fontFamily: 'monospace' }}>{value}</span>
      </span>
    </label>
  );
}

function FontSelect({ label, value, onChange }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '10px 12px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,.12)',
          background: 'rgba(255,255,255,.06)', color: '#fff',
          fontSize: 13, fontWeight: 600,
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'calc(100% - 10px) center',
          paddingRight: 32,
        }}
      >
        {FONTS.map(f => <option key={f} value={f} style={{ background: '#0f172a' }}>{f}</option>)}
      </select>
    </div>
  );
}

function PanelInput({ label, value, onChange, placeholder, multiline }) {
  const shared = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid rgba(255,255,255,.1)',
    background: 'rgba(255,255,255,.05)', color: '#fff',
    fontSize: 13, fontWeight: 500, outline: 'none',
    transition: 'border-color .15s ease',
  };
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={3}
          style={{ ...shared, resize: 'vertical', minHeight: 90, lineHeight: 1.5 }}
          onFocus={e => (e.target.style.borderColor = 'rgba(96,165,250,.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
        />
      ) : (
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={shared}
          onFocus={e => (e.target.style.borderColor = 'rgba(96,165,250,.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
        />
      )}
    </label>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function ProSiteBuilder({ user, open, onClose }) {
  const [site, setSite] = useState(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [section, setSection] = useState('themes');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [previewTick, setPreviewTick] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savedStyle, setSavedStyle] = useState(DEFAULT_STYLE);
  const [content, setContent] = useState({ title: '', hero_tagline: '', bio: '' });
  const [savedContent, setSavedContent] = useState({ title: '', hero_tagline: '', bio: '' });
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceRef = useRef(null);
  const previewRef = useRef(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('sts_token') : '';

  // Load site data
  useEffect(() => {
    if (!open || !token) return;
    apiFetch('/api/index.php?action=site', {}, token)
      .then(data => {
        const current = data?.site || {};
        setSite(current);
        let ai = null;
        try { ai = typeof current.site_ai_data === 'string' ? JSON.parse(current.site_ai_data) : current.site_ai_data; } catch {}
        const normalized = normalize(ai, current.theme || 'tech-clarity');
        const currentContent = { title: current.title || '', hero_tagline: current.hero_tagline || '', bio: current.profile_summary || current.bio || '' };
        setStyle(normalized);
        setSavedStyle(normalized);
        setContent(currentContent);
        setSavedContent(currentContent);
      })
      .catch(err => setMessage(err.message));
  }, [open, token]);

  // Debounced preview update
  useEffect(() => {
    if (!open) return;
    setPreviewLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewTick(x => x + 1), 150);
    return () => clearTimeout(debounceRef.current);
  }, [style, content, open]);

  // Click-on-preview to jump to tool
  useEffect(() => {
    if (!open) return;
    const handler = event => {
      if (event.source !== previewRef.current?.contentWindow || event.data?.type !== 'sts-studio-select') return;
      if (TOOLS.some(item => item.id === event.data.section)) setSection(event.data.section);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open]);

  const siteUrl = useMemo(
    () => `${window.location.origin}/${user?.slug || site?.slug || ''}`.replace(/\/$/, ''),
    [user?.slug, site?.slug],
  );
  const previewUrl = useMemo(
    () => `${siteUrl}?studio_preview=1&preview_data=${encodePreview({ ...style, ...content })}&v=${previewTick}`,
    [siteUrl, style, content, previewTick],
  );

  const setNested = useCallback((group, key, value) =>
    setStyle(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } })), []);

  const applyTheme = preset =>
    setStyle(prev => normalize({ ...preset, custom_css: prev.custom_css || '' }, preset.id));

  const dirty = useMemo(
    () => JSON.stringify(style) !== JSON.stringify(savedStyle) || JSON.stringify(content) !== JSON.stringify(savedContent),
    [style, savedStyle, content, savedContent],
  );

  function moveBlock(targetId) {
    if (!draggedBlock || draggedBlock === targetId) return;
    const order = [...style.layout_recipe.section_order];
    const next = order.filter(id => id !== draggedBlock);
    next.splice(next.indexOf(targetId), 0, draggedBlock);
    setNested('layout_recipe', 'section_order', next);
    setDraggedBlock(null);
  }

  function nudgeBlock(blockId, direction) {
    const order = [...style.layout_recipe.section_order];
    const index = order.indexOf(blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setNested('layout_recipe', 'section_order', order);
  }

  function toggleBlock(blockId) {
    const hidden = new Set(style.layout_recipe.hidden_sections || []);
    if (hidden.has(blockId)) hidden.delete(blockId); else hidden.add(blockId);
    setNested('layout_recipe', 'hidden_sections', [...hidden]);
  }

  function closeBuilder() {
    if (dirty && !window.confirm('Hai modifiche non salvate. Vuoi davvero uscire?')) return;
    onClose();
  }

  async function save() {
    setSaving(true); setMessage(''); setSaveSuccess(false);
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method: 'POST',
        body: JSON.stringify({
          theme: style.design_archetype,
          design_archetype: style.design_archetype,
          accent_color: style.color_palette.primary,
          custom_css: style.custom_css || '',
          site_ai_data: style,
          title: content.title.trim(),
          hero_tagline: content.hero_tagline,
          bio: content.bio,
        }),
      }, token);
      setSavedStyle(style);
      setSavedContent(content);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) { setMessage(e.message); }
    setSaving(false);
  }

  if (!open) return null;

  const activeTool = TOOLS.find(t => t.id === section);

  return (
    <>
      <style>{`
        @keyframes psb-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes psb-pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        @keyframes psb-spin { to { transform:rotate(360deg); } }
        @keyframes psb-success { 0% { transform:scale(0.8); opacity:0; } 60% { transform:scale(1.05); } 100% { transform:scale(1); opacity:1; } }
        .psb-tool-btn:hover { background: rgba(255,255,255,.06) !important; color: rgba(255,255,255,.8) !important; }
        .psb-choice:hover { background: rgba(255,255,255,.06) !important; border-color: rgba(255,255,255,.18) !important; }
        .psb-theme-card:hover { border-color: rgba(96,165,250,.4) !important; background: rgba(255,255,255,.04) !important; transform: translateY(-2px); }
        .psb-block-row:hover { border-color: rgba(255,255,255,.18) !important; background: rgba(255,255,255,.07) !important; }
        .psb-color-row:hover { background: rgba(255,255,255,.07) !important; }
        .psb-panel-inner { animation: psb-fadein .2s ease; }
        .psb-density-btn:hover { border-color: rgba(255,255,255,.25) !important; background: rgba(255,255,255,.07) !important; }
      `}</style>

      <div
        className="pro-site-builder"
        style={{
          position: 'fixed', inset: 0, zIndex: 30000,
          background: '#060d1a',
          color: '#fff',
          display: 'grid',
          gridTemplateRows: '64px 1fr',
          fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', gap: 14,
          borderBottom: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(8,15,30,.95)',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              type="button"
              onClick={closeBuilder}
              title="Chiudi Studio"
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.7)',
                cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 18,
                transition: 'all .15s ease',
              }}
            >←</button>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-.01em' }}>
                Modifica il tuo sito
              </div>
              <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>
                {content.title || site?.title || 'Sito senza nome'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Dirty indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 999,
              background: dirty ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)',
              border: `1px solid ${dirty ? 'rgba(245,158,11,.2)' : 'rgba(34,197,94,.18)'}`,
              fontSize: 11, fontWeight: 700,
              color: dirty ? '#fbbf24' : '#86efac',
              transition: 'all .3s ease',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 99,
                background: dirty ? '#f59e0b' : '#22c55e',
                animation: dirty ? 'psb-pulse 1.5s ease infinite' : 'none',
              }} />
              {dirty ? 'Modifiche da salvare' : 'Tutto salvato'}
            </div>

            {saveSuccess && (
              <div style={{
                padding: '5px 14px', borderRadius: 999,
                background: 'rgba(34,197,94,.15)',
                border: '1px solid rgba(34,197,94,.25)',
                color: '#86efac', fontSize: 11, fontWeight: 800,
                animation: 'psb-success .3s ease',
              }}>✓ Pubblicato!</div>
            )}

            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 14px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,.12)',
                background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.75)',
                textDecoration: 'none', fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all .15s ease',
              }}
            >
              <span style={{ fontSize: 11 }}>↗</span> Apri sito
            </a>

            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              style={{
                padding: '8px 18px', borderRadius: 10,
                border: 'none',
                background: dirty
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'rgba(255,255,255,.08)',
                color: dirty ? '#fff' : 'rgba(255,255,255,.35)',
                fontWeight: 800, fontSize: 13, cursor: dirty ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: dirty ? '0 4px 16px rgba(37,99,235,.35)' : 'none',
                transition: 'all .2s ease',
              }}
            >
              {saving ? (
                <><span style={{ display: 'inline-block', animation: 'psb-spin .8s linear infinite', fontSize: 14 }}>⟳</span> Pubblicazione…</>
              ) : 'Salva e pubblica'}
            </button>
          </div>
        </header>

        {/* ── Workspace ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', minHeight: 0 }}>

          {/* ── Tool Sidebar ── */}
          <nav
            aria-label="Strumenti di modifica"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 4, padding: '12px 6px',
              borderRight: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(4,9,20,.9)',
              overflowY: 'auto',
            }}
          >
            {TOOLS.map(tool => (
              <ToolIcon
                key={tool.id}
                tool={tool}
                active={section === tool.id}
                onClick={() => setSection(tool.id)}
              />
            ))}

            <div style={{ marginTop: 'auto', paddingTop: 8, width: '100%', display: 'grid', gap: 4 }}>
              {/* Panel toggle */}
              <button
                type="button"
                title={panelVisible ? 'Nascondi pannello' : 'Mostra pannello'}
                onClick={() => setPanelVisible(v => !v)}
                style={{
                  width: 60, height: 44, borderRadius: 12,
                  border: '1px solid rgba(255,255,255,.08)',
                  background: panelVisible ? 'rgba(255,255,255,.06)' : 'transparent',
                  color: 'rgba(255,255,255,.4)', cursor: 'pointer',
                  fontSize: 16, display: 'grid', placeItems: 'center',
                  transition: 'all .15s ease',
                }}
              >{panelVisible ? '◁' : '▷'}</button>
            </div>
          </nav>

          {/* ── Main Area ── */}
          <div style={{ display: 'grid', gridTemplateColumns: panelVisible ? '340px 1fr' : '0 1fr', minHeight: 0, transition: 'grid-template-columns .25s ease' }}>

            {/* ── Detail Panel ── */}
            <aside style={{
              overflowY: 'auto', overflowX: 'hidden',
              borderRight: '1px solid rgba(255,255,255,.07)',
              background: 'rgba(7,14,28,.96)',
              opacity: panelVisible ? 1 : 0,
              transition: 'opacity .2s ease',
            }}>
              {/* Panel header */}
              <div style={{
                position: 'sticky', top: 0, zIndex: 2,
                padding: '16px 18px',
                background: 'rgba(7,14,28,.96)',
                borderBottom: '1px solid rgba(255,255,255,.07)',
                backdropFilter: 'blur(16px)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(37,99,235,.2)', border: '1px solid rgba(96,165,250,.2)',
                    display: 'grid', placeItems: 'center', fontSize: 18, color: '#93c5fd',
                    flexShrink: 0,
                  }}>{activeTool?.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>{activeTool?.label}</div>
                    <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>{activeTool?.help}</div>
                  </div>
                </div>

                {/* Click-on-preview hint */}
                <div style={{
                  marginTop: 12, padding: '9px 12px', borderRadius: 10,
                  background: 'rgba(37,99,235,.1)', border: '1px solid rgba(96,165,250,.15)',
                  fontSize: 11, lineHeight: 1.5, color: '#bfdbfe',
                }}>
                  <strong>Clicca direttamente sul sito</strong> nell'anteprima per passare subito allo strumento giusto.
                </div>
              </div>

              {/* Panel content */}
              <div className="psb-panel-inner" key={section} style={{ padding: '18px 18px 80px', display: 'grid', gap: 12 }}>

                {/* ── Themes ── */}
                {section === 'themes' && <>
                  <SectionHeader help="Un tema cambia colori, carattere, testata, menu e stile dei contenuti. Poi puoi personalizzarlo nei passaggi successivi.">
                    Scegli da dove partire
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {BUILDER_LAYOUTS.map(p => (
                      <button
                        key={p.id}
                        className="psb-theme-card"
                        onClick={() => applyTheme(p)}
                        style={{
                          width: '100%', textAlign: 'left',
                          display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12,
                          padding: '14px 14px', borderRadius: 14, cursor: 'pointer', color: '#fff',
                          border: style.design_archetype === p.id
                            ? '1.5px solid rgba(96,165,250,.7)'
                            : '1px solid rgba(255,255,255,.08)',
                          background: style.design_archetype === p.id
                            ? 'linear-gradient(135deg, rgba(37,99,235,.22), rgba(37,99,235,.08))'
                            : 'rgba(255,255,255,.02)',
                          boxShadow: style.design_archetype === p.id ? '0 0 0 3px rgba(37,99,235,.1)' : 'none',
                          transition: 'all .18s ease',
                        }}
                      >
                        <span style={{ fontSize: 32, lineHeight: 1.2, display: 'grid', placeItems: 'center' }}>{p.emoji}</span>
                        <span>
                          <strong style={{ display: 'block', fontSize: 14, color: style.design_archetype === p.id ? '#dbeafe' : '#fff' }}>{p.name}</strong>
                          <small style={{ display: 'block', opacity: .5, fontSize: 11, lineHeight: 1.35, marginTop: 3 }}>{p.desc}</small>
                          <span style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                            {p.colors.map(c => <i key={c} style={{ width: 16, height: 16, borderRadius: 99, background: c, border: '1px solid rgba(255,255,255,.2)' }} />)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>}

                {/* ── Texts ── */}
                {section === 'texts' && <>
                  <SectionHeader help="Clicca nei campi e guarda subito il risultato nella pagina a destra.">
                    Testi principali
                  </SectionHeader>
                  <PanelInput label="Nome del sito" value={content.title} onChange={v => setContent(p => ({ ...p, title: v }))} placeholder="Nome attività" />
                  <PanelInput label="Titolo di apertura" value={content.hero_tagline} onChange={v => setContent(p => ({ ...p, hero_tagline: v }))} placeholder="La tua promessa principale" />
                  <PanelInput label="Breve presentazione" value={content.bio} onChange={v => setContent(p => ({ ...p, bio: v }))} placeholder="Chi sei e cosa offri" multiline />
                </>}

                {/* ── Structure ── */}
                {section === 'structure' && <>
                  <SectionHeader help="Trascina i blocchi nell'ordine che preferisci. L'occhio mostra o nasconde una sezione senza eliminarla.">
                    Componi la pagina
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {style.layout_recipe.section_order.map((blockId, index, order) => {
                      const block = SECTION_BLOCKS.find(item => item.id === blockId);
                      const hidden = (style.layout_recipe.hidden_sections || []).includes(blockId);
                      return (
                        <div
                          key={blockId}
                          className="psb-block-row"
                          draggable
                          onDragStart={() => setDraggedBlock(blockId)}
                          onDragEnd={() => setDraggedBlock(null)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => moveBlock(blockId)}
                          style={{
                            display: 'grid', gridTemplateColumns: '28px 1fr auto',
                            alignItems: 'center', gap: 10, padding: '11px 12px',
                            borderRadius: 13,
                            border: draggedBlock === blockId
                              ? '1.5px solid rgba(96,165,250,.7)'
                              : '1px solid rgba(255,255,255,.09)',
                            background: hidden ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.05)',
                            opacity: hidden ? .5 : 1, cursor: 'grab',
                            transition: 'all .12s ease',
                          }}
                        >
                          <span style={{ fontSize: 18, textAlign: 'center', opacity: .4 }}>⠿</span>
                          <span>
                            <strong style={{ display: 'block', fontSize: 13, color: hidden ? 'rgba(255,255,255,.45)' : '#f1f5f9' }}>
                              {block?.icon} {block?.title}
                            </strong>
                            <small style={{ display: 'block', opacity: .45, fontSize: 11, lineHeight: 1.3, marginTop: 2 }}>
                              {block?.desc}
                            </small>
                          </span>
                          <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 28px)', gap: 3 }}>
                            {[['↑', 'Su', () => nudgeBlock(blockId, -1), index === 0],
                              ['↓', 'Giù', () => nudgeBlock(blockId, 1), index === order.length - 1],
                              [hidden ? '○' : '●', hidden ? 'Mostra' : 'Nascondi', () => toggleBlock(blockId), false],
                            ].map(([icon, title, action, disabled]) => (
                              <button
                                key={title}
                                type="button"
                                title={title}
                                disabled={disabled}
                                onClick={action}
                                style={{
                                  width: 28, height: 28, padding: 0,
                                  border: '1px solid rgba(255,255,255,.1)',
                                  borderRadius: 8,
                                  background: 'rgba(255,255,255,.05)',
                                  color: disabled ? 'rgba(255,255,255,.2)' : '#fff',
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  fontSize: 13, display: 'grid', placeItems: 'center',
                                  transition: 'all .12s ease',
                                }}
                              >{icon}</button>
                            ))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>}

                {/* ── Header ── */}
                {section === 'header' && <>
                  <SectionHeader help="È la prima cosa che una persona vede entrando nel sito. Scegli il modo in cui vuoi presentarti.">
                    Come vuoi aprire il sito?
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {HERO_CHOICES.map(x => (
                      <ChoiceCard key={x.id} {...x} active={style.layout_recipe.hero === x.id}
                        onClick={() => setNested('layout_recipe', 'hero', x.id)} />
                    ))}
                  </div>
                </>}

                {/* ── Menu ── */}
                {section === 'menu' && <>
                  <SectionHeader help="Per un sito personale il menu deve aiutare, non rubare spazio. Se hai poche sezioni, la versione essenziale è normalmente più coerente.">
                    Come vuoi mostrare il menu?
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {NAV_CHOICES.map(x => (
                      <ChoiceCard key={x.id} {...x} badge={x.recommended} active={style.layout_recipe.nav === x.id}
                        onClick={() => setNested('layout_recipe', 'nav', x.id)} />
                    ))}
                  </div>
                  <div style={{
                    padding: '11px 13px', borderRadius: 11,
                    background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.15)',
                    fontSize: 11, lineHeight: 1.5, color: '#fde68a',
                  }}>
                    <strong>Nota editoriale:</strong> una barra molto evidente ha senso solo se offre destinazioni realmente utili.
                    Su un profilo professionale conviene privilegiare identità, messaggio e contenuti.
                  </div>
                </>}

                {/* ── Content ── */}
                {section === 'content' && <>
                  <SectionHeader help="Cambia il modo in cui articoli, aggiornamenti e contenuti vengono presentati graficamente.">
                    Come vuoi mostrare i contenuti?
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {CONTENT_CHOICES.map(x => (
                      <ChoiceCard key={x.id} {...x} active={style.layout_recipe.cards === x.id}
                        onClick={() => setNested('layout_recipe', 'cards', x.id)} />
                    ))}
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                    <SectionHeader help="Regola quanto spazio lasci tra gli elementi.">
                      Quanto deve essere ariosa la pagina?
                    </SectionHeader>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                      {DENSITY_CHOICES.map(x => (
                        <button
                          key={x.id}
                          className="psb-density-btn"
                          onClick={() => setNested('layout_recipe', 'density', x.id)}
                          style={{
                            padding: '12px 7px', borderRadius: 12, cursor: 'pointer',
                            border: style.layout_recipe.density === x.id
                              ? '1.5px solid rgba(96,165,250,.7)'
                              : '1px solid rgba(255,255,255,.1)',
                            background: style.layout_recipe.density === x.id
                              ? 'rgba(37,99,235,.2)' : 'rgba(255,255,255,.03)',
                            color: '#fff', display: 'grid', gap: 3, textAlign: 'center', fontSize: 11,
                            transition: 'all .15s ease',
                          }}
                        >
                          <strong style={{ fontSize: 13 }}>{x.title}</strong>
                          <small style={{ opacity: .5 }}>{x.desc}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </>}

                {/* ── Colors ── */}
                {section === 'colors' && <>
                  <SectionHeader help="Usa i selettori visivi: non devi conoscere codici o valori tecnici.">
                    Colori del sito
                  </SectionHeader>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {[
                      ['background', 'Sfondo'],
                      ['surface', 'Riquadri'],
                      ['text', 'Testo principale'],
                      ['text_muted', 'Testo secondario'],
                      ['primary', 'Colore principale'],
                      ['secondary', 'Colore di supporto'],
                    ].map(([k, l]) => (
                      <label key={k} className="psb-color-row" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 10, padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                        fontSize: 12, fontWeight: 700, color: '#cbd5e1',
                        transition: 'background .12s ease',
                      }}>
                        <span>{l}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 26, height: 26, borderRadius: 7,
                            background: style.color_palette[k] || '#000',
                            border: '2px solid rgba(255,255,255,.15)', flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
                          }} />
                          <input
                            aria-label={l} type="color"
                            value={style.color_palette[k] || '#000000'}
                            onChange={e => setNested('color_palette', k, e.target.value)}
                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{ fontSize: 10, opacity: .4, fontFamily: 'monospace' }}>
                            {style.color_palette[k]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                    <SectionHeader help="Puoi lasciare tranquillamente quelli scelti dal tema.">
                      Carattere del testo
                    </SectionHeader>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <FontSelect label="Titoli" value={style.font_heading} onChange={v => setStyle(p => ({ ...p, font_heading: v }))} />
                      <FontSelect label="Testo" value={style.font_body} onChange={v => setStyle(p => ({ ...p, font_body: v }))} />
                    </div>
                  </div>
                </>}

                {/* ── Advanced ── */}
                {section === 'advanced' && <>
                  <SectionHeader help="Questa sezione è facoltativa. Puoi ignorarla completamente se non sai cosa modificare.">
                    Opzioni avanzate
                  </SectionHeader>

                  {/* UI Style controls */}
                  <div style={{ display: 'grid', gap: 10 }}>
                    <PanelInput
                      label="Arrotondamento riquadri"
                      value={style.ui_style.radius}
                      onChange={v => setNested('ui_style', 'radius', v)}
                      placeholder="es. 16px"
                    />
                    <PanelInput
                      label="Ombra riquadri"
                      value={style.ui_style.card_shadow}
                      onChange={v => setNested('ui_style', 'card_shadow', v)}
                      placeholder="es. 0 8px 24px rgba(0,0,0,.1)"
                    />
                  </div>

                  {/* Glassmorphism toggle */}
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#cbd5e1',
                  }}>
                    <span>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>Effetto vetro</span>
                      <span style={{ display: 'block', fontSize: 11, opacity: .45, marginTop: 2 }}>
                        Sfondo semi-trasparente con sfocatura
                      </span>
                    </span>
                    <span style={{
                      width: 44, height: 24, borderRadius: 999, position: 'relative',
                      background: style.ui_style.glassmorphism ? '#2563eb' : 'rgba(255,255,255,.15)',
                      transition: 'background .2s ease', flexShrink: 0,
                    }}>
                      <input
                        type="checkbox" checked={!!style.ui_style.glassmorphism}
                        onChange={e => setNested('ui_style', 'glassmorphism', e.target.checked)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', top: 3, left: style.ui_style.glassmorphism ? 23 : 3,
                        width: 18, height: 18, borderRadius: 99,
                        background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)',
                        transition: 'left .2s ease',
                      }} />
                    </span>
                  </label>

                  {/* Custom CSS */}
                  <div style={{ display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      CSS personalizzato
                    </span>
                    <textarea
                      value={style.custom_css}
                      onChange={e => setStyle(p => ({ ...p, custom_css: e.target.value }))}
                      placeholder="/* Solo per utenti esperti */"
                      rows={8}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,.1)',
                        background: 'rgba(255,255,255,.04)', color: '#a5f3fc',
                        fontSize: 12, fontFamily: "'Fira Code', 'Courier New', monospace",
                        resize: 'vertical', lineHeight: 1.6, outline: 'none',
                      }}
                    />
                  </div>

                  {/* Reset buttons */}
                  <div style={{ display: 'grid', gap: 7, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setStyle(normalize(savedStyle))}
                      disabled={!dirty}
                      style={{
                        padding: '10px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,.12)',
                        background: 'rgba(255,255,255,.04)', color: dirty ? '#fff' : 'rgba(255,255,255,.25)',
                        fontWeight: 700, fontSize: 12, cursor: dirty ? 'pointer' : 'not-allowed',
                        transition: 'all .15s ease',
                      }}
                    >↩ Annulla le modifiche non salvate</button>
                    <button
                      type="button"
                      onClick={() => setStyle(DEFAULT_STYLE)}
                      style={{
                        padding: '10px', borderRadius: 10,
                        border: '1px solid rgba(239,68,68,.18)',
                        background: 'rgba(239,68,68,.06)', color: '#fca5a5',
                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        transition: 'all .15s ease',
                      }}
                    >⚠ Ripristina design predefinito</button>
                  </div>
                </>}

                {/* Error message */}
                {message && (
                  <div style={{
                    padding: '12px 14px', borderRadius: 11,
                    background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                    fontSize: 13, color: '#fca5a5', lineHeight: 1.5,
                  }}>{message}</div>
                )}
              </div>
            </aside>

            {/* ── Preview Pane ── */}
            <main style={{ position: 'relative', minWidth: 0, background: '#0a0f1e', padding: 16 }}>
              {/* Preview status bar */}
              <div style={{
                position: 'absolute', left: 28, top: 28, zIndex: 3,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 999,
                background: 'rgba(4,9,20,.88)', border: '1px solid rgba(255,255,255,.08)',
                fontSize: 11, fontWeight: 600, color: '#cbd5e1',
                boxShadow: '0 6px 20px rgba(0,0,0,.3)',
                backdropFilter: 'blur(16px)',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 99,
                  background: previewLoading ? '#f59e0b' : '#22c55e',
                  animation: previewLoading ? 'psb-pulse .8s ease infinite' : 'none',
                }} />
                {previewLoading ? 'Aggiorno anteprima…' : 'Anteprima live'}
              </div>

              {/* Hint */}
              <div style={{
                position: 'absolute', right: 28, top: 28, zIndex: 3,
                padding: '7px 12px', borderRadius: 999,
                background: 'rgba(4,9,20,.88)', border: '1px solid rgba(255,255,255,.08)',
                fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.55)',
                backdropFilter: 'blur(16px)',
              }}>
                👆 Clicca una parte del sito per modificarla
              </div>

              {/* iframe */}
              <iframe
                ref={previewRef}
                onLoad={() => setPreviewLoading(false)}
                title="Anteprima live del sito"
                src={previewUrl}
                style={{
                  width: '100%', height: '100%', border: 0,
                  borderRadius: 16, background: '#fff',
                  boxShadow: '0 30px 80px rgba(0,0,0,.5)',
                }}
              />
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
