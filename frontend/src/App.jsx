import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { LandingScreen } from './screens/LandingScreen';
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
      setUser(JSON.parse(u));
    }
    setLoading(false);

    fetch('/deploy-info.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setDeployInfo)
      .catch(() => {});
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

  if (loading) return null; // or a spinner

  return (
    <>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/dashboard" /> : <LandingScreen onGetStarted={() => navigate('/login')} />} />
        <Route path="/login" element={token ? <Navigate to="/dashboard" /> : <AuthScreen onAuth={handleAuth} />} />
        <Route path="/connect" element={token ? <ConnectScreen token={token} onDone={() => navigate('/generating')} /> : <Navigate to="/login" />} />
        <Route path="/generating" element={token ? <GeneratingScreen token={token} user={user} onDone={() => navigate('/dashboard')} /> : <Navigate to="/login" />} />
        <Route path="/dashboard/*" element={token ? <DashboardScreen token={token} user={user} onLogout={logout} /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      
      {deployInfo && (
        <footer style={{ textAlign: 'center', padding: '18px 12px', fontSize: '12px', color: 'var(--text-faint)' }}>
          Deploy {deployInfo.deployed_day || ''} {deployInfo.deployed_at || ''}
          {deployInfo.release ? ` · ${deployInfo.release}` : ''}
        </footer>
      )}
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
