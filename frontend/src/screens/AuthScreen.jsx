import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { BrandMark } from './LandingScreen';

export function AuthScreen({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/api/routes/auth.php?action=login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('sts_token', data.token);
      localStorage.setItem('sts_user', JSON.stringify(data.user));
      onAuth(data.token, data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', backgroundColor: '#0f1115', color: '#fff',
      fontFamily: '"Inter", sans-serif', overflow: 'hidden'
    }}>
      {/* Sezione Sinistra: Visual & Branding */}
      <div style={{
        flex: 1, position: 'relative', display: 'none', '@media(min-width: 900px)': { display: 'block' },
        background: 'linear-gradient(135deg, #1e2128 0%, #0f1115 100%)',
        borderRight: '1px solid rgba(255,255,255,0.05)'
      }} className="auth-visual-side">
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255, 90, 60, 0.15), transparent 60%), radial-gradient(circle at 70% 80%, rgba(99, 102, 241, 0.1), transparent 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.5 }} />
        
        <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', padding: '4rem' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'inline-block', filter: 'invert(1)' }}>
            <BrandMark />
          </a>
          
          <div style={{ marginTop: 'auto', marginBottom: 'auto', maxWidth: '480px' }}>
            <h1 style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(to right, #fff, #a0a5b5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Dai social a uno spazio che resta.
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#8a91a6', lineHeight: 1.6, fontWeight: 400 }}>
              Accedi al tuo hub e trasforma contenuti effimeri in un asset proprietario, organizzato e pronto per essere trovato.
            </p>
          </div>
          
          <div style={{ marginTop: 'auto', display: 'flex', gap: '2rem', color: '#636b80', fontSize: '0.875rem', fontWeight: 500 }}>
            <span>© {new Date().getFullYear()} All Social To Web</span>
            <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
            <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Termini</a>
          </div>
        </div>
      </div>

      {/* Sezione Destra: Form di Accesso */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative'
      }}>
        {/* Glow effect sullo sfondo del form */}
        <div style={{ position: 'absolute', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 60%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', filter: 'blur(40px)' }} />

        <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
          <div className="auth-mobile-header" style={{ marginBottom: '3rem', display: 'none' }}>
            <a href="/" style={{ textDecoration: 'none', filter: 'invert(1)' }}><BrandMark compact /></a>
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff', letterSpacing: '-0.02em' }}>Bentornato</h2>
          <p style={{ color: '#8a91a6', marginBottom: '2.5rem', fontSize: '1.05rem' }}>Inserisci le tue credenziali per accedere.</p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#a0a5b5', marginBottom: '0.5rem' }}>Email o Username</label>
              <input 
                type="text" 
                placeholder="es. admin" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                style={{ 
                  width: '100%', padding: '14px 16px', fontSize: '1rem', background: '#171a21', 
                  border: '1px solid #2a2e39', borderRadius: '12px', color: '#fff', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; }}
                onBlur={e => { e.target.style.borderColor = '#2a2e39'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#a0a5b5', marginBottom: '0.5rem' }}>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                style={{ 
                  width: '100%', padding: '14px 16px', fontSize: '1rem', background: '#171a21', 
                  border: '1px solid #2a2e39', borderRadius: '12px', color: '#fff', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.2)'; }}
                onBlur={e => { e.target.style.borderColor = '#2a2e39'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 500, border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ 
              marginTop: '1rem', width: '100%', padding: '16px', fontSize: '1.05rem', 
              background: loading ? '#4338ca' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
              color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={e => { if(!loading) { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 12px 24px rgba(99, 102, 241, 0.4)'; } }}
            onMouseOut={e => { if(!loading) { e.target.style.transform = 'none'; e.target.style.boxShadow = '0 8px 20px rgba(99, 102, 241, 0.3)'; } }}
            >
              {loading ? 'Accesso in corso...' : 'Entra nello spazio →'}
            </button>
          </form>

          <div style={{ marginTop: '3rem', textAlign: 'center', color: '#636b80', fontSize: '0.875rem' }}>
            Non hai un account? <a href="/#come-funziona" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>Scopri come funziona</a>
          </div>
        </div>
      </div>
      
      <style>{`
        @media (max-width: 899px) {
          .auth-visual-side { display: none !important; }
          .auth-mobile-header { display: block !important; }
        }
      `}</style>
    </div>
  );
}
