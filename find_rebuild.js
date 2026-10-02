const fs = require('fs');
const code = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');
const lines = code.split('\n');
const idx = lines.findIndex(l => l.includes('rebuildSeoFoundation'));
if (idx > -1) console.log(lines.slice(idx - 5, idx + 15).join('\n'));
else console.log('not found');
