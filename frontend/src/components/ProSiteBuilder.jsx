import React, { useEffect, useMemo, useState } from 'react';
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

export function ProSiteBuilder({ user, open, onClose }) {
  const [site, setSite] = useState(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [section, setSection] = useState('themes');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('sts_token') : '';

  useEffect(() => {
    if (!open || !token) return;
    apiFetch('/api/index.php?action=site', {}, token).then(data => {
      const current = data?.site || {};
      setSite(current);
      let ai = null;
      try { ai = typeof current.site_ai_data === 'string' ? JSON.parse(current.site_ai_data) : current.site_ai_data; } catch {}
      setStyle(normalize(ai, current.theme || 'tech-clarity'));
    }).catch(err => setMessage(err.message));
  }, [open, token]);

  const siteUrl = useMemo(() => `${window.location.origin}/${user?.slug || site?.slug || ''}`.replace(/\/$/, ''), [user?.slug, site?.slug]);
  const previewUrl = useMemo(() => `${siteUrl}?studio_preview=1&preview_data=${encodePreview(style)}`, [siteUrl, style]);

  const setNested = (group, key, value) => setStyle(prev => ({ ...prev, [group]: { ...prev[group], [key]: value } }));
  const applyTheme = preset => setStyle(normalize({ ...preset, custom_css: style.custom_css || '' }, preset.id));

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
      setMessage(`Design salvato e applicato a ${siteUrl}.`);
    } catch (e) { setMessage(e.message); }
    setSaving(false);
  }

  if (!open) return null;
  const nav = [['themes','Temi'],['colors','Colori'],['type','Tipografia'],['layout','Layout'],['effects','Stile UI'],['css','CSS']];

  return (
    <div style={{position:'fixed',inset:0,zIndex:30000,background:'#07101d',color:'#fff',display:'grid',gridTemplateRows:'64px 1fr'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 18px',borderBottom:'1px solid rgba(255,255,255,.1)',background:'#0b1424'}}>
        <div><strong style={{fontSize:19}}>Builder grafico PROFESSIONAL</strong><span style={{marginLeft:10,opacity:.55,fontSize:12}}>Stai modificando {siteUrl || 'il tuo sito'} · anteprima live</span></div>
        <div style={{display:'flex',gap:8}}><button onClick={save} disabled={saving} style={primaryBtn}>{saving?'Salvataggio…':'Salva e pubblica'}</button><button onClick={onClose} style={ghostBtn}>Chiudi</button></div>
      </header>
      <div style={{display:'grid',gridTemplateColumns:'380px 1fr',minHeight:0}}>
        <aside style={{overflowY:'auto',padding:16,borderRight:'1px solid rgba(255,255,255,.1)',background:'#0b1424'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:18}}>{nav.map(([id,label])=><button key={id} onClick={()=>setSection(id)} style={{...tabBtn,...(section===id?activeTab:{})}}>{label}</button>)}</div>
          {section==='themes' && <div style={stack}>{SITE_LAYOUTS.map(p=><button key={p.id} onClick={()=>applyTheme(p)} style={{...cardBtn,borderColor:style.design_archetype===p.id?'#5b8cff':'rgba(255,255,255,.12)'}}><span style={{fontSize:26}}>{p.emoji}</span><div><strong>{p.name}</strong><small style={small}>{p.desc}</small><div style={{display:'flex',gap:5,marginTop:8}}>{p.colors.map(c=><i key={c} style={{width:17,height:17,borderRadius:99,background:c,border:'1px solid rgba(255,255,255,.25)'}} />)}</div></div></button>)}</div>}
          {section==='colors' && <div style={stack}>{[['background','Sfondo'],['surface','Superficie'],['text','Testo'],['text_muted','Testo secondario'],['primary','Primario'],['secondary','Secondario']].map(([k,l])=><label key={k} style={field}><span>{l}</span><div style={{display:'flex',gap:8}}><input type="color" value={style.color_palette[k] || '#000000'} onChange={e=>setNested('color_palette',k,e.target.value)} /><input value={style.color_palette[k] || ''} onChange={e=>setNested('color_palette',k,e.target.value)} style={input}/></div></label>)}</div>}
          {section==='type' && <div style={stack}><Select label="Font titoli" value={style.font_heading} onChange={v=>setStyle(p=>({...p,font_heading:v}))} options={FONTS}/><Select label="Font testo" value={style.font_body} onChange={v=>setStyle(p=>({...p,font_body:v}))} options={FONTS}/></div>}
          {section==='layout' && <div style={stack}><Select label="Hero" value={style.layout_recipe.hero} onChange={v=>setNested('layout_recipe','hero',v)} options={['product','editorial','split','immersive','human']}/><Select label="Navigazione" value={style.layout_recipe.nav} onChange={v=>setNested('layout_recipe','nav',v)} options={['solid','transparent','floating']}/><Select label="Card" value={style.layout_recipe.cards} onChange={v=>setNested('layout_recipe','cards',v)} options={['product','editorial','bold','cinematic','soft']}/><Select label="Densità" value={style.layout_recipe.density} onChange={v=>setNested('layout_recipe','density',v)} options={['compact','balanced','airy']}/></div>}
          {section==='effects' && <div style={stack}><label style={field}><span>Raggio bordi</span><input value={style.ui_style.radius} onChange={e=>setNested('ui_style','radius',e.target.value)} style={input}/></label><label style={field}><span>Ombra card</span><input value={style.ui_style.card_shadow} onChange={e=>setNested('ui_style','card_shadow',e.target.value)} style={input}/></label><label style={{...field,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span>Glassmorphism</span><input type="checkbox" checked={!!style.ui_style.glassmorphism} onChange={e=>setNested('ui_style','glassmorphism',e.target.checked)}/></label></div>}
          {section==='css' && <label style={field}><span>CSS personalizzato</span><textarea value={style.custom_css} onChange={e=>setStyle(p=>({...p,custom_css:e.target.value}))} placeholder="/* CSS personalizzato */" style={{...input,minHeight:320,fontFamily:'monospace',resize:'vertical'}}/></label>}
          {message && <div style={{marginTop:14,padding:10,borderRadius:10,background:'rgba(91,140,255,.12)',fontSize:13}}>{message}</div>}
          <button onClick={()=>setStyle(DEFAULT_STYLE)} style={{...ghostBtn,width:'100%',marginTop:14}}>Ripristina impostazioni builder</button>
        </aside>
        <main style={{position:'relative',minWidth:0,background:'#111827',padding:18}}>
          <div style={{position:'absolute',top:25,right:28,zIndex:2,display:'flex',gap:8}}><a href={siteUrl} target="_blank" rel="noreferrer" style={{...ghostBtn,textDecoration:'none'}}>Apri sito</a></div>
          <iframe title="Anteprima builder" src={previewUrl} style={{width:'100%',height:'100%',border:0,borderRadius:18,background:'#fff',boxShadow:'0 30px 80px rgba(0,0,0,.45)'}} />
        </main>
      </div>
    </div>
  );
}

function Select({label,value,onChange,options}) { return <label style={field}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={input}>{options.map(x=><option key={x}>{x}</option>)}</select></label>; }
const stack={display:'grid',gap:10};
const small={display:'block',opacity:.58,fontSize:11,lineHeight:1.35,marginTop:3};
const field={display:'grid',gap:6,fontSize:12,fontWeight:700};
const input={width:'100%',padding:'10px 11px',borderRadius:9,border:'1px solid rgba(255,255,255,.14)',background:'#111c2e',color:'#fff'};
const tabBtn={padding:'8px 6px',borderRadius:8,border:'1px solid rgba(255,255,255,.1)',background:'#101a2c',color:'#cbd5e1',fontSize:11,cursor:'pointer'};
const activeTab={background:'#2563eb',color:'#fff',borderColor:'#2563eb'};
const cardBtn={width:'100%',display:'grid',gridTemplateColumns:'36px 1fr',gap:10,textAlign:'left',padding:12,borderRadius:12,border:'1px solid rgba(255,255,255,.12)',background:'#101a2c',color:'#fff',cursor:'pointer'};
const primaryBtn={padding:'9px 14px',border:0,borderRadius:9,background:'#2563eb',color:'#fff',fontWeight:800,cursor:'pointer'};
const ghostBtn={padding:'9px 14px',border:'1px solid rgba(255,255,255,.16)',borderRadius:9,background:'transparent',color:'#fff',fontWeight:700,cursor:'pointer'};