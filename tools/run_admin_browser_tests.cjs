// Local fixtures only. Requires Playwright on NODE_PATH and a browser installed.
const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], { cwd: path.join(root, 'frontend'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
let serverError = null;
const captureServerOutput = chunk => { serverOutput = (serverOutput + chunk).slice(-8000); };
server.stdout.on('data', captureServerOutput);
server.stderr.on('data', captureServerOutput);
server.on('error', error => { serverError = error; captureServerOutput(error.message); });

function runTest(test) {
  console.log('[admin-browser] Starting ' + test);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, test)], { cwd: root, windowsHide: true, stdio: 'inherit', env: process.env });
    let finished = false, timedOut = false, forceTimer;
    const finish = error => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      if (error) reject(error);
      else {
        console.log('[admin-browser] Passed ' + test + ' (' + ((Date.now() - started) / 1000).toFixed(1) + 's)');
        resolve();
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceTimer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error(test + ' timed out after 120s (forced termination)'));
      }, 2000);
    }, 120000);
    child.once('error', error => finish(new Error(test + ': ' + error.message)));
    child.once('exit', (code, signal) => finish(timedOut
      ? new Error(test + ' timed out after 120s')
      : code === 0 ? null : new Error(test + ' failed: ' + (signal || code))));
  });
}

(async () => {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) throw new Error('Vite stopped: ' + server.exitCode);
    // Only probe the server started by this runner, never a different process on this port.
    if (serverOutput.replace(/\u001b\[[0-9;]*m/g, '').includes('Local:')) {
      try { ready = (await fetch('http://127.0.0.1:5178', { signal: AbortSignal.timeout(500) })).ok; } catch {}
    }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('Vite not ready');
  console.log('[admin-browser] Vite ready; running administration tests.');
  for (const test of ['test_admin_browser.cjs', 'test_control_room.cjs', 'test_admin_shell.cjs', 'test_lia_workspace.cjs']) {
    await runTest(test);
  }
})().catch(error => {
  console.error('[admin-browser] ' + error.message);
  if (serverOutput.trim()) console.error('[admin-browser] Last Vite output (max 8000 characters):\n' + serverOutput);
  process.exitCode = 1;
}).finally(() => { server.kill(); });
