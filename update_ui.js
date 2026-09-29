const fs = require('fs');
const file = 'frontend/src/screens/DashboardScreen.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const panel = fs.readFileSync('panel.txt', 'utf8');

// Delete lines 2742 to 3495
lines.splice(2742, 3495 - 2742 + 1);

// Find settings tab
const settingsIdx = lines.findIndex(l => l.includes("{tab === 'settings' && ("));
lines.splice(settingsIdx + 2, 0, '          <div style={{ display: "grid", gap: "1rem", marginBottom: "2rem" }}>\n' + panel + '\n          </div>');

// Find navigation overview item and add strategy before it
const navIdx = lines.findIndex(l => l.includes("{ id: 'overview'"));
const strategyItem = "        { id: 'strategy', icon: <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><circle cx=\"12\" cy=\"12\" r=\"6\"></circle><circle cx=\"12\" cy=\"12\" r=\"2\"></circle></svg>, label: 'Profilo Attività', hint: 'Strategia e obiettivi' },";
lines.splice(navIdx, 0, strategyItem);

fs.writeFileSync(file, lines.join('\n'));
