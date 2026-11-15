// Illustrazioni originali per ogni bus: apparecchi stilizzati, cavo tipico e connettore in primo piano.
// I disegni sono generici (non riproducono prodotti né loghi); cosa mostrare è definito in protocols.json (campo "illus").
import { h, svgEl } from './core.js';

const UNIT = {
  plc: 'PLC',
  pc: 'PC / HMI',
  ipc: 'PC industriale',
  io: 'Modulo I/O',
  drive: 'Azionamento',
  sensor: 'Sensore',
  cloud: 'Broker / cloud',
  server: 'Server',
  hvac: 'Regolatore',
  button: 'Pulsante',
  lamp: 'Attuatore luce',
  transmitter: 'Trasmettitore',
  meter: 'Contatore',
};
const CONN = {
  rj45: 'RJ45',
  m12: 'M12',
  dsub9: 'D-sub 9 poli',
  terminal: 'Morsetti a vite',
  asi: 'Cavo piatto a perforazione',
  knx: 'Morsetto bus',
  net: 'Rete IP (cavo o wireless)',
};
const P = (cls, d) => svgEl('path', { class: cls, d });
const R = (cls, x, y, w, hh, rx = 3) => svgEl('rect', { class: cls, x, y, width: w, height: hh, rx });
const C = (cls, cx, cy, r) => svgEl('circle', { class: cls, cx, cy, r });

// Apparecchi: disegnati attorno all'origine, entro circa 76×64 px.
function unit(type) {
  const g = svgEl('g', { class: 'iunit' });
  if (type === 'plc')
    g.append(
      P('iu2', 'M-38 -22H38M-38 22H38'),
      R('iu', -34, -28, 68, 56, 5),
      R('iacc', -34, -28, 18, 56, 5),
      P('iu2', 'M-16 -28V28M0 -28V28M16 -28V28'),
      C('iled', -25, -19, 2.6),
      ...[-8, 8, 24].flatMap(x => [C('idot', x, -18, 1.8), C('idot', x, -10, 1.8), C('idot', x, 16, 1.8)]),
    );
  else if (type === 'pc')
    g.append(R('iu', -30, -28, 60, 40, 4), R('iacc', -25, -23, 50, 30, 2), P('iu', 'M-6 12H6V22H-6Z'), P('iu2', 'M-18 24H18'));
  else if (type === 'ipc')
    g.append(
      R('iu', -30, -26, 60, 52, 5),
      R('iacc', -30, -26, 60, 12, 5),
      P('iu2', 'M-20 -4H20M-20 4H20M-20 12H8'),
      C('iled', 20, 14, 2.6),
    );
  else if (type === 'io' || type === 'meter')
    g.append(
      R('iu', -30, -26, 60, 52, 5),
      R('iacc', -30, -26, 60, 9, 4),
      ...(type === 'meter'
        ? [R('iu2', -20, -10, 40, 16, 2), P('iu2', 'M-14 -2H-6M-2 -2H6M10 -2H14')]
        : [-20, -10, 0, 10, 20].flatMap(x => [C('idot', x, -8, 2.2), C('idot', x, 2, 2.2)])),
      P('iu2', 'M-22 16H22'),
    );
  else if (type === 'drive')
    g.append(R('iu', -22, -30, 44, 60, 5), R('iacc', -15, -23, 30, 14, 2), C('iu2', 0, 4, 7), P('iu2', 'M0 4V-2M-14 20H14'));
  else if (type === 'sensor')
    g.append(
      R('iu', -30, -11, 46, 22, 11),
      R('iacc', -30, -11, 12, 22, 6),
      C('iu2', 4, 0, 5),
      P('iu2', 'M16 0H34'),
      C('iled', -6, -5, 2.2),
    );
  else if (type === 'cloud')
    g.append(
      P('iu', 'M-26 14a13 13 0 0 1 2 -25a17 17 0 0 1 32 -4a14 14 0 0 1 18 14a10 10 0 0 1 -4 15Z'),
      P('iacc line', 'M-10 4H10M4 -2L10 4L4 10'),
    );
  else if (type === 'server')
    g.append(
      ...[-26, -8, 10].flatMap(y => [R('iu', -28, y, 56, 15, 3), C('iled', -20, y + 7.5, 2.2), P('iu2', `M-10 ${y + 7.5}H20`)]),
      R('iacc', -28, -26, 5, 15, 2),
    );
  else if (type === 'hvac') g.append(R('iu', -26, -26, 52, 52, 10), C('iacc', 0, -2, 13), P('iu2', 'M0 -2L7 -9M-14 18H14'));
  else if (type === 'button') g.append(R('iu', -24, -26, 48, 52, 6), R('iacc', -15, -17, 30, 15, 3), R('iu2', -15, 3, 30, 15, 3));
  else if (type === 'lamp')
    g.append(
      P('iu', 'M-14 -6a14 14 0 1 1 28 0c0 7 -6 9 -7 16h-14c-1 -7 -7 -9 -7 -16Z'),
      P('iacc line', 'M-6 16H6M-5 22H5'),
      P('iu2', 'M-4 -4L0 4L4 -4'),
    );
  else g.append(C('iu', 0, -10, 18), C('iacc', 0, -10, 11), P('iu2', 'M0 -10L6 -16'), P('iu', 'M-6 8H6V20H-6Z'), P('iu2', 'M-14 24H14')); // trasmettitore
  return g;
}

