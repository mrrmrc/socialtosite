const fs = require('fs');

const path = 'frontend/src/screens/DashboardScreen.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove auto-open studio workspace
content = content.replace(/setStudioSourceLabel\('Layout attuale'\);\s+setStudioWorkspaceOpen\(true\);\s+\}, \[tab\]\);/, "setStudioSourceLabel('Layout attuale');\n  }, [tab]);");

// 2. Update navigationGroups
content = content.replace(/\{ id: 'settings', icon:(.*?)label: 'Aspetto'(.*?)\},[\s\S]*?\{ id: 'seo', icon:(.*?)label: 'Visibilità'(.*?)\},[\s\S]*?\],[\s\S]*?\}[\s\S]*?\];/, 
`{ id: 'seo', icon:$3label: 'Visibilità'$4},
      ],
    },
    {
      label: 'Sito Pubblico',
      items: [
        { id: 'settings', icon:$1label: 'Aspetto', hint: 'Temi del sito' },
        { id: 'experience', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>, label: 'Identità del sito', hint: 'Scegli nome e immagine' },
      ],
    }
  ];`);

// 3. Update renderAccountHub with renderAccountProfile
content = content.replace(/const renderAccountHub = \(\) => \([\s\S]*?boxShadow: '0 4px 10px rgba\(0,0,0,0\.02\)'[\s\S]*?<\/button>[\s\S]*?\)\)}[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?\);/, 
`const renderAccountProfile = () => (
    <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', border: '1px solid var(--border)' }}>
      <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <h2 style={{ fontSize: '20px', margin: 0, color: 'var(--text)' }}>Profilo Utente</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>Gestisci le tue informazioni personali</p>
      </header>
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 700 }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{user?.name || 'Utente'}</div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{user?.email || 'Nessuna email'}</div>
            <div style={{ display: 'inline-block', marginTop: '0.5rem', padding: '2px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Ruolo: {user?.role === 'admin' ? 'Amministratore' : 'Utente Standard'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );`);

// 4. Update backend header
content = content.replace(/<div className="backend-header-actions">([\s\S]*?)<button className="btn btn-outline" onClick=\{\(\) => selectNavigation\(\{ id: 'account', section: 'profile' \}\)\}>Profilo<\/button>\s*<button className="btn btn-outline" onClick=\{onLogout\}>Esci<\/button>\s*<\/div>/, 
`<div className="backend-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>$1
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
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem' }} onMouseDown={() => selectNavigation({ id: 'account' })}>Profilo</button>
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem' }} onMouseDown={() => selectNavigation({ id: 'security' })}>Sicurezza</button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '0.5rem 0' }}></div>
              <button className="btn btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', color: 'var(--red)' }} onMouseDown={onLogout}>Esci</button>
            </div>
          </div>
        </div>`);

// 5. Remove visual-identity from settings
content = content.replace(/\{tab === 'settings' && \(\s*<div>\s*<div style=\{\{ display: "grid", gap: "1rem", marginBottom: "2rem" \}\}>\s*<section className="card visual-identity-panel" id="visual-identity">[\s\S]*?<\/section>\s*<\/div>/, 
`{tab === 'settings' && (
          <div>`);

// 6. Change Apri Studio button
content = content.replace(/<button\s*className="btn btn-primary"\s*onClick=\{\(\) => openStudioWorkspace\(templateStudio, 'Workspace corrente'\)\}\s*style=\{\{\s*padding: '12px 20px', fontWeight: 700 \}\}\s*>\s*Apri Studio\s*<\/button>/g,
`<button
                  className="btn btn-primary"
                  onClick={() => openStudioWorkspace(templateStudio, 'Workspace corrente')}
                  style={{ padding: '12px 20px', fontWeight: 700 }}
                >
                  Modifica sito pubblico
                </button>`);

// 7. Insert renderAccountProfile call
content = content.replace(/\{tab === 'security' && \(/, 
`{tab === 'account' && renderAccountProfile()}

        {tab === 'security' && (`);

fs.writeFileSync(path, content, 'utf8');
console.log('Script completed.');
