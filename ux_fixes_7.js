const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

const s1 = `            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              {[
                ['01', 'Orientamento immediato', 'Home, articoli, argomenti e informazioni mantengono sempre una posizione riconoscibile.'],
                ['02', 'Lettura accessibile', 'Testi, contrasti, focus visibile e spaziature seguono regole comuni e verificabili.'],
                ['03', 'Mobile prima di tutto', 'Menu, schede e azioni si adattano senza nascondere i contenuti importanti.'],
                ['04', 'Identità autentica', 'Il sito usa il tuo marchio e il tuo patrimonio social, senza layout casuali generati.'],
              ].map(([number, title, description]) => <article className="card" key={number} style={{ padding: '1.25rem', border: '1px solid var(--border)' }}><span style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '12px' }}>{number}</span><h3 style={{ margin: '0.55rem 0', color: 'var(--text)', fontSize: '17px' }}>{title}</h3><p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.65 }}>{description}</p></article>)}
            </div>`;

code = code.replace(s1, '');
code = code.replace(s1.replace(/\n/g, '\r\n'), '');

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code);
