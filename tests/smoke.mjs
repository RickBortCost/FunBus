// Smoke test in browser: tutte le pagine, entrambi i livelli, desktop e mobile. Uso: node tests/smoke.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('wwwroot');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const data = id => JSON.parse(fs.readFileSync(`wwwroot/data/${id}.json`, 'utf8'));
const ids = data('protocols').protocols.map(p => p.id);
const routes = ['/', '/protocolli', '/confronto', '/test', '/test/quiz', '/test/match', '/test/scenari', '/test/ripasso', '/test/frame', '/profilo', '/strumenti', '/glossario', '/approfondimenti', '/certificato', ...ids.map(i => '/protocolli/' + i)];
const errs = [];
const b = await chromium.launch();
for (const [label, vp] of [['desktop', { width: 1200, height: 800 }], ['mobile', { width: 390, height: 800 }]]) {
  const pg = await b.newPage({ viewport: vp });
  pg.on('pageerror', e => errs.push(`${label} PE ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error' && !/404|api\//.test(m.text())) errs.push(`${label} CE ${m.text()}`); });
  for (const lv of ['lvB', 'lvP']) {
    await pg.goto(base + '#/'); await pg.waitForSelector('#splash', { state: 'detached', timeout: 8000 }); await pg.click('#' + lv);
    for (const r of routes) {
      await pg.evaluate(h => (location.hash = h), r); await pg.waitForTimeout(80);
      const t = await pg.textContent('#app');
      if (t.length < 20 || t.startsWith('Errore')) errs.push(`${label}/${lv} ${r}: pagina vuota o in errore`);
      if (label === 'mobile' && !r.startsWith('/confronto')) {
        const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (ov > 2) errs.push(`mobile/${lv} ${r}: overflow orizzontale ${ov}px`);
      }
    }
  }
  // animazione di ogni protocollo
  if (label === 'desktop') for (const id of ids) {
    await pg.evaluate(h => (location.hash = h), '/protocolli/' + id); await pg.click('#lvP');
    await pg.click('button[role=tab]:has-text("Animazione")'); await pg.click('button:has-text("Play")'); await pg.waitForTimeout(150);
    await pg.click('button[role=tab]:has-text("Scheda")');
  }
  await pg.close();
}
await b.close(); server.close();
if (errs.length) { console.error('ERRORI:\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('Smoke OK: ' + routes.length + ' pagine × 2 livelli × 2 viewport');
