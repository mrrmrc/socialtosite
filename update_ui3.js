const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update navigationGroups
const navOld = `  const navigationGroups = user?.role === 'admin' ? [
    {
      label: 'Amministrazione',
      items: [
        { id: 'admin', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, label: 'Utenti', hint: 'Account e accessi' },
      ],
    }
  ] : [
    {
      label: 'Menu Principale',
      items: [
        { id: 'strategy', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>, label: 'Profilo Attività', hint: 'Strategia e obiettivi' },
        { id: 'overview', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>, label: 'Panoramica', hint: 'Cosa succede' },
        { id: 'site', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, label: 'Articoli', hint: 'Bozze e pubblicati' },
        { id: 'sources', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, label: 'Canali', hint: 'Contenuti acquisiti' },
        { id: 'settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>, label: 'Aspetto', hint: 'Tema e identità' },
        { id: 'seo', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path><path d="M8 11h6M11 8v6"></path></svg>, label: 'Visibilità', hint: 'Google e pagine' },
      ],
    }
  ];`;

const navNew = `  const navigationGroups = user?.role === 'admin' ? [
    {
      label: 'Amministrazione',
      items: [
        { id: 'admin', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, label: 'Utenti', hint: 'Account e accessi' },
      ],
    }
  ] : [
    {
      label: 'Menu Principale',
      items: [
        { id: 'strategy', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>, label: 'Profilo Attività', hint: 'Strategia e obiettivi' },
        { id: 'overview', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>, label: 'Panoramica', hint: 'Cosa succede' },
        { id: 'site', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, label: 'Articoli', hint: 'Bozze e pubblicati' },
        { id: 'sources', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>, label: 'Canali', hint: 'Contenuti acquisiti' },
        { id: 'seo', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path><path d="M8 11h6M11 8v6"></path></svg>, label: 'Visibilità', hint: 'Google e pagine' },
      ],
    },
    {
      label: 'Sito Pubblico',
      items: [
        { id: 'settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>, label: 'Aspetto', hint: 'Tema e layout' },
        { id: 'experience', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>, label: 'Identità del sito', hint: 'Nome, logo, immagine' },
      ]
    }
  ];`;

content = content.replace(navOld, navNew);

// 2. Remove renderAccountHub completely
const hubRegex = /const renderAccountHub = \(\) => \([\s\S]*?\n  \);\n/g;
content = content.replace(hubRegex, '');

// 3. Add renderAccountProfile right before renderVisibilityServices
const profileJsx = `  const renderAccountProfile = () => (
    <div className="card" style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '24px' }}>Profilo Utente</h2>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)' }}>Email loggata</strong>
          <span style={{ fontSize: '16px' }}>{user?.email}</span>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)' }}>Ruolo</strong>
          <span style={{ fontSize: '16px' }}>{user?.role === 'admin' ? 'Amministratore' : 'Utente standard'}</span>
        </div>
        <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <strong style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)' }}>Piano abbonamento</strong>
          <span style={{ fontSize: '16px', textTransform: 'capitalize' }}>{user?.plan || 'Base'}</span>
        </div>
      </div>
    </div>
  );\n`;
content = content.replace('  const renderVisibilityServices = () => (', profileJsx + '  const renderVisibilityServices = () => (');

// 4. Update Header actions
const headerOld = `        <div className="backend-header-actions">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" aria-label="Apri il mio sito pubblico" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Apri il mio sito
          </a>
          <button className="btn btn-outline" onClick={() => selectNavigation({ id: 'account', section: 'profile' })}>Profilo</button>
          <button className="btn btn-outline" onClick={onLogout}>Esci</button>
        </div>`;

const headerNew = `        <div className="backend-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" aria-label="Apri il mio sito pubblico" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Apri il mio sito
          </a>
          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-outline btn-icon" 
              onClick={(e) => {
                const menu = e.currentTarget.nextElementSibling;
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
              }}
              onBlur={(e) => {
                const menu = e.currentTarget.nextElementSibling;
                setTimeout(() => { menu.style.display = 'none'; }, 200);
              }}
              aria-label="Menu utente"
              style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <div 
              style={{ 
                display: 'none', position: 'absolute', top: '100%', right: '0', 
                marginTop: '0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', 
                borderRadius: 'var(--radius)', padding: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                minWidth: '160px', zIndex: 100 
              }}>
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem' }} onClick={() => selectNavigation({ id: 'account' })}>Profilo</button>
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem' }} onClick={() => selectNavigation({ id: 'security' })}>Sicurezza</button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 0' }}></div>
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', color: 'var(--red)' }} onClick={onLogout}>Esci</button>
            </div>
          </div>
        </div>`;

content = content.replace(headerOld, headerNew);

// 5. Replace {tab === 'account' && renderAccountHub()} with renderAccountProfile()
content = content.replace(/{tab === 'account' && renderAccountHub\(\)}/g, "{tab === 'account' && renderAccountProfile()}");

fs.writeFileSync(file, content);
