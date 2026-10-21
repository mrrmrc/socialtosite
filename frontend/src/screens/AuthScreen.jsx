import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { BrandMark } from './LandingScreen';

export function AuthScreen({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset-password') || '');
  const [mode, setMode] = useState(() => resetToken ? 'reset' : 'login');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    function consumeRecoveryLink() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get('reset-password');
      if (!token) return;
      setResetToken(token); setMode('reset'); setError(''); setNotice(''); setPassword(''); setConfirmation('');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    consumeRecoveryLink();
    window.addEventListener('hashchange', consumeRecoveryLink);
    return () => window.removeEventListener('hashchange', consumeRecoveryLink);
  }, []);

  function changeMode(next) {
    setMode(next); setError(''); setNotice(''); setPassword(''); setConfirmation('');
  }

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(''); setNotice('');
    try {
      if (mode === 'forgot') {
        const data = await apiFetch('/api/index.php?action=forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
        setNotice(data.message);
        return;
      }
      if (mode === 'reset') {
        if (password !== confirmation) { setError('Le password non coincidono.'); return; }
        const data = await apiFetch('/api/index.php?action=reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, password, password_confirmation: confirmation }) });
        localStorage.removeItem('sts_token'); localStorage.removeItem('sts_user');
        setResetToken(''); setPassword(''); setConfirmation(''); setMode('login'); setNotice(data.message);
        return;
      }
      const data = await apiFetch('/api/index.php?action=login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      localStorage.setItem('sts_token', data.token);
      localStorage.setItem('sts_user', JSON.stringify(data.user));
      onAuth(data.token, data.user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const fields = mode === 'reset' ? [
    { name: 'password', label: 'Nuova password', type: 'password', val: password, set: setPassword, ph: 'Da 10 a 72 caratteri' },
    { name: 'password-confirmation', label: 'Conferma nuova password', type: 'password', val: confirmation, set: setConfirmation, ph: 'Ripeti la nuova password' },
  ] : [
    { name: 'email', label: 'Email', type: 'email', val: email, set: setEmail, ph: 'es. mario@esempio.it' },
    ...(mode === 'login' ? [{ name: 'password', label: 'Password', type: 'password', val: password, set: setPassword, ph: '••••••••' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F7F5F0', fontFamily: '"Inter", system-ui, sans-serif', overflowX: 'hidden' }}>

      {/* ── Left brand panel ─────────────────────────────── */}
      <div className="auth-left" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: 'clamp(2rem, 5vw, 4rem)',
        background: '#0F0F0E', position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', width: '70%', height: '70%', top: '-20%', left: '-20%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,.28), transparent 70%)', filter: 'blur(50px)' }} />
          <div style={{ position: 'absolute', width: '50%', height: '50%', bottom: '-10%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,.18), transparent 70%)', filter: 'blur(50px)' }} />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Logo */}
          <div style={{ filter: 'brightness(0) invert(1)' }}>
            <BrandMark />
          </div>

          {/* Center */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '3rem', paddingBottom: '2rem' }}>
            <img src="/logo-cropped.png" alt="" style={{ width: 72, height: 72, marginBottom: '2rem', filter: 'drop-shadow(0 0 28px rgba(124,58,237,.6))' }} />
            <h1 style={{ margin: '0 0 1rem', fontSize: 'clamp(2rem, 3.5vw, 3rem)', fontWeight: 900, lineHeight: .98, letterSpacing: '-.04em', color: '#fff' }}>
              Dai social<br />
              <span style={{ background: 'linear-gradient(135deg, #7C3AED, #06B6D4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                a uno spazio<br />che resta.
              </span>
            </h1>
            <p style={{ margin: '0 0 2rem', fontSize: 15, color: 'rgba(255,255,255,.55)', lineHeight: 1.65, maxWidth: 380 }}>
              Il tuo hub per trasformare contenuti effimeri in un asset proprietario, aggiornato ogni giorno dall'AI.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '⚡', text: 'Sincronizzazione automatica dai social' },
                { icon: '🧠', text: "L'AI struttura e organizza i contenuti" },
                { icon: '🌐', text: 'Sito pubblico sempre aggiornato' },
              ].map(f => (
                <div key={f.icon} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: 12, color: 'rgba(255,255,255,.3)' }}>
            <span>© {new Date().getFullYear()} All Social To Web</span>
            <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</a>
            <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Termini</a>
          </div>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div style={{
        width: 'min(520px, 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(2rem, 5vw, 4rem)', position: 'relative',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Mobile brand */}
          <div className="auth-mobile-brand" style={{ display: 'none', marginBottom: '2.5rem' }}>
            <BrandMark />
          </div>

          <h2 style={{ margin: '0 0 .4rem', fontSize: 26, fontWeight: 900, color: '#0F0F0E', letterSpacing: '-.035em' }}>{mode === 'forgot' ? 'Recupera password' : mode === 'reset' ? 'Scegli una nuova password' : 'Bentornato'}</h2>
          <p style={{ margin: '0 0 2rem', fontSize: 15, color: '#9CA3AF' }}>{mode === 'forgot' ? 'Inserisci l’email del tuo account per richiedere il link di recupero.' : mode === 'reset' ? 'Imposta una password da 10 a 72 caratteri. Il link scade dopo 30 minuti.' : 'Inserisci email e password per accedere al pannello.'}</p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fields.map(f => (
              <div key={f.label}>
                <label htmlFor={`auth-${f.name}`} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#6B7280', marginBottom: 7 }}>{f.label}</label>
                <input
                  id={`auth-${f.name}`} name={f.name}
                  autoComplete={f.type === 'email' ? 'username' : mode === 'reset' ? 'new-password' : 'current-password'}
                  minLength={mode === 'reset' ? 10 : undefined} maxLength={mode === 'reset' ? 72 : f.type === 'email' ? 254 : undefined}
                  disabled={loading} aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined}
                  type={f.type} placeholder={f.ph} value={f.val}
                  onChange={e => f.set(e.target.value)} required
                  style={{ width: '100%', padding: '13px 15px', fontSize: 15, background: '#fff', border: '1.5px solid rgba(15,15,14,.12)', borderRadius: 12, color: '#0F0F0E', outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s, box-shadow .2s', boxSizing: 'border-box' }}
                  onFocus={e => { e.target.style.borderColor = '#7C3AED'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,.12)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(15,15,14,.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ))}

            {notice && <div role="status" style={{ background: '#E8F5EE', color: '#165D3B', padding: '12px', borderRadius: 10, fontSize: 14 }}>{notice}</div>}
            {error && (
              <div id="auth-error" role="alert" style={{ background: 'rgba(239,68,68,.08)', color: '#DC2626', padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: '0.5rem', width: '100%', padding: '15px', fontSize: 15, fontWeight: 800,
              background: loading ? '#EE634688' : '#EE6346',
              color: '#fff', border: 'none', borderRadius: 12, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 20px rgba(238,99,70,.3)', fontFamily: 'inherit',
              transition: 'transform .2s, box-shadow .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 26px rgba(238,99,70,.4)'; }}}
            onMouseOut={e => { if (!loading) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(238,99,70,.3)'; }}}>
              {loading ? 'Attendi…' : mode === 'forgot' ? 'Invia link di recupero' : mode === 'reset' ? 'Salva nuova password' : 'Entra nello spazio →'}
            </button>
            {mode === 'login' ? <button type="button" disabled={loading} onClick={() => changeMode('forgot')} style={{ background: 'none', border: 0, color: '#7C3AED', cursor: 'pointer', padding: '8px', fontSize: 14 }}>Password dimenticata? Recupera password</button> : <button type="button" disabled={loading} onClick={() => changeMode(mode === 'reset' ? 'forgot' : 'login')} style={{ background: 'none', border: 0, color: '#7C3AED', cursor: 'pointer', padding: '8px', fontSize: 14 }}>{mode === 'reset' ? 'Richiedi un nuovo link' : 'Torna al login'}</button>}
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: 14, color: '#9CA3AF' }}>
            Non hai un account?{' '}
            <a href="/#funziona" style={{ color: '#7C3AED', fontWeight: 700, textDecoration: 'none' }}>Scopri come funziona</a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-mobile-brand { display: block !important; }
        }
      `}</style>
    </div>
  );
}
