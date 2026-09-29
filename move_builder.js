const fs = require('fs');
const lines = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('<ProSiteBuilder user={user} open={studioWorkspaceOpen && !isAdmin}'));

let depth = 0;
let realEndIndex = startIndex;
let foundStart = false;
for (let i = startIndex; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('{studioWorkspaceOpen && isAdmin && (')) foundStart = true;
  if (foundStart) {
    for (let char of line) {
      if (char === '{' || char === '(') depth++;
      if (char === '}' || char === ')') depth--;
    }
    if (depth === 0) {
      realEndIndex = i;
      break;
    }
  }
}

if (!foundStart || realEndIndex === startIndex) {
  console.log('Error calculating real end index');
  process.exit(1);
}

const extractedBlock = lines.slice(startIndex, realEndIndex + 1).join('\n');
console.log('Extracted block length:', extractedBlock.length);

lines.splice(startIndex, realEndIndex - startIndex + 1);

const socialIndex = lines.findIndex(l => l.includes('{socialComposer && ('));
if (socialIndex === -1) {
  console.log('Could not find socialComposer');
  process.exit(1);
}

lines.splice(socialIndex, 0, extractedBlock + '\n');

fs.writeFileSync('frontend/src/screens/DashboardScreen.jsx', lines.join('\n'));
console.log('Successfully moved ProSiteBuilder block');
