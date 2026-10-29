import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { InterfaceIcon as Icon } from './InterfaceIcon';

export function AccountProfile({ user, token, onSaved, onNavigate }) {
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', current_password: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const emailChanged = form.email.trim().toLowerCase() !== String(user.email || '').toLowerCase();
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await apiFetch('/api/index.php?action=account-update', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), ...(emailChanged ? { current_password: form.current_password } : {}) }) }, token);
      if (!result.user?.id) throw new Error('Conferma dell’aggiornamento non ricevuta. Ricarica i dati prima di riprovare.');
      onSaved(result.user);
      setForm({ name: result.user.name, email: result.user.email, current_password: '' });
      setNotice({ ok: true, text: 'Dati account aggiornati.' });
    } catch (error) { setNotice({ ok: false, text: error.message }); }
    finally { setBusy(false); }
  }
  return <section className="account-profile card" aria-labelledby="account-profile-title"><header><span className="account-profile-avatar"><Icon name="user" size={32} /></span><div><h2 id="account-profile-title">Il tuo profilo personale</h2><p>Modifica nome ed email di accesso.</p></div><span className="account-plan-badge">{user.plan || 'Base'}</span></header><form onSubmit={save}><label htmlFor="account-name">Nome e cognome<input id="account-name" type="text" autoComplete="name" maxLength={100} required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} disabled={busy} /></label><label htmlFor="account-email">Email di accesso<input id="account-email" type="email" autoComplete="email" maxLength={190} required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} disabled={busy} /></label>{emailChanged && <label htmlFor="account-current-password">Conferma con la password attuale<input id="account-current-password" type="password" autoComplete="current-password" required value={form.current_password} onChange={event => setForm(current => ({ ...current, current_password: event.target.value }))} disabled={busy} /><small>La nuova email diventerà il tuo indirizzo di accesso.</small></label>}{notice && <p role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'lw-success' : 'lw-error'}>{notice.text}</p>}<button className="btn btn-primary" disabled={busy}><Icon name="check" size={18} />{busy ? 'Salvataggio…' : 'Salva i miei dati'}</button></form><footer><button type="button" className="btn btn-outline" onClick={() => onNavigate('security')}><Icon name="shield" size={18} />Password e accessi</button>{user.role !== 'admin' && <button type="button" className="btn btn-outline" onClick={() => onNavigate('profile')}><Icon name="globe" size={18} />Dati pubblici dell’attività</button>}</footer></section>;
}
