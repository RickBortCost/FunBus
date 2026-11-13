// Motore di animazione generico, guidato dai dati di data/animations.json
import { h, svgEl, T, L, isPro, S, mark } from './core.js';

const W = 800, H = 300, BASE_MS = 1100;

// Tipi di pacchetto: ognuno ha forma, colore e tratteggio propri (non solo il colore).
export const KINDS = {
  cyc: 'Dati ciclici / polling',
  acy: 'Aciclico (setup, parametri, richieste)',
  alm: 'Evento / allarme',
  tok: 'Token / controllo (SYNC, ACK)',
  err: 'Errore (frame corrotto o eccezione)'
};
const FAULTS = { cable: 'Cavo interrotto', node: 'Nodo perso', crc: 'CRC errato' };
const GENERIC = {
  cable: { b: 'Il cavo è interrotto: i messaggi che devono passare di lì non arrivano più.', p: 'Collegamento fisico interrotto: i nodi oltre il guasto non sono più raggiungibili e i timeout del protocollo segnalano l\'errore.' },
  node: { b: 'Un dispositivo è spento o guasto: non riceve e non risponde più.', p: 'Nodo assente: le richieste restano senza risposta fino al timeout; il comportamento dipende dal protocollo e dalla configurazione.' },
  crc: { b: 'Un disturbo ha rovinato il messaggio: chi lo riceve se ne accorge e lo scarta.', p: 'Il controllo di integrità del frame non corrisponde: il ricevitore scarta il frame; la ripetizione dipende dal protocollo.' }
};
const OUTCOME = {
  ok: ['✔', 'Questo passo non è toccato dal guasto.'],
  lost: ['✖', 'Il messaggio di questo passo non arriva a destinazione.'],
  nosend: ['✖', 'Il nodo guasto non trasmette: questo messaggio non parte.'],
  corrupt: ['✖', 'Il frame arriva alterato e viene scartato da chi lo riceve.']
};
const CHECK_FIELD = /FCS|CRC|check|CKS|^PB$/i;

export const kindOf = s => (KINDS[s.kind] ? s.kind : s.t === 'ciclo' ? 'cyc' : s.t === 'evento' ? 'alm' : 'acy');

export function fmtUs(us) {
  const loc = S.lang === 'en' ? 'en-US' : 'it-IT';
  const f = (v, u) => `${v.toLocaleString(loc, { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 })} ${u}`;
  return us >= 1e6 ? f(us / 1e6, 's') : us >= 1000 ? f(us / 1000, 'ms') : f(us, 'µs');
}

