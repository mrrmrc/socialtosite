import React from 'react';

const PROFILES = [['base', 'Base'], ['professional', 'Professional'], ['agency', 'Agency'], ['admin', 'Amministratore']];

export function AdminClients({ users, currentUser, form, setForm, loading, usersLoading, userSearch, setUserSearch, userProfile, setUserProfile, passwordDrafts, setPasswordDrafts, busy, onCreate, onProfile, onClient, onRevoke, onImpersonate, onDelete, onPassword }) {
  const visibleUsers = users.filter(user => (!userProfile || (userProfile === 'admin' ? user.role === 'admin' : user.role !== 'admin' && user.plan === userProfile)) && [user.name, user.email, user.slug].some(value => String(value || '').toLowerCase().includes(userSearch.trim().toLowerCase())));
  return <div className="admin-clients">
    <section className="card" aria-labelledby="admin-create-heading">
      <div className="admin-section-heading"><div><h3 id="admin-create-heading">Crea account cliente o amministratore</h3><p>Inserisci i dati di accesso e scegli il profilo dell’account.</p></div></div>
      <form className="admin-create-form" onSubmit={onCreate}>
        <label htmlFor="admin-create-name">Nome<input id="admin-create-name" type="text" autoComplete="name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label htmlFor="admin-create-email">Email<input id="admin-create-email" type="email" autoComplete="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required /></label>
        <label htmlFor="admin-create-password">Password temporanea<input id="admin-create-password" type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required /></label>
        <label htmlFor="admin-create-profile">Profilo<select id="admin-create-profile" value={form.profile} onChange={event => setForm({ ...form, profile: event.target.value })}>{PROFILES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="admin-create-actions"><button className="btn btn-primary" disabled={loading}>{loading ? 'Creazione...' : 'Crea utente'}</button></div>
      </form>
    </section>

    <section className="card" aria-labelledby="admin-accounts-heading">
      <div className="admin-section-heading"><div><h3 id="admin-accounts-heading">Account, piani e accessi</h3><p>Gli account cliente producono contenuti; gli amministratori gestiscono tutta la piattaforma.</p></div></div>
      <div className="admin-client-filters"><input aria-label="Cerca clienti" type="search" value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="Nome, email o indirizzo del sito" /><select aria-label="Filtra profilo clienti" value={userProfile} onChange={event => setUserProfile(event.target.value)}><option value="">Tutti i profili</option><option value="base">Base</option><option value="professional">Professional</option><option value="agency">Agency</option><option value="admin">Amministratori</option></select></div>
      {usersLoading && <p role="status">Aggiornamento account…</p>}
      {!usersLoading && !visibleUsers.length && <p className="admin-clients-empty">{users.length ? 'Nessun account corrisponde ai filtri selezionati.' : 'Nessun account disponibile.'}</p>}
      <div className="admin-account-list">{visibleUsers.map(user => {
        const siteUrl = `${(window.API_BASE || '').replace(/\/$/, '')}/${encodeURIComponent(user.slug)}`;
        const self = Number(user.id) === Number(currentUser.id);
        const name = user.name || user.email;
        return <article className="admin-account-card" key={user.id} aria-label={`Account ${name}`}>
          <div className="admin-user-row">
            <div className="admin-account-identity"><strong>{name}</strong><span>{user.email}</span>{user.role !== 'admin' && <a href={siteUrl} target="_blank" rel="noopener">{siteUrl}</a>}</div>
            <div className="admin-account-counts">{user.role === 'admin' ? <span>Accesso globale alla piattaforma</span> : <><span><b>{user.posts_count ?? '—'}</b> contenuti</span><span><b>{user.sources_count ?? '—'}</b> fonti attive</span></>}</div>
            <label className="admin-account-profile">Profilo<select aria-label={`Profilo di ${name}`} value={user.role === 'admin' ? 'admin' : (user.plan || 'base')} onChange={event => onProfile(user.id, event.target.value)}>{PROFILES.map(([value, label]) => <option key={value} value={value} disabled={self && value !== 'admin'}>{label}</option>)}</select></label>
            <div className="admin-account-actions">{user.role !== 'admin' && <button className="btn btn-outline" onClick={() => onClient(String(user.id))}>Apri controllo cliente</button>}<button className="btn btn-outline" disabled={busy} onClick={() => onRevoke(user.id)}>Revoca sessioni</button><button className="btn btn-outline" disabled={self} onClick={() => onImpersonate(user.id)}>Accedi come</button><button className="btn btn-outline admin-action-danger" disabled={self} onClick={() => onDelete(user.id)}>Elimina</button></div>
          </div>
          <div className="admin-account-password"><label htmlFor={`admin-password-${user.id}`}>Nuova password per {name}<input id={`admin-password-${user.id}`} type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="Minimo 8 caratteri" value={passwordDrafts[user.id] || ''} onChange={event => setPasswordDrafts(current => ({ ...current, [user.id]: event.target.value }))} /></label><button type="button" className="btn btn-outline" disabled={(passwordDrafts[user.id] || '').length < 8} onClick={() => onPassword(user.id)}>Imposta password</button></div>
          {Boolean(user.sources?.length) && <section className="admin-account-sources" aria-label={`Fonti di ${name}`}><h4>Fonti social collegate</h4>{user.sources.map(source => <div key={source.url}><span>{source.platform}</span><a href={source.url} target="_blank" rel="noopener">{source.url}</a></div>)}</section>}
        </article>;
      })}</div>
    </section>
  </div>;
}
