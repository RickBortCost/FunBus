import { S, h, isPro, shuffle, addXP, save, checkBadges, levelInfo, protoByName, defProgress } from './core.js';

const lvKey = () => (isPro() ? 'professional' : 'beginner');

export function hub(app) {
  const p = S.progress, li = levelInfo();
  app.append(
    h('h1', {}, 'Test e giochi'),
    h('p', { class: 'muted' }, `Difficoltà: ${isPro() ? 'Professional' : 'Beginner'} · Livello ${li.index + 1} (${li.name}) · ${p.xp} XP`),
    h('div', { class: 'grid' },
      h('a', { class: 'card', href: '#/test/quiz' }, h('h3', {}, '❓ Quiz'), h('p', { class: 'muted' }, 'Domande a punti con feedback immediato e serie di risposte corrette.')),
      h('a', { class: 'card', href: '#/test/match' }, h('h3', {}, '🧩 Collega le schede'), h('p', { class: 'muted' }, 'Abbina protocolli, caratteristiche e topologie.')),
      h('a', { class: 'card', href: '#/test/scenari' }, h('h3', {}, '📐 Scenari di fattibilità'), h('p', { class: 'muted' }, 'Scegli il protocollo giusto per un requisito e scopri perché.'))));
}

/* ---------- QUIZ ---------- */
export function quiz(app) {
  const cfg = S.data.game.quiz;
  const pool = S.data.quiz.questions.filter(q => q.level === lvKey());
  const qs = shuffle(pool).slice(0, cfg.questions).sort((a, b) => a.d - b.d);
  let i = 0, score = 0, ok = 0, streak = 0, best = 0;
  const box = h('div');
  app.append(h('a', { href: '#/test' }, '← Test'), h('h1', {}, 'Quiz'), box);

  const next = () => { i++; i < qs.length ? ask() : end(); };
  const ask = () => {
    const q = qs[i];
    const order = shuffle(q.o.map((t, k) => ({ t, k })));
    const fb = h('div');
    const nextBtn = h('button', { class: 'primary', style: 'display:none', onclick: next }, i === qs.length - 1 ? 'Risultato' : 'Avanti →');
    const opts = h('div', { class: 'opts' }, order.map(o => h('button', {
      onclick: e => {
        opts.querySelectorAll('button').forEach(b => (b.disabled = true));
        const right = o.k === q.a;
        e.currentTarget.classList.add(right ? 'right' : 'wrong');
        if (!right) opts.querySelectorAll('button')[order.findIndex(x => x.k === q.a)].classList.add('right');
        let pts = 0;
        if (right) { ok++; streak++; best = Math.max(best, streak); pts = q.d * cfg.pointsPerDifficulty + (streak >= 3 ? cfg.streakBonus : 0); score += pts; } else streak = 0;
        fb.replaceChildren(h('div', { class: 'fb ' + (right ? 'ok' : 'ko') }, h('strong', {}, right ? `Corretto! +${pts} punti${streak >= 3 ? ' (bonus serie)' : ''}` : 'Non esatto. '), ' ', q.e));
        nextBtn.style.display = '';
        nextBtn.focus();
      }
    }, o.t)));
    box.replaceChildren(
      h('div', { class: 'progress' }, h('i', { style: `width:${(i / qs.length) * 100}%` })),
      h('p', { class: 'muted' }, `Domanda ${i + 1}/${qs.length} · Punti ${score} · Serie ${streak} · Difficoltà ${'★'.repeat(q.d)}`),
      h('h2', {}, q.q), opts, fb, nextBtn);
  };

  const end = () => {
    const pct = Math.round((ok / qs.length) * 100), st = S.progress.stats;
    st.quizDone++; st.bestStreak = Math.max(st.bestStreak, best);
    st.quizBest[lvKey()] = Math.max(st.quizBest[lvKey()] || 0, pct);
    addXP(score);
    box.replaceChildren(h('div', { class: 'card' }, h('h2', {}, `Risultato: ${ok}/${qs.length} (${pct}%)`),
      h('p', {}, `Punti guadagnati: ${score} XP · Miglior serie: ${best}`),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => location.reload() }, 'Rigioca'), h('a', { class: 'btn', href: '#/test' }, 'Torna ai test'))));
  };
  qs.length ? ask() : box.append(h('p', {}, 'Nessuna domanda disponibile per questo livello.'));
}

