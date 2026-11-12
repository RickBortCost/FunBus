// Grafici di confronto disegnati a mano in SVG: radar, mappa determinismo/performance, piramidi OSI sovrapposte.
import { S, h, svgEl, toast } from './core.js';
import { score as secScore } from './normative.js';
import { logo } from './logos.js';
import { fmtUs } from './sim.js';

export const MAX_SERIES = 6;
const AXES = [['cycle', 'Ciclo'], ['det', 'Determinismo'], ['sec', 'Sicurezza'], ['speed', 'Velocità'], ['topo', 'Topologie']];
const RT_SCORE = { hard: 5, det: 4, soft: 2.5, none: 1 };
const DASH = ['', '7 3', '2 3', '9 3 2 3', '5 2', '1 4'];
const OSI = { 7: 'Applicazione', 6: 'Presentazione', 5: 'Sessione', 4: 'Trasporto', 3: 'Rete', 2: 'Collegamento dati', 1: 'Fisico' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const short = s => s.split(' (')[0];
const num = (v, d = 1) => v.toLocaleString(S.lang === 'en' ? 'en-US' : 'it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMbps = m => (m >= 1000 ? `${num(m / 1000, 0)} Gbit/s` : m >= 1 ? `${num(m, 0)} Mbit/s` : `${num(m * 1000, m * 1000 < 100 ? 1 : 0)} kbit/s`);

// Punteggi indicativi 0–5 ricavati dai dati (scenarios.matrix, attrs, normative): servono a confrontare, non a classificare.
export function scores(p) {
  const m = S.data.scenarios.matrix[p.id], mbps = p.attrs.mbps || 1, nt = S.data.topologies.topologies.length;
  const v = {
    cycle: clamp(5 - (Math.log10(m.cycleMinUs) - 1.5) * (4.5 / 4.2), 0.5, 5),
    det: RT_SCORE[m.rt] ?? 1,
    sec: secScore(p.id) / 2,
    speed: clamp(0.5 + ((Math.log10(mbps) + 2.92) / 5.92) * 4.5, 0.5, 5),
    topo: (p.attrs.topo.length / nt) * 5
  };
  v.perf = (v.cycle + v.speed) / 2;
  v.raw = { cycle: `~${fmtUs(m.cycleMinUs)}`, det: S.data.scenarios.rtLabels[m.rt], sec: `${secScore(p.id)}/10`, speed: fmtMbps(mbps), topo: `${p.attrs.topo.length} su ${nt}` };
  return v;
}

/* ---- serie: colore + tratteggio + forma del marcatore (mai solo il colore) ---- */
function marker(slot, x, y, r = 5) {
  const a = { class: `mk s${slot + 1}` };
  if (slot === 0) return svgEl('circle', { ...a, cx: x, cy: y, r });
  if (slot === 1) return svgEl('rect', { ...a, x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8 });
  const poly = pts => svgEl('polygon', { ...a, points: pts.map(([dx, dy]) => `${x + dx * r},${y + dy * r}`).join(' ') });
  if (slot === 2) return poly([[0, -1.25], [1.15, 0.85], [-1.15, 0.85]]);
  if (slot === 3) return poly([[0, -1.3], [1.3, 0], [0, 1.3], [-1.3, 0]]);
  if (slot === 4) return poly([[0, 1.25], [1.15, -0.85], [-1.15, -0.85]]);
  return poly([[0, -1.25], [1.2, -0.4], [0.75, 1.05], [-0.75, 1.05], [-1.2, -0.4]]);
}
function sample(slot) {
  const s = svgEl('svg', { viewBox: '0 0 40 16', width: 40, height: 16, class: 'ssample', 'aria-hidden': 'true' });
  s.append(svgEl('line', { class: `sl s${slot + 1}`, x1: 2, y1: 8, x2: 38, y2: 8, 'stroke-dasharray': DASH[slot] }), marker(slot, 20, 8, 4.2));
  return s;
}

function tipLayer() {
  const tip = h('div', { class: 'charttip', role: 'status', hidden: true });
  const wrap = h('div', { class: 'chartwrap' }, tip);
  const show = (el, kids) => {
    tip.replaceChildren(...kids); tip.hidden = false;
    const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const x = clamp(r.left + r.width / 2 - w.left, tip.offsetWidth / 2 + 2, w.width - tip.offsetWidth / 2 - 2);
    const above = r.top - w.top - tip.offsetHeight - 8;
    tip.style.left = `${x - tip.offsetWidth / 2}px`; tip.style.top = `${above >= 0 ? above : r.bottom - w.top + 8}px`;
  };
  const bind = (el, kids) => {
    el.addEventListener('pointerenter', () => show(el, kids())); el.addEventListener('focus', () => show(el, kids()));
    el.addEventListener('pointerleave', () => (tip.hidden = true)); el.addEventListener('blur', () => (tip.hidden = true));
  };
  return { wrap, bind };
}
const tipLine = (name, label, val, raw) => [h('strong', {}, name), h('div', {}, h('span', {}, label), val != null ? `: ${num(val)}/5 ` : ' ', raw ? h('span', { class: 'muted' }, '(', h('span', {}, raw), ')') : null)];

/* ---- radar ---- */
function radar(series) {
  const W = 460, H = 330, cx = 230, cy = 172, R = 112, n = AXES.length;
  const pt = (k, v) => { const a = ((-90 + (k * 360) / n) * Math.PI) / 180; return [cx + Math.cos(a) * R * (v / 5), cy + Math.sin(a) * R * (v / 5)]; };
  const { wrap, bind } = tipLayer();
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart radar', role: 'img', 'aria-label': 'Grafico radar dei protocolli selezionati' });
  for (let l = 1; l <= 5; l++) svg.append(svgEl('polygon', { class: 'rgrid' + (l === 5 ? ' out' : ''), points: AXES.map((_, k) => pt(k, l).join(',')).join(' ') }));
  AXES.forEach(([, label], k) => {
    const [x, y] = pt(k, 5), [lx, ly] = pt(k, 5.9);
    svg.append(svgEl('line', { class: 'rgrid', x1: cx, y1: cy, x2: x, y2: y }));
    const t = svgEl('text', { class: 'clbl', x: lx, y: ly + 4, 'text-anchor': Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end' }); t.textContent = label; svg.append(t);
  });
  for (const l of [1, 3, 5]) { const t = svgEl('text', { class: 'ctick', x: cx + 4, y: cy - (R * l) / 5 + 3 }); t.textContent = String(l); svg.append(t); }
  for (const { p, slot, sc } of series) svg.append(svgEl('polygon', { class: `rarea s${slot + 1}`, points: AXES.map(([key], k) => pt(k, sc[key]).join(',')).join(' '), 'stroke-dasharray': DASH[slot] }));
  for (const { p, slot, sc } of series) AXES.forEach(([key, label], k) => {
    const [x, y] = pt(k, sc[key]);
    const hit = svgEl('circle', { class: 'chit', cx: x, cy: y, r: 11, tabindex: 0, role: 'img', 'aria-label': `${p.name} · ${label}: ${num(sc[key])}/5` });
    // punti sovrapposti: il riquadro elenca tutte le serie con lo stesso valore
    bind(hit, () => series.filter(o => Math.abs(o.sc[key] - sc[key]) < 0.25).flatMap(o => tipLine(o.p.name, label, o.sc[key], o.sc.raw[key])));
    svg.append(marker(slot, x, y), hit);
  });
  wrap.append(svg);
  return wrap;
}

/* ---- mappa a quadranti: determinismo (fasce) × performance ---- */
function quadrant(ps, sel, slots, toggle) {
  const { wrap, bind } = tipLayer();
  const box = h('div');
  const rtL = S.data.scenarios.rtLabels;
  const draw = () => {
    const w = clamp(Math.round(wrap.clientWidth || 640), 300, 760), ML = 12, MR = 12, RH = 20, HEADH = 22, CAP = 22;
    const X = v => ML + ((w - ML - MR) * v) / 5;
    const bands = ['hard', 'det', 'soft', 'none'].map(rt => ({ rt, items: ps.map(p => ({ p, sc: scores(p) })).filter(o => S.data.scenarios.matrix[o.p.id].rt === rt).sort((a, b) => b.sc.perf - a.sc.perf) }));
    let y = CAP + 6;
    const svg = svgEl('svg', { class: 'chart quad', role: 'group', 'aria-label': 'Mappa determinismo e performance' });
    const text = (cls, x, yy, s, anchor) => { const t = svgEl('text', { class: cls, x, y: yy, ...(anchor ? { 'text-anchor': anchor } : {}) }); t.textContent = s; svg.append(t); return t; };
    const body = svgEl('g'), marks = [];
    let split = 0;
    bands.forEach((b, bi) => {
      const hgt = HEADH + Math.max(1, b.items.length) * RH + 6;
      body.append(svgEl('rect', { class: 'qband q' + b.rt, x: 1, y, width: w - 2, height: hgt, rx: 8 }));
      const t = svgEl('text', { class: 'qhead', x: 10, y: y + 15 }); t.textContent = w < 620 ? short(rtL[b.rt]) : rtL[b.rt]; body.append(t);
      b.items.forEach((o, i) => marks.push({ ...o, x: X(o.sc.perf), y: y + HEADH + i * RH + RH / 2 }));
      y += hgt + 4;
      if (bi === 1) { split = y + CAP / 2 + 6; y += 2 * CAP + 10; }
    });
    const hgt = y + CAP + 24;
    svg.setAttribute('viewBox', `0 0 ${w} ${hgt}`); svg.setAttribute('width', w); svg.setAttribute('height', hgt);
    svg.append(body, svgEl('line', { class: 'qaxis', x1: X(2.5), y1: 4, x2: X(2.5), y2: hgt - 22 }), svgEl('line', { class: 'qaxis', x1: 1, y1: split + 9, x2: w - 1, y2: split + 9 }));
    const small = w < 520;
    const cap = (x, yy, s, anchor) => text('qcap', x, yy, s, anchor);
    cap(6, 16, small ? 'Deterministico, più lento' : 'Deterministico ma più lento: sensori, attuatori, bus seriali');
    cap(w - 6, 16, small ? 'Deterministico e veloce' : 'Deterministico e veloce: motion e I/O rapidi', 'end');
    cap(6, split + 26, small ? 'Senza garanzie, più lento' : 'Lento e senza garanzie: edifici e strumentazione');
    cap(w - 6, split + 26, small ? 'Veloce, senza garanzie' : 'Veloce ma senza garanzie: dati, supervisione, IT', 'end');
    text('ctick', ML, hgt - 6, '← più lento'); text('ctick', w - MR, hgt - 6, 'più veloce →', 'end'); text('clbl', w / 2, hgt - 6, 'Performance', 'middle');
    for (const o of marks) {
      const on = sel.has(o.p.id), slot = slots.get(o.p.id), right = o.x < w * 0.58;
      const g = svgEl('g', { class: 'qdot' + (on ? ' on' : ''), role: 'button', tabindex: 0, 'aria-pressed': String(on), 'aria-label': o.p.name });
      if (on && slot != null) g.append(svgEl('circle', { class: `qring s${slot + 1}`, cx: o.x, cy: o.y, r: 10 }));
      g.append(svgEl('circle', { class: 'qpt', cx: o.x, cy: o.y, r: 6, fill: o.p.color }));
      const t = svgEl('text', { class: 'qlbl', x: o.x + (right ? 13 : -13), y: o.y + 4, 'text-anchor': right ? 'start' : 'end' }); t.textContent = o.p.name; g.append(t);
      g.append(svgEl('rect', { class: 'chit', x: 2, y: o.y - RH / 2, width: w - 4, height: RH }));
      bind(g, () => [h('strong', {}, o.p.name), h('div', {}, h('span', {}, 'Performance'), `: ${num(o.sc.perf)}/5 `, h('span', { class: 'muted' }, '(', h('span', {}, 'Ciclo'), ` ${o.sc.raw.cycle}, `, h('span', {}, 'Velocità'), ` ${o.sc.raw.speed})`)), h('div', {}, h('span', {}, 'Determinismo'), ': ', h('span', {}, o.sc.raw.det))]);
      g.addEventListener('click', () => toggle(o.p.id));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(o.p.id); } });
      svg.append(g);
    }
    box.replaceChildren(svg);
  };
  wrap.append(box);
  let lastW = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { const w = Math.round(wrap.clientWidth); if (w && w !== lastW) { lastW = w; draw(); } }) : null;
  draw(); ro?.observe(wrap);
  return { el: wrap, stop: () => ro?.disconnect() };
}

