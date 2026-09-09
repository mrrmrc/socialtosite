import React, { useState } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import './index.css';

export default function App() {
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

  if (!token || !user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <DashboardScreen token={token} user={user} onLogout={handleLogout} />;
}
