const fs = require('fs');
const c = fs.readFileSync('frontend/src/screens/DashboardScreen.jsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('<div') && (l.includes('flex') || l.includes('layout') || l.includes('main'))) {
    console.log(i, l.trim());
  }
});
