import React, { useState, useEffect } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { AdminWorkspaceScreen } from './screens/AdminWorkspaceScreen';
import { LandingScreen } from './screens/LandingScreen';
import { LegalScreen } from './screens/LegalScreen';
import { ConnectScreen } from './screens/ConnectScreen';
import { BasicUserScreen } from './screens/BasicUserScreen';
import { apiFetch } from './utils/api';
import './index.css';

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const [recoveryLink, setRecoveryLink] = useState(() => pathname === '/accedi' && new URLSearchParams(window.location.hash.slice(1)).has('reset-password'));
  const [token, setToken] = useState(() => localStorage.getItem('sts_token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sts_user')) || null;
    } catch {
      return null;
    }
  });
  const [identityState, setIdentityState] = useState(() => localStorage.getItem('sts_token') ? 'loading' : 'ready');
  const [identityError, setIdentityError] = useState('');
  const [identityRevision, setIdentityRevision] = useState(0);

  function handleAuth(newToken, newUser) {
    setRecoveryLink(false);
    setIdentityState('loading');
    setIdentityError('');
    setToken(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    localStorage.removeItem('sts_token');
    localStorage.removeItem('sts_user');
    setToken(null);
    setUser(null);
    setIdentityState('ready');
    setIdentityError('');
  }

  useEffect(() => {
    if (!token || recoveryLink) return;
    const controller = new AbortController();
    setIdentityState('loading');
    setIdentityError('');
    apiFetch('/api/index.php?action=me', { signal: controller.signal }, token)
      .then(data => {
        if (controller.signal.aborted) return;
        const verifiedUser = data.user;
        if (!verifiedUser?.id || !['admin', 'user'].includes(verifiedUser.role)) throw new Error('Il server non ha restituito un account valido.');
        const verifiedUrl = new URL(window.location.href);
        if (verifiedUser.role !== 'admin' && ['admin', 'general'].includes(verifiedUrl.searchParams.get('tab'))) {
          verifiedUrl.searchParams.delete('tab');
          window.history.replaceState(null, '', verifiedUrl);
        }
        localStorage.setItem('sts_user', JSON.stringify(verifiedUser));
        setUser(verifiedUser);
        setIdentityState('ready');
      })
      .catch(error => {
        if (controller.signal.aborted || error.name === 'AbortError') return;
        setIdentityError(error.message);
        setIdentityState('error');
      });
    return () => controller.abort();
  }, [token, identityRevision, recoveryLink]);

  // Piano Base = nessun plan tra professional/pro/agency (stessa regola di
  // DashboardScreen.jsx). Per questi account, al primo accesso (nessuna
  // fonte ancora collegata) mostriamo BasicUserScreen invece del pannello
  // completo: era già scritto e pronto, semplicemente mai collegato.
  const normalizedPlan = String(user?.plan || '').trim().toLowerCase();
  const isAdmin = user?.role === 'admin';
  const isBasePlan = !!user && !isAdmin && !['professional', 'pro', 'agency'].includes(normalizedPlan);
  const [hasSources, setHasSources] = useState(null); // null = non ancora verificato
  const [showFullDashboard, setShowFullDashboard] = useState(false);

  useEffect(() => {
    function showRecovery() {
      if (pathname === '/accedi' && new URLSearchParams(window.location.hash.slice(1)).has('reset-password')) setRecoveryLink(true);
    }
    window.addEventListener('hashchange', showRecovery);
    return () => window.removeEventListener('hashchange', showRecovery);
  }, [pathname]);

  useEffect(() => {
    if (recoveryLink || identityState !== 'ready' || !token || !user || !isBasePlan) { setHasSources(null); return; }
    let cancelled = false;
    apiFetch('/api/index.php?action=site', {}, token)
      .then(data => { if (!cancelled) setHasSources((data?.sources || []).length > 0); })
      // Se il controllo fallisce non blocchiamo l'utente dietro un gate
      // forse rotto: meglio farlo entrare nel pannello che conosce già.
      .catch(() => { if (!cancelled) setHasSources(true); });
    return () => { cancelled = true; };
  }, [token, user, isBasePlan, recoveryLink, identityState]);

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
  } else if (recoveryLink || !token) {
    screen = <AuthScreen onAuth={handleAuth} />;
  } else if (identityState !== 'ready') {
    screen = identityState === 'error'
      ? <div className="app-loading" role="alert"><p>Impossibile verificare la sessione: {identityError}</p><button className="btn btn-primary" onClick={() => setIdentityRevision(value => value + 1)}>Riprova verifica sessione</button><button className="btn btn-outline" onClick={handleLogout}>Esci</button></div>
      : <div className="app-loading" role="status">Verifica della sessione…</div>;
  } else if (!user) {
    screen = <AuthScreen onAuth={handleAuth} />;
  } else if (isAdmin) {
    screen = <AdminWorkspaceScreen token={token} user={user} onLogout={handleLogout} />;
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
    screen = <div className="app-loading" role="status">Caricamento del tuo spazio…</div>;
  } else {
    screen = <DashboardScreen token={token} user={user} onLogout={handleLogout} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }}>{screen}</div>
      <footer style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: 'var(--text-faint)', background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 1000 }}>
        Build: {typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'Dev'}
      </footer>
    </div>
  );
}
