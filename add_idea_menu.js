const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// 1. Add "IDEA 💡" to navigationGroups
const navGroupsStart = code.indexOf("const navigationGroups = user?.role === 'admin' ? [");
const navGroupsEnd = code.indexOf("];", navGroupsStart) + 2;

if (navGroupsStart > -1 && code.indexOf("{ id: 'idea'") === -1) {
    let groupsStr = code.substring(navGroupsStart, navGroupsEnd);
    const adminInsertPoint = groupsStr.indexOf("],", groupsStr.indexOf("label: 'Amministrazione',"));
    groupsStr = groupsStr.substring(0, adminInsertPoint) + 
      ",\n        { id: 'idea', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z\"/></svg>, label: 'IDEA 💡', hint: 'Genera contenuti con l\\'AI' }" +
      groupsStr.substring(adminInsertPoint);
      
    const mainInsertPoint = groupsStr.indexOf("],", groupsStr.indexOf("label: 'Menu Principale',"));
    groupsStr = groupsStr.substring(0, mainInsertPoint) + 
      ",\n        { id: 'idea', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><path d=\"M9 18h6\"/><path d=\"M10 22h4\"/><path d=\"M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z\"/></svg>, label: 'IDEA 💡', hint: 'Genera contenuti con l\\'AI' }" +
      groupsStr.substring(mainInsertPoint);

    code = code.substring(0, navGroupsStart) + groupsStr + code.substring(navGroupsEnd);
}

// 2. Add state for IDEA generator
const stateInsertPoint = code.indexOf("const [viewMode, setViewMode] = useState('grid');");
if (stateInsertPoint > -1 && code.indexOf('const [ideaGenState') === -1) {
    const states = `
  const [ideaGenState, setIdeaGenState] = useState({ 
    argomento: '', 
    usa_profilo: false, 
    links: '', 
    loading: false, 
    variants: null,
    error: null,
    savingVariantIndex: -1
  });
  
  async function generateIdeaTexts() {
    setIdeaGenState(prev => ({ ...prev, loading: true, error: null, variants: null }));
    try {
      const res = await apiFetch('/api/index.php?action=generate-ai-texts', {
        method: 'POST',
        body: JSON.stringify({ 
          argomento: ideaGenState.argomento, 
          usa_profilo: ideaGenState.usa_profilo, 
          links: ideaGenState.links 
        })
      }, token);
      if (res.variants && res.variants.length >= 2) {
        setIdeaGenState(prev => ({ ...prev, loading: false, variants: res.variants }));
      } else {
        throw new Error('Formato risposta non valido.');
      }
    } catch (err) {
      setIdeaGenState(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }
  
  async function saveIdeaVariant(variant, index) {
    setIdeaGenState(prev => ({ ...prev, savingVariantIndex: index }));
    try {
      await apiFetch('/api/index.php?action=post-create', {
        method: 'POST',
        body: JSON.stringify({
          edited_title: variant.title,
          edited_body: variant.content
        })
      }, token);
      await loadData();
      setTab('site');
      setIdeaGenState({ argomento: '', usa_profilo: false, links: '', loading: false, variants: null, error: null, savingVariantIndex: -1 });
    } catch (err) {
      setSyncMsg({ ok: false, text: err.message });
      setIdeaGenState(prev => ({ ...prev, savingVariantIndex: -1 }));
    }
  }
  
`;
    code = code.substring(0, stateInsertPoint) + states + code.substring(stateInsertPoint);
}

// 3. Add UI for IDEA tab
const uiInsertPoint = code.indexOf("{tab === 'overview' && (");
if (uiInsertPoint > -1 && code.indexOf("tab === 'idea'") === -1) {
    const ui = `
            {tab === 'idea' && (
              <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <header style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z"/></svg>
                    Idea e Scrittura AI
                  </h2>
                  <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>Fai generare all'AI 2 brani/testi. Dalle istruzioni e scegli la variante migliore per i tuoi Articoli.</p>
                </header>
                
                {!ideaGenState.variants ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>Di cosa vuoi scrivere? (Argomento)</span>
                      <textarea className="form-input" rows={2} value={ideaGenState.argomento} onChange={e => setIdeaGenState(p => ({...p, argomento: e.target.value}))} placeholder="Es. I 3 errori più comuni nel mio settore..." />
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <input type="checkbox" checked={ideaGenState.usa_profilo} onChange={e => setIdeaGenState(p => ({...p, usa_profilo: e.target.checked}))} style={{ width: '20px', height: '20px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '600' }}>Usa il mio profilo e Internet</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>L'AI baserà il testo sulla tua identità e cercherà aggiornamenti in tempo reale su Google per arricchirlo.</span>
                      </div>
                    </label>
                    
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>Link di spunto (Opzionali)</span>
                      <textarea className="form-input" rows={3} value={ideaGenState.links} onChange={e => setIdeaGenState(p => ({...p, links: e.target.value}))} placeholder="Incolla qui gli URL (uno per riga) da cui prendere ispirazione o informazioni." />
                    </label>
                    
                    {ideaGenState.error && (
                      <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        {ideaGenState.error}
                      </div>
                    )}
                    
                    <button className="btn btn-primary" onClick={generateIdeaTexts} disabled={ideaGenState.loading || (!ideaGenState.argomento.trim() && !ideaGenState.links.trim())} style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem' }}>
                      {ideaGenState.loading ? 'Generazione in corso (può richiedere fino a 1 minuto)...' : '✨ Genera 2 Varianti'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button className="btn btn-outline" onClick={() => setIdeaGenState(p => ({...p, variants: null}))} style={{ marginBottom: '1.5rem' }}>← Cambia richiesta</button>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                      {ideaGenState.variants.map((variant, i) => (
                        <div key={i} style={{ padding: '1.5rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <h3 style={{ margin: '0 0 1rem', color: 'var(--primary)' }}>Variante {i + 1}: {variant.title}</h3>
                          <div style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: '1.6', maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '0.5rem' }} dangerouslySetInnerHTML={{ __html: variant.content }} />
                          <button className="btn btn-primary" style={{ width: '100%' }} disabled={ideaGenState.savingVariantIndex !== -1} onClick={() => saveIdeaVariant(variant, i)}>
                            {ideaGenState.savingVariantIndex === i ? 'Salvataggio...' : '✓ Scegli e vai agli Articoli'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
`;
    code = code.substring(0, uiInsertPoint) + ui + code.substring(uiInsertPoint);
}

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code, 'utf8');
console.log('Done!');
