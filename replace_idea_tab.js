const fs = require('fs');

let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// The start and end of `tab === 'idea'` block
const ideaStart = code.indexOf("{tab === 'idea' && (");
const ideaEnd = code.indexOf('</section>\n            )}', ideaStart) + '</section>'.length;

if (ideaStart > -1 && ideaEnd > ideaStart) {
  const originalManualBlock = code.substring(ideaStart, ideaEnd);
  
  // Extract just the inner logic of manual block (excluding the wrapper section and tab check)
  const manualInnerStart = originalManualBlock.indexOf('<header');
  const manualInner = originalManualBlock.substring(manualInnerStart);
  
  // We will also grab the exact `ideas-list` rendering from `visibilitySection === 'ideas'`
  const ideasListStart = code.indexOf('<ol className="ideas-list">');
  const ideasListEnd = code.indexOf('</ol>', ideasListStart) + '</ol>'.length;
  const ideasListContent = code.substring(ideasListStart, ideasListEnd);

  const newBlock = `{tab === 'idea' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        Articoli suggeriti da LIA oggi vuoi generarli?
                      </h2>
                      <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>LIA analizza il tuo profilo e le tue priorità per proporti 3 nuove idee.</p>
                    </div>
                    <button className="btn btn-primary" onClick={generateAiContentIdeas} disabled={generatingIdeas}>
                      {generatingIdeas ? 'Cerco e genero…' : '✦ Genera'}
                    </button>
                  </header>
                  
                  {contentIdeas.length > 0 && (
                    <div style={{ marginTop: '1.5rem' }}>
                      ${ideasListContent}
                    </div>
                  )}
                </section>

                <section className="card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <header style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.67 3.03 6.17a1 1 0 0 1 .37.78V17h7v-1.05a1 1 0 0 1 .37-.78C17.81 13.67 19 11.38 19 9a7 7 0 0 0-7-7z"/></svg>
                      Generazione manuale di 2 articoli
                    </h2>
                    <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>Indica a LIA fornendo o il titolo o una breve sintesi di quello che vuoi trattare 2 articoli che lei genererà. (italiano, formattazione, a tutto il resto pensa lei!)</p>
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
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>LIA baserà il testo sulla tua identità e cercherà aggiornamenti in tempo reale su Google per arricchirlo.</span>
                      </div>
                    </label>
                    
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>Hai qualche sito di riferimento? (Link di spunto opzionali)</span>
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
              </div>
`;

  code = code.substring(0, ideaStart) + newBlock + code.substring(ideaEnd);
  fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code, 'utf8');
  console.log('OK');
} else {
  console.log('Idea block not found');
}
