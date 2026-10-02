const fs = require('fs');
let c = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

c = c.replace(
  /id: "identity",\s*label: "🎨 Identità e Aspetto",\s*desc: "Logo, stile e impaginazione",/,
  'id: "openpage",\n                    label: "🎨 Costruttore Sito",\n                    desc: "Costruisci il tuo sito web in tempo reale",'
);

c = c.replace(
  /onClick=\{\(\) => setProfileSubTab\(opt\.id\)\}/,
  "onClick={() => {\n                      if (opt.id === 'openpage') { window.open('/builder/', '_blank'); } else { setProfileSubTab(opt.id); }\n                    }}"
);

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', c, 'utf8');
console.log('Replaced identity with openpage in DashboardScreen.jsx');
