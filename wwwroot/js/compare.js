import { S, h, T, isPro } from './core.js';
import { logo } from './logos.js';

// Classificazione categorica usata per evidenziare le differenze.
const STACK = { profinet: 'L2 (+IP per servizi aciclici)', profibus: 'Fieldbus L1/L2/L7', ethercat: 'L2 (+mailbox L7)', s7: 'L7 su TCP/IP', ads: 'L7 su TCP/IP', mqtt: 'L7 su TCP/IP', opcua: 'L7 su TCP/IP', enip: 'L5–L7 su TCP/UDP/IP', modbus: 'L7 su TCP/IP', canopen: 'CAN L1/L2 + L7', iolink: 'IO-Link L1/L2/L7 punto-punto' };
const RT = { hard: 'hard real-time', det: 'deterministico', soft: 'soft real-time', none: 'non real-time' };
const MODEL = { 'master-slave': 'master/slave', 'client-server': 'client/server', 'pub-sub': 'pub/sub o producer/consumer' };
const TOPO = { line: 'linea', star: 'stella', ring: 'anello', tree: 'albero', bus: 'bus' };

const ROWS = [
  { label: 'Famiglia', get: p => p.family, cat: p => p.family, lv: 'bp', hl: 'bp' },
  { label: 'Scopo', get: p => T(p.card.purpose), lv: 'bp' },
  { label: 'Livello OSI', get: p => T(p.card.osi), cat: p => STACK[p.id], lv: 'p', hl: 'p' },
  { label: 'Mezzo fisico', get: p => T(p.card.medium), cat: p => p.attrs.ethernet, lv: 'bp', hl: 'bp' },
  { label: 'Velocità', get: p => p.card.speed, lv: 'p' },
  { label: 'Topologia', get: p => T(p.card.topology), cat: p => p.attrs.topo.join(), lv: 'bp', hl: 'bp' },
  { label: 'Modello', get: p => T(p.card.model), cat: p => p.attrs.model.join(), lv: 'bp', hl: 'bp' },
  { label: 'Determinismo', get: p => T(p.card.determinism), cat: p => p.attrs.rt, lv: 'bp', hl: 'bp' },
  { label: 'Tempi di ciclo', get: p => T(p.card.cycle), cat: p => p.attrs.rt, lv: 'bp', hl: 'p' },
  { label: 'Vantaggi', get: p => list(p.pros), lv: 'bp' },
  { label: 'Limiti', get: p => list(p.cons), lv: 'bp' },
  { label: 'Casi d\'uso', get: p => list(p.usecases), lv: 'bp' },
  { label: 'Dati tecnici', get: p => h('div', {}, p.tech.map(([k, v]) => h('div', {}, h('strong', {}, k + ': '), v))), lv: 'p' }
];
function list(a) { return h('ul', { class: 'clean' }, a.map(x => h('li', {}, x))); }

const FILTERS = () => [
  { id: 'family', label: 'Famiglia', opts: [...new Set(S.data.protocols.protocols.map(p => p.family))].map(v => [v, v]), test: (p, v) => p.family === v },
  { id: 'eth', label: 'Mezzo', opts: [['yes', 'Ethernet/IP'], ['no', 'Seriale']], test: (p, v) => p.attrs.ethernet === (v === 'yes') },
  { id: 'rt', label: 'Real-time', opts: Object.entries(RT), test: (p, v) => p.attrs.rt === v },
  { id: 'topo', label: 'Topologia', opts: Object.entries(TOPO), test: (p, v) => p.attrs.topo.includes(v) },
  { id: 'model', label: 'Modello', opts: Object.entries(MODEL), test: (p, v) => p.attrs.model.includes(v) }
];

export function compare(app) {
  const flt = {}; const sel = new Set(); let only = false;
  const out = h('div');
  const bar = h('div', { class: 'filters' });
  const render = () => {
    const lv = isPro() ? 'p' : 'b';
    let ps = S.data.protocols.protocols.filter(p => FILTERS().every(f => !flt[f.id]?.size || [...flt[f.id]].some(v => f.test(p, v))));
    if (only && sel.size >= 2) ps = ps.filter(p => sel.has(p.id));
    bar.replaceChildren(...FILTERS().map(f => h('div', { class: 'grp' }, h('strong', {}, f.label + ':'),
      f.opts.map(([v, l]) => h('span', { class: 'tag chip' + (flt[f.id]?.has(v) ? ' on' : ''), tabindex: 0, role: 'button', 'aria-pressed': String(!!flt[f.id]?.has(v)),
        onclick: () => { (flt[f.id] ||= new Set()); flt[f.id].has(v) ? flt[f.id].delete(v) : flt[f.id].add(v); render(); },
        onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } } }, l)))),
      h('button', { disabled: sel.size < 2 && !only, onclick: () => { only = !only; render(); } }, only ? 'Mostra tutti' : `Affianca selezionati (${sel.size})`),
      h('button', { onclick: () => { for (const k in flt) flt[k].clear(); sel.clear(); only = false; render(); } }, 'Azzera'));
    if (!ps.length) { out.replaceChildren(h('p', { class: 'muted' }, 'Nessun protocollo corrisponde ai filtri.')); return; }
    const rows = ROWS.filter(r => r.lv.includes(lv));
    const thead = h('thead', {}, h('tr', {}, h('th', {}, ''), ps.map(p => h('th', { style: `border-top:4px solid ${p.color}` },
      h('div', {}, logo(p, 28)), h('label', {}, h('input', { type: 'checkbox', checked: sel.has(p.id), onchange: e => { e.target.checked ? sel.add(p.id) : sel.delete(p.id); render(); } }), ' ', h('a', { href: `#/protocolli/${p.id}` }, p.name))))));
    const tbody = h('tbody', {}, rows.map(r => {
      const diff = r.cat && r.hl?.includes(lv) && ps.length > 1 && new Set(ps.map(p => String(r.cat(p)))).size > 1;
      return h('tr', { class: diff ? 'diff' : '' }, h('td', {}, r.label), ps.map(p => h('td', {}, r.get(p))));
    }));
    out.replaceChildren(h('div', { class: 'tablewrap' }, h('table', { class: 'cmp' }, thead, tbody)),
      h('p', { class: 'muted' }, isPro() ? 'Righe in giallo: differenze rilevanti per il livello Professional (stack, mezzo, topologia, modello, determinismo e ciclo).' : 'Righe in giallo: differenze rilevanti per il livello Beginner (famiglia, mezzo, topologia, modello, determinismo).'));
  };
  app.append(h('h1', {}, 'Confronto'), h('p', {}, 'Filtra i protocolli, spunta quelli da confrontare (almeno 2) e usa "Affianca selezionati".'), bar, out);
  render();
}
