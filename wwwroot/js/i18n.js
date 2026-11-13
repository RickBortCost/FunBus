// Localizzazione IT/EN: i contenuti sono scritti in italiano; per l'inglese si usa un dizionario (data/lang/en.json)
// applicato ai dati caricati (traduzione ricorsiva) e, per l'interfaccia, ai nodi di testo del DOM.
import { S } from './core.js';

const SKIP = new Set(['id', 'show', 'compare', 'key', 'proto', 'topoAllowed', 'left', 'right', 'conn', 'cable', 'wire', 'protos', 'test', 'kind', 'us', 'cycleUs', 'link', 'color', 'from', 'to', 'path', 'frame', 'loopFrom', 'x', 'y', 'a', 'level', 'attrs', 'req', 'mode', 'caps', 'hex', 'cycleMinUs', 'maxNodes', 'links', 'own', 'via']);
let dict = null, patterns = [], observer = null;

export async function loadDict() {
  if (dict) return;
  const r = await fetch('data/lang/en.json', { cache: 'no-cache' });
  const j = await r.json();
  dict = j.strings || {};
  patterns = (j.patterns || []).map(([re, rep]) => [new RegExp(re, 's'), rep]);
}

// Traduce una stringa: corrispondenza esatta, poi pattern; altrimenti la lascia invariata.
export function tx(s) {
  if (S.lang !== 'en' || !dict || typeof s !== 'string') return s;
  const t = s.trim();
  if (!t) return s;
  let out = dict[t];
  if (out === undefined) for (const [re, rep] of patterns) { const m = re.exec(t); if (m) { out = rep.replace(/\$(\d)/g, (_, n) => tx(m[+n] ?? '')); break; } }
  if (out === undefined) return s;
  return s.replace(t, () => out);
}

export function translateData(o, key) {
  if (Array.isArray(o)) return o.map(v => translateData(v, key));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, SKIP.has(k) ? v : translateData(v, k)]));
  return typeof o === 'string' ? tx(o) : o;
}

/* ---- DOM ---- */
const ORIG = new WeakMap();
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];

function localizeNode(n) {
  if (n.nodeType === 3) {
    const v = n.nodeValue, o = ORIG.get(n) ?? v, t = tx(o);
    if (t !== v) { if (!ORIG.has(n)) ORIG.set(n, v); n.nodeValue = t; }
  } else if (n.nodeType === 1) {
    if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    for (const a of ATTRS) if (n.hasAttribute(a)) {
      const key = '__o_' + a, o = n[key] ?? n.getAttribute(a), t = tx(o);
      if (t !== o) { n[key] = o; n.setAttribute(a, t); }
    }
    n.childNodes.forEach(localizeNode);
  }
}

function revertNode(n) {
  if (n.nodeType === 3) { if (ORIG.has(n)) { n.nodeValue = ORIG.get(n); ORIG.delete(n); } }
  else if (n.nodeType === 1) {
    for (const a of ATTRS) if (n['__o_' + a] !== undefined) { n.setAttribute(a, n['__o_' + a]); delete n['__o_' + a]; }
    n.childNodes.forEach(revertNode);
  }
}

export function startDomLocalizer() {
  if (observer) { observer.disconnect(); observer = null; }
  if (S.lang !== 'en') { revertNode(document.body); document.documentElement.lang = 'it'; document.title = 'FunBus'; return; }
  document.documentElement.lang = 'en';
  localizeNode(document.body);
  observer = new MutationObserver(muts => {
    observer.disconnect();
    for (const m of muts) m.addedNodes.forEach(localizeNode);
    observer.observe(document.body, { childList: true, subtree: true });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
