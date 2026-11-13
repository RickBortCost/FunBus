import { S, h, T, isPro } from './core.js';
import { logo } from './logos.js';
import { pyramid } from './osi.js';
import { profile, profileTag } from './normative.js';
import { chartsView, MAX_SERIES } from './charts.js';

// Classificazione categorica usata per evidenziare le differenze.
const STACK = { profinet: 'L2 (+IP per servizi aciclici)', profibus: 'Fieldbus L1/L2/L7', ethercat: 'L2 (+mailbox L7)', s7: 'L7 su TCP/IP', ads: 'L7 su TCP/IP', mqtt: 'L7 su TCP/IP', opcua: 'L7 su TCP/IP', opcuapubsub: 'L7 su UDP/IP, Ethernet L2 o broker', opcuafx: 'L7 (client/server + PubSub) su Ethernet/TSN', enip: 'L5–L7 su TCP/UDP/IP', modbus: 'L7 su TCP/IP', canopen: 'CAN L1/L2 + L7', iolink: 'IO-Link L1/L2/L7 punto-punto', cip: 'L5–L7 su TCP/UDP/IP', modbusrtu: 'Fieldbus L1/L2/L7', asi: 'Fieldbus L1/L2', bacnet: 'L7 su UDP/IP', knx: 'KNX L1–L7', hart: 'HART L1/L2/L7 su 4–20 mA' };
const RT = { hard: 'hard real-time', det: 'deterministico', soft: 'soft real-time', none: 'non real-time' };
const MODEL = { 'master-slave': 'master/slave', 'client-server': 'client/server', 'pub-sub': 'pub/sub o producer/consumer' };
const TOPO = { line: 'linea', star: 'stella', ring: 'anello', tree: 'albero', bus: 'bus' };

const ROWS = [
  { label: 'Famiglia', get: p => p.family, cat: p => p.family, lv: 'bp', hl: 'bp' },
  { label: 'Scopo', get: p => T(p.card.purpose), lv: 'bp' },
  { label: 'Livello OSI', get: p => T(p.card.osi), cat: p => STACK[p.id], lv: 'p', hl: 'p' },
  { label: 'Piramide OSI', get: p => pyramid(p, { compact: true, width: 150 }), cat: p => (p.osi?.own || []).join(), lv: 'bp', hl: 'p' },
  { label: 'Mezzo fisico', get: p => T(p.card.medium), cat: p => p.attrs.ethernet, lv: 'bp', hl: 'bp' },
  { label: 'Velocità', get: p => p.card.speed, lv: 'p' },
  { label: 'Topologia', get: p => T(p.card.topology), cat: p => p.attrs.topo.join(), lv: 'bp', hl: 'bp' },
  { label: 'Scambio dati', get: p => T({ b: p.comm.b, p: p.comm.p }), cat: p => p.comm.mode, lv: 'bp', hl: 'bp', pre: p => ({ polling: '🔄 Polling', notify: '🔔 Notifica', both: '⚖ Entrambi' }[p.comm.mode]) },
  { label: 'Modello', get: p => T(p.card.model), cat: p => p.attrs.model.join(), lv: 'bp', hl: 'bp' },
  { label: 'Determinismo', get: p => T(p.card.determinism), cat: p => p.attrs.rt, lv: 'bp', hl: 'bp' },
  { label: 'Tempi di ciclo', get: p => T(p.card.cycle), cat: p => p.attrs.rt, lv: 'bp', hl: 'p' },
  { label: 'Vantaggi', get: p => list(p.pros), lv: 'bp' },
  { label: 'Limiti', get: p => list(p.cons), lv: 'bp' },
  { label: 'Casi d\'uso', get: p => list(p.usecases), lv: 'bp' },
  { label: 'Cybersicurezza', get: p => profileTag(p.id), cat: p => profile(p.id), lv: 'bp', hl: 'bp' },
  { label: 'Dati tecnici', get: p => h('div', {}, p.tech.map(([k, v]) => h('div', {}, h('strong', {}, k + ': '), v))), lv: 'p' }
];
function list(a) { return h('ul', { class: 'clean' }, a.map(x => h('li', {}, x))); }

const FILTERS = () => [
  { id: 'family', label: 'Famiglia', opts: [...new Set(S.data.protocols.protocols.map(p => p.family))].map(v => [v, v]), test: (p, v) => p.family === v },
  { id: 'eth', label: 'Mezzo', opts: [['yes', 'Ethernet/IP'], ['no', 'Seriale']], test: (p, v) => p.attrs.ethernet === (v === 'yes') },
  { id: 'rt', label: 'Real-time', opts: Object.entries(RT), test: (p, v) => p.attrs.rt === v },
  { id: 'topo', label: 'Topologia', opts: Object.entries(TOPO), test: (p, v) => p.attrs.topo.includes(v) },
  { id: 'comm', label: 'Scambio dati', opts: [['polling', 'polling'], ['notify', 'notifica'], ['both', 'entrambi']], test: (p, v) => p.comm.mode === v },
  { id: 'model', label: 'Modello', opts: Object.entries(MODEL), test: (p, v) => p.attrs.model.includes(v) }
];

