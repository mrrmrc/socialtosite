const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// 1. Add 'presence' to Profile Sub-Tabs
code = code.replace(
  /\{\s*id:\s*'who'.*?\},[\s\n]*\{\s*id:\s*'identity'.*?\},/g,
  `{ id: 'who', label: '✍️ Stile Editoriale', desc: "Istruisci l'AI su come scrivere" },
                { id: 'presence', label: '🌐 Presenza e Contatti', desc: 'Sito ufficiale, territori e recapiti' },
                { id: 'identity', label: '🎨 Identità e Aspetto', desc: 'Logo, stile e impaginazione' },`
);

// 2. Remove the 4 cards from identity
const cardsRegex = /<div style=\{\{\s*display:\s*'grid',\s*gridTemplateColumns:\s*'repeat\(auto-fit,\s*minmax\(210px,\s*1fr\)\)',\s*gap:\s*'1rem'\s*\}\}>[\s\S]*?\.map\(\[number, title, description\] => <article className="card"[\s\S]*?<\/article>\)\}<\/div>/;
code = code.replace(cardsRegex, '');

// 3. Extract presence-setup from SEO tab
const setupRegex = /<section className="presence-setup">[\s\S]*?<\/section>/;
const match = code.match(setupRegex);
if (match) {
  const presenceSetupHtml = match[0];
  // Remove it from SEO
  code = code.replace(presenceSetupHtml, '');
  
  // Inject it into Profile tab
  const targetSplit = "\n        {(tab === 'seo' && visibilitySection === 'network') && <div className=\"presence-workspace\">";
  const insertion = `\n        {(tab === 'profile' && profileSubTab === 'presence') && (
          <div className="presence-workspace">
            ${presenceSetupHtml.replace(/\$/g, '$$$$')}
          </div>
        )}\n`;
  code = code.replace(targetSplit, insertion + targetSplit);
  console.log("Injected successfully");
} else {
  console.log("Could not find presence-setup");
}

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code);
