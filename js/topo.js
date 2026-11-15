// Topologie interattive: bus, linea, stella, albero e anello (MRP/DLR) con guasti e ripristino animato.
import { S, h, svgEl, T, protoById, mark } from './core.js';
import { logo } from './logos.js';
import { pktShape } from './sim.js';

const ORDER = ['bus', 'line', 'star', 'tree', 'ring'];
const ICON = {
  bus: ['M3 10H25M3 6V14M25 6V14M9 10V16M14 10V4M19 10V16', []],
  line: [
    'M4 10H24',
    [
      [4, 10],
      [10.7, 10],
      [17.3, 10],
      [24, 10],
    ],
  ],
  star: [
    'M14 10L4 3M14 10L24 3M14 10L4 17M14 10L24 17',
    [
      [14, 10],
      [4, 3],
      [24, 3],
      [4, 17],
      [24, 17],
    ],
  ],
  tree: [
    'M14 3V7M6 12V7H22V12M6 12L3 17M6 12L9 17M22 12L19 17M22 12L25 17',
    [
      [14, 3],
      [6, 12],
      [22, 12],
    ],
  ],
  ring: [
    'M14 3C22 3 25 6 25 10S22 17 14 17S3 14 3 10S6 3 14 3Z',
    [
      [14, 3],
      [25, 10],
      [14, 17],
      [3, 10],
    ],
  ],
};

export function topoIcon(id, size = 22) {
  const s = svgEl('svg', { viewBox: '0 0 28 20', width: size * 1.4, height: size, class: 'topoicon', 'aria-hidden': 'true' });
  const [d, dots] = ICON[id] || ICON.line;
  s.append(svgEl('path', { d }), ...dots.map(([cx, cy]) => svgEl('circle', { cx, cy, r: 2.4 })));
  return s;
}
const topoData = id => S.data.topologies.topologies.find(t => t.id === id);

// Scheda del protocollo: topologie supportate, con collegamento al disegno interattivo.
export function topoChips(p) {
  return h(
    'div',
    { class: 'row' },
    p.attrs.topo
      .filter(topoData)
      .map(t =>
        h(
          'a',
          { class: 'tag topochip', href: `#/topologie/${t}`, title: 'Apri il disegno interattivo' },
          topoIcon(t, 16),
          h('span', {}, topoData(t).name),
        ),
      ),
  );
}