export function compare(app, { cleanups, id }) {
  const flt = {}; const sel = new Set(); let only = false;
  // Vista tabella o grafici; nei grafici ogni protocollo selezionato occupa una "serie" stabile (colore, tratteggio, marcatore).
  let view = sessionStorage.getItem('cmpView') === 'charts' ? 'charts' : 'table';
  const slots = new Map(), chartClean = [];
  const toggle = id => {
    if (sel.has(id)) { sel.delete(id); slots.delete(id); }
    else { sel.add(id); const used = new Set(slots.values()); for (let i = 0; i < MAX_SERIES; i++) if (!used.has(i)) { slots.set(id, i); break; } }
  };
  cleanups.push(() => chartClean.splice(0).forEach(f => f()));
  const out = h('div');
  const bar = h('div', { class: 'filters' });
  const render = () => {
    const lv = isPro() ? 'p' : 'b';
    chartClean.splice(0).forEach(f => f());
    const all = S.data.protocols.protocols.filter(p => FILTERS().every(f => !flt[f.id]?.size || [...flt[f.id]].some(v => f.test(p, v))));
    let ps = S.data.protocols.protocols.filter(p => FILTERS().every(f => !flt[f.id]?.size || [...flt[f.id]].some(v => f.test(p, v))));
    if (only && sel.size >= 2) ps = ps.filter(p => sel.has(p.id));
    const vbtn = (k, l) => h('button', { class: view === k ? 'on' : '', 'aria-pressed': String(view === k), onclick: () => { view = k; try { sessionStorage.setItem('cmpView', k); } catch { /* ignora */ } if (k === 'charts' && !sel.size) all.slice(0, 3).forEach(p => toggle(p.id)); render(); } }, l);
    bar.replaceChildren(h('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, vbtn('table', '▦ Tabella'), vbtn('charts', '📊 Grafici')), ...FILTERS().map(f => h('div', { class: 'grp' }, h('strong', {}, f.label + ':'),
      f.opts.map(([v, l]) => h('span', { class: 'tag chip' + (flt[f.id]?.has(v) ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': String(!!flt[f.id]?.has(v)),
        onclick: () => { (flt[f.id] ||= new Set()); flt[f.id].has(v) ? flt[f.id].delete(v) : flt[f.id].add(v); render(); },
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } } }, l)))),
      ...(view === 'table' ? [h('button', { disabled: sel.size < 2 && !only, onclick: () => { only = !only; render(); } }, only ? 'Mostra tutti' : `Affianca selezionati (${sel.size})`)] : []),
      h('button', { onclick: () => { for (const k in flt) flt[k].clear(); sel.clear(); slots.clear(); only = false; render(); } }, 'Azzera'));
    if (view === 'charts' && all.length) { out.replaceChildren(chartsView(all, sel, slots, id => { toggle(id); render(); }, chartClean, isPro())); return; }
    if (!ps.length) { out.replaceChildren(h('p', { class: 'muted' }, 'Nessun protocollo corrisponde ai filtri.')); return; }
    const rows = ROWS.filter(r => r.lv.includes(lv));
    const thead = h('thead', {}, h('tr', {}, h('th', {}, ''), ps.map(p => h('th', { style: `border-top:4px solid ${p.color}` },
      h('div', {}, logo(p, 28)), h('label', {}, h('input', { type: 'checkbox', checked: sel.has(p.id), onchange: () => { toggle(p.id); render(); } }), ' ', h('a', { href: `#/protocolli/${p.id}` }, p.name))))));
    const tbody = h('tbody', {}, rows.map(r => {
      const diff = r.cat && r.hl?.includes(lv) && ps.length > 1 && new Set(ps.map(p => String(r.cat(p)))).size > 1;
      return h('tr', { class: diff ? 'diff' : '' }, h('td', {}, r.label), ps.map(p => h('td', {}, r.pre ? h('strong', {}, r.pre(p) + ' — ') : null, r.get(p))));
    }));
    out.replaceChildren(h('div', { class: 'tablewrap' }, h('table', { class: 'cmp', style: `--n:${ps.length}` }, thead, tbody)),
      h('p', { class: 'muted' }, isPro() ? 'Righe evidenziate (giallo, tratteggio e segno ≠): differenze rilevanti per il livello Professional (stack, mezzo, topologia, modello, determinismo e ciclo).' : 'Righe evidenziate (giallo, tratteggio e segno ≠): differenze rilevanti per il livello Beginner (famiglia, mezzo, topologia, modello, determinismo).'));
  };
  // #/confronto/id1,id2,…: protocolli già selezionati e affiancati (es. dalle schede delle varianti OPC UA)
  const pre = (id || '').split(',').filter(x => S.data.protocols.protocols.some(p => p.id === x));
  pre.forEach(toggle);
  if (pre.length >= 2) only = true;
  if (view === 'charts' && !sel.size) S.data.protocols.protocols.slice(0, 3).forEach(p => toggle(p.id));
  app.append(h('h1', {}, 'Confronto'), h('p', {}, 'Filtra i protocolli, spunta quelli da confrontare (almeno 2) e usa "Affianca selezionati"; passa a «Grafici» per radar, mappa e piramidi OSI.'), bar, out);
  render();
}