/* ---------- COLLEGA LE SCHEDE ---------- */
export function match(app) {
  const list = S.data.matching.exercises.filter(e => e.level === lvKey());
  const box = h('div');
  app.append(h('a', { href: '#/test' }, '← Test'), h('h1', {}, 'Collega le schede'), box);
  const menu = () => box.replaceChildren(h('div', { class: 'grid' }, list.map(e => {
    const d = S.progress.matchDone[e.id];
    return h('button', { class: 'card', onclick: () => play(e) }, h('h3', {}, e.title), h('p', { class: 'muted' }, e.hint), d !== undefined ? h('span', { class: 'tag' }, `✔ completato (${d} errori)`) : null);
  })));
  const play = ex => {
    const cfg = S.data.game.match;
    let selL = null, errors = 0, done = 0;
    const L = shuffle(ex.pairs.map((p, k) => ({ k, t: p[0] }))), R = shuffle(ex.pairs.map((p, k) => ({ k, t: p[1] })));
    const info = h('p', { class: 'muted' }, 'Seleziona un elemento a sinistra, poi quello corrispondente a destra.');
    const bL = L.map(x => h('button', { onclick: e => { if (e.currentTarget.classList.contains('done')) return; bL.forEach(b => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); selL = x; } }, x.t));
    const bR = R.map(x => h('button', {
      onclick: e => {
        const btn = e.currentTarget;
        if (!selL || btn.classList.contains('done')) return;
        if (selL.k === x.k) {
          const lb = bL[L.indexOf(selL)];
          [lb, btn].forEach(b => { b.classList.remove('sel'); b.classList.add('done'); });
          selL = null; done++;
          if (done === ex.pairs.length) finish();
        } else {
          errors++; btn.classList.add('shake'); setTimeout(() => btn.classList.remove('shake'), 350);
          info.textContent = `Non corrisponde. Errori: ${errors}`;
        }
      }
    }, x.t));
    const finish = () => {
      const first = S.progress.matchDone[ex.id] === undefined;
      const pts = first ? Math.max(0, ex.pairs.length * cfg.pointsPerPair - errors * cfg.penaltyWrong) : 0;
      if (first || errors < S.progress.matchDone[ex.id]) S.progress.matchDone[ex.id] = Math.min(errors, S.progress.matchDone[ex.id] ?? errors);
      if (errors === 0) S.progress.stats.matchPerfect++;
      addXP(pts); checkBadges();
      info.replaceChildren(h('div', { class: 'fb ok' }, `Completato! Errori: ${errors}. ${first ? `+${pts} XP` : 'Già completato in precedenza: nessun XP aggiuntivo.'}`),
        h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => play(ex) }, 'Riprova'), h('button', { onclick: menu }, 'Altri esercizi')));
    };
    box.replaceChildren(h('h2', {}, ex.title), info, h('div', { class: 'match' }, h('div', {}, bL), h('div', {}, bR)));
  };
  list.length ? menu() : box.append(h('p', {}, 'Nessun esercizio per questo livello.'));
}

/* ---------- SCENARI ---------- */
const RANK = { none: 0, soft: 1, det: 2, hard: 3 };

export function evaluate(pid, req) {
  const sc = S.data.scenarios, m = sc.matrix[pid], p = S.data.protocols.protocols.find(x => x.id === pid);
  const pro = isPro(), checks = [];
  const add = (status, text, note) => checks.push({ status, text: text + (pro && note ? ` — ${note}` : '') });
  if (req.maxCycleUs != null) {
    if (m.cycleMinUs > req.maxCycleUs) add('fail', `Ciclo richiesto ${fmtUs(req.maxCycleUs)}: ${p.name} non scende sotto ~${fmtUs(m.cycleMinUs)}.`, m.cycleNote);
    else if (m.rt === 'none' && m.cycleMinUs * 5 > req.maxCycleUs) add('warn', `Ciclo ${fmtUs(req.maxCycleUs)}: raggiungibile solo "di solito", senza garanzia e con poco margine.`, m.cycleNote);
    else add('ok', `Ciclo ${fmtUs(req.maxCycleUs)}: compatibile${pro ? ` (minimo tipico ~${fmtUs(m.cycleMinUs)})` : ''}.`, m.cycleNote);
  }
  if (req.rtMin) {
    if (RANK[m.rt] >= RANK[req.rtMin]) add('ok', `Determinismo richiesto (${sc.rtLabels[req.rtMin]}): soddisfatto.`, m.rtNote);
    else add('fail', `Serve ${sc.rtLabels[req.rtMin]}, ma ${p.name} offre: ${sc.rtLabels[m.rt]}.`, m.rtNote);
  }
  if (req.topo) {
    if (p.attrs.topo.includes(req.topo)) add('ok', `Topologia ${sc.topoLabels[req.topo]}: supportata.`);
    else add('fail', `Topologia ${sc.topoLabels[req.topo]} non supportata${req.topo === 'bus' ? ': ' + p.name + ' richiede cablaggio Ethernet, non un bus RS-485' : ''}.`);
  }
  if (req.nodes) {
    if (m.maxNodes >= req.nodes) add('ok', `${req.nodes} nodi: nei limiti.`, m.nodesNote);
    else add('fail', `${req.nodes} nodi: oltre il limite di ${p.name} (${m.maxNodes}).`, m.nodesNote);
  }
  for (const c of req.caps || []) {
    const v = m.caps[c] || 'no', label = sc.capLabels[c], note = m.notes?.[c];
    if (v === 'yes') add('ok', `${cap(label)}: supportato.`, note);
    else if (v === 'partial') add('warn', `${cap(label)}: solo in parte o con componenti aggiuntivi.`, note);
    else add('fail', `${cap(label)}: non previsto da ${p.name}.`, note);
  }
  const verdict = checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'warn') ? 'warn' : 'ok';
  return { checks, verdict };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtUs = us => (us >= 1e6 ? `${us / 1e6} s` : us >= 1000 ? `${us / 1000} ms` : `${us} µs`);

