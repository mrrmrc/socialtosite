import React, { useEffect, useState } from 'react';
import './AdminProviderCard.css';

export function AdminProviderCard({ provider, busy, onSave }) {
  const [model, setModel] = useState(provider.model || '');
  const [enabled, setEnabled] = useState(Number(provider.enabled) === 1);
  const [credential, setCredential] = useState('');
  const [clear, setClear] = useState(false);
  useEffect(() => {
    setModel(provider.model || ''); setEnabled(Number(provider.enabled) === 1);
  }, [provider.model, provider.enabled]);
  const serverManaged = provider.credential_source === 'server';
  async function submit(event) {
    event.preventDefault();
    if (clear && !window.confirm('Rimuovere la credenziale salvata nel database?')) return;
    const saved = await onSave({ provider: provider.provider, model, enabled, credential, clear_credential: clear, monthly_credit: provider.monthly_credit ?? '' });
    if (saved) { setCredential(''); setClear(false); }
  }
  return <form className="admin-provider-card" onSubmit={submit} aria-label={`Collegamento ${provider.label}`}>
    <h4>{provider.label}</h4>
    <p>{provider.credential_configured ? serverManaged ? 'Credenziale configurata sul server' : 'Credenziale salvata e cifrata' : 'Credenziale mancante'}</p>
    <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Provider abilitato</label>
    <label>{provider.provider === 'gemini' ? 'Modello (vuoto = predefinito)' : 'Configurazione modello (opzionale)'}<input maxLength={120} value={model} onChange={e => setModel(e.target.value)} /></label>
    {serverManaged ? <p>La chiave è gestita dalla configurazione del server. Per sostituirla aggiorna quella configurazione.</p> : <>
      <label>Nuova chiave API<input type="password" autoComplete="new-password" maxLength={4096} value={credential} disabled={clear} onChange={e => setCredential(e.target.value)} placeholder="Lascia vuoto per conservare la chiave" /></label>
      {provider.credential_configured && <label><input type="checkbox" checked={clear} onChange={e => { setClear(e.target.checked); setCredential(''); }} /> Rimuovi la chiave salvata</label>}
    </>}
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Salvataggio…' : 'Salva collegamento'}</button>
  </form>;
}
