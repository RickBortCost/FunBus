// Grafica dei badge: medaglie, scudi ed esagoni disegnati in SVG (niente emoji), con lucchetto quando non ottenuti.
import { h, svgEl } from './core.js';

const CIRCLE = r => `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
// forma, colore, tratto, [pieno]
const ART = {
  first_quiz: ['medal', '#2a78d6', CIRCLE(10) + CIRCLE(5), CIRCLE(1.6)],
  quiz_90: ['medal', '#a17a00', '', 'M0 -11L3.2 -3.6L11 -3L5 2.2L7 10L0 5.8L-7 10L-5 2.2L-11 -3L-3.2 -3.6Z'],
  streak5: ['medal', '#c9541e', '', 'M0 -11C1 -5 8 -3 7 4A7 7 0 0 1 -7 4C-7 0 -4 -1 -3 -5C-1 -3 -1 -1 0 0C1 -3 0 -7 0 -11Z'],
  matcher: ['medal', '#6250d6', 'M-11 -7H-1V3H-11ZM1 -3H11V7H1ZM-1 -2H1'],
  feasibility: ['shield', '#0f8a5f', 'M-9 9V-9L9 9ZM-5 5V0L0 5Z'],
  explorer: ['shield', '#2a78d6', CIRCLE(10), 'M5 -5L1.8 1.8L-5 5L-1.8 -1.8Z'],
  animator: ['shield', '#c2407a', 'M-10 -8H10V8H-10Z', 'M-3 -4.5V4.5L5 0Z'],
  pro: ['shield', '#5d6b7a', 'M6 -10a6 6 0 0 0 -7 8L-10 7L-7 10L2 1a6 6 0 0 0 8 -7L6 -2L2 -6Z'],
  builder: [
    'hex',
    '#0f8a5f',
    'M0 -7V0M0 0L-7 6M0 0L7 6',
    CIRCLE(3).replace('M-3 0', 'M-3 -9') + CIRCLE(3).replace('M-3 0', 'M-11 8') + CIRCLE(3).replace('M-3 0', 'M5 8'),
  ],
  graduate: ['hex', '#a17a00', 'M-11 -3L0 -8L11 -3L0 2ZM-6 0V5C-6 8 6 8 6 5V0M11 -3V4'],
  architect: [
    'hex',
    '#6250d6',
    CIRCLE(8),
    [
      [0, -8],
      [8, 0],
      [0, 8],
      [-8, 0],
    ]
      .map(([x, y]) => CIRCLE(2.8).replace('M-2.8 0', `M${x - 2.8} ${y}`))
      .join(''),
  ],
};
const SHAPE = {
  medal: ['M28 4a20 20 0 1 0 0.01 0Z', 28, 24, 'M17 39L13 54L21 49L28 54L35 49L43 54L39 39Z'],
  shield: ['M28 3L48 10V27C48 40 39 49 28 53C17 49 8 40 8 27V10Z', 28, 27],
  hex: ['M28 3L50 15.5V40.5L28 53L6 40.5V15.5Z', 28, 28],
};
const LOCK = ['M-5 -1V-5a5 5 0 0 1 10 0V-1', 'M-8 -1H8V9H-8Z'];

export const hasArt = id => !!ART[id];
export function badgeArt(id, earned, size = 56) {
  const [shape, color, stroke, fill] = ART[id],
    [outline, cx, cy, ribbon] = SHAPE[shape];
  const s = svgEl('svg', {
    viewBox: '0 0 56 56',
    width: size,
    height: size,
    class: 'badgeart' + (earned ? '' : ' off'),
    'aria-hidden': 'true',
  });
  s.style.setProperty('--bc', color);
  if (ribbon) s.append(svgEl('path', { class: 'bribbon', d: ribbon }));
  s.append(
    svgEl('path', { class: 'bbase', d: outline }),
    svgEl('path', { class: 'brim', d: outline, transform: `translate(${cx} ${cy}) scale(.84) translate(${-cx} ${-cy})` }),
  );
  const g = svgEl('g', { transform: `translate(${cx} ${cy})` });
  const [st, fl] = earned ? [stroke, fill] : LOCK;
  if (st) g.append(svgEl('path', { class: 'bst', d: st }));
  if (fl) g.append(svgEl('path', { class: 'bfl', d: fl }));
  s.append(g);
  return s;
}

// Medaglia del livello raggiunto: stella con il numero.
function levelArt(n, size) {
  const s = svgEl('svg', { viewBox: '0 0 56 56', width: size, height: size, class: 'badgeart', 'aria-hidden': 'true' });
  s.style.setProperty('--bc', '#0b6bcb');
  const t = svgEl('text', { class: 'blvl', x: 28, y: 36, 'text-anchor': 'middle' });
  t.textContent = String(n);
  s.append(
    svgEl('path', {
      class: 'bbase',
      d: 'M28 2L35 11L46 8L46 19.5L56 25L49 34L52 45L41 46L36 56L28 49L20 56L15 46L4 45L7 34L0 25L10 19.5L10 8L21 11Z',
    }),
    svgEl('circle', { class: 'brim', cx: 28, cy: 29, r: 16 }),
    t,
  );
  return s;
}

// Traguardo raggiunto: riquadro in basso con la grafica in grande. Non blocca la pagina, si chiude da solo o con un clic;
// più traguardi insieme si mostrano uno dopo l'altro. L'animazione è spenta da prefers-reduced-motion (nel CSS).
const queue = [];
let showing = false;
export function celebrate(what) {
  queue.push(what);
  if (!showing) nextCelebration();
}
function nextCelebration() {
  const w = queue.shift();
  showing = !!w;
  if (!w) return;
  const close = () => {
    clearTimeout(timer);
    box.remove();
    nextCelebration();
  };
  const art = w.kind === 'level' ? levelArt(w.n, 88) : hasArt(w.id) ? badgeArt(w.id, true, 88) : h('span', { class: 'cicon' }, w.icon);
  const box = h(
    'div',
    { class: 'celebrate', role: 'status', 'data-kind': w.kind },
    h('span', { class: 'cart' }, art),
    h('span', { class: 'cbody' }, h('span', { class: 'clabel' }, w.label), h('strong', {}, w.name), h('span', { class: 'cdesc' }, w.desc)),
    h('button', { class: 'cclose', 'aria-label': 'Chiudi', onclick: close }, '✕'),
  );
  document.body.append(box);
  const timer = setTimeout(close, 6000);
}