export function scenari(app) {
  const list = S.data.scenarios.scenarios.filter(s => s.level === lvKey());
  const box = h('div');
  app.append(h('a', { href: '#/test' }, '← Test'), h('h1', {}, 'Scenari di fattibilità'), box);
  const menu = () => box.replaceChildren(h('div', { class: 'grid' }, list.map(s =>
    h('button', { class: 'card', onclick: () => play(s) }, h('h3', {}, s.title), S.progress.scenariosSolved.includes(s.id) ? h('span', { class: 'tag' }, '✔ risolto') : null))));
  const play = s => {
    const res = h('div');
    const pick = h('div', { class: 'pick' }, S.data.protocols.protocols.map(p => h('button', {
      onclick: e => {
        pick.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        const r = evaluate(p.id, s.req), pts = S.data.game.scenario;
        const first = !S.progress.scenariosSolved.includes(s.id);
        let msg = '';
        if (r.verdict === 'ok' && first) { S.progress.scenariosSolved.push(s.id); addXP(pts.pointsCorrect); msg = ` +${pts.pointsCorrect} XP`; }
        else if (r.verdict === 'warn' && first) { addXP(pts.pointsPartial); msg = ` +${pts.pointsPartial} XP (scelta con riserve)`; }
        const title = { ok: '✅ Fattibile', warn: '⚠ Fattibile con riserve', fail: '❌ Non fattibile' }[r.verdict];
        const best = S.data.protocols.protocols.filter(x => evaluate(x.id, s.req).verdict === 'ok').map(x => x.name);
        const maybe = S.data.protocols.protocols.filter(x => evaluate(x.id, s.req).verdict === 'warn').map(x => x.name);
        res.replaceChildren(h('h3', {}, `${title}: ${p.name}${msg}`),
          ...r.checks.map(c => h('div', { class: 'chk ' + c.status }, (c.status === 'ok' ? '✔ ' : c.status === 'warn' ? '⚠ ' : '✖ ') + c.text)),
          h('div', { class: 'note analogy' }, h('strong', {}, 'Scelte pienamente adatte: '), best.length ? best.join(', ') : 'nessuna', maybe.length ? h('span', {}, ' · Con riserve: ' + maybe.join(', ')) : null));
      }
    }, p.name)));
    box.replaceChildren(h('button', { onclick: menu }, '← Scenari'), h('h2', {}, s.title), h('div', { class: 'card' }, h('p', {}, s.text), reqTags(s.req)), h('p', {}, 'Quale protocollo sceglieresti?'), pick, res);
  };
  list.length ? menu() : box.append(h('p', {}, 'Nessuno scenario per questo livello.'));
}

function reqTags(r) {
  const sc = S.data.scenarios, t = [];
  if (r.maxCycleUs != null) t.push(`ciclo ≤ ${fmtUs(r.maxCycleUs)}`);
  if (r.rtMin) t.push(sc.rtLabels[r.rtMin]);
  if (r.topo) t.push(`cablaggio ${sc.topoLabels[r.topo]}`);
  if (r.nodes) t.push(`${r.nodes} nodi`);
  (r.caps || []).forEach(c => t.push(sc.capLabels[c]));
  return h('div', {}, t.map(x => h('span', { class: 'tag' }, x)));
}

/* ---------- PROFILO ---------- */
export function profilo(app, { rerender }) {
  const p = S.progress, li = levelInfo(), st = p.stats;
  app.append(
    h('h1', {}, 'Profilo'),
    h('div', { class: 'card' }, h('h2', {}, `Livello ${li.index + 1} · ${li.name}`),
      h('div', { class: 'progress' }, h('i', { style: `width:${li.pct}%` })),
      h('p', { class: 'muted' }, `${p.xp} XP${li.next ? ` · prossimo livello a ${li.next} XP` : ' · livello massimo'}`)),
    h('h2', {}, 'Badge'),
    h('div', { class: 'grid' }, S.data.game.badges.map(b => h('div', { class: 'badge' + (p.badges[b.id] ? '' : ' locked') }, h('span', { class: 'ic' }, b.icon), h('div', {}, h('strong', {}, b.name), h('div', { class: 'muted' }, b.desc))))),
    h('h2', {}, 'Statistiche'),
    h('ul', { class: 'clean' },
      h('li', {}, `Quiz completati: ${st.quizDone} (miglior serie: ${st.bestStreak})`),
      h('li', {}, `Abbinamenti completati: ${Object.keys(p.matchDone).length}`),
      h('li', {}, `Scenari risolti: ${p.scenariosSolved.length}`),
      h('li', {}, `Schede aperte: ${p.visited.length}/${S.data.protocols.protocols.length}`)),
    h('button', { onclick: () => { if (confirm('Azzerare tutti i progressi?')) { S.progress = defProgress(); save(); rerender(); } } }, 'Azzera progressi'));
}