/* ---- piramidi OSI sovrapposte: ogni livello è diviso in una fetta per protocollo ---- */
function osiOverlay(series) {
  const W = 380, RH = 30, LBL = 132, PW = W - LBL - 6, H = RH * 7 + 28, n = series.length, cx = LBL + PW / 2, topW = PW * 0.34;
  const { wrap, bind } = tipLayer();
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart osi', role: 'img', 'aria-label': 'Piramidi OSI sovrapposte dei protocolli selezionati' });
  const defs = svgEl('defs', {});
  for (let s = 1; s <= MAX_SERIES; s++) { const p = svgEl('pattern', { id: `hatch${s}`, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }); p.append(svgEl('rect', { class: 'hbg', width: 6, height: 6 }), svgEl('line', { class: `sl s${s}`, x1: 0, y1: 0, x2: 0, y2: 6, 'stroke-width': 3 })); defs.append(p); }
  svg.append(defs);
  for (let i = 0; i < 7; i++) {
    const layer = 7 - i, y0 = i * RH + 3, y1 = y0 + RH - 3;
    const wT = topW + (PW - topW) * (i / 7), wB = topW + (PW - topW) * ((i + 1) / 7);
    const t = svgEl('text', { class: 'clbl', x: LBL - 8, y: y0 + RH / 2 + 2, 'text-anchor': 'end' }); t.textContent = `${layer} · ${OSI[layer]}`; svg.append(t);
    series.forEach(({ p, slot }, k) => {
      const xa = f => [cx - wT / 2 + wT * f, cx - wB / 2 + wB * f], [a0, b0] = xa(k / n), [a1, b1] = xa((k + 1) / n), g = n > 1 ? 1 : 0;
      const own = (p.osi?.own || []).includes(layer), via = !own && (p.osi?.via || []).includes(layer);
      const poly = svgEl('polygon', { class: `oslice ${own ? 'own s' + (slot + 1) : via ? 'via s' + (slot + 1) : 'no'}`, points: `${a0 + g},${y0} ${a1 - g},${y0} ${b1 - g},${y1} ${b0 + g},${y1}`, tabindex: 0, role: 'img', 'aria-label': `${p.name} · L${layer} ${OSI[layer]}` });
      if (via) poly.setAttribute('fill', `url(#hatch${slot + 1})`);
      bind(poly, () => [h('strong', {}, p.name), h('div', {}, `L${layer} `, h('span', {}, OSI[layer]), ': ', h('span', {}, own ? 'definito dal bus' : via ? 'fornito dallo stack sottostante' : 'non usato'))]);
      svg.append(poly);
    });
  }
  // numeri delle serie sotto la base, nell'ordine delle fette
  series.forEach(({ slot }, k) => { const x = LBL + (PW * (k + 0.5)) / n; const t = svgEl('text', { class: 'clbl', x: x + 8, y: RH * 7 + 20 }); t.textContent = String(slot + 1); svg.append(marker(slot, x - 3, RH * 7 + 16, 4.2), t); });
  wrap.append(svg);
  const sw = cls => { const s = svgEl('svg', { viewBox: '0 0 18 14', width: 18, height: 14, 'aria-hidden': 'true' }); const r = svgEl('rect', { class: 'oslice ' + cls, x: 1, y: 1, width: 16, height: 12, rx: 2 }); if (cls.startsWith('via')) r.setAttribute('fill', 'url(#hatch1)'); s.append(r); return s; };
  return h('div', {}, wrap, h('div', { class: 'legend' }, h('span', {}, sw('own s1'), 'definito dal bus'), h('span', {}, sw('via s1'), 'fornito dallo stack sottostante'), h('span', {}, sw('no'), 'non usato')));
}

