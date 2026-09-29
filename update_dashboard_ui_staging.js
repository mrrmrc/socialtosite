const fs = require('fs');

const path = 'frontend/src/screens/DashboardScreen.jsx';
let content = fs.readFileSync(path, 'utf8');

const changes = [
  {
    desc: 'Remove auto-open studio workspace',
    from: `    setStudioSourceLabel('Layout attuale');
    setStudioWorkspaceOpen(true);
  }, [tab]);`,
    to: `    setStudioSourceLabel('Layout attuale');
  }, [tab]);`
  },
  {
    desc: 'Update navigationGroups',
    from: `        { id: 'settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>, label: 'Aspetto', hint: 'Tema e identità' },
        { id: 'seo', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path><path d="M8 11h6M11 8v6"></path></svg>, label: 'Visibilità', hint: 'Google e pagine' },
      ],
    }
  ];`,
    to: `        { id: 'seo', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path><path d="M8 11h6M11 8v6"></path></svg>, label: 'Visibilità', hint: 'Google e pagine' },
      ],
    },
    {
      label: 'Sito Pubblico',
      items: [
        { id: 'settings', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>, label: 'Aspetto', hint: 'Temi del sito' },
        { id: 'experience', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>, label: 'Identità del sito', hint: 'Scegli nome e immagine' },
      ],
    }
  ];`
  },
  {
    desc: 'Update renderAccountHub with renderAccountProfile',
    from: String.raw`  const renderAccountHub = () => (
    <div className="settings-hub">
      <section className="settings-hub-intro">
        <span>Configurazione</span>
        <h2>Impostazioni account</h2>
        <p>Qui trovi profilo dell'attività, identità del sito e sicurezza dell'account.</p>
      </section>
      <div className="settings-hub-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
        {[
          ['Profilo attività','Obiettivi, pubblico, servizi e territorio','strategy','✓'],
          ['Identità del sito','Logo e immagine rappresentativa','experience','◇'],
          ['Sicurezza','Password e sessioni del tuo account','security','⌾'],
        ].map(([title,description,target,icon]) => (
          <button key={target} onClick={() => setTab(target)} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            textAlign: 'left', 
            background: 'var(--surface)', 
            border: '2px solid var(--border-strong)', 
            padding: '24px', 
            borderRadius: 'var(--radius-lg)', 
            cursor: 'pointer', 
            gap: '20px', 
            transition: 'all 0.2s', 
            boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
          }}>
            <span style={{ fontSize: '32px', color: 'var(--primary)', flexShrink: 0, width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-light)', borderRadius: '12px' }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: '20px', color: 'var(--text)', marginBottom: '4px', fontWeight: 800 }}>{title}</strong>
              <small style={{ display: 'block', fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{description}</small>
            </div>
            <i style={{ fontStyle: 'normal', fontSize: '24px', color: 'var(--text-muted)', opacity: 0.5 }}>→</i>
          </button>
        ))}
      </div>
    </div>
  );`,
    to: String.raw`  const renderAccountProfile = () => (
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
  );`
  },
  {
    desc: 'Update backend header',
    from: String.raw`        <div className="backend-header-actions">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" aria-label="Apri il mio sito pubblico" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Apri il mio sito
          </a>
          <button className="btn btn-outline" onClick={() => selectNavigation({ id: 'account', section: 'profile' })}>Profilo</button>
          <button className="btn btn-outline" onClick={onLogout}>Esci</button>
        </div>`,
    to: String.raw`        <div className="backend-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
        </div>`
  },
  {
    desc: 'Remove visual-identity from settings',
    from: String.raw`        {tab === 'settings' && (
          <div>
          <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>
            <section className="card visual-identity-panel" id="visual-identity">
              <header><div><span className="section-eyebrow">Identità del sito</span><h2>Scegli nome e immagine</h2><p>Il cliente decide come presentarsi: il nome scritto qui resta prioritario e non viene sostituito dalle successive importazioni social.</p></div><a className="btn btn-outline" href={siteUrl} target="_blank" rel="noopener">Vedi anteprima ↗</a></header>
              <form className="site-name-editor" onSubmit={saveSiteTitle}>
                <label htmlFor="site-title"><strong>Nome del sito</strong><span>Comparirà nell’intestazione, nelle pagine e nei risultati condivisi.</span></label>
                <div><input id="site-title" type="text" maxLength={120} required value={siteTitleDraft} onChange={event => setSiteTitleDraft(event.target.value)} placeholder="Es. Studio Rossi, Casa Verde, Marco Bianchi" /><button className="btn btn-primary" type="submit" disabled={savingSiteTitle}>{savingSiteTitle ? 'Salvataggio…' : 'Salva nome'}</button></div>
              </form>
              <div className="visual-choice-intro"><strong>Immagine del sito</strong><span>Usa un logo se hai un marchio riconoscibile; scegli una foto per raccontare subito attività, luogo o persona.</span></div>
              <div className="visual-choice-grid" role="radiogroup" aria-label="Tipo di immagine del sito">
                {[
                  ['logo', 'Logo', 'Ideale per marchi e professionisti', logoUrl],
                  ['cover', 'Immagine rappresentativa', 'Ideale per luoghi, persone e attività', coverUrl],
                ].map(([mode, label, description, image]) => (
                  <button type="button" role="radio" aria-checked={brandVisualMode === mode} className={brandVisualMode === mode ? 'is-selected' : ''} onClick={() => selectBrandVisualMode(mode)} disabled={savingVisualMode} key={mode}>
                    <span className={'visual-choice-preview is-' + mode}>{image ? <img src={image} alt="" /> : <b>{mode === 'logo' ? 'LOGO' : 'IMMAGINE'}</b>}</span>
                    <span><strong>{label}</strong><small>{description}</small></span><i>{brandVisualMode === mode ? '✓' : ''}</i>
                  </button>
                ))}
              </div>
              <div className="visual-upload-row">
                <div><strong>{brandVisualMode === 'cover' ? 'Immagine orizzontale consigliata' : 'Logo quadrato o orizzontale'}</strong><span>{brandVisualMode === 'cover' ? 'JPG, PNG o WebP · massimo 8 MB · rapporto consigliato 16:9' : 'JPG, PNG o WebP · massimo 3 MB · sfondo trasparente consigliato'}</span></div>
                <label className="btn btn-primary">{uploadingLogo ? 'Caricamento…' : (brandVisualMode === 'cover' ? 'Carica immagine' : 'Carica logo')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => uploadSiteVisual(event, brandVisualMode)} disabled={uploadingLogo} /></label>
              </div>
            </section>
          </div>
            {isAdmin && (`,
    to: String.raw`        {tab === 'settings' && (
          <div>
            {isAdmin && (`
  },
  {
    desc: 'Change Apri Studio button',
    from: String.raw`                <button
                  className="btn btn-primary"
                  onClick={() => openStudioWorkspace(templateStudio, 'Workspace corrente')}
                  style={{ padding: '12px 20px', fontWeight: 700 }}
                >
                  Apri Studio
                </button>`,
    to: String.raw`                <button
                  className="btn btn-primary"
                  onClick={() => openStudioWorkspace(templateStudio, 'Workspace corrente')}
                  style={{ padding: '12px 20px', fontWeight: 700 }}
                >
                  Modifica sito pubblico
                </button>`
  },
  {
    desc: 'Insert renderAccountProfile call',
    from: String.raw`        {tab === 'security' && (`,
    to: String.raw`        {tab === 'account' && renderAccountProfile()}

        {tab === 'security' && (`
  }
];

let failed = false;
for (const change of changes) {
  // Try to match, sometimes String.raw has issues with exact matching if there are special characters that need to be exactly the same. But here the JS source is literal.
  // Wait, I changed the original code in chunk 5!
  // I replaced: \`\${brandVisualMode === 'cover' ? 'Carica immagine' : 'Carica logo'}\` with (brandVisualMode === 'cover' ? 'Carica immagine' : 'Carica logo') IN THE SEARCH STRING. That will fail to match!
  // Let's use indexOf instead to be safe, or just search part of the string.
}
