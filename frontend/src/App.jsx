import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthScreen } from './screens/AuthScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { GeneratingScreen } from './screens/GeneratingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { BasicUserScreen } from './screens/BasicUserScreen';
import { PlanExperience, normalizePlan } from './components/PlanExperience';

// Pannello temporaneo richiesto per seguire l'acquisizione. Rimuovere solo
// quando l'utente conferma che la diagnosi e' conclusa.
const TEMPORARY_ACQUISITION_DEBUG = true;

function storedAcquisitionDebug() {
  try {
    const value = sessionStorage.getItem('sts_acquisition_debug');
    return value ? JSON.parse(value) : null;
  } catch (_) {
    return null;
  }
}

function AppContent() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [deployInfo, setDeployInfo] = useState(null);
  const [acquisitionDebug, setAcquisitionDebug] = useState(storedAcquisitionDebug);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!acquisitionDebug) return;
    try { sessionStorage.setItem('sts_acquisition_debug', JSON.stringify(acquisitionDebug)); } catch (_) {}
  }, [acquisitionDebug]);

  useEffect(() => {
    fetch('/deploy-info.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setDeployInfo)
      .catch(() => {});

    const storedToken = localStorage.getItem('sts_token');
    if (!storedToken) {
      localStorage.removeItem('sts_user');
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/index.php?action=me', {
      headers: { Authorization: `Bearer ${storedToken}` },
      cache: 'no-store',
    })
      .then(response => {
        if (!response.ok) throw new Error('session-sync-failed');
        return response.json();
      })
      .then(data => {
        if (cancelled || !data?.user) return;
        setToken(storedToken);
        setUser(data.user);
        localStorage.setItem('sts_user', JSON.stringify(data.user));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem('sts_token');
        localStorage.removeItem('sts_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  function handleAuth(t, u) {
    setToken(t);
    setUser(u);
    navigate('/dashboard');
  }

  function logout() {
    localStorage.removeItem('sts_token');
    localStorage.removeItem('sts_user');
    setToken(null);
    setUser(null);
    navigate('/login');
  }

  const userPlan = normalizePlan(user?.plan);
  const usesBasicExperience = user?.role !== 'admin' && userPlan === 'base';

  if (loading) return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--primary)', fontWeight: 800 }}>Verifica accesso…</div>
    </main>
  );

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <AuthScreen onAuth={handleAuth} />} />
        <Route path="/connect" element={token ? <ConnectScreen token={token} onDone={() => navigate('/generating')} /> : <Navigate to="/login" />} />
        <Route path="/generating" element={token ? <GeneratingScreen token={token} user={user} onDone={() => navigate('/dashboard')} /> : <Navigate to="/login" />} />
        <Route
          path="/dashboard/manage/*"
          element={token ? <DashboardScreen token={token} user={user} onLogout={logout} onAcquisitionDebug={setAcquisitionDebug} /> : <Navigate to="/login" />}
        />
        <Route
          path="/dashboard/*"
          element={token ? (
            usesBasicExperience
              ? <BasicUserScreen token={token} user={user} onLogout={logout} onEnterDashboard={() => navigate('/dashboard/manage')} />
              : <DashboardScreen token={token} user={user} onLogout={logout} onAcquisitionDebug={setAcquisitionDebug} />
          ) : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      </Routes>

      {token && user && !usesBasicExperience && <PlanExperience user={user} />}
      
      <footer style={{
        textAlign: 'center', padding: 0, fontSize: '11px',
        color: 'var(--text-faint)', borderTop: '1px solid var(--border)',
        background: 'var(--sidebar-bg)', backdropFilter: 'blur(8px)',
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <img src="/logo-cropped.png?v=2" alt="LinkSeoWeb" style={{ height: '28px', opacity: 0.9, display: 'block' }} />
          <span style={{ opacity: 0.6 }}>LinkSeoWeb</span>
        </span>
        <span style={{ opacity: 0.3 }}>·</span>
        {user?.plan && <>
          <span>Piano: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{user.plan}</strong></span>
          <span style={{ opacity: 0.3 }}>·</span>
        </>}
        {deployInfo ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ opacity: 0.5 }}>🚀</span>
            <span>Deploy: <strong style={{ color: 'var(--primary)', opacity: 0.8 }}>{deployInfo.deployed_day} {deployInfo.deployed_at}</strong></span>
            {deployInfo.release && <span style={{ opacity: 0.4 }}>· {deployInfo.release}</span>}
          </span>
        ) : (
          <span style={{ opacity: 0.5 }}>⚙️ Dev build — {new Date().toLocaleString('it-IT')}</span>
        )}
        </div>

        {TEMPORARY_ACQUISITION_DEBUG && token && (
          <details open style={{ textAlign: 'left', borderTop: '1px solid rgba(245,158,11,.35)', background: 'rgba(15,23,42,.96)', color: '#dbeafe' }}>
            <summary style={{ cursor: 'pointer', padding: '10px 16px', color: '#fbbf24', fontWeight: 850, letterSpacing: '.04em', userSelect: 'none' }}>
              ⚠ DEBUG TEMPORANEO ACQUISIZIONE · {acquisitionDebug?.status || 'in attesa'}
            </summary>
            <div style={{ padding: '0 16px 14px', maxWidth: '1500px', margin: '0 auto', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '11px', lineHeight: 1.5 }}>
              {!acquisitionDebug ? (
                <div style={{ padding: '10px', border: '1px dashed rgba(148,163,184,.4)', borderRadius: '8px', color: '#94a3b8' }}>Nessuna traccia in questa sessione. Avvia “Aggiorna contenuti” o “Sincronizza tutti”.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '10px', color: '#cbd5e1' }}>
                    <span><strong style={{ color: '#fff' }}>Modalità:</strong> {acquisitionDebug.mode || 'scansione'}</span>
                    <span><strong style={{ color: '#fff' }}>Aggiornato:</strong> {acquisitionDebug.updated_at ? new Date(acquisitionDebug.updated_at).toLocaleString('it-IT') : '—'}</span>
                    <span><strong style={{ color: '#fff' }}>Esito:</strong> {acquisitionDebug.summary || acquisitionDebug.status}</span>
                  </div>
                  {(acquisitionDebug.traces || []).map((trace, traceIndex) => (
                    <section key={`${trace.source_id || trace.platform}-${traceIndex}`} style={{ marginTop: '9px', border: `1px solid ${trace.status === 'error' ? 'rgba(248,113,113,.55)' : 'rgba(96,165,250,.3)'}`, borderRadius: '9px', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 10px', background: 'rgba(30,41,59,.9)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <strong style={{ color: trace.status === 'error' ? '#fca5a5' : '#93c5fd' }}>{String(trace.platform || 'fonte').toUpperCase()} · {trace.status}</strong>
                        <span>{trace.url}</span>
                        <span>limite={trace.limit ?? '—'} · dal={trace.since_date || 'nessuna data'} · trovati={trace.found ?? 0} · importati={trace.imported ?? 0} · {trace.elapsed_ms ?? 0} ms</span>
                      </div>
                      {trace.error && <div style={{ padding: '7px 10px', color: '#fecaca', background: 'rgba(127,29,29,.3)' }}>{trace.error}</div>}
                      <div style={{ display: 'grid', gap: '1px', background: 'rgba(148,163,184,.15)', overflowX: 'auto' }}>
                        {(trace.events || []).map((event, eventIndex) => (
                          <div key={`${event.provider}-${event.stage}-${eventIndex}`} style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: '70px minmax(120px,.7fr) minmax(130px,.8fr) 75px 1fr', gap: '8px', minWidth: '680px', background: '#0f172a', color: '#cbd5e1' }}>
                            <span>{event.time || '—'}</span>
                            <strong style={{ color: '#e2e8f0' }}>{event.provider}</strong>
                            <span>{event.stage}</span>
                            <span style={{ color: event.status === 'error' ? '#f87171' : event.status === 'ok' ? '#4ade80' : '#fbbf24', fontWeight: 800 }}>{event.status}{Number.isFinite(event.count) ? ` (${event.count})` : ''}</span>
                            <span>{event.message}{event.elapsed_ms ? ` · ${event.elapsed_ms} ms` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </>
              )}
            </div>
          </details>
        )}
      </footer>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
