// Smoke test in browser: tutte le pagine, entrambi i livelli, desktop e mobile. Uso: node tests/smoke.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { IT_RE, NOT_ITALIAN } from './italian.mjs';

const root = path.resolve('wwwroot');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http
  .createServer((q, r) => {
    const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      r.writeHead(404);
      return r.end();
    }
    r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  })
  .listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const data = id => JSON.parse(fs.readFileSync(`wwwroot/data/${id}.json`, 'utf8'));
const ids = data('protocols').protocols.map(p => p.id);
const routes = [
  '/',
  '/protocolli',
  '/confronto',
  '/test',
  '/test/quiz',
  '/test/match',
  '/test/scenari',
  '/test/ripasso',
  '/test/frame',
  '/test/rete',
  '/profilo',
  '/strumenti',
  '/glossario',
  '/approfondimenti',
  '/normative',
  '/certificato',
  '/cerca',
  '/cerca/token',
  '/percorso',
  ...data('course').lessons.flatMap(l => ['/percorso/' + l.id, '/percorso/' + l.id + '/quiz']),
  '/topologie',
  ...data('topologies').topologies.map(t => '/topologie/' + t.id),
  ...ids.map(i => '/protocolli/' + i),
];
const errs = [];
// In inglese non deve restare testo italiano (testi composti in pagina compresi): euristica condivisa con tests/i18n.mjs
const italianLeft = pg =>
  pg.evaluate(
    ([src, not]) => {
      const re = new RegExp(src, 'i'),
        skip = not.map(x => new RegExp(x)),
        out = new Set();
      const test = t => t && re.test(t) && !skip.some(r => r.test(t));
      const walk = n => {
        if (n.nodeType === 3) {
          const t = n.nodeValue.trim();
          if (test(t)) out.add(t);
        } else if (n.nodeType === 1 && n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') {
          for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
            const v = n.getAttribute(a);
            if (test(v)) out.add(`[${a}] ${v}`);
          }
          n.childNodes.forEach(walk);
        }
      };
      walk(document.body);
      return [...out];
    },
    [IT_RE.source, NOT_ITALIAN.map(r => r.source)],
  );
