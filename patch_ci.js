const fs = require('fs');

// Fix deploy-staging.yml
let c = fs.readFileSync('.github/workflows/deploy-staging.yml', 'utf8');
c = c.replace(
  'npm run build',
  'npm run build\n          cd ../frontend/openpage\n          npm install --legacy-peer-deps\n          npm run build'
);
fs.writeFileSync('.github/workflows/deploy-staging.yml', c);

// Fix deploy.yml
let c2 = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
c2 = c2.replace(
  'npm run build',
  'npm run build\n          cd openpage\n          npm install --legacy-peer-deps\n          npm run build'
);
c2 = c2.replace(
  'cp -r frontend/dist/. release/',
  'cp -r frontend/dist/. release/\n          mkdir -p release/builder\n          cp -r frontend/openpage/dist/. release/builder/'
);
fs.writeFileSync('.github/workflows/deploy.yml', c2);

// Fix Dockerfile
let c3 = fs.readFileSync('Dockerfile', 'utf8');
c3 = c3.replace(
  'RUN npm run build',
  'RUN npm run build\nRUN cd openpage && npm install --legacy-peer-deps && npm run build'
);
c3 = c3.replace(
  'COPY --from=frontend-builder /app/dist/ ./',
  'COPY --from=frontend-builder /app/dist/ ./\nCOPY --from=frontend-builder /app/openpage/dist/ ./builder/'
);
fs.writeFileSync('Dockerfile', c3);

console.log('Fixed CI and Docker config');
