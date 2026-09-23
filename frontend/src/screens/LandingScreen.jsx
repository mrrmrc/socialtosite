import React, { useState, useEffect } from 'react';

const examples = {
  hospitality: {
    tab: 'Agriturismo', label: 'OSPITALITÀ · UMBRIA', name: 'La Quercia',
    title: 'La campagna,\ncome dovrebbe essere.',
    description: 'Camere tra gli ulivi, cucina della terra e giornate che seguono un ritmo più lento.',
    action: 'Verifica disponibilità',
    paths: ['Dormire', 'Mangiare', 'Esperienze'],
    accent: '#16A34A',
    bg: '#F0FDF4',
  },
  legal: {
    tab: 'Studio legale', label: 'DIRITTO D\'IMPRESA · MILANO', name: 'Studio Ferri',
    title: 'Chiarezza nelle\ndecisioni importanti.',
    description: 'Competenza legale, ascolto e una direzione concreta per imprese e professionisti.',
    action: 'Richiedi un colloquio',
    paths: ['Competenze', 'Professionisti', 'Approfondimenti'],
    accent: '#1E40AF',
    bg: '#EFF6FF',
  },
  editorial: {
    tab: 'Blog', label: 'CULTURA DIGITALE · IDEE', name: 'Fuori Margine',
    title: 'Le idee non devono\nsparire nel feed.',
    description: 'Storie, strumenti e punti di vista per capire come cambia il nostro modo di creare.',
    action: 'Esplora gli articoli',
    paths: ['Storie', 'Strumenti', 'Prospettive'],
    accent: '#7C3AED',
    bg: '#F5F3FF',
  },
};

/* ─── Shared logo component ─────────────────────────────────────────────── */
export function BrandMark({ compact = false, iconOnly = false }) {
  const size = compact ? 30 : 38;
  const img = (
    <img
      src="/logo-cropped.png"
      alt="All Social To Web"
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
  );
  if (iconOnly) return img;
  return (
    <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 8 : 10, textDecoration: 'none' }}>
      {img}
      <span style={{ display: 'grid', lineHeight: 1.1 }}>
        <strong style={{ fontSize: compact ? 14 : 15, fontWeight: 900, color: '#0F0F0E', letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>
          All Social <span style={{ color: '#7C3AED' }}>To Web</span>
        </strong>
      </span>
    </a>
  );
}

