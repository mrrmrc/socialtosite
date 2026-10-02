const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/screens/DashboardScreen.jsx');

let code = fs.readFileSync(file, 'utf8');

// 1. Remove from profile subnav
const oldProfileNav = `{ id: 'network', label: '🌐 Rete e Presenza', desc: 'Rispondi una volta, il sistema usa tutto' },`;
code = code.replace(oldProfileNav, '');

// 2. Fix the title block for profileSubTab
const oldTitleCheck1 = `profileSubTab === 'network' ? 'Rispondi una volta, il sistema usa tutto' : `;
code = code.replace(oldTitleCheck1, '');

const oldTitleCheck2 = `profileSubTab === 'network' ? 'Queste informazioni vengono propagate su tutto il tuo network: sito, mappe e servizi collegati.' :`;
code = code.replace(oldTitleCheck2, '');

// 3. Add to seo subnav
const oldSeoNav = `['overview', 'Statistiche e pagine'],`;
const newSeoNav = `['overview', 'Statistiche e pagine'],
                  ['network', 'Rete e Presenza'],`;
code = code.replace(oldSeoNav, newSeoNav);

// 4. Change the rendering condition for presence-workspace
const oldWorkspaceCond = `{(tab === 'profile' && profileSubTab === 'network') && <div className="presence-workspace">`;
const newWorkspaceCond = `{(tab === 'seo' && visibilitySection === 'network') && <div className="presence-workspace">`;
code = code.replace(oldWorkspaceCond, newWorkspaceCond);

// 5. Change the old commented out modal condition just in case it exists (it was: {false && (tab === 'profile' && profileSubTab === 'network') && <>)
code = code.replace(/{false && \(tab === 'profile' && profileSubTab === 'network'\) && <>/g, `{false && (tab === 'seo' && visibilitySection === 'network') && <>`);

fs.writeFileSync(file, code, 'utf8');
console.log("Fixed dashboard layout!");
