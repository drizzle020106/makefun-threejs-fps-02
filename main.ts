// main.ts — Dustline Protocol (make.fun threejs-fps-02 entry)
// Node 22+ program at the repo root. It validates the entry's files and
// serves the playable game (game/) as static files on localhost.
//   node main.ts            serve game/ on http://localhost:8123
//   node main.ts --port 9000
//   node main.ts --check    validate files only, then exit (0 = ok)
// No build step, no network requests, no wallet, no signing.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)));

const REQUIRED: string[] = [
  'game/index.html',
  'game/game.js',
  'game/config.js',
  'game/vendor/three.module.js',
  'game/vendor/three.core.js',
  'vendor/makefun-threejs.ts',
  'screenshots/cover.png',
  'screenshots/gameplay.png',
  'DOSSIER.md',
  'dossier.json',
  'README.md',
  'LICENSE',
  'TRANSCRIPT.md',
];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
};

async function validate(): Promise<string[]> {
  const missing: string[] = [];
  for (const rel of REQUIRED) {
    try {
      const s = await stat(join(ROOT, rel));
      if (!s.isFile()) missing.push(rel + ' (not a file)');
    } catch {
      missing.push(rel);
    }
  }
  return missing;
}

function parseArgs(argv: string[]): { port: number; check: boolean } {
  let port = 8123;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    if (argv[i] === '--port' && argv[i + 1]) port = Number(argv[i + 1]);
  }
  return { port, check };
}

const { port, check } = parseArgs(process.argv.slice(2));
const missing = await validate();
if (missing.length > 0) {
  console.error('VALIDATION FAILED — missing files:');
  for (const m of missing) console.error('  - ' + m);
  process.exit(1);
}
console.log('Validation OK: ' + REQUIRED.length + ' required files present.');
if (check) {
  console.log('Check passed. Serve the game with: node main.ts');
  process.exit(0);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = join(ROOT, 'game', rel);
    if (!file.startsWith(join(ROOT, 'game'))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(port, () => {
  console.log('Dustline Protocol — Tactical FPS');
  console.log('Serving game/ at http://localhost:' + port + '/');
  console.log('Open it in desktop Chrome, click DEPLOY, and play (WASD + mouse, click to shoot).');
  console.log('Demo/screenshot mode (autopilot, no pointer lock): http://localhost:' + port + '/?demo=1');
});
