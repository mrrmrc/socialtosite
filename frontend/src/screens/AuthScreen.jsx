import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', top: '-150px', left: '-150px', background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png?v=2" alt="" style={{ width: 78, height: 78, objectFit: 'contain', margin: '0 auto 10px', display: 'block', filter: 'drop-shadow(0 12px 20px rgba(99,102,241,.2))' }} />
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '6px' }}>LinkSeo<span className="gradient-text">Web</span></div>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: '32px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
          <form onSubmit={submit}>
            <div className="form-group">
              <label className="label">Email o Username</label>
              <input type="text" placeholder="tua@email.it oppure username" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input type="password" placeholder="Minimo 8 caratteri" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: 'var(--radius-sm)', fontWeight: 800 }}>
              {loading ? '⟳ Caricamento...' : 'Entra nella piattaforma →'}
            </button>
          </form>

          <div className="divider" />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', textAlign: 'center', lineHeight: 1.6 }}>
            🔒 Accesso riservato agli utenti già abilitati
          </div>
        </div>
      </div>
    </div>
  );
}
