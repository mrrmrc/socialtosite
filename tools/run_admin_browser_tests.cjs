// Local fixtures only. Requires Playwright on NODE_PATH and a browser installed.
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk; });
server.stderr.on('data', chunk => { serverOutput += chunk; });
server.on('error', error => { serverOutput += error.message; });
(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite stopped: ' + serverOutput);
    try { ready = (await fetch('http://127.0.0.1:5178', { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('Vite not ready: ' + serverOutput);
  for (const test of ['test_admin_browser.cjs', 'test_control_room.cjs', 'test_admin_shell.cjs']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, test)], { cwd: root, windowsHide: true, stdio: 'inherit', env: process.env, timeout: 120000 });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(test + ' failed: ' + result.status);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => { server.kill(); });
