const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Remove renderAccountHub
const accountHubStart = lines.findIndex(l => l.includes('const renderAccountHub = () => {'));
if (accountHubStart !== -1) {
  let accountHubEnd = -1;
  for (let i = accountHubStart; i < lines.length; i++) {
    if (lines[i] === '  };') {
      accountHubEnd = i;
      break;
    }
  }
  if (accountHubEnd !== -1) {
    lines.splice(accountHubStart, accountHubEnd - accountHubStart + 1);
  }
}

// 2. Add Strategy to Navigation
const navIdx = lines.findIndex(l => l.includes("{ id: 'overview', icon"));
if (navIdx !== -1) {
  const strategyItem = "        { id: 'strategy', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><circle cx=\"12\" cy=\"12\" r=\"6\"></circle><circle cx=\"12\" cy=\"12\" r=\"2\"></circle></svg>, label: 'Profilo Attività', hint: 'Strategia e obiettivi' },";
  lines.splice(navIdx, 0, strategyItem);
}

// 3. Remove 'account' from navigationGroups
const accountNavIdx = lines.findIndex(l => l.includes("{ id: 'account', icon"));
if (accountNavIdx !== -1) {
  lines.splice(accountNavIdx, 1);
}

// 4. Update Header: change Profilo button to Sicurezza
const headerIdx = lines.findIndex(l => l.includes("<button className=\"btn btn-outline\" onClick={() => setTab('account')}"));
if (headerIdx !== -1) {
  lines[headerIdx] = lines[headerIdx].replace("setTab('account')", "setTab('security')").replace("Profilo", "Sicurezza");
}

// 5. Remove `tab === 'account' && renderAccountHub()`
const accountTabIdx = lines.findIndex(l => l.includes("{tab === 'account' && renderAccountHub()}"));
if (accountTabIdx !== -1) {
  lines.splice(accountTabIdx, 1);
}

// 6. Move visual-identity-panel from experience to settings
const expStart = lines.findIndex(l => l.includes("{tab === 'experience' && ("));
let expEnd = -1;
let visualIdentityPanel = [];
if (expStart !== -1) {
  let inPanel = false;
  let panelLines = [];
  let bracketCount = 0;
  for (let i = expStart; i < lines.length; i++) {
    if (lines[i].includes('<section className="card visual-identity-panel"')) {
      inPanel = true;
    }
    if (inPanel) {
      panelLines.push(lines[i]);
      if (lines[i].includes('</section>')) {
        inPanel = false;
        visualIdentityPanel = [...panelLines];
        panelLines = [];
      }
    }
    
    // Find the end of experience tab
    // We count open/close brackets roughly or just look for the first line that matches the end of the div
    if (lines[i].includes('{tab === \'experience\' && (')) bracketCount++;
    if (lines[i].includes('(')) bracketCount += (lines[i].match(/\(/g) || []).length;
    if (lines[i].includes(')')) bracketCount -= (lines[i].match(/\)/g) || []).length;
    
    if (lines[i] === '        )}' && lines[i-1] === '          </div>') {
       expEnd = i;
       break;
    }
  }
  if (expEnd !== -1) {
    lines.splice(expStart, expEnd - expStart + 1);
  }
}

// 7. Insert visual identity panel into settings
const settingsIdx = lines.findIndex(l => l.includes("{tab === 'settings' && ("));
if (settingsIdx !== -1 && visualIdentityPanel.length > 0) {
  const insertIndex = settingsIdx + 2; // after <div>
  const wrapperStart = '          <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>';
  const wrapperEnd = '          </div>';
  lines.splice(insertIndex, 0, wrapperStart, ...visualIdentityPanel, wrapperEnd);
}

fs.writeFileSync(file, lines.join('\n'));
