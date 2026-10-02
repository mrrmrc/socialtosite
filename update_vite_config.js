const fs = require('fs');
let c = fs.readFileSync('frontend/vite.config.js', 'utf8');
c = c.replace("import react from '@vitejs/plugin-react'", "import react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'");
c = c.replace('plugins: [react()]', 'plugins: [react(), tailwindcss()]');
fs.writeFileSync('frontend/vite.config.js', c);
console.log('Updated vite.config.js');
