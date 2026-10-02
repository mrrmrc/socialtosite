const fs = require('fs');
let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

const setupRegex = /<section className="presence-setup">[\s\S]*?<\/section>/;
const match = code.match(setupRegex);
if (match) {
  const presenceSetupHtml = match[0];
  code = code.replace(presenceSetupHtml, '');
  
  const targetSplit = "\n        {(tab === 'seo' && visibilitySection === 'network') && <div className=\"presence-workspace\">";
  const insertion = `\n        {(tab === 'profile' && profileSubTab === 'presence') && (
          <div className="presence-workspace" style={{ padding: '0' }}>
            ${presenceSetupHtml.replace(/\$/g, '$$$$')}
          </div>
        )}\n`;
  code = code.replace(targetSplit, insertion + targetSplit);
  console.log("Injected successfully");
} else {
  console.log("Could not find presence-setup");
}

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code);
