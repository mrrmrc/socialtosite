const fs = require('fs');
const path = require('path');

const file = path.join('frontend', 'src', 'screens', 'DashboardScreen.jsx');
let content = fs.readFileSync(file, 'utf8');

// Find the opening of the experience tab grid
// We look for the line: {tab === 'experience' && (
// then the next line: <div style={{ display: 'grid', gap: '1rem' }}>
// then insert our banner before the first <section className="card"

const MARKER = `{tab === 'experience' && (\r
          <div style={{ display: 'grid', gap: '1rem' }}>\r
            <section className="card" style={{ padding: 'clamp(1.25rem, 3vw, 2rem)', background: 'linear-gradient(135deg, var(--surface), var(--primary-light))', border: '1px solid var(--border)' }}>`;

const REPLACEMENT = `{tab === 'experience' && (\r
          <div style={{ display: 'grid', gap: '1rem' }}>\r
            {/* MODIFICA SITO — azione principale sempre visibile */}\r
            <section style={{\r
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',\r
              gap: '1.5rem', flexWrap: 'wrap',\r
              padding: 'clamp(1.25rem, 3vw, 2rem)',\r
              borderRadius: 'var(--radius-lg)',\r
              background: 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',\r
              boxShadow: '0 8px 32px rgba(79,140,255,0.28)',\r
            }}>\r
              <div>\r
                <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Sito pubblico</span>\r
                <h2 style={{ color: '#fff', margin: '0.4rem 0 0.5rem', fontSize: 'clamp(20px, 3vw, 28px)', lineHeight: 1.15 }}>Modifica il tuo sito</h2>\r
                <p style={{ color: 'rgba(255,255,255,0.82)', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>\r
                  Apri l&apos;editor per personalizzare layout, colori, testi, menu e struttura del tuo sito pubblico.\r
                </p>\r
              </div>\r
              <button\r
                type="button"\r
                style={{\r
                  background: '#fff', color: 'var(--primary)', fontWeight: 800,\r
                  padding: '14px 28px', fontSize: '16px', flexShrink: 0,\r
                  border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',\r
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',\r
                }}\r
                onClick={() => openStudioWorkspace(templateStudio, 'Workspace corrente')}\r
              >\r
                ✏️ Apri editor sito →\r
              </button>\r
            </section>\r
            <section className="card" style={{ padding: 'clamp(1.25rem, 3vw, 2rem)', background: 'linear-gradient(135deg, var(--surface), var(--primary-light))', border: '1px solid var(--border)' }}>`;

if (!content.includes(MARKER)) {
  console.error('MARKER NOT FOUND. Trying without \\r...');
  const MARKER2 = MARKER.replace(/\r\n/g, '\n');
  if (!content.includes(MARKER2)) {
    console.error('MARKER2 also not found. Dumping first 200 chars around "experience":');
    const idx = content.indexOf("tab === 'experience'");
    console.log(JSON.stringify(content.slice(idx, idx + 400)));
    process.exit(1);
  }
  const REPLACEMENT2 = REPLACEMENT.replace(/\r\n/g, '\n');
  content = content.replace(MARKER2, REPLACEMENT2);
  console.log('Replaced with LF version');
} else {
  content = content.replace(MARKER, REPLACEMENT);
  console.log('Replaced with CRLF version');
}

fs.writeFileSync(file, content);
console.log('Done - banner inserted successfully');
