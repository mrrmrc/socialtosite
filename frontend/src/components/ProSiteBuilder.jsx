import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SITE_LAYOUTS } from '../utils/siteLayouts';
import { apiFetch } from '../utils/api';

const FONTS = ['Inter','Outfit','Plus Jakarta Sans','Space Grotesk','Sora','DM Sans','Source Sans 3','Cormorant Garamond','Fraunces'];
const DEFAULT_STYLE = {
  design_archetype: 'tech-clarity',
  font_heading: 'Plus Jakarta Sans',
  font_body: 'Inter',
  color_palette: { background:'#f3f7fb', surface:'#ffffff', text:'#16202a', text_muted:'#5f6b76', primary:'#2563eb', secondary:'#dbe8ff', primary_gradient:'linear-gradient(135deg, #4f8cff, #1d4ed8)' },
  ui_style: { radius:'16px', card_shadow:'0 10px 30px rgba(15,23,42,0.08)', glassmorphism:false },
  layout_recipe: { hero:'product', nav:'solid', cards:'product', density:'balanced' },
  base_models:['tech-clarity'], custom_css:''
};

const HERO_CHOICES = [
  { id:'product', icon:'▤', title:'Pulita e professionale', desc:'Titolo chiaro, messaggio diretto e call to action.' },
  { id:'split', icon:'◫', title:'Testo + immagine', desc:'Presentazione divisa in due parti, molto leggibile.' },
  { id:'editorial', icon:'T', title:'Editoriale', desc:'Più elegante, con il testo al centro della scena.' },
  { id:'immersive', icon:'▣', title:'Immagine protagonista', desc:'Testata ampia e scenografica.' },
  { id:'human', icon:'☺', title:'Profilo personale', desc:'Ideale per professionisti e personal brand.' },
];

const NAV_CHOICES = [
  { id:'floating', icon:'☰', title:'Essenziale', desc:'Leggera e discreta. È la scelta che consiglio nella maggior parte dei siti personali.', recommended:true },
  { id:'solid', icon:'▬', title:'Classica', desc:'Barra ben visibile, utile se hai molte sezioni da raggiungere.' },
  { id:'transparent', icon:'▱', title:'Sopra la testata', desc:'Il menu si integra con l’immagine o con la testata iniziale.' },
];

const CONTENT_CHOICES = [
  { id:'editorial', icon:'▥', title:'Magazine', desc:'Un contenuto guida gli altri. Ottimo se pubblichi articoli e approfondimenti.' },
  { id:'product', icon:'▦', title:'Griglia ordinata', desc:'Tutti i contenuti hanno lo stesso peso e sono facili da scorrere.' },
  { id:'cinematic', icon:'▣', title:'Foto grandi', desc:'Più impatto visivo, ideale se immagini e video sono importanti.' },
  { id:'soft', icon:'▤', title:'Raccolta morbida', desc:'Card leggere e ariose, adatte a un sito personale.' },
  { id:'bold', icon:'▧', title:'Compatta', desc:'Mostra più contenuti nello stesso spazio.' },
];

const DENSITY_CHOICES = [
  { id:'compact', title:'Compatto', desc:'Più informazioni subito' },
  { id:'balanced', title:'Equilibrato', desc:'La scelta più versatile' },
  { id:'airy', title:'Arioso', desc:'Più spazio e respiro' },
];

const EDITOR_STEPS = [
  { id:'themes', label:'Stile', icon:'✨', help:'Scegli una base pronta' },
  { id:'header', label:'Testata', icon:'▣', help:'Decidi come inizi la pagina' },
  { id:'menu', label:'Menu', icon:'☰', help:'Scegli la navigazione' },
  { id:'content', label:'Contenuti', icon:'▦', help:'Disponi articoli e foto' },
  { id:'colors', label:'Colori e font', icon:'●', help:'Personalizza l’aspetto' },
  { id:'advanced', label:'Avanzate', icon:'⚙', help:'Solo se ti servono' },
];

