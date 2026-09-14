import React, { useState } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LandingScreen } from './screens/LandingScreen';
import { LegalScreen } from './screens/LegalScreen';
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

  if (pathname === '/') {
    return (
      <LandingScreen
        isLoggedIn={!!token && !!user}
        onGetStarted={() => { window.location.href = '/accedi'; }}
      />
    );
  }

  if (pathname === '/privacy') return <LegalScreen type="privacy" />;
  if (pathname === '/terms' || pathname === '/termini') return <LegalScreen type="terms" />;

  if (!token || !user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <DashboardScreen token={token} user={user} onLogout={handleLogout} />;
}
