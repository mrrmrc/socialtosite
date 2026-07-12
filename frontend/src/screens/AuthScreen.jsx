import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/api/index.php?action=login' : '/api/index.php?action=register';
      const body = mode === 'login' ? { email, password } : { email, password, name };
      const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('sts_token', data.token);
      localStorage.setItem('sts_user', JSON.stringify(data.user));
      onAuth(data.token, data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', top: '-150px', left: '-150px', background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '16px', background: 'var(--gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px', boxShadow: 'var(--shadow-colored)' }}>✦</div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>Social<span className="gradient-text">ToSite</span></div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '32px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="label">Nome</label>
                <input type="text" placeholder="Il tuo nome" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="label">Email</label>
              <input type="email" placeholder="tua@email.it" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input type="password" placeholder="Minimo 8 caratteri" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: 'var(--radius-sm)', fontWeight: 800 }}>
              {loading ? '⟳ Caricamento...' : mode === 'login' ? 'Entra nella piattaforma →' : 'Crea il mio account →'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button className="btn btn-outline" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ fontSize: '13px', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
              {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
            </button>
          </div>

          <div className="divider" />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6 }}>
            🔒 Piano gratuito · Fino a 3 social · Nessuna carta richiesta
          </div>
        </div>
      </div>
    </div>
  );
}