function normalize(raw, fallback='tech-clarity') {
  const preset = SITE_LAYOUTS.find(x => x.id === fallback) || SITE_LAYOUTS[0];
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    design_archetype: src.design_archetype || preset?.id || DEFAULT_STYLE.design_archetype,
    font_heading: src.font_heading || preset?.font_heading || DEFAULT_STYLE.font_heading,
    font_body: src.font_body || preset?.font_body || DEFAULT_STYLE.font_body,
    color_palette: { ...DEFAULT_STYLE.color_palette, ...(preset?.color_palette || {}), ...(src.color_palette || {}) },
    ui_style: { ...DEFAULT_STYLE.ui_style, ...(preset?.ui_style || {}), ...(src.ui_style || {}) },
    layout_recipe: { ...DEFAULT_STYLE.layout_recipe, ...(preset?.layout_recipe || {}), ...(src.layout_recipe || {}) },
    base_models: Array.isArray(src.base_models) ? src.base_models : (preset?.base_models || [preset?.id].filter(Boolean)),
    custom_css: src.custom_css || ''
  };
}

function encodePreview(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  } catch { return ''; }
}

function ChoiceCard({ active, icon, title, desc, badge, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      width:'100%', textAlign:'left', display:'grid', gridTemplateColumns:'44px 1fr', gap:12,
      padding:13, borderRadius:14, cursor:'pointer', color:'#fff',
      border:active ? '2px solid #6ea0ff' : '1px solid rgba(255,255,255,.12)',
      background:active ? 'linear-gradient(135deg, rgba(37,99,235,.30), rgba(37,99,235,.12))' : '#101a2c',
      boxShadow:active ? '0 0 0 3px rgba(37,99,235,.13)' : 'none'
    }}>
      <span style={{width:44,height:44,borderRadius:11,display:'grid',placeItems:'center',background:'rgba(255,255,255,.07)',fontSize:20}}>{icon}</span>
      <span>
        <span style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
          <strong style={{fontSize:14}}>{title}</strong>
          {badge && <em style={{fontStyle:'normal',fontSize:9,fontWeight:800,letterSpacing:'.05em',padding:'3px 6px',borderRadius:999,background:'#2563eb'}}>CONSIGLIATO</em>}
        </span>
        <small style={{display:'block',opacity:.62,fontSize:11,lineHeight:1.4,marginTop:4}}>{desc}</small>
      </span>
    </button>
  );
}

function SectionTitle({ children, help }) {
  return <div style={{marginBottom:12}}><h3 style={{margin:'0 0 5px',fontSize:17}}>{children}</h3><p style={{margin:0,opacity:.58,fontSize:12,lineHeight:1.5}}>{help}</p></div>;
}