const italianSeen = new Set();
const checkEnglish = async (pg, where) => {
  for (const t of await italianLeft(pg))
    if (!italianSeen.has(t)) {
      italianSeen.add(t);
      errs.push(`testo italiano in inglese (${where}): «${t.slice(0, 120)}»`);
    }
};
const b = await chromium.launch();
for (const [label, vp] of [
  ['desktop', { width: 1200, height: 800 }],
  ['mobile', { width: 390, height: 800 }],
]) {
  const pg = await b.newPage({ viewport: vp });
  pg.on('pageerror', e => errs.push(`${label} PE ${e.message}`));
  pg.on('console', m => {
    if (m.type() === 'error' && !/404|api\//.test(m.text())) errs.push(`${label} CE ${m.text()}`);
  });
  for (const lang of ['it', 'en'])
    for (const lv of ['lvB', 'lvP']) {
      await pg.goto(base + '#/');
      await pg.waitForSelector('#splash', { state: 'detached', timeout: 8000 });
      await pg.selectOption('#langSel', lang);
      await pg.click('#' + lv);
      for (const r of routes) {
        await pg.evaluate(h => (location.hash = h), r);
        await pg.waitForTimeout(80);
        const t = await pg.textContent('#app');
        if (t.length < 20 || t.startsWith('Errore')) errs.push(`${label}/${lang}/${lv} ${r}: pagina vuota o in errore`);
        if (lang === 'en') await checkEnglish(pg, `${lv} ${r}`);
        if (ids.includes(r.split('/')[2]) && lv === 'lvP') {
          await pg.click('button[role=tab] >> nth=1');
          await pg.waitForTimeout(60);
          if (!(await pg.locator('.seq svg').count())) errs.push(`${label}/${lang} ${r}: animazione senza diagramma`);
          const vb = await pg.locator('.sim > svg').getAttribute('viewBox');
          if ((label === 'mobile') !== vb.startsWith('0 0 380'))
            errs.push(`${label} ${r}: disposizione della rete non adatta alla larghezza (${vb})`);
          if (lang === 'en') await checkEnglish(pg, `${lv} ${r} animazione`);
        }
        if (label === 'mobile' && !r.startsWith('/confronto')) {
          const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          if (ov > 2) errs.push(`mobile/${lv} ${r}: overflow orizzontale ${ov}px`);
        }
        if (ids.includes(r.split('/')[2]) && lv === 'lvP') await pg.click('button[role=tab] >> nth=0');
      }
    }
  // varianti: tabelle delle differenze nelle schede e collegamento al confronto
  {
    await pg.selectOption('#langSel', 'it');
    const vs = data('protocols').variants || [];
    for (const id of [...new Set(vs.flatMap(v => v.show))]) {
      await pg.evaluate(h => (location.hash = h), '/protocolli/' + id);
      await pg.waitForTimeout(100);
      const mine = vs.filter(v => v.show.includes(id));
      if ((await pg.locator('.vstable').count()) !== mine.length) errs.push(`${label} ${id}: tabelle delle differenze mancanti`);
      if ((await pg.locator('.vstable tbody tr').count()) !== mine.reduce((a, v) => a + v.rows.length, 0))
        errs.push(`${label} ${id}: tabella delle differenze incompleta`);
      const withCur = mine.some(v => v.cols.some(c => c.proto === id) && v.cols.some(c => c.proto !== id));
      if (withCur && (await pg.locator('.vstable tbody tr').first().locator('td.cur').count()) !== 1)
        errs.push(`${label} ${id}: colonna della scheda non evidenziata`);
    }
    for (const v of vs.filter(x => x.compare)) {
      await pg.evaluate(h => (location.hash = h), '/confronto/' + v.compare.join(','));
      await pg.waitForTimeout(150);
      if (label === 'desktop' && (await pg.locator('table.cmp thead th').count()) !== v.compare.length + 1)
        errs.push(`confronto/${v.compare.join(',')}: protocolli non affiancati`);
    }
    await pg.evaluate(h => (location.hash = h), '/confronto');
  }
  // ricerca globale e stampa della scheda
  {
    await pg.selectOption('#langSel', 'it');
    await pg.evaluate(h => (location.hash = h), '/cerca');
    await pg.waitForTimeout(150);
    await pg.fill('.searchbox', 'token');
    await pg.waitForTimeout(120);
    if (!(await pg.locator('.results a', { hasText: 'PROFIBUS' }).count()) || !(await pg.locator('.results mark').count()))
      errs.push(`${label} ricerca: «token» non trova PROFIBUS o non evidenzia la parola`);
    await pg.fill('.searchbox', 'perche');
    await pg.waitForTimeout(120);
    if (!(await pg.locator('.results a').count())) errs.push(`${label} ricerca: la ricerca non ignora gli accenti`);
    await pg.fill('.searchbox', 'zzzqqq');
    await pg.waitForTimeout(120);
    if (await pg.locator('.results a').count()) errs.push(`${label} ricerca: risultati per una parola inesistente`);
    await pg.fill('.searchbox', 'jitter');
    await pg.waitForTimeout(120);
    await pg.locator('.results a', { hasText: 'Jitter' }).first().click();
    await pg.waitForTimeout(150);
    if ((await pg.locator('dl.spec dt').count()) > 5) errs.push(`${label} ricerca: il glossario non arriva già filtrato`);
    await pg.evaluate(h => (location.hash = h), '/protocolli/' + ids[0]);
    await pg.waitForTimeout(120);
    await pg.emulateMedia({ media: 'print' });
    const pr = await pg.evaluate(() => ({
      bar: getComputedStyle(document.querySelector('.topbar')).display,
      btn: [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').length,
      bg: getComputedStyle(document.querySelector('.card')).backgroundColor,
    }));
    if (pr.bar !== 'none' || pr.btn || pr.bg !== 'rgb(255, 255, 255)')
      errs.push(`${label} stampa: la scheda non è pronta per la stampa (${JSON.stringify(pr)})`);
    await pg.emulateMedia({ media: 'screen' });
  }
  // percorso guidato: i passi si spuntano con le attività, il quiz di lezione aggiorna la lezione
  {
    await pg.selectOption('#langSel', 'it');
    await pg.click('#lvB');
    const l = data('course').lessons[1]; // Modbus: scheda, animazione, scheda, quiz
    await pg.evaluate(h => (location.hash = h), '/percorso/' + l.id);
    await pg.waitForTimeout(150);
    if ((await pg.locator('.steps .step').count()) !== l.steps.length) errs.push(`${label} percorso: passi della lezione incompleti`);
    const before = await pg.locator('.steps .step.done').count();
    await pg.locator('.steps .step:not(.done) .steplink').first().click();
    await pg.waitForTimeout(200);
    if (await pg.locator('.sim button.primary').count()) {
      await pg.click('.sim button.primary');
      await pg.waitForTimeout(80);
    } // l'animazione conta quando viene avviata
    if (!(await pg.locator('.backlesson').count())) errs.push(`${label} percorso: manca il ritorno alla lezione`);
    else {
      await pg.click('.backlesson');
      await pg.waitForTimeout(150);
    }
    if ((await pg.locator('.steps .step.done').count()) <= before) errs.push(`${label} percorso: il passo svolto non viene spuntato`);
    await pg.evaluate(h => (location.hash = h), '/percorso/' + l.id + '/quiz');
    await pg.waitForTimeout(150);
    for (let k = 0; k < 6 && (await pg.locator('.opts button').count()); k++) {
      await pg.locator('.opts button').first().click();
      await pg.locator('#app button.primary').click();
      await pg.waitForTimeout(60);
    }
    if (!(await pg.locator('.fb.ok, .fb.ko').count())) errs.push(`${label} percorso: il quiz di lezione non riporta l'esito`);
    await pg.evaluate(h => (location.hash = h), '/percorso');
    await pg.waitForTimeout(100);
    if ((await pg.locator('.lessons .lesson').count()) !== data('course').lessons.length)
      errs.push(`${label} percorso: elenco delle lezioni incompleto`);
  }
  // scenari con varianti: per PROFINET va scelta la variante (RT o IRT) e l'esito cambia
  {
    await pg.selectOption('#langSel', 'it');
    await pg.evaluate(h => (location.hash = h), '/test/scenari');
    await pg.click('#lvB');
    await pg.waitForTimeout(150);
    await pg.locator('button.card', { hasText: data('scenarios').scenarios.find(x => x.id === 'sb2').title }).click();
    await pg.waitForTimeout(100);
    await pg.locator('.pick button', { hasText: 'PROFINET' }).click();
    await pg.waitForTimeout(60);
    if ((await pg.locator('.varchip').count()) !== 2) errs.push(`${label} scenari: le varianti di PROFINET non vengono proposte`);
    else {
      await pg.locator('.varchip', { hasText: 'PROFINET RT' }).click();
      await pg.waitForTimeout(60);
      if (!(await pg.locator('.chk.fail').count())) errs.push(`${label} scenari: PROFINET RT accettato per il motion sincronizzato`);
      await pg.locator('.varchip', { hasText: 'PROFINET IRT' }).click();
      await pg.waitForTimeout(60);
      if (await pg.locator('.chk.fail').count()) errs.push(`${label} scenari: PROFINET IRT rifiutato per il motion sincronizzato`);
    }
  }
  // gioco «Costruisci la rete»: trascinamento (mouse), posa a clic, verifica e badge disegnati
  {
    await pg.selectOption('#langSel', 'it');
    await pg.evaluate(h => (location.hash = h), '/test/rete');
    await pg.click('#lvB');
    await pg.waitForTimeout(150);
    const m = data('game').build.missions.filter(x => x.level === 'beginner')[1]; // linea di robot: EtherCAT in linea
    await pg.locator('button.card', { hasText: m.title }).click();
    await pg.waitForTimeout(120);
    await pg.click('.bench button.primary');
    if (!(await pg.locator('.fb.ko').count())) errs.push(`${label} rete: la verifica di un banco vuoto non avvisa`);
    const put = async (chip, target) => {
      await chip.scrollIntoViewIfNeeded();
      await chip.click();
      await target.click();
      await pg.waitForTimeout(60);
    };
    if (label === 'desktop') {
      const drag = async (from, to) => {
        await from.scrollIntoViewIfNeeded();
        const a = await from.boundingBox(),
          b = await to.boundingBox();
        await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await pg.mouse.down();
        await pg.mouse.move(a.x + a.width / 2 + 14, a.y, { steps: 3 });
        await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
        await pg.mouse.up();
        await pg.waitForTimeout(100);
      };
      await drag(pg.locator('.pick', { hasText: 'EtherCAT' }), pg.locator('.dropzone[data-drop=bus]'));
      if (!(await pg.locator('.dropzone[data-drop=bus]').textContent()).includes('EtherCAT'))
        errs.push('rete: il trascinamento del bus non funziona');
    } else await put(pg.locator('.pick', { hasText: 'EtherCAT' }), pg.locator('.dropzone[data-drop=bus]'));
    await put(pg.locator('.traygrp').nth(1).locator('.pick').nth(2), pg.locator('[data-drop=topo]').last()); // stella: non adatta
    while (await pg.locator('.tnode.slot').count()) {
      await pg.locator('.devchip').first().click();
      await pg.locator('.tnode.slot').first().dispatchEvent('click');
      await pg.waitForTimeout(40);
    }
    await pg.click('.bench button.primary');
    await pg.waitForTimeout(100);
    if (!(await pg.locator('.chk.fail').count())) errs.push(`${label} rete: una topologia non adatta viene accettata`);
    await put(pg.locator('.traygrp').nth(1).locator('.pick').nth(1), pg.locator('[data-drop=topo]').last()); // linea
    while (await pg.locator('.tnode.slot').count()) {
      await pg.locator('.devchip').first().click();
      await pg.locator('.tnode.slot').first().dispatchEvent('click');
      await pg.waitForTimeout(40);
    }
    await pg.click('.bench button.primary');
    await pg.waitForTimeout(100);
    if ((await pg.locator('.chk.fail, .chk.warn').count()) || !(await pg.locator('.chk.ok').count()))
      errs.push(`${label} rete: la soluzione corretta non viene riconosciuta`);
    // missione con dorsale seriale: servono i terminatori; un ripetitore di troppo viene segnalato
    await pg.click('text=Altre missioni');
    await pg.waitForTimeout(100);
    await pg.locator('button.card', { hasText: data('game').build.missions.find(x => x.id === 'nb4').title }).click();
    await pg.waitForTimeout(120);
    await put(pg.locator('.traygrp .pick', { hasText: 'Modbus RTU' }), pg.locator('.dropzone[data-drop=bus]'));
    await put(pg.locator('.traygrp').nth(1).locator('.pick').nth(0), pg.locator('[data-drop=topo]').last()); // bus
    while (await pg.locator('.tnode.slot[data-drop=dev]').count()) {
      await pg.locator('.devchip').first().click();
      await pg.locator('.tnode.slot[data-drop=dev]').first().dispatchEvent('click');
      await pg.waitForTimeout(40);
    }
    await pg.click('.bench button.primary');
    await pg.waitForTimeout(100);
    if (!(await pg.locator('.chk.fail').count())) errs.push(`${label} rete: una dorsale senza terminatori viene accettata`);
    while (await pg.locator('.tnode.slot[data-drop=term]').count()) {
      await pg.locator('.termchip').first().click();
      await pg.locator('.tnode.slot[data-drop=term]').first().dispatchEvent('click');
      await pg.waitForTimeout(40);
    }
    await pg.locator('.stepper button').last().click();
    await pg.click('.bench button.primary');
    await pg.waitForTimeout(100);
    if ((await pg.locator('.chk.fail').count()) || (await pg.locator('.chk.warn').count()) !== 1)
      errs.push(`${label} rete: il ripetitore superfluo non viene segnalato`);
    await pg.locator('.stepper button').first().click();
    await pg.click('.bench button.primary');
    await pg.waitForTimeout(100);
    if (await pg.locator('.chk.fail, .chk.warn').count()) errs.push(`${label} rete: la soluzione essenziale non viene riconosciuta`);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 2) errs.push(`${label} rete: overflow orizzontale ${ov}px`);
    await pg.evaluate(h => (location.hash = h), '/profilo');
    await pg.waitForTimeout(100);
    if ((await pg.locator('.badge .badgeart').count()) !== data('game').badges.length)
      errs.push(`${label} profilo: grafica dei badge mancante`);
  }
  // temi: chiaro → scuro → alto contrasto, con illustrazione del bus e transizione di pagina
  {
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await pg.click('#themeBtn');
      seen.push(await pg.evaluate(() => document.documentElement.dataset.theme));
    }
    if (new Set(seen).size !== 3 || !seen.includes('hc'))
      errs.push(`${label}: il pulsante del tema non passa per chiaro/scuro/alto contrasto (${seen})`);
    while ((await pg.evaluate(() => document.documentElement.dataset.theme)) !== 'hc') await pg.click('#themeBtn');
    for (const r of ['/', '/protocolli/' + ids[0], '/confronto', '/topologie/ring', '/test/quiz']) {
      await pg.evaluate(h => (location.hash = h), r);
      await pg.waitForTimeout(80);
      if ((await pg.textContent('#app')).length < 20) errs.push(`${label} alto contrasto ${r}: pagina vuota`);
      if (!(await pg.evaluate(() => document.getElementById('app').classList.contains('enter'))))
        errs.push(`${label} ${r}: transizione di pagina assente`);
      const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (ov > 2 && r !== '/confronto') errs.push(`${label} alto contrasto ${r}: overflow orizzontale ${ov}px`);
    }
    for (const id of ids) {
      await pg.evaluate(h => (location.hash = h), '/protocolli/' + id);
      await pg.waitForTimeout(40);
      if (!(await pg.locator('.illusfig svg').count())) errs.push(`${id}: illustrazione mancante`);
    }
    while ((await pg.evaluate(() => document.documentElement.dataset.theme)) !== 'light') await pg.click('#themeBtn');
  }
  // confronto: vista grafici (radar, piramidi OSI sovrapposte, mappa a quadranti)
  for (const lang of ['it', 'en']) {
    await pg.selectOption('#langSel', lang);
    await pg.evaluate(h => (location.hash = h), '/confronto');
    await pg.waitForTimeout(120);
    await pg.click('.filters .seg button >> nth=1');
    await pg.waitForTimeout(200);
    for (const c of ['.radar .rarea', '.osi .oslice.own', '.quad .qdot', '.scoretbl'])
      if (!(await pg.locator(c).count())) errs.push(`${label}/${lang} grafici: manca ${c}`);
    if ((await pg.locator('.quad .qdot').count()) !== ids.length)
      errs.push(`${label}/${lang} grafici: la mappa non mostra tutti i protocolli`);
    const before = await pg.locator('.pchip.sel').count();
    await pg.locator('.pchip:not(.sel)').first().click();
    await pg.waitForTimeout(120);
    if ((await pg.locator('.pchip.sel').count()) !== before + 1 || (await pg.locator('.radar .rarea').count()) !== before + 1)
      errs.push(`${label}/${lang} grafici: la selezione non aggiorna il radar`);
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ov > 2) errs.push(`${label}/${lang} grafici: overflow orizzontale ${ov}px`);
    if ((await pg.textContent('#app')).includes('null')) errs.push(`${label}/${lang} grafici: testo "null" nella pagina`);
    await pg.click('.filters .seg button >> nth=0');
  }
  await pg.selectOption('#langSel', 'it');
  // topologie: guasto di cavo e di nodo, anello con ripristino
  for (const t of data('topologies').topologies) {
    await pg.evaluate(h => (location.hash = h), '/topologie/' + t.id);
    await pg.waitForTimeout(150);
    const all = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
    await pg.locator('.tlinkg').nth(1).dispatchEvent('click');
    await pg.waitForTimeout(120);
    if (!(await pg.locator('.tlinkg.broken').count())) errs.push(`${label} topologia ${t.id}: il cavo non si interrompe`);
    if (t.id === 'ring') {
      await pg
        .waitForFunction(() => /4/.test(document.querySelector('.topobox ~ * .tag, .note .tag')?.textContent || ''), null, {
          timeout: 8000,
        })
        .catch(() => errs.push(`${label} anello: la riconfigurazione non arriva alla fase 4`));
      const now = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
      if (now[0] !== all[1]) errs.push(`${label} anello: dopo il ripristino ${now[0]}/${all[1]} raggiungibili`);
    } else {
      const now = (await pg.locator('.toporeach').textContent()).match(/\d+/g);
      if (+now[0] >= +all[0]) errs.push(`${label} topologia ${t.id}: il guasto non isola alcun nodo`);
      await pg.locator('.tnode[role=button]').first().dispatchEvent('click');
      await pg.waitForTimeout(80);
      if (!(await pg.locator('.tnode.off').count())) errs.push(`${label} topologia ${t.id}: il nodo non si spegne`);
    }
    await pg.click('.topobox ~ .row button');
    await pg.waitForTimeout(80);
    if (await pg.locator('.tlinkg.broken, .tnode.off').count()) errs.push(`${label} topologia ${t.id}: ripristino non riuscito`);
  }
  // animazioni attive: in modalità previsione l'animazione si ferma e chiede il passo successivo
  for (const lang of ['it', 'en']) {
    await pg.selectOption('#langSel', lang);
    await pg.evaluate(h => (location.hash = h), '/protocolli/modbus');
    await pg.click('button[role=tab] >> nth=1');
    await pg.selectOption('.sim .ctl select', '4');
    await pg.click('.predbtn');
    if (await pg.locator('.seq').isVisible()) errs.push(`${label}/${lang}: diagramma a sequenza visibile durante le previsioni`);
    const total = data('animations').modbus.steps.length;
    let asked = 0;
    for (let k = 0; k < total + 2 && !(await pg.locator('.predict .pend').count()); k++) {
      await pg.waitForSelector('.predict .popts button, .predict .pend', { timeout: 8000 });
      if (await pg.locator('.predict .pend').count()) break;
      if ((await pg.locator('.predict .popts button').count()) !== 3) errs.push(`${label}/${lang}: la previsione deve offrire tre scelte`);
      if (lang === 'en') await checkEnglish(pg, 'previsione');
      if ((await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) > 0)
        errs.push(`${label}/${lang}: previsione con overflow orizzontale`);
      await pg.locator('.predict .popts button').first().click();
      asked++;
      await pg.waitForSelector('.predict .fb');
    }
    if (!asked) errs.push(`${label}/${lang}: nessuna previsione chiesta`);
    if (!(await pg.locator('.predict .pend').count())) errs.push(`${label}/${lang}: la sequenza di previsioni non arriva alla fine`);
    else if (!(await pg.textContent('.predict .pscore')).includes(String(asked)))
      errs.push(`${label}/${lang}: conteggio delle previsioni errato`);
    if (lang === 'en') await checkEnglish(pg, 'fine previsioni');
    await pg.click('.predbtn');
    if (!(await pg.locator('.seq').isVisible())) errs.push(`${label}/${lang}: diagramma a sequenza non ripristinato`);
    await pg.click('button[role=tab] >> nth=0');
  }
  await pg.selectOption('#langSel', 'it');
  // primo avvio guidato, «Riprendi» in home e menu a gruppi (pagina nuova: nessun progresso salvato)
  {
    const fp = await b.newPage({ viewport: vp });
    fp.on('pageerror', e => errs.push(`${label} avvio PE ${e.message}`));
    const overflow = () => fp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await fp.goto(base + '#/');
    await fp.waitForSelector('#splash', { state: 'detached', timeout: 8000 });
    await fp.selectOption('#langSel', 'en');
    if (!(await fp.locator('#welcome').count())) errs.push(`${label}: al primo avvio manca l'introduzione`);
    if (await fp.locator('#resume').count()) errs.push(`${label}: «Riprendi» mostrato senza progressi`);
    for (let i = 0; i < 3; i++) {
      await checkEnglish(fp, `primo avvio, passo ${i + 1}`);
      if ((await overflow()) > 0) errs.push(`${label}: primo avvio, passo ${i + 1} con overflow orizzontale`);
      if (i === 0) await fp.click('#welcome button.primary');
      if (i === 1) await fp.click('#welcome .two button >> nth=1');
      await fp.waitForTimeout(60);
    }
    if (!(await fp.evaluate(() => document.getElementById('lvP').classList.contains('on')))) errs.push(`${label}: livello non applicato`);
    await fp.click('#welcome .two button.primary');
    await fp.waitForTimeout(80);
    const first = data('course').lessons[0].id;
    if ((await fp.evaluate(() => location.hash)) !== `#/percorso/${first}`)
      errs.push(`${label}: il primo avvio non porta alla prima lezione`);
    await fp.evaluate(h => (location.hash = h), '/protocolli/' + ids[0]);
    await fp.waitForTimeout(80);
    await fp.evaluate(h => (location.hash = h), '/');
    await fp.waitForTimeout(80);
    if (await fp.locator('#welcome').count()) errs.push(`${label}: introduzione mostrata di nuovo`);
    if ((await fp.locator('#resume .rtile').count()) !== 2) errs.push(`${label}: «Riprendi» deve proporre lezione e ultima scheda`);
    if (!(await fp.locator(`#resume a[href="#/protocolli/${ids[0]}"]`).count())) errs.push(`${label}: «Riprendi» senza l'ultima scheda`);
    await checkEnglish(fp, 'home con Riprendi');
    // menu: si apre, non esce dallo schermo, porta alla pagina, segna la voce attiva e si chiude con Esc
    for (const g of [0, 1, 2]) {
      await fp.locator('#nav .navb').nth(g).click();
      if ((await overflow()) > 0) errs.push(`${label}: menu ${g} con overflow orizzontale`);
      const box = await fp.locator('#nav .navp').nth(g).boundingBox();
      if (!box || box.x < 0 || box.x + box.width > vp.width) errs.push(`${label}: menu ${g} fuori dallo schermo`);
      await checkEnglish(fp, `menu ${g}`);
    }
    await fp.click('#nav a[data-s=quiz]');
    await fp.waitForTimeout(80);
    if ((await fp.evaluate(() => location.hash)) !== '#/test/quiz') errs.push(`${label}: la voce di menu non apre la pagina`);
    if (!(await fp.evaluate(() => document.getElementById('nav-prova').hidden))) errs.push(`${label}: menu non chiuso dopo la scelta`);
    if ((await fp.locator('#nav a[aria-current=page]').getAttribute('data-s')) !== 'quiz') errs.push(`${label}: voce attiva non segnata`);
    await fp.locator('#nav .navb').first().click();
    await fp.keyboard.press('Escape');
    if (!(await fp.evaluate(() => document.getElementById('nav-impara').hidden))) errs.push(`${label}: Esc non chiude il menu`);
    // traguardi: badge e livello in grande, uno dopo l'altro, chiudibili
    await fp.evaluate(async () => {
      const m = await import('./js/badges.js');
      m.celebrate({ kind: 'badge', id: 'builder', icon: '🏗', label: 'Nuovo badge', name: 'Costruttore', desc: 'Completa un quiz.' });
      m.celebrate({ kind: 'level', n: 2, label: 'Nuovo livello', name: 'Tecnico', desc: 'Livello 2' });
    });
    for (const kind of ['badge', 'level']) {
      await fp.waitForSelector(`.celebrate[data-kind=${kind}] svg.badgeart`);
      await fp.waitForTimeout(80);
      if ((await overflow()) > 0) errs.push(`${label}: traguardo ${kind} con overflow orizzontale`);
      const cb = await fp.locator('.celebrate').boundingBox();
      if (cb.x < 0 || cb.x + cb.width > vp.width) errs.push(`${label}: traguardo ${kind} fuori dallo schermo`);
      await checkEnglish(fp, `traguardo ${kind}`);
      await fp.click('.celebrate .cclose');
    }
    if (await fp.locator('.celebrate').count()) errs.push(`${label}: traguardo non chiuso`);
    // ripasso distanziato: l'errore torna dopo un giorno, poi 3 e 7; alla terza risposta giusta esce
    {
      await fp.selectOption('#langSel', 'it');
      const questions = data('quiz').questions;
      const stored = () => fp.evaluate(() => JSON.parse(localStorage.getItem('ipl')).progress.review);
      const answer = async right => {
        const text = (await fp.textContent('#app h2')).trim();
        const cur = questions.find(x => x.q === text);
        const want = right ? cur.o[cur.a] : cur.o[(cur.a + 1) % cur.o.length];
        const all = await fp.locator('.opts button').allTextContents();
        await fp
          .locator('.opts button')
          .nth(all.findIndex(t => t.trim() === want))
          .click();
        await fp.waitForSelector('.fb');
        await fp.waitForTimeout(350); // il salvataggio è differito
        return cur.id;
      };
      const days = e => Math.round((e.due - Date.now()) / 864e5);
      await fp.evaluate(h => (location.hash = h), '/test/quiz');
      await fp.waitForSelector('.opts button');
      const id = await answer(false);
      if (!(await fp.locator('.fb .again').count())) errs.push(`${label}: errore senza avviso di ripasso`);
      let e = (await stored())[id];
      if (!e || e.box !== 0 || days(e) !== 1) errs.push(`${label}: l'errore deve tornare dopo 1 giorno`);
      await fp.evaluate(h => (location.hash = h), '/test/ripasso');
      await fp.waitForSelector('#reviewLater');
      if (await fp.locator('.opts button').count()) errs.push(`${label}: domanda proposta prima della scadenza`);
      await fp.selectOption('#langSel', 'en');
      await fp.waitForTimeout(150);
      await checkEnglish(fp, 'ripasso in programma');
      await fp.selectOption('#langSel', 'it');
      await fp.click('#reviewLater a');
      await fp.waitForSelector('.opts button');
      await answer(true);
      e = (await stored())[id];
      if (!e || e.box !== 1 || days(e) !== 3) errs.push(`${label}: dopo la prima risposta giusta il ripasso è a 3 giorni`);
      await fp.evaluate(k => {
        const st = JSON.parse(localStorage.getItem('ipl'));
        st.progress.review[k] = { box: 2, due: 1 };
        localStorage.setItem('ipl', JSON.stringify(st));
      }, id);
      await fp.reload();
      await fp.waitForSelector('#splash', { state: 'detached', timeout: 8000 });
      await fp.evaluate(h => (location.hash = h), '/');
      await fp.waitForTimeout(80);
      if (!(await fp.locator('#resume a[href="#/test/ripasso"]').count()))
        errs.push(`${label}: «Riprendi» non propone il ripasso in scadenza`);
      await fp.evaluate(h => (location.hash = h), '/test/ripasso');
      await fp.waitForSelector('.opts button');
      await answer(true);
      if ((await stored())[id]) errs.push(`${label}: alla terza risposta giusta la domanda deve uscire dal ripasso`);
      await fp.selectOption('#langSel', 'en');
      await fp.waitForTimeout(150);
      await checkEnglish(fp, 'ripasso: domanda imparata');
    }
    await fp.close();
  }
  // animazione di ogni protocollo
  if (label === 'desktop')
    for (const id of ids) {
      await pg.evaluate(h => (location.hash = h), '/protocolli/' + id);
      await pg.click('#lvP');
      await pg.click('button[role=tab] >> nth=1');
      await pg.click('button.primary:has-text("Play")');
      await pg.waitForTimeout(150);
      // diagramma a sequenza e guasti simulati
      const rows = await pg.locator('.seq .srow').count();
      if (rows !== data('animations')[id].steps.length) errs.push(`${id}: diagramma a sequenza con ${rows} righe`);
      await pg.click('.faultbtn');
      for (const f of ['cable', 'node', 'crc']) {
        await pg.click(`.faults [data-f=${f}]`);
        await pg.locator('.seq .srow').last().click();
        await pg.waitForTimeout(60);
        if (!(await pg.locator('.note.fault').count())) errs.push(`${id}: guasto ${f} senza spiegazione`);
      }
      if (!(await pg.locator('.frame button').count())) errs.push(`${id}: frame non mostrato in Professional`);
      await pg.click('button[role=tab] >> nth=0');
    }
  await pg.close();
}
await b.close();
server.close();
if (errs.length) {
  console.error('ERRORI:\n- ' + errs.join('\n- '));
  process.exit(1);
}
console.log('Smoke OK: ' + routes.length + ' pagine × 2 livelli × 2 viewport');
