const fs = require('fs');
const content = fs.readFileSync('api/services/ai.php', 'utf8');
const lines = content.split('\n');

// Remove lines at 0-based indices 623, 624, 625 (1-based: 624, 625, 626)
// These are the orphan: } catch (Exception $e) { / return ''; / }
const removed = lines.splice(623, 3);
console.log('Removed lines:');
removed.forEach((l, i) => console.log(624 + i, ':', l));

fs.writeFileSync('api/services/ai.php', lines.join('\n'));
console.log('Done. Total lines now:', lines.length);