/* ---- modelli geometrici (larghi e stretti) ---- */
const dev = (n, x, y) => ({ id: 'd' + n, kind: 'dev', x, y, label: `Dispositivo ${n}` });
export function model(id, narrow, mech) {
  const M = (x, y, label = 'Master') => ({ id: 'm', kind: 'master', x, y, label });
  const sw = (id, x, y) => ({ id, kind: 'switch', x, y, label: 'Switch' });
  if (id === 'bus') {
    const p = narrow ? [80, 165, 250, 335, 420] : [130, 270, 410, 550, 690];
    const J = (i, c) => (narrow ? { id: 'j' + i, kind: 'junc', x: 90, y: c } : { id: 'j' + i, kind: 'junc', x: c, y: 150 });
    const nodes = [
      narrow
        ? { id: 't1', kind: 'term', x: 90, y: 26, label: 'Terminatore' }
        : { id: 't1', kind: 'term', x: 44, y: 150, label: 'Terminatore' },
      narrow
        ? { id: 't2', kind: 'term', x: 90, y: 474, label: 'Terminatore' }
        : { id: 't2', kind: 'term', x: 762, y: 150, label: 'Terminatore' },
      ...p.map((c, i) => J(i, c)),
      narrow ? M(250, p[0]) : M(p[0], 52),
      ...p.slice(1).map((c, i) => (narrow ? dev(i + 1, 250, c) : dev(i + 1, c, 236))),
    ];
    const links = [
      ['t1', 'j0', 'trunk'],
      ...p.slice(1).map((_, i) => ['j' + i, 'j' + (i + 1), 'trunk']),
      ['j4', 't2', 'trunk'],
      ['j0', 'm', 'drop'],
      ...p.slice(1).map((_, i) => ['j' + (i + 1), 'd' + (i + 1), 'drop']),
    ];
    return { W: narrow ? 380 : 800, H: narrow ? 500 : 300, nodes, links };
  }
  if (id === 'line') {
    const p = narrow ? [45, 140, 235, 330, 425] : [80, 240, 400, 560, 720];
    const nodes = [narrow ? M(190, p[0]) : M(p[0], 70), ...p.slice(1).map((c, i) => (narrow ? dev(i + 1, 190, c) : dev(i + 1, c, 70)))];
    return { W: narrow ? 380 : 800, H: narrow ? 480 : 150, nodes, links: nodes.slice(1).map((n, i) => [nodes[i].id, n.id]) };
  }
  if (id === 'star') {
    const nodes = narrow
      ? [M(190, 45), sw('s0', 190, 165), dev(1, 50, 310), dev(2, 143, 310), dev(3, 237, 310), dev(4, 330, 310)]
      : [M(110, 150), sw('s0', 370, 150), dev(1, 680, 40), dev(2, 680, 115), dev(3, 680, 190), dev(4, 680, 265)];
    return { W: narrow ? 380 : 800, H: narrow ? 370 : 320, nodes, links: [['m', 's0'], ...[1, 2, 3, 4].map(i => ['s0', 'd' + i])] };
  }
  if (id === 'tree') {
    const nodes = narrow
      ? [
          M(190, 40),
          sw('s0', 190, 130),
          sw('s1', 97, 225),
          sw('s2', 283, 225),
          dev(1, 50, 340),
          dev(2, 143, 340),
          dev(3, 237, 340),
          dev(4, 330, 340),
        ]
      : [
          M(80, 160),
          sw('s0', 250, 160),
          sw('s1', 450, 80),
          sw('s2', 450, 240),
          dev(1, 690, 40),
          dev(2, 690, 120),
          dev(3, 690, 200),
          dev(4, 690, 280),
        ];
    return {
      W: narrow ? 380 : 800,
      H: narrow ? 400 : 335,
      nodes,
      links: [
        ['m', 's0'],
        ['s0', 's1'],
        ['s0', 's2'],
        ['s1', 'd1'],
        ['s1', 'd2'],
        ['s2', 'd3'],
        ['s2', 'd4'],
      ],
    };
  }
  // anello: il manager e 5 dispositivi
  const [cx, cy, rx, ry, a0] = narrow ? [190, 220, 125, 170, 90] : [400, 150, 290, 105, 180];
  const pos = k => {
    const a = ((a0 - k * 60) * Math.PI) / 180;
    return [Math.round(cx + rx * Math.cos(a)), Math.round(cy - ry * Math.sin(a))];
  };
  const nodes = [M(...pos(0), mech?.manager || 'Manager'), ...[1, 2, 3, 4, 5].map(k => dev(k, ...pos(k)))];
  const ids = nodes.map(n => n.id);
  return {
    W: narrow ? 380 : 800,
    H: narrow ? 450 : 320,
    nodes,
    links: ids.map((a, i) => [a, ids[(i + 1) % ids.length]]),
    blocked: ids.length - 1,
  };
}

export const SIZE = { master: [66, 42], dev: [62, 38], switch: [72, 30], term: [20, 30], junc: [0, 0] };
export function nodeShape(n) {
  const [w, hh] = SIZE[n.kind],
    g = svgEl('g', { class: 'tnode k-' + n.kind });
  if (n.kind === 'junc') {
    g.append(svgEl('circle', { class: 'tj', cx: n.x, cy: n.y, r: 4 }));
    return g;
  }
  const x = n.x - w / 2,
    y = n.y - hh / 2;
  g.append(svgEl('rect', { class: 'tbox', x, y, width: w, height: hh, rx: n.kind === 'term' ? 4 : 9 }));
  if (n.kind === 'master')
    g.append(
      svgEl('path', {
        class: 'tin',
        d: `M${x + 16} ${y + 6}V${y + hh - 6}M${x + 30} ${y + 12}H${x + 56}M${x + 30} ${y + 21}H${x + 56}M${x + 30} ${y + 30}H${x + 48}`,
      }),
      svgEl('circle', { class: 'tled', cx: x + 9, cy: y + 11, r: 3 }),
    );
  else if (n.kind === 'switch')
    g.append(...[0, 1, 2, 3, 4].map(i => svgEl('rect', { class: 'tport', x: x + 9 + i * 12, y: y + 10, width: 7, height: 10, rx: 1.5 })));
  else if (n.kind === 'dev')
    g.append(
      svgEl('circle', { class: 'tin', cx: x + 18, cy: n.y, r: 8 }),
      svgEl('path', { class: 'tin', d: `M${x + 34} ${n.y - 6}H${x + 52}M${x + 34} ${n.y + 6}H${x + 46}` }),
    );
  else g.append(svgEl('path', { class: 'tin', d: `M${n.x} ${y + 4}v3l-5 2.5l10 4l-10 4l5 2.5v3` }));
  return g;
}

