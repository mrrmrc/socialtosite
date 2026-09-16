import React, { useState } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { LandingScreen } from './screens/LandingScreen';
import { LegalScreen } from './screens/LegalScreen';
import { DeployFooter } from './components/DeployFooter';
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
  } else {
    screen = <DashboardScreen token={token} user={user} onLogout={handleLogout} />;
  }

  return (
    <>
      {screen}
      <DeployFooter />
    </>
  );
}
