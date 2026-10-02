const fs = require('fs');
let file = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

file = file.replace(
  /\{\s*id:\s*'network',\s*label:\s*'🌍 Rete e Presenza',[^}]+},\s*\{\s*id:\s*'identity',\s*label:\s*'🎨 Identità visiva',[^}]+},\s*\{\s*id:\s*'themes',\s*label:\s*'✨ Temi del sito',[^}]+},/g,
  "{ id: 'identity', label: '🎨 Identità e Aspetto', desc: 'Logo, stile e impaginazione' },"
);

file = file.replace(
  /profileSubTab === 'who' \? 'Il tuo stile editoriale' :[\s\S]*?profileSubTab === 'identity' \? 'L\\'identità del tuo sito' : 'Scegli il layout ideale'/g,
  "profileSubTab === 'who' ? 'Il tuo stile editoriale' : 'Identità e Layout del tuo sito'"
);

file = file.replace(
  /profileSubTab === 'who' \? 'Le informazioni inserite qui istruiscono l\\'AI su come presentare il tuo progetto.' :[\s\S]*?profileSubTab === 'identity' \? 'Personalizza il logo, i contatti e i banner che compaiono sul tuo sito web.' :[\s\S]*?'Guarda in anteprima decine di design professionali prima di applicarli.'/g,
  "profileSubTab === 'who' ? 'Le informazioni inserite qui istruiscono l\\'AI su come presentare il tuo progetto.' : 'Personalizza il logo, i contatti e scegli il design professionale più adatto per i tuoi contenuti.'"
);

file = file.replace(
  /<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(auto-fill, minmax\(280px, 1fr\)\)', gap: '1\.5rem' \}\}>/g,
  "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>"
);

// We need to replace the theme preview card HTML to include the CSS miniature and make it more compact.
const oldGridCardStart = `{visibleSiteLayouts.map(layout => (`;
const newGridCardCode = \`{visibleSiteLayouts.map(layout => (
                  <div key={layout.id}
                    style={{ 
                      border: selectedTheme === layout.id ? '2px solid var(--primary)' : '1px solid var(--border-strong)', 
                      borderRadius: 'var(--radius)', 
                      padding: '1rem', 
                      background: selectedTheme === layout.id ? 'rgba(0,240,255,0.05)' : 'rgba(255,255,255,0.02)', 
                      position: 'relative', 
                      cursor: 'pointer', 
                      transition: 'all 0.3s ease', 
                      boxShadow: selectedTheme === layout.id ? '0 0 20px rgba(0, 240, 255, 0.2)' : 'none',
                      display: 'flex', flexDirection: 'column'
                    }} 
                    onClick={() => openThemePreview(layout)}>
                    
                    {selectedTheme === layout.id && <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--primary)', color: '#000', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, zIndex: 10, boxShadow: '0 0 10px rgba(0,240,255,0.5)' }}>✓</div>}
                    
                    {/* CSS Mini-Preview */}
                    <div style={{ width: '100%', aspectRatio: '16/10', borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: layout.colors[0] || '#fff', border: '1px solid rgba(0,0,0,0.1)' }}>
                       <div style={{ height: '20%', background: layout.colors[1] || '#eee', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
                          <div style={{ width: '20%', height: '40%', background: 'rgba(0,0,0,0.2)', borderRadius: '2px' }} />
                       </div>
                       <div style={{ flex: 1, padding: '10px', display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                             <div style={{ width: '80%', height: '20%', background: layout.colors[2] || '#ccc', borderRadius: '2px' }} />
                             <div style={{ width: '100%', height: '10%', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }} />
                             <div style={{ width: '90%', height: '10%', background: 'rgba(0,0,0,0.1)', borderRadius: '2px' }} />
                          </div>
                          <div style={{ flex: 1, background: layout.colors[1] || '#eee', borderRadius: '4px' }} />
                       </div>
                    </div>
                    
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', marginBottom: '6px', padding: '3px 6px', borderRadius: '999px', background: 'var(--surface)', color: 'var(--primary)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{layout.category}</div>
                    <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px', color: 'var(--text)' }}>{layout.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem', minHeight: '36px', lineHeight: 1.4, fontWeight: 500, flex: 1 }}>{layout.desc}</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                      <button className={selectedTheme === layout.id ? "btn btn-primary btn-full" : "btn btn-outline btn-full"} style={{ fontSize: '13px', padding: '8px', fontWeight: 700 }}>
                        {selectedTheme === layout.id ? 'Attivo' : 'Vedi'}
                      </button>
                    </div>
                  </div>
                ))}\`;

file = file.replace(/\{visibleSiteLayouts\.map\(layout => \([\s\S]*?\}\)\}/, newGridCardCode);

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', file);