function scoreTable(series) {
  return h('div', { class: 'tablewrap', style: 'max-height:none' }, h('table', { class: 'cmp scoretbl', style: `--n:${AXES.length + 1}` },
    h('thead', {}, h('tr', {}, h('th', {}, ''), AXES.map(([, l]) => h('th', {}, l)))),
    h('tbody', {}, series.map(({ p, slot, sc }) => h('tr', {}, h('td', {}, h('span', { class: 'row', style: 'gap:.3rem;flex-wrap:nowrap' }, sample(slot), p.name)), AXES.map(([k]) => h('td', {}, h('strong', {}, num(sc[k])), h('div', { class: 'muted small' }, k === 'det' ? short(sc.raw[k]) : sc.raw[k]))))))));
}

// Vista "Grafici" della pagina Confronto. ps = protocolli filtrati, sel = selezione condivisa con la tabella.
export function chartsView(ps, sel, slots, toggle, cleanups, pro) {
  const series = ps.filter(p => sel.has(p.id) && slots.has(p.id)).sort((a, b) => slots.get(a.id) - slots.get(b.id)).map(p => ({ p, slot: slots.get(p.id), sc: scores(p) }));
  const picker = h('div', { class: 'row chartpick', role: 'group', 'aria-label': 'Protocolli nei grafici' }, ps.map(p => {
    const on = sel.has(p.id) && slots.has(p.id);
    return h('button', { class: 'tag chip pchip' + (on ? ' sel' : ''), 'aria-pressed': String(on), onclick: () => { if (!on && slots.size >= MAX_SERIES) { toast('Massimo 6 protocolli nei grafici: deselezionane uno.'); return; } toggle(p.id); } },
      on ? sample(slots.get(p.id)) : logo(p, 18), h('span', {}, p.name), on ? h('span', { class: 'snum', 'aria-hidden': 'true' }, String(slots.get(p.id) + 1)) : null);
  }));
  const q = quadrant(ps, sel, slots, id => { if (!sel.has(id) && slots.size >= MAX_SERIES) { toast('Massimo 6 protocolli nei grafici: deselezionane uno.'); return; } toggle(id); });
  cleanups.push(q.stop);
  const empty = () => h('p', { class: 'muted' }, 'Seleziona da 1 a 6 protocolli qui sopra.');
  return h('div', {},
    h('div', { class: 'card' }, h('strong', {}, 'Protocolli nei grafici (da 1 a 6):'), picker),
    h('div', { class: 'chartgrid' },
      h('div', { class: 'card' }, h('h2', {}, 'Radar: profilo a colpo d\'occhio'), series.length ? radar(series) : empty()),
      h('div', { class: 'card' }, h('h2', {}, 'Piramidi OSI sovrapposte'), series.length ? osiOverlay(series) : empty(),
        h('p', { class: 'muted small' }, 'Ogni livello è diviso in una fetta per protocollo, nell\'ordine dei numeri della selezione.'))),
    h('div', { class: 'card', style: 'margin-top:1rem' }, h('h2', {}, 'Mappa: determinismo e performance'), q.el,
      h('p', { class: 'muted small' }, 'Clicca su un protocollo per aggiungerlo o toglierlo dai grafici. Performance = media dei punteggi di ciclo e velocità.')),
    series.length ? h('div', { class: 'card', style: 'margin-top:1rem' }, h('h2', {}, 'Tabella dei punteggi'), scoreTable(series)) : null,
    h('div', { class: 'note' }, h('strong', {}, 'Come leggere i punteggi: '), pro
      ? 'valori indicativi da 0 a 5 ricavati dai dati dell\'app. Ciclo: ciclo minimo tipico, in scala logaritmica (≈ 30 µs → 5; 0,5 s → 0,5). Determinismo: classe real-time (hard 5, deterministico 4, soft 2,5, nessuno 1). Sicurezza: funzioni di cybersicurezza native o parziali della pagina Normative. Velocità: bit rate tipico del mezzo, in scala logaritmica (per i protocolli su TCP/IP dipende dalla rete). Topologie: quante delle 5 topologie sono supportate. I valori reali dipendono da versione, dispositivi e configurazione.'
      : 'sono voti indicativi da 0 a 5 calcolati dai dati dell\'app, utili per confrontare i protocolli tra loro. Non dicono quale sia «il migliore»: dipende da cosa serve all\'impianto.'));
}
