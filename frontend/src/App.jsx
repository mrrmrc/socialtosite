import React, { useState, useEffect } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LandingScreen } from './screens/LandingScreen';
import { LegalScreen } from './screens/LegalScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { BasicUserScreen } from './screens/BasicUserScreen';
import { apiFetch } from './utils/api';
import './index.css';

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const [token, setToken] = useState(() => localStorage.getItem('sts_token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sts_user')) || null;
    } catch {
      return null;
    }
  });

  function handleAuth(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    localStorage.removeItem('sts_token');
    localStorage.removeItem('sts_user');
    setToken(null);
    setUser(null);
  }

  // Piano Base = nessun plan tra professional/pro/agency (stessa regola di
  // DashboardScreen.jsx). Per questi account, al primo accesso (nessuna
  // fonte ancora collegata) mostriamo BasicUserScreen invece del pannello
  // completo: era già scritto e pronto, semplicemente mai collegato.
  const normalizedPlan = String(user?.plan || '').trim().toLowerCase();
  const isBasePlan = !!user && !['professional', 'pro', 'agency'].includes(normalizedPlan);
  const [hasSources, setHasSources] = useState(null); // null = non ancora verificato
  const [showFullDashboard, setShowFullDashboard] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!token || !user || !isBasePlan) { setHasSources(null); return; }
    let cancelled = false;
    apiFetch('/api/index.php?action=site', {}, token)
      .then(data => { if (!cancelled) setHasSources((data?.sources || []).length > 0); })
      // Se il controllo fallisce non blocchiamo l'utente dietro un gate
      // forse rotto: meglio farlo entrare nel pannello che conosce già.
      .catch(() => { if (!cancelled) setHasSources(true); });
    return () => { cancelled = true; };
  }, [token, user, isBasePlan]);

  let screen;
  if (pathname === '/') {
    screen = (
      <LandingScreen
        isLoggedIn={!!token && !!user}
        onGetStarted={() => { window.location.href = '/accedi'; }}
      />
    );
  } else if (pathname === '/privacy') {
    screen = <LegalScreen type="privacy" />;
  } else if (pathname === '/terms' || pathname === '/termini') {
    screen = <LegalScreen type="terms" />;
  } else if (!token || !user) {
    screen = <AuthScreen onAuth={handleAuth} />;
  } else if (pathname === '/connect') {
    screen = <ConnectScreen token={token} onDone={() => { window.location.href = '/dashboard'; }} />;
  } else if (isBasePlan && hasSources === false && !showFullDashboard) {
    screen = (
      <BasicUserScreen
        user={user}
        token={token}
        onLogout={handleLogout}
        onEnterDashboard={() => setShowFullDashboard(true)}
      />
    );
  } else if (isBasePlan && hasSources === null) {
    screen = <div style={{ minHeight: '100vh' }} aria-hidden="true" />;
  } else {
    screen = <DashboardScreen token={token} user={user} onLogout={handleLogout} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }}>{screen}</div>
      <footer style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-faint)', background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 1000 }}>
        {now.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </footer>
    </div>
  );
}
