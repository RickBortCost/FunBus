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
const routes = ['/', '/protocolli', '/confronto', '/test', '/test/quiz', '/test/match', '/test/scenari', '/test/ripasso', '/test/frame', '/profilo', '/strumenti', '/glossario', '/approfondimenti', '/normative', '/certificato', '/topologie', ...data('topologies').topologies.map(t => '/topologie/' + t.id), ...ids.map(i => '/protocolli/' + i)];
const errs = [];
const b = await chromium.launch();
for (const [label, vp] of [['desktop', { width: 1200, height: 800 }], ['mobile', { width: 390, height: 800 }]]) {
  const pg = await b.newPage({ viewport: vp });
  pg.on('pageerror', e => errs.push(`${label} PE ${e.message}`));
  pg.on('console', m => { if (m.type() === 'error' && !/404|api\//.test(m.text())) errs.push(`${label} CE ${m.text()}`); });
  for (const lang of ['it', 'en']) for (const lv of ['lvB', 'lvP']) {
    await pg.goto(base + '#/'); await pg.waitForSelector('#splash', { state: 'detached', timeout: 8000 }); await pg.selectOption('#langSel', lang); await pg.click('#' + lv);
    for (const r of routes) {
      await pg.evaluate(h => (location.hash = h), r); await pg.waitForTimeout(80);
      const t = await pg.textContent('#app');
      if (t.length < 20 || t.startsWith('Errore')) errs.push(`${label}/${lang}/${lv} ${r}: pagina vuota o in errore`);
      if (ids.includes(r.split('/')[2]) && lv === 'lvP') { await pg.click('button[role=tab] >> nth=1'); await pg.waitForTimeout(60); if (!(await pg.locator('.seq svg').count())) errs.push(`${label}/${lang} ${r}: animazione senza diagramma`); }
      if (label === 'mobile' && !r.startsWith('/confronto')) {
        const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (ov > 2) errs.push(`mobile/${lv} ${r}: overflow orizzontale ${ov}px`);
      }
      if (ids.includes(r.split('/')[2]) && lv === 'lvP') await pg.click('button[role=tab] >> nth=0');
    }
  }
  // confronto: vista grafici (radar, piramidi OSI sovrapposte, mappa a quadranti)
  for (const lang of ['it', 'en']) {
    await pg.selectOption('#langSel', lang); await pg.evaluate(h => (location.hash = h), '/confronto'); await pg.waitForTimeout(120);
    await pg.click('.filters .seg button >> nth=1'); await pg.waitForTimeout(200);
    for (const c of ['.radar .rarea', '.osi .oslice.own', '.quad .qdot', '.scoretbl']) if (!(await pg.locator(c).count())) errs.push(`${label}/${lang} grafici: manca ${c}`);
    if ((await pg.locator('.quad .qdot').count()) !== ids.length) errs.push(`${label}/${lang} grafici: la mappa non mostra tutti i protocolli`);
    const before = await pg.locator('.pchip.sel').count();
    await pg.locator('.pchip:not(.sel)').first().click(); await pg.waitForTimeout(120);
    if ((await pg.locator('.pchip.sel').count()) !== before + 1 || (await pg.locator('.radar .rarea').count()) !== before + 1) errs.push(`${label}/${lang} grafici: la selezione non aggiorna il radar`);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 2) errs.push(`${label}/${lang} grafici: overflow orizzontale ${ov}px`);
    if ((await pg.textContent('#app')).includes('null')) errs.push(`${label}/${lang} grafici: testo "null" nella pagina`);
    await pg.click('.filters .seg button >> nth=0');
  }
  await pg.selectOption('#langSel', 'it');
  // topologie: guasto di cavo e di nodo, anello con ripristino
  for (const t of data('topologies').topologies) {
    await pg.evaluate(h => (location.hash = h), '/topologie/' + t.id); await pg.waitForTimeout(150);
    const all = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
    await pg.locator('.tlinkg').nth(1).dispatchEvent('click'); await pg.waitForTimeout(120);
    if (!(await pg.locator('.tlinkg.broken').count())) errs.push(`${label} topologia ${t.id}: il cavo non si interrompe`);
    if (t.id === 'ring') {
      await pg.waitForFunction(() => /4/.test(document.querySelector('.topobox ~ * .tag, .note .tag')?.textContent || ''), null, { timeout: 8000 }).catch(() => errs.push(`${label} anello: la riconfigurazione non arriva alla fase 4`));
      const now = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
      if (now[0] !== all[1]) errs.push(`${label} anello: dopo il ripristino ${now[0]}/${all[1]} raggiungibili`);
    } else {
      const now = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
      if (+now[0] >= +all[0]) errs.push(`${label} topologia ${t.id}: il guasto non isola alcun nodo`);
      await pg.locator('.tnode[role=button]').first().dispatchEvent('click'); await pg.waitForTimeout(80);
      if (!(await pg.locator('.tnode.off').count())) errs.push(`${label} topologia ${t.id}: il nodo non si spegne`);
    }
    await pg.click('.topobox ~ .row button'); await pg.waitForTimeout(80);
    if (await pg.locator('.tlinkg.broken, .tnode.off').count()) errs.push(`${label} topologia ${t.id}: ripristino non riuscito`);
  }
  // animazione di ogni protocollo
  if (label === 'desktop') for (const id of ids) {
    await pg.evaluate(h => (location.hash = h), '/protocolli/' + id); await pg.click('#lvP');
    await pg.click('button[role=tab] >> nth=1'); await pg.click('button.primary:has-text("Play")'); await pg.waitForTimeout(150);
    // diagramma a sequenza e guasti simulati
    const rows = await pg.locator('.seq .srow').count();
    if (rows !== data('animations')[id].steps.length) errs.push(`${id}: diagramma a sequenza con ${rows} righe`);
    await pg.click('.faultbtn');
    for (const f of ['cable', 'node', 'crc']) {
      await pg.click(`.faults [data-f=${f}]`); await pg.locator('.seq .srow').last().click(); await pg.waitForTimeout(60);
      if (!(await pg.locator('.note.fault').count())) errs.push(`${id}: guasto ${f} senza spiegazione`);
    }
    if (!(await pg.locator('.frame button').count())) errs.push(`${id}: frame non mostrato in Professional`);
    await pg.click('button[role=tab] >> nth=0');
  }
  await pg.close();
}
await b.close(); server.close();
if (errs.length) { console.error('ERRORI:\n- ' + errs.join('\n- ')); process.exit(1); }
console.log('Smoke OK: ' + routes.length + ' pagine × 2 livelli × 2 viewport');
