// Test della versione web: costruita con web/build.mjs, servita in una sottocartella come su GitHub Pages.
// Controlla che non cerchi il server locale, che sia installabile e che dopo la prima visita funzioni senza rete.
// Uso: NODE_PATH=$(npm root -g) node tests/web.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'funbus-web-'));
execFileSync('node', ['web/build.mjs', out], { stdio: ['ignore', 'ignore', 'inherit'] });
const errs = [];
const check = (ok, msg) => {
  if (!ok) errs.push(msg);
};

const BASE = '/FunBus/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const asked = [],
  missing = [];
const server = http
  .createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    asked.push(u);
    const f = u.startsWith(BASE) ? path.join(out, u === BASE ? 'index.html' : u.slice(BASE.length)) : '';
    if (!f || !f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      missing.push(u);
      r.writeHead(404);
      return r.end();
    }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  })
  .listen(0);
const url = `http://127.0.0.1:${server.address().port}${BASE}`;
const version = /<Version>([^<]+)</.exec(fs.readFileSync('FunBus.csproj', 'utf8'))[1];

// file statici
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.webmanifest'), 'utf8'));
for (const i of manifest.icons) check(fs.existsSync(path.join(out, i.src)), `manifest: icona mancante ${i.src}`);
check(manifest.start_url === './' && manifest.scope === './', 'manifest: start_url e scope devono essere relativi');
const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
check(sw.includes(`funbus-${version}`) && !sw.includes('__FILES__'), 'sw.js: segnaposto non sostituiti');
for (const f of ['index.html', 'js/app.js', 'css/style.css', 'data/protocols.json', 'data/lang/en.json', 'logo.svg'])
  check(sw.includes(`"${f}"`), `sw.js: ${f} non è nell'elenco dei file`);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 820, height: 1180 } });
const page = await context.newPage();
page.on('pageerror', e => errs.push('errore JS: ' + e.message));
page.on('console', m => {
  // i loghi ufficiali sono file facoltativi (logos/<id>.svg|png): la loro assenza non è un errore
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text());
});
await page.goto(url);
await page.waitForSelector('#splash', { state: 'detached', timeout: 10000 });
check((await page.textContent('#ver')).includes(`v${version}`), 'versione non mostrata a piè di pagina');
check(
  !asked.some(u => u.includes('/api/')),
  'la versione web non deve chiamare il server locale: ' + asked.filter(u => u.includes('/api/')),
);
check(!asked.some(u => !u.startsWith(BASE)), 'richieste fuori dalla sottocartella: ' + asked.filter(u => !u.startsWith(BASE)));
check(!missing.some(u => !u.startsWith(BASE + 'logos/')), 'file non trovati: ' + missing.filter(u => !u.startsWith(BASE + 'logos/')));
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 });

// progressi: salvati nel browser e ritrovati al riavvio
await page.click('#lvP');
await page.evaluate(() => (location.hash = '#/protocolli/profinet'));
await page.waitForSelector('h1');
await page.waitForTimeout(500);

// senza rete: ricarica, cambia pagina e lingua
await context.setOffline(true);
await page.reload();
await page.waitForSelector('#splash', { state: 'detached', timeout: 10000 });
check(await page.evaluate(() => document.getElementById('lvP').classList.contains('on')), 'livello non ritrovato dopo il riavvio');
await page.evaluate(() => (location.hash = '#/profilo'));
await page.waitForSelector('#webNote');
check((await page.textContent('#app')).includes('1/'), 'scheda aperta non ritrovata nei progressi');
await page.selectOption('#langSel', 'en');
await page
  .waitForFunction(() => /saved in this browser/.test(document.getElementById('webNote')?.textContent || ''), null, { timeout: 5000 })
  .catch(() => errs.push('senza rete: dizionario inglese non disponibile'));
await page.evaluate(() => (location.hash = '#/protocolli/ethercat'));
await page.waitForSelector('.illus', { timeout: 5000 }).catch(() => errs.push('senza rete: la scheda non si apre'));

await browser.close();
server.close();
fs.rmSync(out, { recursive: true, force: true });
if (errs.length) {
  console.error(errs.join('\n'));
  process.exit(1);
}
console.log('Versione web OK: sottocartella, nessuna chiamata al server, installabile, usabile senza rete');
