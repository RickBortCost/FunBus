import { S, h, T, isPro, protoById } from './core.js';
import { logo } from './logos.js';

const SC = { native: 2, partial: 1, none: 0 };
export function score(pid) {
  const b = S.data.normative.bus[pid];
  return S.data.normative.reqs.reduce((a, r) => a + SC[b[r.id]], 0);
}
export function profile(pid) { const s = score(pid); return s >= 8 ? 'high' : s >= 3 ? 'medium' : 'low'; }
const COL = { high: 'var(--ok)', medium: 'var(--warn)', low: 'var(--bad)' };

export function badge(level) {
  const L = S.data.normative.levels[level];
  return h('span', { title: L.label, 'aria-label': L.label, style: `font-size:1.1rem;color:${level === 'native' ? 'var(--ok)' : level === 'partial' ? 'var(--warn)' : 'var(--bad)'}` }, L.icon);
}
export function profileTag(pid) {
  const k = profile(pid);
  return h('span', { class: 'tag', style: `border-color:${COL[k]};color:${COL[k]};font-weight:600` }, S.data.normative.profiles[k].split(' (')[0]);
}

// Riquadro per la scheda del protocollo
export function securityBox(p) {
  const N = S.data.normative, b = N.bus[p.id];
  return h('div', { class: 'card', style: 'margin-top:1rem' },
    h('h3', { style: 'margin-top:0' }, N.ui.cardtitle),
    h('div', { class: 'row' }, h('strong', {}, N.ui.profile + ':'), profileTag(p.id), h('span', { class: 'muted' }, N.ui.exposure, ': ', N.exposure[b.exposure])),
    h('div', { class: 'row', style: 'margin:.5rem 0' }, N.reqs.map(r => h('span', { class: 'tag' }, badge(b[r.id]), ' ', r.label, isPro() ? ` (${r.fr})` : ''))),
    h('p', {}, T(b.note)),
    h('div', { class: 'note analogy' }, h('strong', {}, N.ui.comp + ': '), T(b.comp)),
    h('a', { href: '#/normative' }, N.ui.seeall + ' →'));
}

export function normative(app) {
  const N = S.data.normative, pro = isPro();
  let sort = false, filt = 'all';
  const tbl = h('div');
  const detail = h('div');
  const drawTable = () => {
    let ps = S.data.protocols.protocols.filter(p => filt === 'all' || N.bus[p.id].exposure === filt);
    if (sort) ps = ps.slice().sort((a, b) => score(b.id) - score(a.id));
    const head = h('tr', {}, h('th', {}, N.ui.bus), ...(pro ? N.reqs.map(r => h('th', { title: r.fr }, r.label, h('div', { class: 'muted', style: 'font-weight:400;font-size:.75rem' }, r.fr))) : []), h('th', {}, N.ui.exposure), h('th', {}, N.ui.profile));
    const rows = ps.map(p => {
      const b = N.bus[p.id];
      return h('tr', { tabindex: 0, style: 'cursor:pointer', onclick: () => show(p), onkeydown: e => { if (e.key === 'Enter') show(p); } },
        h('td', {}, h('div', { class: 'row' }, logo(p, 24), h('strong', {}, p.name))),
        ...(pro ? N.reqs.map(r => h('td', { style: 'text-align:center' }, badge(b[r.id]))) : []),
        h('td', {}, N.exposure[b.exposure]), h('td', {}, profileTag(p.id), pro ? h('span', { class: 'muted' }, ` ${score(p.id)}/10`) : null));
    });
    tbl.replaceChildren(h('div', { class: 'tablewrap' }, h('table', { class: 'cmp', style: '--n:3;table-layout:auto;width:100%' }, h('thead', {}, head), h('tbody', {}, rows))));
  };
  const show = p => {
    const b = N.bus[p.id];
    detail.replaceChildren(h('div', { class: 'card', style: 'margin-top:1rem' }, h('div', { class: 'row' }, logo(p, 36), h('h3', { style: 'margin:0' }, p.name), profileTag(p.id)),
      h('p', {}, T(b.note)), h('div', { class: 'note analogy' }, h('strong', {}, N.ui.comp + ': '), T(b.comp))));
  };
  const chips = h('div', { class: 'filters' },
    ['all', 'field', 'net', 'ip'].map(k => h('span', { class: 'tag chip' + (filt === k ? ' on' : ''), role: 'button', tabindex: 0, onclick: e => { filt = k; chips.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); drawTable(); } }, k === 'all' ? N.ui.all : N.exposure[k])),
    h('button', { onclick: e => { sort = !sort; e.currentTarget.classList.toggle('primary', sort); drawTable(); } }, N.ui.sort));
  app.append(h('h1', {}, N.ui.title),
    h('div', { class: 'note' }, T(N.disclaimer)),
    h('h2', {}, N.ui.regs),
    ...N.regs.map(r => h('div', { class: 'card', style: 'margin-bottom:1rem' },
      h('h3', { style: 'margin-top:0' }, r.name, ' ', h('span', { class: 'tag' }, r.kind)),
      h('p', {}, T(r.short)),
      h('dl', { class: 'spec' }, h('dt', {}, N.ui.who), h('dd', {}, T(r.who)), h('dt', {}, N.ui.dates), h('dd', {}, T(r.dates)), h('dt', {}, N.ui.impact), h('dd', {}, T(r.impact))))),
    h('div', { class: 'note analogy' }, N.ui.safetynote),
    h('h2', {}, N.ui.matrix), h('p', { class: 'muted' }, T(N.howto)), chips, tbl, detail);
  drawTable();
}
