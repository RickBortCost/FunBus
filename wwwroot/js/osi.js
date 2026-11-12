import { S, h, onColor } from './core.js';

let hatchN = 0;

const NAMES = { 7: 'Applicazione', 6: 'Presentazione', 5: 'Sessione', 4: 'Trasporto', 3: 'Rete', 2: 'Collegamento dati', 1: 'Fisico' };

// Piramide OSI: livelli propri del bus evidenziati, livelli forniti dallo stack sottostante (es. TCP/IP) in tinta chiara.
export function pyramid(p, { compact = false, width = 240 } = {}) {
  const NS = 'http://www.w3.org/2000/svg', rowH = compact ? 17 : 26, w = width, h7 = rowH * 7;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h7}`); svg.setAttribute('width', w); svg.setAttribute('role', 'img');
  const own = p.osi?.own || [], via = p.osi?.via || [];
  svg.setAttribute('aria-label', `Livelli OSI di ${p.name}: propri ${own.join(', ') || 'nessuno'}; forniti dallo stack sottostante ${via.join(', ') || 'nessuno'}`);
  svg.style.maxWidth = '100%';
  const topW = w * 0.35, gap = 1.5;
  // livelli forniti dallo stack sottostante: tratteggio (non solo una tinta più chiara)
  const hid = `osih${hatchN++}`, defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `<pattern id="${hid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${p.color}" stroke-width="2.5"/></pattern>`;
  svg.append(defs);
  for (let i = 0; i < 7; i++) {
    const layer = 7 - i;
    const wTop = topW + (w - topW) * (i / 7), wBot = topW + (w - topW) * ((i + 1) / 7);
    const y = i * rowH, cx = w / 2;
    const pts = `${cx - wTop / 2},${y + gap} ${cx + wTop / 2},${y + gap} ${cx + wBot / 2},${y + rowH - gap} ${cx - wBot / 2},${y + rowH - gap}`;
    const isOwn = own.includes(layer), isVia = !isOwn && via.includes(layer);
    const poly = document.createElementNS(NS, 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('class', 'opoly');
    poly.style.fill = isOwn ? p.color : isVia ? `url(#${hid})` : 'var(--surface2)';
    poly.style.stroke = isOwn || isVia ? p.color : 'var(--border)';
    poly.style.strokeWidth = '1.5';
    const t = document.createElementNS(NS, 'title');
    t.textContent = `L${layer} ${NAMES[layer]}: ${isOwn ? 'definito dal bus' : isVia ? 'fornito dallo stack sottostante' : 'non usato'}`;
    poly.append(t);
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', cx); txt.setAttribute('y', y + rowH / 2 + 4); txt.setAttribute('text-anchor', 'middle');
    txt.style.fontSize = compact ? '10px' : '12px'; txt.style.fontFamily = 'inherit'; txt.style.pointerEvents = 'none';
    txt.style.fill = isOwn ? onColor(p.color) : 'var(--text)'; txt.style.fontWeight = isOwn || isVia ? '700' : '400';
    if (isVia) { txt.style.paintOrder = 'stroke'; txt.style.stroke = 'var(--surface)'; txt.style.strokeWidth = '3px'; }
    txt.textContent = compact ? String(layer) : `${layer} · ${NAMES[layer]}`;
    svg.append(poly, txt);
  }
  return svg;
}

export function pyramidLegend(p) {
  const sw = (bg, bd) => h('span', { style: `display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:.3rem;background:${bg};border:1.5px solid ${bd}` });
  return h('div', { class: 'muted', style: 'font-size:.85rem;display:flex;gap:.9rem;flex-wrap:wrap;margin-top:.4rem' },
    h('span', {}, sw(p.color, p.color), 'definito dal bus'),
    h('span', {}, sw(`repeating-linear-gradient(135deg, ${p.color} 0 2px, transparent 2px 5px)`, p.color), 'fornito dallo stack sottostante'),
    h('span', {}, sw('var(--surface2)', 'var(--border)'), 'non usato'));
}