/* ─── Arrow SVG ─────────────────────────────────────────────────────────── */
function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M2.5 7.5h10M9 3.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ─── Main Landing ──────────────────────────────────────────────────────── */
export function LandingScreen({ onGetStarted, isLoggedIn = false }) {
  const [activeEx, setActiveEx] = useState('hospitality');
  const [scrolled, setScrolled] = useState(false);
  const ex = examples[activeEx];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const go = () => {
    if (isLoggedIn) window.location.href = '/dashboard';
    else if (onGetStarted) onGetStarted();
    else window.location.href = '/accedi';
  };

  /* Shared styles */
  const wrap = { maxWidth: 1180, margin: '0 auto', padding: '0 clamp(1.25rem, 4vw, 3rem)' };

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '13px 24px', border: 'none', borderRadius: 999,
    fontFamily: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    transition: 'transform .2s, box-shadow .2s', letterSpacing: '0.01em',
  };
  const btnCoral = {
    ...btnBase, background: '#EE6346', color: '#fff',
    boxShadow: '0 6px 20px rgba(238,99,70,.3)',
  };
  const btnDark = {
    ...btnBase, background: '#0F0F0E', color: '#fff',
    boxShadow: '0 4px 14px rgba(0,0,0,.12)',
  };
  const btnOutline = {
    ...btnBase, background: 'transparent', color: '#0F0F0E',
    border: '1.5px solid rgba(15,15,14,.18)',
  };

  return (
    <div style={{ background: '#F7F5F0', color: '#0F0F0E', fontFamily: '"Inter", system-ui, sans-serif', minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: scrolled ? 'rgba(247,245,240,0.88)' : 'rgba(247,245,240,0)',
        backdropFilter: scrolled ? 'blur(18px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(15,15,14,.08)' : '1px solid transparent',
        transition: 'all .3s ease',
      }}>
        <div style={{ ...wrap, minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2rem' }}>
          <BrandMark />
          <nav style={{ display: 'flex', gap: 'clamp(1.2rem,3vw,2.5rem)', fontSize: 14, fontWeight: 600 }} className="pub-nav">
            {[['Funziona','#funziona'],['Esempi','#esempi'],['Piani','#piani'],['Esplora','/scopri']].map(([l,h]) => (
              <a key={l} href={h} style={{ color: '#6B7280', textDecoration: 'none', transition: 'color .15s' }}
                onMouseOver={e => e.target.style.color = '#0F0F0E'}
                onMouseOut={e => e.target.style.color = '#6B7280'}>{l}</a>
            ))}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {!isLoggedIn && <a href="/accedi" style={{ fontSize: 14, fontWeight: 600, color: '#6B7280', textDecoration: 'none' }}>Accedi</a>}
            <button style={btnDark} onClick={go}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'none'}>
              {isLoggedIn ? 'Dashboard' : 'Inizia ora'} <Arrow />
            </button>
          </div>
        </div>
      </header>

      {/* ── BENTO HERO ─────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(2.5rem, 5vw, 4rem) 0 clamp(3rem, 6vw, 5rem)' }}>
        <div style={{ ...wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 'clamp(1.2rem,3vw,2rem)', alignItems: 'stretch' }} className="hero-grid">

          {/* Copy card */}
          <div style={{ background: '#fff', borderRadius: 24, padding: 'clamp(2rem, 5vw, 3.5rem)', border: '1px solid rgba(15,15,14,.06)', boxShadow: '0 2px 12px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 440 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EE6346', display: 'block', boxShadow: '0 0 0 4px rgba(238,99,70,.15)' }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9CA3AF' }}>Dai social a uno spazio che resta</span>
              </div>
              <h1 style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5.2rem)', fontWeight: 900, lineHeight: .95, letterSpacing: '-.055em', color: '#0F0F0E', margin: '0 0 1.2rem' }}>
                I tuoi<br />contenuti,<br />
                <em style={{ fontStyle: 'italic', color: '#EE6346', fontFamily: 'Georgia, serif', fontWeight: 400 }}>oltre le 24 ore.</em>
              </h1>
              <p style={{ fontSize: 'clamp(.95rem,1.5vw,1.1rem)', color: '#6B7280', lineHeight: 1.65, maxWidth: 460, margin: 0 }}>
                All Social To Web trasforma post, video e storie in un sito proprietario, organizzato dall'AI e sempre aggiornato.
              </p>
            </div>
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <button style={btnCoral} onClick={go}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(238,99,70,.35)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(238,99,70,.3)'; }}>
                  {isLoggedIn ? 'Apri il tuo spazio' : 'Crea il tuo sito'} <Arrow />
                </button>
                <a href="#funziona" style={{ fontSize: 14, fontWeight: 600, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                  Come funziona <span style={{ color: '#EE6346' }}>↓</span>
                </a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#D1D5DB' }}>Collega</span>
                {[
                  { l: 'IG', bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' },
                  { l: 'TT', bg: '#000' },
                  { l: 'YT', bg: '#FF0000' },
                  { l: 'FB', bg: '#1877F2' },
                  { l: 'WWW', bg: '#9CA3AF' },
                ].map(b => (
                  <span key={b.l} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 26, padding: '0 8px', borderRadius: 7, background: b.bg, color: '#fff', fontSize: 9, fontWeight: 800 }}>{b.l}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Visual card */}
          <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 'clamp(.8rem,2vw,1.2rem)' }}>
            {/* Product mockup */}
            <div style={{ background: '#fff', borderRadius: 24, border: '1px solid rgba(15,15,14,.06)', boxShadow: '0 2px 12px rgba(0,0,0,.04)', overflow: 'hidden', position: 'relative' }}>
              {/* Browser bar */}
              <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(15,15,14,.06)', background: '#FAFAF8' }}>
                {['#FF5F56','#FFBD2E','#27C93F'].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />)}
                <span style={{ marginLeft: 10, flex: 1, textAlign: 'center', fontSize: 11, color: '#9CA3AF', background: '#F3F4F6', borderRadius: 6, padding: '3px 10px' }}>iltuospazio.it</span>
              </div>
              {/* Site preview content */}
              <div style={{ padding: 'clamp(1.5rem,3vw,2.5rem)' }}>
                {/* Hero band */}
                <div style={{ borderRadius: 14, padding: 'clamp(1.2rem,3vw,2rem)', background: 'linear-gradient(135deg, #7C3AED15, #06B6D415)', border: '1px solid rgba(124,58,237,.1)', marginBottom: 16 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7C3AED', marginBottom: 8 }}>IL TUO SPAZIO UFFICIALE</div>
                  <div style={{ fontSize: 'clamp(1rem,2vw,1.35rem)', fontWeight: 800, lineHeight: 1.2, color: '#0F0F0E', marginBottom: 12 }}>Quello che fai,<br/>finalmente organizzato.</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, background: '#7C3AED', color: '#fff', fontSize: 11, fontWeight: 700 }}>Esplora i contenuti <Arrow /></div>
                </div>
                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {['#7C3AED22','#06B6D422','#EE634622'].map((bg,i) => (
                    <div key={i} style={{ height: 50, borderRadius: 10, background: bg, border: '1px solid rgba(15,15,14,.05)' }} />
                  ))}
                </div>
              </div>
              {/* Floating badge */}
              <div style={{ position: 'absolute', top: 60, right: -10, background: '#fff', borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,.1)', border: '1px solid rgba(15,15,14,.06)', animation: 'pubFloat 5s ease-in-out infinite' }}>
                <span style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(45deg,#f09433,#dc2743)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>IG</span>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#9CA3AF', letterSpacing: '.08em' }}>Nuovo post</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0F0F0E' }}>Una storia da raccontare</div>
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div style={{ background: '#0F0F0E', borderRadius: 16, padding: '1.1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', animation: 'pubPulse 2s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Pubblicato e organizzato</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['IG','TT','YT'].map(s => (
                  <span key={s} style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 700 }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── PROCESS STRIP ──────────────────────────────────────────────── */}
        <div style={{ ...wrap, marginTop: 'clamp(1.2rem,3vw,2rem)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(.8rem,2vw,1.2rem)' }} className="process-grid" id="funziona">
            {[
              { n: '01', title: 'Collega i canali', desc: 'Indichi i profili social che raccontano la tua attività.', icon: '⬡', color: '#7C3AED', bg: '#F5F3FF' },
              { n: '02', title: "L'AI dà struttura", desc: 'Comprende argomenti e trasforma i contenuti in pagine utili.', icon: '⬡', color: '#0891B2', bg: '#ECFEFF' },
              { n: '03', title: 'Il sito prende vita', desc: 'Uno spazio aggiornato automaticamente, senza nessuno sforzo.', icon: '⬡', color: '#EE6346', bg: '#FFF7ED' },
            ].map(step => (
              <div key={step.n} style={{ background: step.bg, borderRadius: 20, padding: 'clamp(1.2rem,3vw,2rem)', border: `1px solid ${step.color}18`, transition: 'transform .2s', cursor: 'default' }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: step.color, display: 'grid', placeItems: 'center', marginBottom: '1rem', boxShadow: `0 6px 16px ${step.color}35` }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>{step.n}</span>
                </div>
                <h3 style={{ margin: '0 0 .5rem', fontSize: 15, fontWeight: 800, color: '#0F0F0E', letterSpacing: '-.02em' }}>{step.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOWCASE ───────────────────────────────────────────────────── */}
      <section id="esempi" style={{ padding: 'clamp(3rem,6vw,5rem) 0', background: '#fff', borderTop: '1px solid rgba(15,15,14,.06)' }}>
        <div style={{ ...wrap }}>
          {/* Header + tabs row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', display: 'block' }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9CA3AF' }}>Un formato. Infinite identità.</span>
              </div>
              <h2 style={{ margin: 0, fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, lineHeight: 1, letterSpacing: '-.045em', color: '#0F0F0E' }}>
                La stessa regia.<br /><span style={{ color: '#7C3AED' }}>Mai lo stesso carattere.</span>
              </h2>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, padding: 6, background: '#F7F5F0', borderRadius: 999, border: '1px solid rgba(15,15,14,.06)' }}>
              {Object.entries(examples).map(([key, item]) => (
                <button key={key} onClick={() => setActiveEx(key)} style={{
                  padding: '9px 18px', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
                  background: activeEx === key ? '#0F0F0E' : 'transparent',
                  color: activeEx === key ? '#fff' : '#9CA3AF',
                }}>{item.tab}</button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ borderRadius: 24, border: '1px solid rgba(15,15,14,.06)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.05)' }}>
            {/* Topbar */}
            <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FAFAF8', borderBottom: '1px solid rgba(15,15,14,.06)' }}>
              <strong style={{ fontSize: 14, fontWeight: 800, color: '#0F0F0E' }}>{ex.name}</strong>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: '#9CA3AF' }}>Storia</span>
                <span style={{ color: '#9CA3AF' }}>Contenuti</span>
                <span style={{ padding: '4px 12px', borderRadius: 999, background: ex.accent, color: '#fff', fontSize: 11, fontWeight: 800 }}>Contatti</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,.8fr)' }} className="showcase-inner">
              {/* Hero band */}
              <div style={{ padding: 'clamp(2rem,5vw,3.5rem)', background: ex.bg }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: ex.accent, marginBottom: 10 }}>{ex.label}</div>
                <h3 style={{ margin: '0 0 1rem', fontSize: 'clamp(1.4rem,3vw,2.4rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-.04em', color: '#0F0F0E' }}>
                  {ex.title.split('\n').map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l}</React.Fragment>)}
                </h3>
                <p style={{ margin: '0 0 1.5rem', fontSize: 13, color: '#6B7280', lineHeight: 1.65, maxWidth: 360 }}>{ex.description}</p>
                <button style={{ ...btnBase, background: ex.accent, color: '#fff', boxShadow: `0 6px 18px ${ex.accent}35` }}>
                  {ex.action} <Arrow />
                </button>
              </div>

              {/* Paths + stories */}
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', background: '#fff' }}>
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(15,15,14,.06)' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#D1D5DB', marginBottom: '1rem' }}>ESPLORA PERCORSI</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ex.paths.map((p, i) => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: i < ex.paths.length - 1 ? '1px solid rgba(15,15,14,.05)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, color: '#D1D5DB', fontWeight: 700 }}>0{i+1}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0F0F0E' }}>{p}</span>
                        </div>
                        <span style={{ color: ex.accent, fontWeight: 700 }}>↗</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#D1D5DB', marginBottom: 4 }}>DALLE STORIE</div>
                  {['Una visita che resta','Tradizioni di stagione'].map((s,i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 32, borderRadius: 8, background: `${ex.accent}18`, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="piani" style={{ padding: 'clamp(3rem,6vw,5rem) 0', borderTop: '1px solid rgba(15,15,14,.06)' }}>
        <div style={{ ...wrap }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EE6346', display: 'block' }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9CA3AF' }}>Scegli la tua dimensione</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-.04em', color: '#0F0F0E' }}>Tre soluzioni per crescere.</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'clamp(1rem,2.5vw,1.5rem)', alignItems: 'start' }} className="pricing-grid">
            {[
              { name: 'Base', sub: 'Per iniziare senza sforzo', items: ['Creazione sito automatica','Aggiornamento 1×/giorno','Template standard'], cta: 'Inizia ora', featured: false },
              { name: 'Professional', sub: 'Per creator e professionisti', items: ['Aggiornamento ogni 2 ore','Control Room editoriale','Tuning AI e tone of voice'], cta: 'Scegli Professional', featured: true },
              { name: 'Agency', sub: 'Per chi gestisce più brand', items: ['Spazi e brand illimitati','Cron e priorità dedicate','Supporto premium'], cta: 'Inizia ora', featured: false },
            ].map(plan => (
              <div key={plan.name} style={{
                position: 'relative', background: plan.featured ? '#0F0F0E' : '#fff',
                borderRadius: 24, padding: 'clamp(1.5rem,3vw,2.5rem)',
                border: plan.featured ? 'none' : '1px solid rgba(15,15,14,.07)',
                boxShadow: plan.featured ? '0 20px 48px rgba(15,15,14,.18)' : '0 2px 10px rgba(0,0,0,.04)',
                transform: plan.featured ? 'translateY(-8px)' : 'none',
                display: 'flex', flexDirection: 'column', gap: '1.5rem',
              }}>
                {plan.featured && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#EE6346', color: '#fff', padding: '4px 14px', borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>Più scelto</div>
                )}
                <div>
                  <h3 style={{ margin: '0 0 .4rem', fontSize: 20, fontWeight: 800, color: plan.featured ? '#fff' : '#0F0F0E' }}>{plan.name}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: plan.featured ? 'rgba(255,255,255,.55)' : '#9CA3AF' }}>{plan.sub}</p>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {plan.items.map(item => (
                    <li key={item} style={{ display: 'flex', gap: 10, fontSize: 14, color: plan.featured ? 'rgba(255,255,255,.85)' : '#374151' }}>
                      <span style={{ color: plan.featured ? '#EE6346' : '#7C3AED', fontWeight: 800, flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button onClick={go} style={{ ...(plan.featured ? btnCoral : btnOutline), width: '100%', justifyContent: 'center', ...(plan.featured ? {} : {}) }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINALE ─────────────────────────────────────────────────── */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 0 clamp(2rem,4vw,3rem)', borderTop: '1px solid rgba(15,15,14,.06)' }}>
        <div style={{ ...wrap }}>
          <div style={{ borderRadius: 28, background: '#0F0F0E', padding: 'clamp(2.5rem,5vw,4.5rem)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(124,58,237,.25), transparent 55%), radial-gradient(ellipse at 70% 50%, rgba(6,182,212,.15), transparent 55%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: 'clamp(1.8rem,4vw,3.2rem)', fontWeight: 900, letterSpacing: '-.045em', color: '#fff', lineHeight: 1.05 }}>
                Il tuo spazio web,<br />completamente automatico.
              </h2>
              <p style={{ margin: '0 auto 2.5rem', fontSize: 15, color: 'rgba(255,255,255,.6)', maxWidth: 480, lineHeight: 1.65 }}>
                Porta i tuoi contenuti su un sito che lavora per te ogni giorno, senza toccare codice o CMS.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button style={btnCoral} onClick={go}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(238,99,70,.4)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(238,99,70,.3)'; }}>
                  {isLoggedIn ? 'Vai alla dashboard' : 'Crea il tuo spazio'} <Arrow />
                </button>
                <a href="/scopri" style={{ ...btnBase, background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.8)', textDecoration: 'none', border: '1px solid rgba(255,255,255,.1)' }}>
                  Esplora gli spazi online
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(15,15,14,.06)', padding: 'clamp(1.5rem,4vw,2.5rem) 0' }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <BrandMark compact />
          <nav style={{ display: 'flex', gap: 'clamp(.8rem,2.5vw,2rem)', fontSize: 13, fontWeight: 600 }}>
            {[['Esplora','/scopri'],['Privacy','/privacy'],['Termini','/terms'],['Accedi','/accedi']].map(([l,h]) => (
              <a key={l} href={h} style={{ color: '#9CA3AF', textDecoration: 'none' }}
                onMouseOver={e => e.target.style.color = '#0F0F0E'}
                onMouseOut={e => e.target.style.color = '#9CA3AF'}>{l}</a>
            ))}
          </nav>
          <small style={{ color: '#D1D5DB', fontSize: 12 }}>© {new Date().getFullYear()} All Social To Web</small>
        </div>
      </footer>

      {/* Keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pubFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pubPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        .pub-nav a, .pub-nav { transition: color .15s; }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .showcase-inner { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .pricing-grid > div { transform: none !important; }
        }
        @media (max-width: 700px) {
          .process-grid { grid-template-columns: 1fr !important; }
          .pub-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