// Connettore in primo piano, dentro un cerchio di raggio 30.
function connector(type) {
  const g = svgEl('g', { class: 'iconn' });
  if (type === 'rj45')
    g.append(
      P('iu', 'M-15 -10H15V10H6V15H-6V10H-15Z'),
      ...[-10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5].map(x => P('iu2', `M${x} -10V-2`)),
    );
  else if (type === 'm12')
    g.append(
      C('iu', 0, 0, 17),
      C('iu2', 0, 0, 12),
      P('iu', 'M-3 -17V-12H3V-17'),
      ...[
        [-5, -5],
        [5, -5],
        [-5, 5],
        [5, 5],
      ].map(([x, y]) => C('idot', x, y, 2.2)),
    );
  else if (type === 'dsub9')
    g.append(
      P('iu', 'M-19 -9H19L15 9H-15Z'),
      ...[-12, -6, 0, 6, 12].map(x => C('idot', x, -3.5, 1.9)),
      ...[-9, -3, 3, 9].map(x => C('idot', x, 3.5, 1.9)),
    );
  else if (type === 'terminal')
    g.append(
      R('iu', -18, -10, 36, 20, 3),
      ...[-10, 0, 10].flatMap(x => [C('iu2', x, -2, 3.6), P('iu2', `M${x - 2.4} -3.6L${x + 2.4} -0.4`), P('iu2', `M${x} 10V18`)]),
    );
  else if (type === 'asi')
    g.append(
      P('icable', 'M-19 -4H12L19 4H-19Z'),
      C('idot', -9, 0, 2.4),
      C('idot', 5, 0, 2.4),
      P('iu2', 'M-9 -16V-3M5 -16V-3'),
      P('iu', 'M-16 -19H12V-14H-16Z'),
    );
  else if (type === 'knx')
    g.append(
      R('iu', -16, -11, 32, 22, 3),
      R('ired', -16, -11, 16, 22, 3),
      C('idot', -8, -4, 2.3),
      C('idot', -8, 4, 2.3),
      C('idot', 8, -4, 2.3),
      C('idot', 8, 4, 2.3),
      P('iu2', 'M0 -11V11'),
    );
  else g.append(C('idot', 0, 10, 3), P('iu2 wave', 'M-7 3a10 10 0 0 1 14 0M-13 -3a18 18 0 0 1 26 0M-19 -9a26 26 0 0 1 38 0')); // rete IP
  return g;
}

export function illustration(p) {
  const il = p.illus;
  if (!il) return null;
  const svg = svgEl('svg', { viewBox: '0 0 340 136', class: 'illus', role: 'img', 'aria-label': `Illustrazione: ${p.name}` });
  svg.style.setProperty('--pc', p.color);
  svg.style.setProperty('--cable', il.cable || '#7f8c8d');
  const cable = 'M90 70C122 112 218 112 250 70';
  svg.append(
    P('icout' + (il.wire === 'flat' ? ' flat' : ''), cable),
    P('icable line' + (il.wire === 'flat' ? ' flat' : '') + (il.wire === 'any' ? ' any' : ''), cable),
    ...(il.wire === 'pair' ? [P('ipair', cable)] : []),
  );
  const place = (g, x, y) => {
    g.setAttribute('transform', `translate(${x} ${y})`);
    svg.append(g);
  };
  place(unit(il.left), 50, 52);
  place(unit(il.right), 290, 52);
  svg.append(P('iu2', 'M170 66V100'), C('idot', 170, 101.5, 3), C('ibubble', 170, 36, 31));
  place(connector(il.conn), 170, 36);
  const label = (x, s, anchor = 'middle') => {
    const t = svgEl('text', { class: 'ilbl', x, y: 130, 'text-anchor': anchor });
    t.textContent = s;
    svg.append(t);
  };
  label(50, UNIT[il.left] || '');
  label(290, UNIT[il.right] || '');
  label(170, CONN[il.conn] || '');
  return h('figure', { class: 'illusfig' }, svg, il.text ? h('figcaption', { class: 'muted small' }, il.text) : null);
}