export function topologie(app, { id, cleanups }) {
  const D = S.data.topologies;
  const tid = id || ORDER[0],
    topo = topoData(tid);
  app.append(
    h('h1', {}, 'Topologie di rete'),
    h('p', {}, T(D.intro)),
    h(
      'div',
      { class: 'tabs', role: 'tablist' },
      ORDER.filter(topoData).map(t =>
        h(
          'a',
          { class: 'btn topotab' + (t === tid ? ' on' : ''), role: 'tab', 'aria-selected': String(t === tid), href: `#/topologie/${t}` },
          topoIcon(t, 16),
          h('span', {}, topoData(t).name),
        ),
      ),
    ),
  );
  if (!topo) {
    app.append(h('p', {}, 'Topologia non trovata.'));
    return;
  }
  S.progress.topoSeen ||= [];
  mark('topoSeen', tid);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isRing = tid === 'ring';
  let mech = isRing ? topo.mechs[0] : null;
  const broken = new Set(),
    off = new Set();
  let narrow = false,
    M = null,
    byId = {},
    open = false,
    phase = 0,
    timer = null,
    raf = null,
    reach = new Set(),
    t0 = 0;
  const box = h('div', { class: 'topobox' });
  const svg = svgEl('svg', { class: 'toposvg', role: 'group', 'aria-label': 'Disegno interattivo della topologia' });
  const gStatic = svgEl('g'),
    gPk = svgEl('g', { 'aria-hidden': 'true' });
  svg.append(gStatic, gPk);
  const status = h('div', { 'aria-live': 'polite' });
  const mechBox = h('div');
  box.append(svg);

  const nameOf = nid => {
    const n = byId[nid];
    if (n.kind !== 'junc') return n.label;
    const l = M.links.find(([a, , k]) => k === 'drop' && a === nid);
    return byId[l[1]].label;
  };
  const usable = i => {
    const [a, b] = M.links[i];
    return !broken.has(i) && !off.has(a) && !off.has(b) && !(isRing && !open && i === M.blocked);
  };
  function paths() {
    const prev = { m: null },
      q = ['m'];
    while (q.length) {
      const c = q.shift();
      M.links.forEach(([a, b], i) => {
        if (!usable(i)) return;
        const n = a === c ? b : b === c ? a : null;
        if (n && !(n in prev)) {
          prev[n] = c;
          q.push(n);
        }
      });
    }
    return prev;
  }
  const pathTo = (prev, nid) => {
    const p = [];
    for (let c = nid; c != null; c = prev[c]) p.unshift(c);
    return p;
  };
  const faults = () => broken.size + off.size;

  function build() {
    M = model(tid, narrow, mech);
    byId = Object.fromEntries(M.nodes.map(n => [n.id, n]));
    svg.setAttribute('viewBox', `0 0 ${M.W} ${M.H}`);
    svg.style.maxWidth = M.W + 'px';
    draw();
  }

  function draw() {
    const prev = paths();
    reach = new Set(Object.keys(prev));
    gStatic.replaceChildren();
    M.links.forEach(([a, b, kind], i) => {
      const A = byId[a],
        B = byId[b],
        br = broken.has(i);
      const g = svgEl('g', {
        class: 'tlinkg' + (br ? ' broken' : '') + (kind === 'trunk' ? ' trunk' : ''),
        role: 'button',
        tabindex: 0,
        'aria-pressed': String(br),
        'aria-label': `Cavo tra ${nameOf(a)} e ${nameOf(b)}`,
      });
      g.append(
        svgEl('line', { class: 'tlink', x1: A.x, y1: A.y, x2: B.x, y2: B.y }),
        svgEl('line', { class: 'thit', x1: A.x, y1: A.y, x2: B.x, y2: B.y }),
      );
      if (br) {
        const m = svgEl('g', { class: 'fmark', transform: `translate(${(A.x + B.x) / 2} ${(A.y + B.y) / 2})` });
        m.append(svgEl('circle', { r: 12 }), svgEl('path', { d: 'M-6 6L-1 -6M1 6L6 -6' }));
        g.append(m);
      }
      if (isRing && i === M.blocked && !open) {
        const m = svgEl('g', { class: 'tblock', transform: `translate(${B.x + (A.x - B.x) * 0.3} ${B.y + (A.y - B.y) * 0.3})` });
        m.append(svgEl('circle', { r: 9 }), svgEl('path', { d: 'M-5.5 5.5L5.5 -5.5' }));
        const tt = svgEl('title', {});
        tt.textContent = 'Porta bloccata';
        m.append(tt);
        g.append(m);
      }
      const tog = () => {
        broken.has(i) ? broken.delete(i) : broken.add(i);
        changed();
      };
      g.addEventListener('click', tog);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tog();
        }
      });
      gStatic.append(g);
    });
    for (const n of M.nodes) {
      const g = nodeShape(n),
        isOff = off.has(n.id),
        un = !isOff && !reach.has(n.id) && n.kind !== 'term' && n.kind !== 'junc';
      if (isOff) g.classList.add('off');
      if (un) g.classList.add('unreach');
      const [, hh] = SIZE[n.kind];
      if (n.kind !== 'junc' && n.kind !== 'term') {
        const t = svgEl('text', { class: 'tlbl', x: n.x, y: n.y + hh / 2 + 14 });
        t.textContent = n.label;
        g.append(t);
      }
      if (n.kind === 'term') {
        const tt = svgEl('title', {});
        tt.textContent = n.label;
        g.append(tt);
        const t = svgEl('text', { class: 'tlbl', x: n.x, y: n.y + (narrow ? 5 : 30), ...(narrow ? { dx: 46 } : {}) });
        t.textContent = 'T';
        g.append(t);
      }
      if (isOff || un) {
        const m = svgEl('g', {
          class: 'tbadge' + (un ? ' un' : ''),
          transform: `translate(${n.x + SIZE[n.kind][0] / 2 - 3} ${n.y - hh / 2 + 2})`,
        });
        m.append(
          svgEl('circle', { r: 9 }),
          svgEl('path', { d: isOff ? 'M-4 -4L4 4M4 -4L-4 4' : 'M-3 -2.5a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1-1.5 2M0 5.4v.2' }),
        );
        g.append(m);
      }
      if (n.kind === 'dev' || n.kind === 'switch') {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', 0);
        g.setAttribute('aria-pressed', String(isOff));
        g.setAttribute('aria-label', n.label + (isOff ? ' · Nodo spento' : un ? ' · Non raggiungibile' : ''));
        const tog = () => {
          off.has(n.id) ? off.delete(n.id) : off.add(n.id);
          changed();
        };
        g.addEventListener('click', tog);
        g.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            tog();
          }
        });
      }
      gStatic.append(g);
    }
    renderStatus();
  }

  function renderStatus() {
    const devs = M.nodes.filter(n => n.kind === 'dev' || n.kind === 'switch');
    const ok = devs.filter(n => reach.has(n.id) && !off.has(n.id)).length;
    const parts = [h('p', { class: 'toporeach' }, h('strong', {}, `Raggiungibili dal master: ${ok} su ${devs.length}`))];
    const note = (label, txt, cls = '') => h('div', { class: 'note fault ' + cls }, h('strong', {}, label), h('p', {}, txt));
    if (isRing) {
      parts.push(
        h(
          'div',
          { class: 'note ' + ([1, 2].includes(phase) ? 'fault' : 'analogy') },
          h('span', { class: 'tag' }, `Fase ${phase + 1} di ${mech.phases.length}`),
          h('p', {}, T(mech.phases[phase])),
        ),
      );
      if (off.size) parts.push(note('Nodo spento', T(topo.node)));
      if (open && devs.some(n => !reach.has(n.id) && !off.has(n.id))) parts.push(note('Cavo interrotto', T(topo.cable)));
    } else if (!faults())
      parts.push(h('div', { class: 'note analogy' }, 'Tutto funziona: clicca su un cavo o su un dispositivo per simulare un guasto.'));
    else {
      if (broken.size) {
        const trunk = [...broken].some(i => M.links[i][2] !== 'drop');
        parts.push(note('Cavo interrotto', T(trunk || !topo.drop ? topo.cable : topo.drop)));
      }
      if (off.size) parts.push(note('Nodo spento', T(topo.node)));
    }
    status.replaceChildren(...parts);
  }

  // Anello: sequenza guasto → riconfigurazione → ripristino.
  function ringStep() {
    clearTimeout(timer);
    const go = (p, ms) => {
      timer = setTimeout(
        () => {
          phase = p;
          if (p === 2) open = true;
          if (p === 5) open = false;
          draw();
          ringStep();
        },
        reduced ? 0 : ms,
      );
    };
    if (faults() && !open) {
      if (phase !== 1) {
        phase = 1;
        draw();
      }
      go(2, 1900);
    } else if (faults() && open) {
      if (phase === 2) go(3, 1900);
      else if (phase !== 3) {
        phase = 3;
        draw();
      }
    } else if (!faults() && open) {
      if (phase !== 4) {
        phase = 4;
        draw();
      }
      go(5, 1900);
    } else if (phase === 5) go(0, 2200);
    else if (phase !== 0) {
      phase = 0;
      draw();
    }
  }
  function changed() {
    draw();
    if (isRing) ringStep();
  }

  /* ---- pacchetti in movimento ---- */
  function along(ids, d) {
    // posizione a distanza d lungo il percorso; null se oltre la fine
    for (let k = 0; k + 1 < ids.length; k++) {
      const A = byId[ids[k]],
        B = byId[ids[k + 1]],
        L = Math.hypot(B.x - A.x, B.y - A.y);
      if (d <= L) return [A.x + ((B.x - A.x) * d) / L, A.y + ((B.y - A.y) * d) / L];
      d -= L;
    }
    return null;
  }
  const len = ids => ids.slice(1).reduce((s, n, k) => s + Math.hypot(byId[n].x - byId[ids[k]].x, byId[n].y - byId[ids[k]].y), 0);
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = ts;
    const t = ts - t0,
      V = 0.26; // px/ms
    gPk.replaceChildren();
    const prev = paths();
    const targets = M.nodes.filter(n => n.kind === 'dev' && !off.has(n.id) && n.id in prev);
    if (targets.length) {
      const routes = targets.map(n => pathTo(prev, n.id)),
        tot = routes.map(r => (2 * len(r)) / V + 250);
      let tt = t % tot.reduce((a, b) => a + b, 0),
        k = 0;
      while (tt > tot[k]) tt -= tot[k++];
      const L = len(routes[k]),
        d = tt * V,
        q = along(routes[k], d <= L ? d : Math.max(0, 2 * L - d));
      if (q) {
        const g = pktShape('cyc');
        g.setAttribute('transform', `translate(${q[0]} ${q[1]}) scale(.8)`);
        gPk.append(g);
      }
    }
    if (isRing) {
      const ring = M.nodes.map(n => n.id);
      for (const ids of [
        [...ring, 'm'],
        ['m', ...ring.slice(1).reverse(), 'm'],
      ]) {
        // i frame di test si fermano al primo guasto
        let stop = Infinity,
          acc = 0;
        for (let k = 0; k + 1 < ids.length && stop === Infinity; k++) {
          const L = len([ids[k], ids[k + 1]]),
            li = M.links.findIndex(([a, b]) => (a === ids[k] && b === ids[k + 1]) || (b === ids[k] && a === ids[k + 1]));
          if (broken.has(li)) stop = acc + L / 2;
          else if (off.has(ids[k + 1])) stop = acc + L - 36;
          acc += L;
        }
        const d = (t * V * 1.5) % (len(ids) + 120),
          q = d < stop ? along(ids, d) : null;
        if (q) {
          const g = pktShape('tok');
          g.setAttribute('transform', `translate(${q[0]} ${q[1]}) scale(.6)`);
          gPk.append(g);
        }
      }
    }
  }

  const legendItem = (cls, label, inner) => {
    const s = svgEl('svg', { viewBox: '-14 -12 28 24', width: 28, height: 24, 'aria-hidden': 'true' });
    const g = svgEl('g', { class: cls });
    g.append(...inner);
    s.append(g);
    return h('span', {}, s, label);
  };
  const legend = h(
    'div',
    { class: 'legend', role: 'group', 'aria-label': 'Legenda' },
    legendItem('fmark', 'Cavo interrotto', [svgEl('circle', { r: 10 }), svgEl('path', { d: 'M-5 5L-1 -5M1 5L5 -5' })]),
    legendItem('tbadge', 'Nodo spento', [svgEl('circle', { r: 9 }), svgEl('path', { d: 'M-4 -4L4 4M4 -4L-4 4' })]),
    legendItem('tbadge un', 'Non raggiungibile', [
      svgEl('circle', { r: 9 }),
      svgEl('path', { d: 'M-3 -2.5a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1-1.5 2M0 5.4v.2' }),
    ]),
    isRing ? legendItem('tblock', 'Porta bloccata', [svgEl('circle', { r: 9 }), svgEl('path', { d: 'M-5.5 5.5L5.5 -5.5' })]) : null,
    tid === 'bus' ? h('span', {}, h('strong', {}, 'T'), 'Terminatore') : null,
  );

  function renderMech() {
    if (!isRing) return;
    mechBox.replaceChildren(
      h(
        'div',
        { class: 'row' },
        h('strong', {}, 'Protocollo di ridondanza:'),
        topo.mechs.map(m =>
          h(
            'button',
            {
              class: 'tag chip' + (m === mech ? ' on' : ''),
              'aria-pressed': String(m === mech),
              onclick: () => {
                mech = m;
                renderMech();
                build();
              },
            },
            m.name,
          ),
        ),
      ),
      h(
        'p',
        { class: 'muted small' },
        h('strong', {}, mech.full),
        ' · ',
        h('span', {}, 'Tempo di ripristino:'),
        ' ',
        h('span', {}, mech.recovery),
        ' · ',
        h('span', {}, 'Usato da:'),
        ' ',
        mech.protos
          .map(protoById)
          .filter(Boolean)
          .map((p, i) => [i ? ', ' : '', h('a', { href: `#/protocolli/${p.id}` }, p.name)]),
      ),
    );
  }

  const protos = S.data.protocols.protocols.filter(p => p.attrs.topo.includes(tid));
  const ul = a =>
    h(
      'ul',
      { class: 'clean' },
      a.map(x => h('li', {}, x)),
    );
  app.append(
    h(
      'div',
      { class: 'card' },
      h('h2', { style: 'margin-top:0' }, topo.title),
      h('p', {}, T(topo.text)),
      mechBox,
      box,
      legend,
      h(
        'div',
        { class: 'row', style: 'margin:.6rem 0' },
        h(
          'button',
          {
            onclick: () => {
              broken.clear();
              off.clear();
              changed();
            },
          },
          '↺ Ripristina tutto',
        ),
      ),
      h('h3', {}, 'Cosa succede'),
      status,
      isRing && topo.other ? h('p', { class: 'muted small' }, topo.other) : null,
    ),
    h(
      'div',
      { class: 'two', style: 'margin-top:1rem' },
      h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Vantaggi'), ul(topo.pros)),
      h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Limiti'), ul(topo.cons)),
    ),
    h(
      'div',
      { class: 'card', style: 'margin-top:1rem' },
      h('h3', { style: 'margin-top:0' }, 'Protocolli che supportano questa topologia'),
      h(
        'div',
        { class: 'row' },
        protos.map(p => h('a', { class: 'tag protochip', href: `#/protocolli/${p.id}` }, logo(p, 20), h('span', {}, p.name))),
      ),
      h('p', { class: 'muted small' }, D.ipNote),
    ),
  );

  renderMech();
  const fit = () => {
    const n = (box.clientWidth || 800) < 560;
    if (n !== narrow || !M) {
      narrow = n;
      build();
    }
  };
  fit();
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(box);
  if (!reduced) raf = requestAnimationFrame(frame);
  cleanups.push(() => {
    clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    ro?.disconnect();
  });
}
