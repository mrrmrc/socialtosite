import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthScreen } from './screens/AuthScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { GeneratingScreen } from './screens/GeneratingScreen';
import { DashboardScreen } from './screens/DashboardScreen';

function AppContent() {
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [deployInfo, setDeployInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('sts_token');
    const u = localStorage.getItem('sts_user');
    if (t && u) {
      setToken(t);
      try {
        setUser(JSON.parse(u));
      } catch {
        localStorage.removeItem('sts_user');
      }
    }
    setLoading(false);

    fetch('/deploy-info.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setDeployInfo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;

    fetch('/api/index.php?action=me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error('session-sync-failed');
        return r.json();
      })
      .then(data => {
        if (data?.user) {
          setUser(data.user);
          localStorage.setItem('sts_user', JSON.stringify(data.user));
        }
      })
      .catch(() => {
        localStorage.removeItem('sts_token');
        localStorage.removeItem('sts_user');
        setToken(null);
        setUser(null);
        navigate('/login');
      });
  }, [token, navigate]);

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

  if (loading) return null; // or a spinner

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
        <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <AuthScreen onAuth={handleAuth} />} />
        <Route path="/connect" element={token ? <ConnectScreen token={token} onDone={() => navigate('/generating')} /> : <Navigate to="/login" />} />
        <Route path="/generating" element={token ? <GeneratingScreen token={token} user={user} onDone={() => navigate('/dashboard')} /> : <Navigate to="/login" />} />
        <Route path="/dashboard/*" element={token ? <DashboardScreen token={token} user={user} onLogout={logout} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={token ? "/dashboard" : "/login"} replace />} />
      </Routes>
      
      <footer style={{
        textAlign: 'center', padding: '12px 20px', fontSize: '11px',
        color: 'var(--text-faint)', borderTop: '1px solid var(--border)',
        background: 'var(--sidebar-bg)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', flexWrap: 'wrap',
        position: 'relative', zIndex: 10,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <img src="/logo-cropped.png" alt="AllSocialToWeb" style={{ height: '28px', opacity: 0.9, display: 'block' }} />
          <span style={{ opacity: 0.6 }}>allsocialtoweb.com</span>
        </span>
        <span style={{ opacity: 0.3 }}>·</span>
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
