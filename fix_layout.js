const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/components/ProSiteBuilder.jsx');
let content = fs.readFileSync(file, 'utf8');

// The original grid layout started at `gridTemplateColumns: '72px 1fr'`
// We want `380px 1fr` and only 2 children: `<aside>` (the unified sidebar) and the preview wrapper.

// Let's replace the Workspace container down to the end of Panel Header
const startMarker = `{/* ── Workspace ── */}`;
const endMarker = `{/* Panel content */}`;

const unifiedSidebar = `{/* ── Workspace ── */}
        <div style={{ display: 'grid', gridTemplateColumns: panelVisible ? '380px 1fr' : '0 1fr', minHeight: 0, transition: 'grid-template-columns .25s ease', position: 'relative' }}>

          {/* Show Panel Button when hidden */}
          {!panelVisible && (
            <button
              type="button"
              onClick={() => setPanelVisible(true)}
              style={{
                position: 'absolute', top: 20, left: 20, zIndex: 10,
                padding: '12px 18px', borderRadius: 12,
                background: 'var(--primary)', color: '#fff',
                border: 'none', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              <span>🛠</span> Strumenti
            </button>
          )}

          {/* ── Unified Detail Panel ── */}
          <aside style={{
            display: 'flex', flexDirection: 'column',
            width: '100%', height: '100%',
            overflowY: 'hidden', overflowX: 'hidden',
            borderRight: '2px solid var(--border-strong)',
            background: 'var(--surface)',
            opacity: panelVisible ? 1 : 0,
            transition: 'opacity .2s ease',
          }}>
            
            {/* Panel header with Unified Tool Tabs */}
            <div style={{
              flexShrink: 0,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border-strong)',
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>Strumenti</div>
                <button type="button" onClick={() => setPanelVisible(false)} style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer'
                }}>✕</button>
              </div>
              
              {/* Horizontal Tool Tabs */}
              <div style={{
                display: 'flex', gap: 6, padding: '0 18px 12px',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none'
              }}>
                {TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setSection(tool.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 99, flexShrink: 0,
                      background: section === tool.id ? 'var(--primary)' : 'var(--bg)',
                      color: section === tool.id ? '#fff' : 'var(--text)',
                      border: '1px solid ' + (section === tool.id ? 'var(--primary)' : 'var(--border)'),
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      transition: 'all .15s ease'
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{tool.icon}</span>
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Click-on-preview hint */}
            <div style={{
              margin: '12px 18px 0', padding: '9px 12px', borderRadius: 10,
              background: 'var(--primary-light)', border: '1px solid var(--primary)',
              fontSize: 11, lineHeight: 1.5, color: 'var(--primary-dark)',
            }}>
              <strong>Clicca direttamente sul sito</strong> nell'anteprima per passare subito allo strumento giusto.
            </div>

            {/* Panel content scrollable */}`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + unifiedSidebar + content.substring(endIndex);
}

// Now we need to remove the extra `</div>` at the very end of Workspace because we removed the nesting `Main Area` div.
// Original structure ended with:
/*
        </div>
      </div>
    </>
*/
// The Workspace `</div>` should now just be one level deep.
content = content.replace(/<\/div>\s*<\/div>\s*<\/>/, "</div>\n    </>");

// Fix LIA colors (the old script logic)
content = content.replace(
  /background: msg\.role === 'user' \? 'rgba\(37,99,235,\.2\)' : 'rgba\(255,255,255,\.05\)'/g,
  "background: msg.role === 'user' ? 'var(--primary-light)' : 'var(--bg)'"
);
content = content.replace(
  /border: msg\.role === 'user' \? '1px solid rgba\(96,165,250,\.3\)' : '1px solid rgba\(255,255,255,\.1\)'/g,
  "border: msg.role === 'user' ? '1px solid var(--primary)' : '1px solid var(--border)'"
);
content = content.replace(
  /color: msg\.role === 'user' \? '#bfdbfe' : '#e2e8f0'/g,
  "color: 'var(--text)'"
);
content = content.replace(
  /color: '#93c5fd'/g,
  "color: 'var(--primary)'"
);
content = content.replace(
  /background: 'rgba\(0,0,0,\.2\)'/g,
  "background: 'var(--surface)'"
);

fs.writeFileSync(file, content);
console.log('Fixed Layout!');
