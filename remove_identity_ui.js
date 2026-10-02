const fs = require('fs');

let code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');

// 1. Remove identity option from profile tabs
code = code.replace(
  "{ id: 'identity', label: '🎨 Identità e Aspetto', desc: 'Logo, stile e impaginazione' },",
  ""
);

// 2. Remove the profileSubTab === 'identity' rendering section
// It starts at `{(tab === 'profile' && profileSubTab === 'identity') && (`
const idStart = code.indexOf("{(tab === 'profile' && profileSubTab === 'identity') && (");
if (idStart > -1) {
  // Let's find the end of this block. It probably ends with `)}` at the same indentation.
  // We'll write a simple brace matcher.
  let openBraces = 0;
  let idEnd = -1;
  let inJSX = false;
  for (let i = idStart; i < code.length; i++) {
    if (code[i] === '{') openBraces++;
    if (code[i] === '}') {
      openBraces--;
      if (openBraces === 0) {
        idEnd = i + 1;
        break;
      }
    }
  }
  if (idEnd > -1) {
    code = code.substring(0, idStart) + code.substring(idEnd);
  }
}

// Check for another identity block if there is one
const idStart2 = code.indexOf("{(tab === 'profile' && profileSubTab === 'identity') && (");
if (idStart2 > -1) {
  let openBraces = 0;
  let idEnd = -1;
  for (let i = idStart2; i < code.length; i++) {
    if (code[i] === '{') openBraces++;
    if (code[i] === '}') {
      openBraces--;
      if (openBraces === 0) {
        idEnd = i + 1;
        break;
      }
    }
  }
  if (idEnd > -1) {
    code = code.substring(0, idStart2) + code.substring(idEnd);
  }
}

// 3. Remove "Gestisci l'aspetto" button
code = code.replace(
  /<button className="btn btn-outline" onClick=\{\(\) => \{ setTab\('profile'\); setProfileSubTab\('themes'\); setMobileMenuOpen\(false\); \}\}>Gestisci l’aspetto<\/button>/g,
  ""
);

// 4. Remove automatic page generation:
// 4a. Remove rebuildSeoFoundation button from 'Pagine fondamentali gestite dal sistema'
// This whole glass-modal can probably be removed. Let's find "Pagine fondamentali gestite dal sistema"
const pgsStart = code.indexOf('<h3 style={{ margin: \'0 0 0.4rem\', color: \'var(--text)\' }}>Pagine fondamentali gestite dal sistema</h3>');
if (pgsStart > -1) {
  // Find the enclosing div.glass-modal
  const divStart = code.lastIndexOf('<div className="glass-modal"', pgsStart);
  if (divStart > -1) {
    let openTags = 0;
    let divEnd = -1;
    // We'll just manually match div tags or use string slicing up to the next <div className="glass-modal"
    const nextDivStart = code.indexOf('<div className="glass-modal"', pgsStart);
    if (nextDivStart > -1) {
      code = code.substring(0, divStart) + code.substring(nextDivStart);
    }
  }
}

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', code, 'utf8');
console.log('Removed identity tab and SEO pages section');
