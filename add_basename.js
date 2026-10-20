const fs = require('fs');
let c = fs.readFileSync('frontend/openpage/src/App.tsx', 'utf8');
c = c.replace('<BrowserRouter>', '<BrowserRouter basename="/builder/">');
fs.writeFileSync('frontend/openpage/src/App.tsx', c, 'utf8');
console.log('Added basename to BrowserRouter');
