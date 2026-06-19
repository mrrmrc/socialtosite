const fs = require('fs');
const html = fs.readFileSync('frontend/index.html', 'utf8');
const lines = html.split('\n');
const start = lines.findIndex(l => l.includes('<script type="text/babel">'));
console.log('Script starts at index:', start);
for (let i = 308; i <= 315; i++) {
    console.log(i + ' | ' + lines[start + i - 1]);
}
