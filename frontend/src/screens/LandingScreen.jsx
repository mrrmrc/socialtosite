import React from 'react';
import { SOCIAL } from '../utils/api';

export function LandingScreen({ onGetStarted }) {
  const isLoggedIn = !!localStorage.getItem('sts_token');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', overflowX: 'hidden' }}>

      {/* Blob decorativi sfondo */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '700px', height: '700px', borderRadius: '50%', top: '-200px', left: '-200px', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', animation: 'blobFloat 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', bottom: '-100px', right: '-100px', background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)', animation: 'blobFloat 16s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', top: '40%', right: '10%', background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)', animation: 'blobFloat 10s ease-in-out infinite 4s' }} />
      </div>

      {/* Navbar */}
      <header style={{ padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(11, 15, 25, 0.8)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 2px 20px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png?v=2" alt="" style={{ width: 42, height: 42, objectFit: 'contain', filter: 'drop-shadow(0 6px 12px rgba(99,102,241,.25))' }} />
          <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>LinkSeo<span className="gradient-text">Web</span></span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <a href="/scopri" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>Scopri</a>
          {!isLoggedIn && <button className="btn btn-outline" onClick={onGetStarted} style={{ padding: '8px 20px', fontSize: '14px' }}>Accedi</button>}
          <button className="btn btn-primary" onClick={() => { if (isLoggedIn) window.location.href = '/dashboard'; else onGetStarted(); }} style={{ padding: '10px 22px', fontSize: '14px' }}>
            {isLoggedIn ? 'Dashboard →' : 'Inizia Gratis'}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary-light)', color: 'var(--primary-dark)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '50px', padding: '6px 18px', fontSize: '13px', fontWeight: 700, marginBottom: '32px', animation: 'fadeInUp 0.6s ease both' }}>
          <span style={{ fontSize: '16px' }}>✨</span> AI-Powered Content Manager · Gratis per iniziare
        </div>

        <h1 style={{ fontSize: 'clamp(40px, 7vw, 76px)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '28px', animation: 'fadeInUp 0.7s 0.1s ease both' }}>
          Il tuo sito si aggiorna<br />
          <span className="gradient-text">da solo, mentre dormi.</span>
        </h1>

        <p style={{ fontSize: 'clamp(16px, 2.5vw, 21px)', color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto 48px', lineHeight: 1.65, animation: 'fadeInUp 0.7s 0.2s ease both' }}>
          Collega Instagram, TikTok, YouTube e Facebook. La nostra AI trasforma ogni post in un
          <strong style={{ color: 'var(--text)' }}> articolo SEO ottimizzato</strong> e lo pubblica sul tuo sito personale.
          Traffico organico su Google, senza pagare un euro di ADS.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeInUp 0.7s 0.3s ease both' }}>
          <button id="hero-cta" className="btn btn-primary" onClick={() => { if (isLoggedIn) window.location.href = '/dashboard'; else onGetStarted(); }} style={{ fontSize: '17px', padding: '16px 36px' }}>
            {isLoggedIn ? 'Vai alla Dashboard →' : '🚀 Inizia Gratis Ora'}
          </button>
          <button className="btn btn-outline" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })} style={{ fontSize: '17px', padding: '16px 32px' }}>Come funziona ↓</button>
        </div>

        {/* Mockup visivo */}
        <div style={{ marginTop: '72px', animation: 'fadeInUp 0.8s 0.4s ease both' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '24px', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(99,102,241,0.18), 0 8px 32px rgba(0,0,0,0.06)', padding: '20px', maxWidth: '760px', margin: '0 auto', textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FDA4AF' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FDE68A' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#6EE7B7' }} />
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px', border: '1px solid var(--border)' }}>🔒 LinkSeoWeb / il tuo spazio</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { emoji: '📸', title: 'Nuova collezione estate 2026', src: 'Instagram', badge: '✅ SEO' },
                { emoji: '🎬', title: 'Tutorial: come fare la pasta fatta in casa', src: 'YouTube', badge: '✅ SEO' },
                { emoji: '🎵', title: 'Behind the scenes del video virale', src: 'TikTok', badge: '⏳ AI...' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--bg)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.emoji}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', lineHeight: 1.3 }}>{item.title}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{item.src}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: item.badge.startsWith('✅') ? 'var(--teal)' : 'var(--amber)', background: item.badge.startsWith('✅') ? 'var(--teal-light)' : 'var(--amber-light)', padding: '2px 8px', borderRadius: '20px' }}>{item.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'rgba(11, 15, 25, 0.6)', backdropFilter: 'blur(10px)', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '32px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
          <span>⭐⭐⭐⭐⭐ <strong style={{ color: 'var(--text)' }}>4.9/5</strong> dalle recensioni</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>🚀 <strong style={{ color: 'var(--text)' }}>500+</strong> creator già connessi</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {['instagram','tiktok','youtube','facebook'].map(p => <img key={p} src={SOCIAL[p]?.icon} alt={p} style={{ width: 18, height: 18, opacity: 0.7 }} />)}
          </span>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '100px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'inline-block', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50px', padding: '5px 16px', fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>COME FUNZIONA</div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '16px' }}>L'AI lavora, tu cresci.</h2>
          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto' }}>Tre step automatici, zero fatica manuale.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {[
            { icon: '🤖', gradient: 'linear-gradient(135deg, #EEF2FF, #F3E8FF)', iconBg: 'linear-gradient(135deg, #6366F1, #8B5CF6)', title: 'Pilota Automatico', desc: 'Collega i tuoi account. Ogni post, reel e video viene intercettato e trascritto dalla nostra AI in automatico — 24 ore su 24, 7 giorni su 7, senza alcun click da parte tua.' },
            { icon: '🚀', gradient: 'linear-gradient(135deg, #ECFEFF, #EEF2FF)', iconBg: 'linear-gradient(135deg, #06B6D4, #6366F1)', title: 'SEO a Vita', desc: 'I post social spariscono in 24 ore dal feed. Noi li trasformiamo in articoli strutturati che Google indicizza e che ti portano traffico organico per anni, senza pagare un euro di pubblicità.' },
            { icon: '💸', gradient: 'linear-gradient(135deg, #F0FDF4, #ECFEFF)', iconBg: 'linear-gradient(135deg, #10B981, #06B6D4)', title: 'Zero ADS per Sempre', desc: 'Smetti di pagare Zuckerberg e Google per farti vedere. Costruisci un pubblico organico e proprietario sul tuo sito, che nessun algoritmo può toglierti e nessuna crisi di budget può fermare.' },
          ].map((feature, i) => (
            <div key={i} className="card" style={{ background: feature.gradient, border: '1px solid rgba(99,102,241,0.12)', padding: '40px 32px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: feature.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>{feature.icon}</div>
              <h3 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '14px' }}>{feature.title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: '15px' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section style={{ position: 'relative', zIndex: 1, margin: '0 24px 80px', borderRadius: '32px', overflow: 'hidden', background: 'var(--gradient)', boxShadow: '0 24px 80px rgba(99,102,241,0.30)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 80% at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', padding: 'clamp(48px, 8vw, 96px) 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: '20px' }}>Pronti a smettere<br />di lavorare per i social?</h2>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.80)', marginBottom: '40px', maxWidth: '480px', margin: '0 auto 40px' }}>Unisciti a centinaia di creator che hanno già automatizzato la loro presenza online. Il tuo primo sito è gratis.</p>
          <button id="footer-cta" className="btn" onClick={() => { if (isLoggedIn) window.location.href = '/dashboard'; else onGetStarted(); }} style={{ background: '#fff', color: 'var(--primary)', fontSize: '17px', padding: '16px 40px', borderRadius: '50px', fontWeight: 800, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: 'none' }}>
            {isLoggedIn ? 'Vai alla Dashboard →' : '✨ Inizia Gratis — Nessuna carta richiesta'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '32px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px', borderTop: '1px solid var(--border)' }}>
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-muted)', fontSize: '14px' }}><img src="/logo.png?v=2" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} /><span>LinkSeoWeb</span></div>
        <p><a href="/scopri" style={{ color: 'inherit' }}>Esplora attività e contenuti</a> · © 2026 LinkSeoWeb. Tutti i diritti riservati. · Piano gratuito · Fino a 3 social</p>
      </footer>
    </div>
  );
}
