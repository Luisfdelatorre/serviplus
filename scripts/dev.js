/**
 * Arranca servidor y cliente (Vite) a la vez para desarrollo: `npm run dev`.
 *
 * - Servidor: `node --watch server/index.js` con NODE_ENV=development
 *   (sin asistente de setup ni licencia obligatoria).
 * - Cliente: Vite con HMR (client/).
 * Ctrl+C detiene ambos. Si uno termina, se detiene el otro.
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const env = { ...process.env, NODE_ENV: 'development' };

const procs = [
  { name: 'server', color: '\x1b[36m', cmd: process.execPath, args: ['--watch', '--watch-path=server', 'server/index.js'], cwd: ROOT },
  { name: 'client', color: '\x1b[35m', cmd: isWin ? 'npm.cmd' : 'npm', args: ['run', 'dev'], cwd: path.join(ROOT, 'client'), shell: isWin }
];

const children = [];
let shuttingDown = false;

function prefixLines(proc, stream, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) target.write(`${proc.color}[${proc.name}]\x1b[0m ${line}\n`);
  });
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

for (const proc of procs) {
  const child = spawn(proc.cmd, proc.args, { cwd: proc.cwd, env, shell: proc.shell, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  prefixLines(proc, child.stdout, process.stdout);
  prefixLines(proc, child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) console.log(`[${proc.name}] terminó (código ${code}). Deteniendo el resto...`);
    shutdown(code || 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
