// Test del server C# (Kestrel): file incorporati, API, --export-content e cartella "content".
// Uso: node tests/server.mjs   (richiede l'SDK .NET 8; compila per la piattaforma corrente, senza aprire il browser)
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'funbus-server-'));
const out = path.join(tmp, 'app'),
  home = path.join(tmp, 'home');
fs.mkdirSync(home, { recursive: true });
const env = { ...process.env, HOME: home, XDG_DATA_HOME: path.join(home, 'data'), DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' };
const errs = [];
const check = (ok, msg) => {
  if (!ok) errs.push(msg);
};

console.log('Compilazione…');
execFileSync('dotnet', ['build', '-c', 'Release', '-o', out, '--nologo', '-v', 'q'], { stdio: ['ignore', 'ignore', 'inherit'], env });
const exe = path.join(out, process.platform === 'win32' ? 'FunBus.exe' : 'FunBus');
check(fs.existsSync(exe), 'eseguibile non prodotto dalla compilazione');

const walk = (dir, base = dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e =>
      e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')],
    );
const files = walk('wwwroot');
const freePort = () =>
  new Promise(r => {
    const s = net.createServer().listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => r(p));
    });
  });

async function start() {
  const port = await freePort();
  const proc = spawn(exe, ['--no-browser', '--port', String(port)], { env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/ping')).ok) return { proc, base };
    } catch {
      /* non ancora pronto */
    }
    await new Promise(r => setTimeout(r, 150));
  }
  proc.kill();
  throw new Error('il server non risponde su ' + base);
}
const stop = s =>
  new Promise(r => {
    s.proc.once('exit', r);
    s.proc.kill();
  });

try {
  // 1. File incorporati e API
  let s = await start();
  for (const f of files) {
    const r = await fetch(`${s.base}/${f}`);
    const body = Buffer.from(await r.arrayBuffer());
    check(r.status === 200, `${f}: stato ${r.status} (file non incorporato nell'exe?)`);
    if (r.status === 200) check(body.equals(fs.readFileSync(path.join('wwwroot', f))), `${f}: contenuto diverso dal sorgente`);
  }
  const home1 = await fetch(s.base + '/');
  check(home1.status === 200 && /text\/html/.test(home1.headers.get('content-type') || ''), 'la radice non restituisce index.html');
  check((home1.headers.get('cache-control') || '').includes('no-cache'), 'manca Cache-Control: no-cache sui file statici');
  check(/javascript/.test((await fetch(s.base + '/js/app.js')).headers.get('content-type') || ''), 'tipo MIME errato per i moduli JS');
  check(/json/.test((await fetch(s.base + '/data/protocols.json')).headers.get('content-type') || ''), 'tipo MIME errato per i JSON');
  check(/svg/.test((await fetch(s.base + '/logo.svg')).headers.get('content-type') || ''), 'tipo MIME errato per gli SVG');
  check((await fetch(s.base + '/non-esiste.txt')).status === 404, 'un file inesistente non restituisce 404');
  const version = fs.readFileSync('FunBus.csproj', 'utf8').match(/<Version>([^<]+)</)[1];
  check((await (await fetch(s.base + '/api/version')).text()) === version, '/api/version diverso da <Version> del progetto');
  check((await (await fetch(s.base + '/api/state')).text()).trim() === '{}', '/api/state iniziale non vuoto');
  const state = JSON.stringify({ lang: 'en', level: 'professional', progress: { xp: 42, note: 'àèìòù ✓' } });
  check(
    (await fetch(s.base + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: state })).ok,
    'PUT /api/state fallita',
  );
  check((await (await fetch(s.base + '/api/state')).text()) === state, 'lo stato salvato non viene riletto identico');
  check(
    (await fetch(s.base + '/api/state', { method: 'PUT', body: 'x'.repeat(1_000_001) })).status === 400,
    'uno stato oltre 1 MB non viene rifiutato',
  );
  await stop(s);

  // 2. Lo stato sopravvive al riavvio
  s = await start();
  check((await (await fetch(s.base + '/api/state')).text()) === state, 'lo stato non sopravvive al riavvio');
  await stop(s);

  // 3. --export-content crea la cartella "content" con tutti i file
  execFileSync(exe, ['--export-content'], { env, stdio: 'ignore' });
  const content = path.join(out, 'content');
  for (const f of files)
    check(
      fs.existsSync(path.join(content, f)) && fs.readFileSync(path.join(content, f)).equals(fs.readFileSync(path.join('wwwroot', f))),
      `--export-content: ${f} mancante o diverso`,
    );

  // 4. La cartella "content" ha la precedenza; ciò che manca viene preso dall'exe
  const game = JSON.parse(fs.readFileSync(path.join(content, 'data', 'game.json'), 'utf8'));
  game.levelNames[0] = 'Prova contenuti';
  fs.writeFileSync(path.join(content, 'data', 'game.json'), JSON.stringify(game));
  fs.rmSync(path.join(content, 'js', 'app.js'));
  s = await start();
  check(
    (await (await fetch(s.base + '/data/game.json')).json()).levelNames[0] === 'Prova contenuti',
    'la cartella content non sovrascrive i file incorporati',
  );
  check((await fetch(s.base + '/js/app.js')).status === 200, "un file assente in content non viene preso dall'exe");
  await stop(s);
} catch (e) {
  errs.push(e.message);
}

fs.rmSync(tmp, { recursive: true, force: true });
if (errs.length) {
  console.error('ERRORI:\n- ' + errs.join('\n- '));
  process.exit(1);
}
console.log(`Server OK: ${files.length} file incorporati, API, export e override dei contenuti`);
