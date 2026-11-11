// Motore di animazione generico, guidato dai dati di data/animations.json
import { h, svgEl, T, isPro, S, mark } from './core.js';

const W = 800, H = 300, BASE_MS = 1100;

function routesFor(step, anim) {
  const adj = {};
  for (const [a, b] of anim.links) { (adj[a] ||= []).push(b); (adj[b] ||= []).push(a); }
  const bfs = (s, t) => {
    const prev = { [s]: null }, q = [s];
    while (q.length) { const c = q.shift(); if (c === t) break; for (const n of adj[c] || []) if (!(n in prev)) { prev[n] = c; q.push(n); } }
    const path = []; for (let c = t; c != null; c = prev[c]) path.unshift(c);
    return path;
  };
  if (step.path) return [step.path];
  const targets = Array.isArray(step.to) ? step.to : [step.to];
  return targets.map(t => bfs(step.from, t));
}

export function createSim(proto, anim) {
  const nodes = Object.fromEntries(anim.nodes.map(n => [n.id, n]));
  const steps = anim.steps;
  let idx = 0, playing = false, speed = 1, elapsed = 0, last = 0, raf = null, cur = null, stopAfter = false, cycles = 0, tabFrame = null, started = false;

  const root = h('div', { class: 'sim' });
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': anim.title });
  const gLinks = svgEl('g'), gNodes = svgEl('g'), gPk = svgEl('g');
  svg.append(gLinks, gNodes, gPk);
  for (const [a, b] of anim.links) gLinks.append(svgEl('line', { class: 'link', x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y }));
  const nodeG = {};
  for (const n of anim.nodes) {
    const w = Math.max(110, n.label.length * 7.4 + 22);
    const g = svgEl('g', { class: 'node' });
    g.append(svgEl('rect', { x: n.x - w / 2, y: n.y - 23, width: w, height: 46, rx: 8 }));
    const t = svgEl('text', { x: n.x, y: n.y + 5 }); t.textContent = n.label; g.append(t);
    gNodes.append(g); nodeG[n.id] = g;
  }

  const btnPlay = h('button', { class: 'primary', onclick: () => togglePlay() }, '▶ Play');
  const spd = h('select', { 'aria-label': 'Velocità', onchange: e => (speed = parseFloat(e.target.value)) },
    [0.25, 0.5, 1, 2, 4].map(v => h('option', { value: v, selected: v === 1 }, `${v}×`)));
  const ctl = h('div', { class: 'ctl' },
    btnPlay,
    h('button', { onclick: () => stepTo(idx - 1, true), title: 'Passo indietro' }, '⏮'),
    h('button', { onclick: () => stepTo(idx + 1, true), title: 'Passo avanti' }, '⏭'),
    h('button', { onclick: () => { stepTo(0, false); cycles = 0; } }, '↺ Riavvia'),
    h('label', {}, 'Velocità', spd),
    h('span', { class: 'muted', id: 'cyc' }, ''));
  const info = h('div', { class: 'stepinfo' });
  const timeline = h('div', { class: 'row', 'aria-label': 'Passi' });
  const frameBox = h('div');
  root.append(h('h3', {}, anim.title), svg, ctl, info, timeline, frameBox);

  function drawTimeline() {
    timeline.replaceChildren(...steps.map((s, i) =>
      h('button', { class: 'tag chip' + (i === idx ? ' on' : ''), onclick: () => stepTo(i, false, true) }, `${i + 1}. ${s.label}`)));
  }

  function renderInfo() {
    const s = steps[idx];
    info.replaceChildren(
      h('div', {}, h('span', { class: 'tag' }, s.t), ' ', h('strong', {}, s.label), cycles && idx >= anim.loopFrom ? h('span', { class: 'muted' }, `  · ciclo n° ${cycles + 1}`) : null),
      h('p', {}, T(s.note)));
    for (const [id, g] of Object.entries(nodeG)) g.classList.toggle('act', id === s.from || (Array.isArray(s.to) ? s.to : [s.to]).includes(id) || (s.path || []).includes(id));
    if (isPro() && s.frame) { tabFrame = s.frame; renderFrame(); }
    drawTimeline();
  }

  function renderFrame() {
    frameBox.replaceChildren();
    if (!isPro()) return;
    const ids = Object.keys(anim.frames || {});
    if (!ids.length) return;
    tabFrame ||= ids[0];
    const fr = anim.frames[tabFrame];
    const desc = h('div', { class: 'fielddesc' }, 'Clicca su un campo per vedere il significato.');
    const sel = h('div', { class: 'frame' }, fr.fields.map(f => h('button', {
      onclick: e => { sel.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); desc.replaceChildren(h('strong', {}, `${f.n} `), h('span', { class: 'muted' }, `(${f.s}${f.v ? ' · ' + f.v : ''})`), h('p', {}, f.d)); },
      style: `flex:${Math.min(6, Math.max(1, parseInt(f.s) || 1))} 1 auto`
    }, f.n, h('small', {}, f.s))));
    frameBox.append(h('h3', {}, 'Frame: ', fr.title),
      ...(ids.length > 1 ? [h('div', { class: 'row' }, ids.map(id => h('button', { class: 'tag chip' + (id === tabFrame ? ' on' : ''), onclick: () => { tabFrame = id; renderFrame(); } }, anim.frames[id].title.split('(')[0])))] : []),
      sel, desc);
  }

  function startStep(i) {
    idx = ((i % steps.length) + steps.length) % steps.length;
    const s = steps[idx];
    const routes = routesFor(s, anim);
    cur = { routes, dur: BASE_MS + 380 * (Math.max(...routes.map(r => r.length)) - 2), color: s.color || '#0b6bcb' };
    elapsed = 0;
    gPk.replaceChildren();
    renderInfo();
    draw();
  }

  function pos(route, p) {
    const pts = route.map(id => nodes[id]);
    const seg = pts.slice(1).map((q, k) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y));
    const total = seg.reduce((a, b) => a + b, 0) || 1;
    let d = p * total;
    for (let k = 0; k < seg.length; k++) {
      if (d <= seg[k] || k === seg.length - 1) { const f = seg[k] ? Math.min(1, d / seg[k]) : 1; return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f }; }
      d -= seg[k];
    }
    return pts[0];
  }

  function draw() {
    if (!cur) return;
    const p = Math.min(1, elapsed / cur.dur);
    gPk.replaceChildren();
    cur.routes.forEach((r, k) => {
      const q = pos(r, p);
      gPk.append(svgEl('rect', { class: 'pkt', x: q.x - 11, y: q.y - 8, width: 22, height: 16, rx: 3, fill: cur.color }));
      if (k === 0) { const t = svgEl('text', { class: 'pktlbl', x: q.x, y: q.y - 14 }); t.textContent = steps[idx].label; gPk.append(t); }
    });
  }

  function tick(ts) {
    if (!playing) { raf = null; return; }
    const dt = Math.min(100, ts - last) * speed; last = ts; elapsed += dt;
    draw();
    if (elapsed >= cur.dur + 250 / speed) {
      if (stopAfter) { stopAfter = false; setPlaying(false); elapsed = cur.dur; draw(); return; }
      let n = idx + 1;
      if (n >= steps.length) { n = anim.loopFrom; cycles++; }
      startStep(n);
    }
    raf = requestAnimationFrame(tick);
  }

  function setPlaying(v) {
    playing = v; btnPlay.textContent = v ? '⏸ Pausa' : '▶ Play';
    if (v) { if (!started) { started = true; mark('animated', proto.id); } last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
  }
  function togglePlay() { stopAfter = false; setPlaying(!playing); }
  function stepTo(i, once, keepPlaying) {
    startStep(i);
    if (once) { stopAfter = true; setPlaying(true); } else if (keepPlaying) { stopAfter = false; setPlaying(true); } else setPlaying(false);
  }

  startStep(0);
  renderFrame();
  return { el: root, stop: () => { playing = false; if (raf) cancelAnimationFrame(raf); raf = null; } };
}
