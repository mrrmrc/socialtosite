import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthScreen } from './screens/AuthScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { GeneratingScreen } from './screens/GeneratingScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { BasicUserScreen } from './screens/BasicUserScreen';
import { PlanExperience, normalizePlan } from './components/PlanExperience';

function AppContent() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [deployInfo, setDeployInfo] = useState(null);
  const [loading, setLoading] = useState(true);

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
          element={token ? <DashboardScreen token={token} user={user} onLogout={logout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/dashboard/*"
          element={token ? (
            usesBasicExperience
              ? <BasicUserScreen token={token} user={user} onLogout={logout} onEnterDashboard={() => navigate('/dashboard/manage')} />
              : <DashboardScreen token={token} user={user} onLogout={logout} />
          ) : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      </Routes>

      {token && user && !usesBasicExperience && <PlanExperience user={user} />}
      
      <footer style={{
        textAlign: 'center', padding: '12px 20px', fontSize: '11px',
        color: 'var(--text-faint)', borderTop: '1px solid var(--border)',
        background: 'var(--sidebar-bg)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', flexWrap: 'wrap',
        position: 'relative', zIndex: 10,
      }}>
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
