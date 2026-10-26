import React, { useEffect, useState } from 'react';
import { AdminScreen } from './AdminScreen';
import { BrandMark } from './LandingScreen';
import { apiFetch } from '../utils/api';
import './AdminWorkspaceScreen.css';

function AdminAccountSecurity({ token, onLogout, onClose }) {
  const [form, setForm] = useState({ current: '', next: '', confirmation: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    if (form.next !== form.confirmation) { setError('Le nuove password non coincidono.'); return; }
    setBusy(true);
    try {
      await apiFetch('/api/index.php?action=password-change', { method: 'POST', body: JSON.stringify({ current_password: form.current, new_password: form.next }) }, token);
      onLogout();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function closeSessions() {
    if (!window.confirm('Chiudere tutte le sessioni del tuo account amministratore? Dovrai accedere nuovamente.')) return;
    setBusy(true); setError('');
    try { await apiFetch('/api/index.php?action=logout-all', { method: 'POST' }, token); onLogout(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <section className="admin-account-security card" aria-labelledby="admin-security-heading">
    <div className="admin-account-security-heading"><div><h2 id="admin-security-heading">Sicurezza account amministratore</h2><p>Il cambio password chiude tutte le sessioni e richiede un nuovo accesso.</p></div><button className="btn btn-outline" onClick={onClose}>Chiudi sicurezza</button></div>
    {error && <p role="alert" className="admin-warning">{error}</p>}
    <form onSubmit={changePassword}>
      <label>Password attuale<input type="password" required autoComplete="current-password" value={form.current} onChange={e => setForm(current => ({ ...current, current: e.target.value }))} /></label>
      <label>Nuova password<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.next} onChange={e => setForm(current => ({ ...current, next: e.target.value }))} /></label>
      <label>Conferma nuova password<input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.confirmation} onChange={e => setForm(current => ({ ...current, confirmation: e.target.value }))} /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Aggiornamento…' : 'Aggiorna password amministratore'}</button>
    </form>
    <button className="btn btn-outline" disabled={busy} onClick={closeSessions}>Chiudi tutte le sessioni amministratore</button>
  </section>;
}

/** Platform administration never mounts the customer dashboard or its automations. */
export function AdminWorkspaceScreen({ token, user, onLogout }) {
  const [prompts, setPrompts] = useState([]);
  const [promptsError, setPromptsError] = useState('');
  const [promptsRevision, setPromptsRevision] = useState(0);
  const [securityOpen, setSecurityOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPromptsError('');
    apiFetch('/api/index.php?action=admin-prompts', { signal: controller.signal }, token)
      .then(data => { if (!controller.signal.aborted) setPrompts(data.prompts || []); })
      .catch(error => { if (error.name !== 'AbortError') setPromptsError(error.message); });
    return () => controller.abort();
  }, [token, promptsRevision]);

  async function updatePrompt(agentName, instructions) {
    const result = await apiFetch('/api/index.php?action=admin-update-prompt', { method: 'POST', body: JSON.stringify({ agent_name: agentName, instructions }) }, token);
    setPrompts(current => current.some(prompt => prompt.agent_name === agentName)
      ? current.map(prompt => prompt.agent_name === agentName ? { ...prompt, instructions } : prompt)
      : [...current, { id: result?.id || 0, agent_name: agentName, instructions }]);
    return result;
  }

  return <div className="admin-application-shell">
    <header className="admin-application-header">
      <div className="admin-application-identity"><BrandMark compact /><div><span>Console amministrativa</span><h1>Amministrazione piattaforma</h1></div></div>
      <div className="admin-application-account"><span>{user.name || user.email}<small>Amministratore</small></span><button className="btn btn-outline" aria-expanded={securityOpen} onClick={() => setSecurityOpen(open => !open)}>Sicurezza account</button><button className="btn btn-outline" onClick={onLogout}>Esci</button></div>
    </header>
    <div className="admin-application-content">
      {securityOpen && <AdminAccountSecurity token={token} onLogout={onLogout} onClose={() => setSecurityOpen(false)} />}
      {promptsError && <div className="admin-warning" role="alert">Impossibile caricare le istruzioni degli agenti: {promptsError} <button className="btn btn-outline" onClick={() => setPromptsRevision(value => value + 1)}>Riprova istruzioni agenti</button></div>}
      <AdminScreen token={token} currentUser={user} adminPrompts={prompts} updatePrompt={updatePrompt} />
    </div>
  </div>;
}