// Forma del pacchetto, centrata sull'origine.
export function pktShape(kind) {
  const g = svgEl('g', { class: 'pkt k-' + kind });
  if (kind === 'cyc') g.append(svgEl('rect', { x: -12, y: -8, width: 24, height: 16, rx: 8 }));
  else if (kind === 'acy') g.append(svgEl('rect', { x: -12, y: -8, width: 24, height: 16, rx: 1.5 }), svgEl('path', { class: 'pd', d: 'M-12 -8L0 1L12 -8' }));
  else if (kind === 'alm') g.append(svgEl('path', { d: 'M0 -11L13 9H-13Z' }), svgEl('path', { class: 'pd', d: 'M0 -4V2.5M0 5.6V5.8' }));
  else if (kind === 'tok') g.append(svgEl('circle', { r: 10 }), svgEl('circle', { class: 'pd', r: 4.5 }));
  else g.append(svgEl('path', { d: 'M-5 -11H5L11 -5V5L5 11H-5L-11 5V-5Z' }), svgEl('path', { class: 'pd', d: 'M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5' }));
  return g;
}

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
  let nodes = {}, NW = W, NH = H, narrowNet = false;
  const steps = anim.steps;
  const allRoutes = steps.map(s => routesFor(s, anim));
  let idx = 0, playing = false, speed = 1, elapsed = 0, last = 0, raf = null, cur = null, stopAfter = false, cycles = 0, tabFrame = null, started = false;
  let fault = null, fields = null, pinned = false, txIdx = -1, track = null, seqDot = null, seqW = 0;
  // Guasto simulato: collegamento e nodo coinvolti (dai dati, con valori predefiniti).
  const fLink = anim.faults?.cable?.link || anim.links[anim.links.length - 1];
  const fNode = anim.faults?.node?.id || anim.nodes[anim.nodes.length - 1].id;
  const onLink = (a, b) => (a === fLink[0] && b === fLink[1]) || (a === fLink[1] && b === fLink[0]);

  const root = h('div', { class: 'sim' });
  const svg = svgEl('svg', { role: 'img', 'aria-label': anim.title });
  const gLinks = svgEl('g'), gNodes = svgEl('g'), gFault = svgEl('g'), gPk = svgEl('g');
  svg.append(gLinks, gNodes, gFault, gPk);
  let linkEl = [], nodeG = {}, nodeW = {}, nodeLines = {};
  // Disposizione dei nodi: quella dei dati (800×300) oppure, negli spazi stretti, ruotata in verticale
  // con una riga per ogni colonna originale, così i testi restano a grandezza naturale.
  function layoutNet(narrow) {
    narrowNet = narrow; nodes = {}; nodeW = {}; nodeLines = {};
    if (!narrow) {
      NW = W; NH = H;
      for (const n of anim.nodes) { nodes[n.id] = { ...n }; nodeW[n.id] = Math.max(110, n.label.length * 7.4 + 22); nodeLines[n.id] = [n.label]; }
      return;
    }
    NW = 380;
    const cols = [...new Set(anim.nodes.map(n => n.x))].sort((a, b) => a - b);
    NH = Math.max(230, (cols.length - 1) * 112 + 96);
    for (const [r, x] of cols.entries()) {
      const row = anim.nodes.filter(n => n.x === x).sort((a, b) => a.y - b.y);
      row.forEach((n, j) => {
        const w = Math.min(Math.max(92, n.label.length * 6.8 + 20), NW / row.length - 10);
        nodes[n.id] = { ...n, x: (NW * (j + 0.5)) / row.length, y: cols.length > 1 ? 48 + (r * (NH - 96)) / (cols.length - 1) : NH / 2 };
        nodeW[n.id] = w; nodeLines[n.id] = wrap(n.label, Math.max(5, Math.floor((w - 14) / 6.6)));
      });
    }
  }
  function buildNet() {
    svg.setAttribute('viewBox', `0 0 ${NW} ${NH}`); svg.classList.toggle('narrow', narrowNet);
    gLinks.replaceChildren(); gNodes.replaceChildren(); linkEl = []; nodeG = {};
    for (const [a, b] of anim.links) { const l = svgEl('line', { class: 'link', x1: nodes[a].x, y1: nodes[a].y, x2: nodes[b].x, y2: nodes[b].y }); gLinks.append(l); linkEl.push([a, b, l]); }
    for (const n of Object.values(nodes)) {
      const w = nodeW[n.id], lines = nodeLines[n.id];
      const g = svgEl('g', { class: 'node' });
      g.append(svgEl('rect', { x: n.x - w / 2, y: n.y - 23, width: w, height: 46, rx: 16 }));
      lines.forEach((l, k) => { const t = svgEl('text', { x: n.x, y: n.y + 5 + (k - (lines.length - 1) / 2) * 15 }); t.textContent = l; g.append(t); });
      if (lines.join(' ').replace(/- /g, '-') !== n.label) { const t = svgEl('title', {}); t.textContent = n.label; g.append(t); }
      gNodes.append(g); nodeG[n.id] = g;
    }
  }
  // Distanza dal centro del nodo al bordo del suo riquadro lungo la direzione da cui arriva il pacchetto.
  const edge = (id, fromId) => { const a = nodes[id], b = nodes[fromId] || a, dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), d = Math.hypot(dx, dy) || 1; return Math.min(dx ? (nodeW[id] / 2) / (dx / d) : Infinity, dy ? 23 / (dy / d) : Infinity) + 8; };
  layoutNet(false); buildNet();

  const btnPlay = h('button', { class: 'primary', onclick: () => togglePlay() }, '▶ Play');
  const spd = h('select', { 'aria-label': 'Velocità', onchange: e => (speed = parseFloat(e.target.value)) },
    [0.25, 0.5, 1, 2, 4].map(v => h('option', { value: v, selected: v === 1 }, `${v}×`)));
  const fRow = h('div', { class: 'row faults', hidden: true },
    Object.entries(FAULTS).map(([k, l]) => h('button', { class: 'tag chip', 'data-f': k, 'aria-pressed': 'false', onclick: () => setFault(fault === k ? null : k) }, l)),
    h('button', { class: 'tag chip', 'data-f': '', onclick: () => setFault(null) }, '↺ Ripristina'));
  const fBtn = h('button', { class: 'faultbtn', 'aria-expanded': 'false', onclick: () => { fRow.hidden = !fRow.hidden; fBtn.setAttribute('aria-expanded', String(!fRow.hidden)); } }, '⚠ Simula guasto');
  const ctl = h('div', { class: 'ctl' },
    btnPlay,
    h('button', { onclick: () => stepTo(idx - 1, true), title: 'Passo indietro' }, '⏮'),
    h('button', { onclick: () => stepTo(idx + 1, true), title: 'Passo avanti' }, '⏭'),
    h('button', { onclick: () => { stepTo(0, false); cycles = 0; } }, '↺ Riavvia'),
    h('label', {}, 'Velocità', spd),
    fBtn);
  const legend = h('div', { class: 'legend', role: 'group', 'aria-label': 'Legenda dei tipi di pacchetto' }, Object.entries(KINDS).map(([k, l]) => {
    const s = svgEl('svg', { viewBox: '-15 -13 30 26', width: 30, height: 26, 'aria-hidden': 'true' });
    s.append(pktShape(k));
    return h('span', {}, s, l);
  }));
  const info = h('div', { class: 'stepinfo' });
  const faultBox = h('div', { 'aria-live': 'polite' });
  const seqBox = h('div', { class: 'seq' });
  const frameBox = h('div');
  root.append(h('h3', {}, anim.title), svg, legend, ctl, fRow, info, faultBox,
    h('h3', {}, 'Diagramma a sequenza'), seqBox,
    h('p', { class: 'muted small' }, 'Tempi indicativi (ordine di grandezza): dipendono da velocità, configurazione e implementazione.', anim.timeNote ? ' ' : null, anim.timeNote ? h('span', {}, anim.timeNote) : null),
    frameBox);

  /* ---- geometria dei percorsi ---- */
  function geom(route) {
    const pts = route.map(id => nodes[id]);
    const seg = pts.slice(1).map((q, k) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y));
    return { pts, seg, total: seg.reduce((a, b) => a + b, 0) || 1 };
  }
  function at({ pts, seg, total }, p) {
    let d = p * total;
    for (let k = 0; k < seg.length; k++) {
      if (d <= seg[k] || k === seg.length - 1) { const f = seg[k] ? Math.min(1, d / seg[k]) : 1; return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * f, y: pts[k].y + (pts[k + 1].y - pts[k].y) * f }; }
      d -= seg[k];
    }
    return pts[0];
  }

  /* ---- guasti ---- */
  // Effetto del guasto su un percorso: dove si ferma il pacchetto e perché.
  function effect(route) {
    if (!fault) return null;
    const { seg, total } = geom(route);
    const acc = k => seg.slice(0, k).reduce((a, b) => a + b, 0);
    if (fault === 'node') {
      if (route[0] === fNode) return { type: 'nosend', stop: 0, a: fNode, b: fNode };
      const k = route.indexOf(fNode);
      return k > 0 ? { type: 'lost', stop: Math.max(0, acc(k) - edge(fNode, route[k - 1])) / total, a: fNode, b: fNode, prev: route[k - 1] } : null;
    }
    const k = route.findIndex((id, i) => i + 1 < route.length && onLink(id, route[i + 1]));
    if (k < 0) return null;
    const mid = (acc(k) + seg[k] / 2) / total;
    return fault === 'cable' ? { type: 'lost', stop: mid, a: route[k], b: route[k + 1] } : { type: 'corrupt', from: mid, stop: Math.max(mid, (acc(k + 1) - edge(route[k + 1], route[k])) / total), a: route[k + 1], b: route[k + 1], prev: route[k] };
  }
  const effectsOf = i => allRoutes[i].map(effect);
  const statusOf = i => { const t = effectsOf(i).map(e => e?.type); return ['nosend', 'lost', 'corrupt'].find(x => t.includes(x)) || null; };

  function drawFault() {
    gFault.replaceChildren();
    for (const [a, b, l] of linkEl) { l.classList.toggle('broken', fault === 'cable' && onLink(a, b)); l.classList.toggle('noisy', fault === 'crc' && onLink(a, b)); }
    for (const [id, g] of Object.entries(nodeG)) g.classList.toggle('dead', fault === 'node' && id === fNode);
    if (fault === 'node') {
      const n = nodes[fNode], m = svgEl('g', { class: 'fmark', transform: `translate(${n.x + nodeW[fNode] / 2 - 4} ${n.y - 21})` });
      m.append(svgEl('circle', { r: 11 }), svgEl('path', { d: 'M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5' }));
      gFault.append(m);
    } else if (fault) {
      const a = nodes[fLink[0]], b = nodes[fLink[1]];
      const m = svgEl('g', { class: 'fmark' + (fault === 'crc' ? ' noise' : ''), transform: `translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})` });
      if (fault === 'cable') m.append(svgEl('circle', { r: 13 }), svgEl('path', { d: 'M-6 6L-1 -6M1 6L6 -6' }));
      else m.append(svgEl('circle', { r: 13 }), svgEl('path', { class: 'bolt', d: 'M3 -9L-5 1H0L-3 9L5 -1H0Z' }));
      gFault.append(m);
    }
  }

  function renderFault() {
    fRow.querySelectorAll('[data-f]').forEach(b => { if (b.dataset.f) { const on = b.dataset.f === fault; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } else b.hidden = !fault; });
    fBtn.classList.toggle('on', !!fault);
    if (!fault) { faultBox.replaceChildren(); return; }
    const txt = T(anim.faults?.[fault]) || GENERIC[fault][L()];
    const [sym, out] = OUTCOME[statusOf(idx) || 'ok'];
    faultBox.replaceChildren(h('div', { class: 'note fault' },
      h('div', {}, h('strong', {}, 'Guasto simulato'), ' · ', h('strong', {}, FAULTS[fault])),
      h('p', {}, txt),
      h('div', { class: 'chk ' + (sym === '✔' ? 'ok' : 'fail') }, `${sym} `, h('span', {}, out))));
  }

  function setFault(f) {
    fault = f;
    if (cur) cur.fx = cur.routes.map(effect);
    drawFault(); renderFault(); drawSeq(); renderFrame(); draw();
  }

  /* ---- diagramma a sequenza ---- */
  function wrap(label, max) {
    const out = [''];
    for (const w of label.split(/ |(?<=-)(?=\S{4})/)) {
      const l = out[out.length - 1], j = l.endsWith('-') ? '' : ' ';
      if (!l) out[out.length - 1] = w; else if ((l + j + w).length <= max) out[out.length - 1] = l + j + w; else out.push(w);
    }
    const two = out.slice(0, 2).map(l => (l.length > max ? l.slice(0, Math.max(1, max - 1)) + '…' : l));
    if (out.length > 2) two[1] = two[1].replace(/…?$/, '…');
    return two;
  }

  function drawSeq() {
    const w = Math.max(300, Math.min(800, Math.round(seqBox.clientWidth || 800)));
    seqW = w;
    const order = anim.nodes.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const GL = 26, GR = w < 480 ? 64 : 84, HEAD = 38, RH = 32, LH = 24;
    const colW = (w - GL - GR) / order.length;
    const X = Object.fromEntries(order.map((n, i) => [n.id, GL + colW * (i + 0.5)]));
    const rowY = i => HEAD + i * RH + RH / 2 + (i >= anim.loopFrom ? LH : 0);
    const hgt = HEAD + steps.length * RH + LH + 6;
    const s = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, role: 'group', 'aria-label': 'Diagramma a sequenza dei passi' });
    const text = (cls, x, y, str, anchor) => { const t = svgEl('text', { class: cls, x, y, ...(anchor ? { 'text-anchor': anchor } : {}) }); t.textContent = str; return t; };
    // banda del ciclo
    const bandY = HEAD + anim.loopFrom * RH;
    s.append(svgEl('rect', { class: 'sband', x: 1, y: bandY + 1, width: w - 2, height: hgt - bandY - 3, rx: 10 }));
    const rtNone = proto.attrs?.rt === 'none';
    const ct = svgEl('text', { class: 'scycle', x: 10, y: bandY + LH / 2 + 5 });
    const span = str => { const t = svgEl('tspan', {}); t.textContent = str; return t; };
    if (anim.cycleUs) ct.append(span('↻ '), span(rtNone ? 'Periodo tipico' : 'Ciclo tipico'), span(` ≈ ${fmtUs(anim.cycleUs)} `), ...(rtNone ? [span('(non garantito)')] : []));
    else ct.append(span('↻ '), span(rtNone ? 'Sequenza ripetuta: nessun ciclo fisso' : 'Sequenza ripetuta'));
    // intestazioni e linee di vita
    const narrow = colW < 62, maxCh = Math.max(4, Math.floor((colW - 4) / (narrow ? 5.3 : 6.2)));
    for (const n of order) {
      const lines = wrap(n.label, maxCh);
      lines.forEach((l, k) => s.append(text('shead' + (narrow ? ' sm' : ''), X[n.id], (lines.length === 1 ? 22 : 13) + k * 12, l, 'middle')));
      if (lines.join(' ').replace(/- /g, '-') !== n.label) { const t = svgEl('title', {}); t.textContent = n.label; s.lastChild.append(t); }
      s.append(svgEl('line', { class: 'slife', x1: X[n.id], y1: HEAD - 4, x2: X[n.id], y2: hgt - 6 }));
    }
    s.append(text('shead', w - 8, 22, 'Tempo', 'end'), ct);
    seqDot = null; track = null;
    steps.forEach((st, i) => {
      const y = rowY(i), fxs = effectsOf(i), fs = fxs.every(Boolean) && fxs.length ? 'all' : null, k = kindOf(st);
      const g = svgEl('g', { class: `srow k-${fs ? 'err' : k}${i === idx ? ' on' : ''}`, role: 'button', tabindex: 0, 'aria-label': `Passo ${i + 1}: ${st.label}` });
      if (i === idx) g.setAttribute('aria-current', 'step');
      g.addEventListener('click', () => stepTo(i, false, true));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepTo(i, false, true); } });
      g.append(svgEl('rect', { class: 'sbg', x: 3, y: y - RH / 2 + 2, width: w - 6, height: RH - 4, rx: 9 }), text('snum', 14, y + 4, String(i + 1), 'middle'));
      const src = st.path ? st.path[0] : st.from, x1 = X[src];
      const round = !!st.path && st.path[st.path.length - 1] === src && st.path.length > 2;
      const tg = st.path ? (round ? [] : [st.path[st.path.length - 1]]) : (Array.isArray(st.to) ? st.to : [st.to]);
      const via = st.path ? st.path.slice(1, round ? undefined : -1).filter(id => id !== src) : [];
      const ly = y + 6;
      let xa = x1, xb = x1, far = x1;
      if (round) {
        far = st.path.map(id => X[id]).reduce((p, q) => (Math.abs(q - x1) > Math.abs(p - x1) ? q : p), x1);
        const d = Math.sign(far - x1) || 1;
        g.append(svgEl('path', { class: 'sline', d: `M${x1} ${ly - 3}H${far}V${ly + 3}H${x1 + 9 * d}` }), svgEl('path', { class: 'shd', d: `M${x1} ${ly + 3}l${9 * d} -4v8Z` }));
        xa = Math.min(x1, far); xb = Math.max(x1, far);
      } else {
        const xs = tg.map(id => X[id]);
        xa = Math.min(x1, ...xs); xb = Math.max(x1, ...xs);
        far = xs.reduce((p, q) => (Math.abs(q - x1) > Math.abs(p - x1) ? q : p), x1);
        g.append(svgEl('path', { class: 'sline', d: `M${xa} ${ly}H${xb}` }));
        for (const x of xs) { const d = Math.sign(x - x1) || 1; g.append(svgEl('path', { class: 'shd', d: `M${x} ${ly}l${-9 * d} -4v8Z` })); }
      }
      if (i === idx) track = { x1, x2: far, y: ly, round };
      for (const id of new Set(via)) g.append(svgEl('circle', { class: 'svia', cx: X[id], cy: ly - (round ? 3 : 0), r: 3 }));
      const dot = pktShape(fs ? 'err' : k); dot.setAttribute('transform', `translate(${x1} ${ly - (round ? 3 : 0)}) scale(.5)`); g.append(dot);
      const tw = st.label.length * 6.2, lx = Math.max(GL + tw / 2, Math.min(w - GR - tw / 2, (xa + xb) / 2));
      g.append(text('slbl', lx, y - 5, st.label, 'middle'), text('stime', w - 8, y + 4, st.us != null ? `≈ ${fmtUs(st.us)}` : '—', 'end'));
      for (const e of new Set(fxs.filter(Boolean).map(e => (e.type === 'nosend' ? x1 + 16 * (Math.sign(far - x1) || 1) : e.type === 'lost' && e.a !== e.b ? (X[e.a] + X[e.b]) / 2 : X[e.a] - 16 * (Math.sign(X[e.a] - X[e.prev]) || 1))))) {
        const m = svgEl('g', { class: 'sfail', transform: `translate(${e} ${ly - (round ? 3 : 0)})` });
        m.append(svgEl('circle', { r: 7 }), svgEl('path', { d: 'M-3 -3L3 3M3 -3L-3 3' }));
        g.append(m);
      }
      if (i === idx) { seqDot = svgEl('circle', { class: 'sdot', r: 4.5, cx: x1, cy: track.y - (round ? 3 : 0) }); g.append(seqDot); }
      s.append(g);
    });
    const foc = seqBox.contains(document.activeElement) ? [...seqBox.querySelectorAll('.srow')].indexOf(document.activeElement) : -1;
    seqBox.replaceChildren(s);
    if (foc >= 0) s.querySelectorAll('.srow')[foc]?.focus({ preventScroll: true });
  }

  /* ---- pannello informazioni e frame ---- */
  function renderInfo() {
    const s = steps[idx];
    info.replaceChildren(
      h('div', {}, h('span', { class: 'tag' }, s.t), ' ', h('strong', {}, s.label), s.us != null ? h('span', { class: 'tag' }, `≈ ${fmtUs(s.us)}`) : null,
        cycles && idx >= anim.loopFrom ? h('span', { class: 'muted' }, `  · ciclo n° ${cycles + 1}`) : null),
      h('p', {}, T(s.note)));
    markActive();
    if (isPro() && s.frame) tabFrame = s.frame;
    renderFrame(); renderFault(); drawSeq();
  }

  function markActive() {
    const s = steps[idx];
    for (const [id, g] of Object.entries(nodeG)) g.classList.toggle('act', id === s.from || (Array.isArray(s.to) ? s.to : [s.to]).includes(id) || (s.path || []).includes(id));
  }

  function showField(f, desc, auto) {
    desc.replaceChildren(h('strong', {}, `${f.n} `), h('span', { class: 'muted' }, `(${f.s}${f.v ? ' · ' + f.v : ''})`), auto ? h('span', { class: 'tag' }, 'in transito') : null, h('p', {}, f.d));
  }

  function renderFrame() {
    frameBox.replaceChildren(); fields = null; txIdx = -1; pinned = false;
    if (!isPro()) return;
    const ids = Object.keys(anim.frames || {});
    if (!ids.length) return;
    tabFrame ||= ids[0];
    const fr = anim.frames[tabFrame];
    const desc = h('div', { class: 'fielddesc' }, 'Clicca su un campo per vedere il significato: durante l\'animazione i campi si accendono mentre il pacchetto passa.');
    const weight = f => Math.min(6, Math.max(1, parseInt(f.s) || 1));
    const corrupt = fault === 'crc' && steps[idx].frame === tabFrame && statusOf(idx) === 'corrupt';
    const sel = h('div', { class: 'frame' }, fr.fields.map(f => h('button', {
      class: corrupt && CHECK_FIELD.test(f.n) ? 'bad' : '',
      onclick: e => { pinned = true; sel.querySelectorAll('button').forEach(b => b.classList.remove('on', 'tx')); e.currentTarget.classList.add('on'); showField(f, desc, false); },
      style: `flex:${weight(f)} 1 auto`
    }, f.n, h('small', {}, f.s))));
    const tot = fr.fields.reduce((a, f) => a + weight(f), 0);
    let acc = 0;
    fields = { live: steps[idx].frame === tabFrame, btns: [...sel.children], list: fr.fields, ends: fr.fields.map(f => (acc += weight(f)) / tot), desc };
    frameBox.append(h('h3', {}, 'Frame: ', fr.title),
      ...(ids.length > 1 ? [h('div', { class: 'row' }, ids.map(id => h('button', { class: 'tag chip' + (id === tabFrame ? ' on' : ''), onclick: () => { tabFrame = id; renderFrame(); } }, anim.frames[id].title.split('(')[0])))] : []),
      sel, desc);
  }

  // Professional: evidenzia il campo del frame "in transito" in base all'avanzamento del pacchetto.
  function highlightField(p) {
    if (!fields?.live) return;
    const i = p >= 1 ? -1 : fields.ends.findIndex(e => p < e);
    if (i === txIdx) return;
    txIdx = i;
    fields.btns.forEach((b, k) => b.classList.toggle('tx', k === i));
    if (i >= 0 && !pinned) showField(fields.list[i], fields.desc, true);
  }

  function startStep(i) {
    idx = ((i % steps.length) + steps.length) % steps.length;
    const s = steps[idx];
    const routes = allRoutes[idx];
    cur = { routes, geo: routes.map(geom), fx: routes.map(effect), kind: kindOf(s), dur: BASE_MS + 380 * (Math.max(...routes.map(r => r.length)) - 2) };
    elapsed = 0;
    gPk.replaceChildren();
    renderInfo();
    draw();
  }

  function draw() {
    if (!cur) return;
    const p = Math.min(1, elapsed / cur.dur);
    gPk.replaceChildren();
    cur.routes.forEach((r, k) => {
      const fx = cur.fx[k];
      let pp = p, kind = cur.kind, dead = false;
      if (fx) {
        if (fx.type === 'corrupt' && p >= fx.from) kind = 'err';
        if (p >= fx.stop) { pp = fx.stop; dead = true; kind = 'err'; }
      }
      const q = at(cur.geo[k], pp);
      if (fx?.type === 'nosend') q.y -= 40;
      const g = pktShape(kind);
      g.setAttribute('transform', `translate(${q.x} ${q.y})`);
      if (dead) g.classList.add('lost');
      gPk.append(g);
      if (k === 0) { const lbl = steps[idx].label, half = lbl.length * 3.3 + 4; const t = svgEl('text', { class: 'pktlbl' + (dead ? ' lost' : ''), x: Math.max(half, Math.min(NW - half, q.x)), y: q.y - 16 }); t.textContent = lbl; gPk.append(t); }
    });
    if (seqDot && track) {
      const f = track.round ? 1 - Math.abs(1 - 2 * p) : p;
      seqDot.setAttribute('cx', track.x1 + (track.x2 - track.x1) * f);
      if (track.round) seqDot.setAttribute('cy', track.y + (p < 0.5 ? -3 : 3));
    }
    highlightField(p);
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
  // Il diagramma a sequenza si adatta alla larghezza disponibile (testi sempre leggibili, anche a 390 px).
  const fit = () => {
    const n = (root.clientWidth || 800) < 560;
    if (n !== narrowNet) { layoutNet(n); buildNet(); cur.geo = cur.routes.map(geom); cur.fx = cur.routes.map(effect); markActive(); drawFault(); draw(); }
    const w = Math.max(300, Math.min(800, Math.round(seqBox.clientWidth || 800)));
    if (w !== seqW) { drawSeq(); draw(); }
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(seqBox);
  return { el: root, stop: () => { playing = false; if (raf) cancelAnimationFrame(raf); raf = null; ro?.disconnect(); } };
}
