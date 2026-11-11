// Pittogrammi originali (non sono i loghi ufficiali, che sono marchi dei rispettivi titolari).
const G = {
  profinet: '<circle cx="24" cy="24" r="13"/><circle cx="24" cy="11" r="3" fill="#fff"/><circle cx="37" cy="24" r="3" fill="#fff"/><circle cx="24" cy="37" r="3" fill="#fff"/><circle cx="11" cy="24" r="3" fill="#fff"/>',
  profibus: '<path d="M6 22H42M14 22V36M24 22V36M34 22V36M6 15V29M42 15V29"/>',
  s7: '<rect x="14" y="14" width="20" height="20" rx="3"/><path d="M19 8V14M29 8V14M19 34V40M29 34V40M8 19H14M8 29H14M34 19H40M34 29H40"/>',
  ethercat: '<path d="M8 17H38M32 12L38 17L32 22M40 31H10M16 26L10 31L16 36"/>',
  ads: '<rect x="5" y="15" width="12" height="18" rx="2"/><rect x="31" y="15" width="12" height="18" rx="2"/><path d="M20 21H28M25 18L28 21L25 24M28 28H20M23 25L20 28L23 31"/>',
  mqtt: '<circle cx="24" cy="24" r="5" fill="#fff"/><path d="M24 24L10 10M24 24L38 10M24 24L10 38M24 24L38 38"/><circle cx="10" cy="10" r="3" fill="#fff"/><circle cx="38" cy="10" r="3" fill="#fff"/><circle cx="10" cy="38" r="3" fill="#fff"/><circle cx="38" cy="38" r="3" fill="#fff"/>',
  opcua: '<path d="M24 12V20M24 20L12 30M24 20L36 30M12 30L8 40M12 30L18 40"/><circle cx="24" cy="10" r="4" fill="#fff"/><circle cx="12" cy="30" r="3" fill="#fff"/><circle cx="36" cy="30" r="3" fill="#fff"/>',
  enip: '<circle cx="11" cy="24" r="5"/><circle cx="37" cy="24" r="5"/><path d="M17 24H31M27 20L31 24L27 28"/>',
  modbus: '<rect x="8" y="8" width="32" height="32" rx="3"/><path d="M8 19H40M8 29H40M19 8V40M29 8V40"/>',
  canopen: '<path d="M6 18H42M6 30H42M14 18V30M24 18V30M34 18V30"/><circle cx="6" cy="24" r="2.5" fill="#fff"/><circle cx="42" cy="24" r="2.5" fill="#fff"/>',
  iolink: '<circle cx="10" cy="24" r="6"/><path d="M16 24H30"/><rect x="30" y="16" width="12" height="16" rx="2"/>'
};

// Se esiste logos/<id>.svg (o .png) viene usato il logo ufficiale, altrimenti il pittogramma.
export function logo(p, size = 40) {
  const box = document.createElement('span');
  box.style.cssText = `display:inline-flex;flex:none;align-items:center;justify-content:center;width:${size}px;height:${size}px`;
  box.append(pictogram(p, size));
  const tryLoad = exts => {
    if (!exts.length) return;
    const img = new Image();
    img.alt = `Logo ${p.name}`;
    img.style.cssText = `max-width:${size}px;max-height:${size}px;object-fit:contain;background:#fff;border-radius:6px;padding:2px`;
    img.onload = () => box.replaceChildren(img);
    img.onerror = () => tryLoad(exts.slice(1));
    img.src = `logos/${p.id}.${exts[0]}`;
  };
  tryLoad(['svg', 'png']);
  return box;
}

function pictogram(p, size) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('role', 'img'); s.setAttribute('aria-label', `Pittogramma ${p.name}`);
  s.style.flex = 'none';
  s.innerHTML = `<rect width="48" height="48" rx="10" fill="${p.color}"/><g stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">${G[p.id] || ''}</g>`;
  return s;
}
