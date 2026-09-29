const fs=require('fs'); 
const lines=fs.readFileSync('produzione.sql', 'utf8').split('\n'); 
const found = lines.filter(l => l.includes('declared_strategy'));
console.log('Found:', found.length);
console.log(found.join('\n'));