export function ProSiteBuilder({ user, open, onClose }) {
  const [site, setSite] = useState(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [section, setSection] = useState('themes');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [previewTick, setPreviewTick] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savedStyle, setSavedStyle] = useState(DEFAULT_STYLE);
  const [draggedStep, setDraggedStep] = useState(null);
  const [stepOrder, setStepOrder] = useState(() => EDITOR_STEPS.map(x => x.id));
  const debounceRef = useRef(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('sts_token') : '';

  useEffect(() => {
    if (!open || !token) return;
    apiFetch('/api/index.php?action=site', {}, token).then(data => {
      const current = data?.site || {};
      setSite(current);
      let ai = null;
      try { ai = typeof current.site_ai_data === 'string' ? JSON.parse(current.site_ai_data) : current.site_ai_data; } catch {}
      const normalized = normalize(ai, current.theme || 'tech-clarity');
      setStyle(normalized);
      setSavedStyle(normalized);
    }).catch(err => setMessage(err.message));
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    setPreviewLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewTick(x => x + 1), 120);
    return () => clearTimeout(debounceRef.current);
  }, [style, open]);

  const siteUrl = useMemo(() => `${window.location.origin}/${user?.slug || site?.slug || ''}`.replace(/\/$/, ''), [user?.slug, site?.slug]);
  const previewUrl = useMemo(() => `${siteUrl}?studio_preview=1&preview_data=${encodePreview(style)}&v=${previewTick}`, [siteUrl, style, previewTick]);

  const setNested = (group, key, value) => setStyle(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const applyTheme = preset => setStyle(prev => normalize({ ...preset, custom_css: prev.custom_css || '' }, preset.id));
  const dirty = useMemo(() => JSON.stringify(style) !== JSON.stringify(savedStyle), [style, savedStyle]);

  function moveStep(targetId) {
    if (!draggedStep || draggedStep === targetId) return;
    setStepOrder(order => {
      const next = order.filter(id => id !== draggedStep);
      next.splice(next.indexOf(targetId), 0, draggedStep);
      return next;
    });
    setDraggedStep(null);
  }

  function closeBuilder() {
    if (dirty && !window.confirm('Hai modifiche non salvate. Vuoi davvero uscire?')) return;
    onClose();
  }

  async function save() {
    setSaving(true); setMessage('');
    try {
      await apiFetch('/api/index.php?action=site-update', {
        method:'POST',
        body: JSON.stringify({
          theme: style.design_archetype,
          design_archetype: style.design_archetype,
          accent_color: style.color_palette.primary,
          custom_css: style.custom_css || '',
          site_ai_data: style
        })
      }, token);
      setSavedStyle(style);
      setMessage('✓ Tema personalizzato salvato e pubblicato sul tuo sito.');
    } catch (e) { setMessage(e.message); }
    setSaving(false);
  }

  if (!open) return null;

  const orderedSteps = stepOrder.map(id => EDITOR_STEPS.find(item => item.id === id)).filter(Boolean);

  return (
    <div className="pro-site-builder" style={{position:'fixed',inset:0,zIndex:30000,background:'#07101d',color:'#fff',display:'grid',gridTemplateRows:'74px 1fr'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',borderBottom:'1px solid rgba(255,255,255,.1)',background:'#0b1424',gap:14}}>
        <div>
          <strong style={{fontSize:19}}>Modifica il tuo sito</strong>
          <span style={{marginLeft:10,opacity:.65,fontSize:12}}>{dirty ? '● Hai modifiche da salvare' : '✓ Tutto salvato'}</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <a href={siteUrl} target="_blank" rel="noreferrer" style={{...ghostBtn,textDecoration:'none'}}>Apri sito attuale</a>
          <button onClick={save} disabled={saving} style={primaryBtn}>{saving?'Pubblicazione…':'Salva e pubblica'}</button>
          <button onClick={closeBuilder} style={ghostBtn}>Esci</button>
        </div>
      </header>

      <div className="pro-site-builder__workspace" style={{display:'grid',gridTemplateColumns:'410px minmax(0,1fr)',minHeight:0}}>
        <aside style={{overflowY:'auto',padding:16,borderRight:'1px solid rgba(255,255,255,.1)',background:'#0b1424'}}>
          <div style={{padding:'12px 13px',borderRadius:13,background:'rgba(37,99,235,.12)',border:'1px solid rgba(96,165,250,.18)',marginBottom:14,fontSize:12,lineHeight:1.5,color:'#dbeafe'}}>
            <strong>È semplice: scegli, guarda, salva.</strong><br/>Ogni clic aggiorna la pagina a destra. Nulla diventa pubblico finché non premi “Salva e pubblica”.
          </div>

          <div style={{marginBottom:18}}>
            <div style={{fontSize:10,opacity:.55,margin:'0 0 8px 2px',letterSpacing:'.06em',textTransform:'uppercase'}}>Trascina per riordinare gli strumenti</div>
            <div style={{display:'grid',gap:6}}>
              {orderedSteps.map((item,index) => <button key={item.id} draggable onDragStart={()=>setDraggedStep(item.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>moveStep(item.id)} onClick={()=>setSection(item.id)} style={{...tabBtn,...(section===item.id?activeTab:{}),display:'grid',gridTemplateColumns:'24px 1fr auto',alignItems:'center',textAlign:'left',padding:'10px 11px'}}>
                <span aria-hidden="true" style={{fontSize:15}}>{item.icon}</span><span><strong style={{display:'block'}}>{index+1}. {item.label}</strong><small style={{display:'block',opacity:.65,fontWeight:500,marginTop:2}}>{item.help}</small></span><span title="Trascina" style={{opacity:.45,fontSize:17}}>↕</span>
              </button>)}
            </div>
          </div>

          {section==='themes' && <>
            <SectionTitle help="Un tema cambia insieme colori, carattere, testata, menu e stile dei contenuti. Poi puoi personalizzarlo nei passaggi successivi.">Scegli da dove partire</SectionTitle>
            <div style={stack}>{SITE_LAYOUTS.map(p => <button key={p.id} onClick={()=>applyTheme(p)} style={{...themeBtn,borderColor:style.design_archetype===p.id?'#6ea0ff':'rgba(255,255,255,.12)'}}>
              <span style={{fontSize:28}}>{p.emoji}</span>
              <span><strong>{p.name}</strong><small style={small}>{p.desc}</small><span style={{display:'flex',gap:5,marginTop:8}}>{p.colors.map(c=><i key={c} style={{width:18,height:18,borderRadius:99,background:c,border:'1px solid rgba(255,255,255,.25)'}} />)}</span></span>
            </button>)}</div>
          </>}

          {section==='header' && <>
            <SectionTitle help="È la prima cosa che una persona vede entrando nel sito. Scegli il modo in cui vuoi presentarti.">Come vuoi aprire il sito?</SectionTitle>
            <div style={stack}>{HERO_CHOICES.map(x=><ChoiceCard key={x.id} {...x} active={style.layout_recipe.hero===x.id} onClick={()=>setNested('layout_recipe','hero',x.id)}/>)}</div>
          </>}

          {section==='menu' && <>
            <SectionTitle help="Per un sito personale il menu deve aiutare, non rubare spazio. Se hai poche sezioni, la versione essenziale è normalmente più coerente.">Come vuoi mostrare il menu?</SectionTitle>
            <div style={stack}>{NAV_CHOICES.map(x=><ChoiceCard key={x.id} {...x} badge={x.recommended} active={style.layout_recipe.nav===x.id} onClick={()=>setNested('layout_recipe','nav',x.id)}/>)}</div>
            <div style={{marginTop:12,padding:12,borderRadius:12,background:'rgba(245,158,11,.09)',border:'1px solid rgba(245,158,11,.18)',fontSize:11,lineHeight:1.45,color:'#fde68a'}}>
              <strong>Nota editoriale:</strong> una barra molto evidente ha senso solo se offre destinazioni realmente utili. Su un profilo professionale conviene privilegiare identità, messaggio e contenuti.
            </div>
          </>}

          {section==='content' && <>
            <SectionTitle help="Cambia il modo in cui articoli, aggiornamenti e contenuti vengono presentati graficamente.">Come vuoi mostrare i contenuti?</SectionTitle>
            <div style={stack}>{CONTENT_CHOICES.map(x=><ChoiceCard key={x.id} {...x} active={style.layout_recipe.cards===x.id} onClick={()=>setNested('layout_recipe','cards',x.id)}/>)}</div>
            <div style={{marginTop:16}}><SectionTitle help="Regola quanto spazio lasci tra gli elementi.">Quanto deve essere ariosa la pagina?</SectionTitle>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>{DENSITY_CHOICES.map(x=><button key={x.id} onClick={()=>setNested('layout_recipe','density',x.id)} style={{...miniChoice,...(style.layout_recipe.density===x.id?miniChoiceActive:{})}}><strong>{x.title}</strong><small>{x.desc}</small></button>)}</div>
            </div>
          </>}

          {section==='colors' && <>
            <SectionTitle help="Usa i selettori visivi: non devi conoscere codici o valori tecnici.">Colori del sito</SectionTitle>
            <div style={stack}>{[['background','Sfondo'],['surface','Riquadri'],['text','Testo'],['text_muted','Testo secondario'],['primary','Colore principale'],['secondary','Colore di supporto']].map(([k,l])=><label key={k} style={colorField}><span>{l}</span><span style={{display:'flex',alignItems:'center',gap:9}}><input aria-label={l} type="color" value={style.color_palette[k] || '#000000'} onChange={e=>setNested('color_palette',k,e.target.value)} style={{width:48,height:40,border:0,borderRadius:8,background:'transparent'}}/><span style={{fontSize:11,opacity:.48}}>{style.color_palette[k]}</span></span></label>)}</div>
            <div style={{marginTop:18}}><SectionTitle help="Puoi lasciare tranquillamente quelli scelti dal tema.">Carattere del testo</SectionTitle><div style={stack}><Select label="Titoli" value={style.font_heading} onChange={v=>setStyle(p=>({...p,font_heading:v}))} options={FONTS}/><Select label="Testo" value={style.font_body} onChange={v=>setStyle(p=>({...p,font_body:v}))} options={FONTS}/></div></div>
          </>}

          {section==='advanced' && <>
            <SectionTitle help="Questa sezione è facoltativa. Puoi ignorarla completamente se non sai cosa modificare.">Opzioni avanzate</SectionTitle>
            <div style={stack}>
              <label style={field}><span>Arrotondamento dei riquadri</span><input value={style.ui_style.radius} onChange={e=>setNested('ui_style','radius',e.target.value)} style={input}/></label>
              <label style={field}><span>Ombra dei riquadri</span><input value={style.ui_style.card_shadow} onChange={e=>setNested('ui_style','card_shadow',e.target.value)} style={input}/></label>
              <label style={{...field,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span>Effetto vetro</span><input type="checkbox" checked={!!style.ui_style.glassmorphism} onChange={e=>setNested('ui_style','glassmorphism',e.target.checked)}/></label>
              <label style={field}><span>CSS personalizzato</span><textarea value={style.custom_css} onChange={e=>setStyle(p=>({...p,custom_css:e.target.value}))} placeholder="Solo per utenti esperti" style={{...input,minHeight:180,fontFamily:'monospace',resize:'vertical'}}/></label>
            </div>
            <button onClick={()=>setStyle(normalize(savedStyle))} disabled={!dirty} style={{...ghostBtn,width:'100%',marginTop:14,opacity:dirty?1:.45}}>Annulla le modifiche non salvate</button>
            <button onClick={()=>setStyle(DEFAULT_STYLE)} style={{...ghostBtn,width:'100%',marginTop:8}}>Ripristina il design predefinito</button>
          </>}

          {message && <div style={{marginTop:14,padding:11,borderRadius:10,background:'rgba(91,140,255,.12)',fontSize:13}}>{message}</div>}
        </aside>

        <main style={{position:'relative',minWidth:0,background:'#111827',padding:18}}>
          <div style={{position:'absolute',left:31,top:29,zIndex:3,display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:999,background:'rgba(15,23,42,.86)',fontSize:11,boxShadow:'0 6px 20px rgba(0,0,0,.25)'}}>
            <span style={{width:7,height:7,borderRadius:99,background:previewLoading?'#f59e0b':'#22c55e'}} />
            {previewLoading?'Aggiorno anteprima…':'Anteprima live'}
          </div>
          <iframe onLoad={()=>setPreviewLoading(false)} title="Anteprima live del sito" src={previewUrl} style={{width:'100%',height:'100%',border:0,borderRadius:18,background:'#fff',boxShadow:'0 30px 80px rgba(0,0,0,.45)'}} />
        </main>
      </div>
    </div>
  );
}

function Select({label,value,onChange,options}) { return <label style={field}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={input}>{options.map(x=><option key={x}>{x}</option>)}</select></label>; }
const stack={display:'grid',gap:9};
const small={display:'block',opacity:.58,fontSize:11,lineHeight:1.35,marginTop:3};
const field={display:'grid',gap:6,fontSize:12,fontWeight:700};
const colorField={display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 12px',borderRadius:11,background:'#101a2c',border:'1px solid rgba(255,255,255,.1)',fontSize:12,fontWeight:700};
const input={width:'100%',padding:'10px 11px',borderRadius:9,border:'1px solid rgba(255,255,255,.14)',background:'#111c2e',color:'#fff'};
const tabBtn={padding:'9px 8px',borderRadius:9,border:'1px solid rgba(255,255,255,.1)',background:'#101a2c',color:'#cbd5e1',fontSize:11,fontWeight:700,cursor:'pointer'};
const activeTab={background:'#2563eb',color:'#fff',borderColor:'#2563eb'};
const themeBtn={width:'100%',display:'grid',gridTemplateColumns:'40px 1fr',gap:11,textAlign:'left',padding:13,borderRadius:13,border:'1px solid rgba(255,255,255,.12)',background:'#101a2c',color:'#fff',cursor:'pointer'};
const miniChoice={padding:'11px 7px',borderRadius:10,border:'1px solid rgba(255,255,255,.11)',background:'#101a2c',color:'#fff',cursor:'pointer',display:'grid',gap:3,textAlign:'center',fontSize:11};
const miniChoiceActive={border:'2px solid #6ea0ff',background:'rgba(37,99,235,.24)'};
const primaryBtn={padding:'10px 15px',border:0,borderRadius:9,background:'#2563eb',color:'#fff',fontWeight:800,cursor:'pointer'};
const ghostBtn={padding:'9px 13px',border:'1px solid rgba(255,255,255,.16)',borderRadius:9,background:'transparent',color:'#fff',fontWeight:700,cursor:'pointer'};
