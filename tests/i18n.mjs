// Controllo statico delle traduzioni: ogni testo italiano dei dati e dell'interfaccia deve avere una voce
// (o un pattern) nel dizionario data/lang/en.json. Uso: node tests/i18n.mjs
// Il dizionario è indicizzato sul testo italiano: basta ritoccare una frase perché la traduzione sparisca in silenzio.
import fs from 'node:fs';
import { looksItalian } from './italian.mjs';

const EN = JSON.parse(fs.readFileSync('wwwroot/data/lang/en.json', 'utf8'));
const patterns = EN.patterns.map(([re]) => new RegExp(re, 's'));
const translated = s => {
  const t = s.trim();
  return !t || EN.strings[t] !== undefined || patterns.some(r => r.test(t));
};
const err = [];

/* ---- dati JSON: stesse chiavi escluse di i18n.js ---- */
const SKIP = new Set(
  [
    ...fs
      .readFileSync('wwwroot/js/i18n.js', 'utf8')
      .match(/const SKIP = new Set\(\[([^\]]*)\]\)/)[1]
      .matchAll(/'([^']+)'/g),
  ].map(m => m[1]),
);
const files = fs
  .readFileSync('wwwroot/js/core.js', 'utf8')
  .match(/DATA_FILES = \[([^\]]*)\]/)[1]
  .match(/'([^']+)'/g)
  .map(s => s.slice(1, -1));
for (const f of files)
  if (SKIP.has(f))
    err.push(
      `dati ${f}.json: il nome del file coincide con una chiave esclusa dalla traduzione (SKIP in i18n.js), quindi non verrebbe tradotto`,
    );
let nData = 0;
const walk = (o, where) => {
  if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${where}[${i}]`));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) if (!SKIP.has(k)) walk(v, `${where}.${k}`);
  } else if (typeof o === 'string') {
    nData++;
    if (looksItalian(o) && !translated(o)) err.push(`dati ${where}: «${o.slice(0, 90)}»`);
  }
};
for (const f of files) walk(JSON.parse(fs.readFileSync(`wwwroot/data/${f}.json`, 'utf8')), f);

/* ---- letterali di testo nel codice dell'interfaccia ---- */
// Estrae stringhe '…', "…" e `…` (le interpolazioni ${…} diventano «1», valore che soddisfa i pattern con (\d+) e (.*)).
function literals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const skipTemplate = () => {
    // i punta dopo il backtick di apertura; restituisce il testo con «1» al posto delle interpolazioni
    let s = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') {
        s += src[i + 1] === 'n' ? '\n' : src[i + 1];
        i += 2;
      } else if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        let depth = 1;
        while (i < n && depth) {
          const c = src[i];
          if (c === '`') {
            i++;
            skipTemplate();
            continue;
          }
          if (c === "'" || c === '"') {
            i++;
            while (i < n && src[i] !== c) i += src[i] === '\\' ? 2 : 1;
          } else if (c === '{') depth++;
          else if (c === '}') depth--;
          i++;
        }
        s += '1';
      } else s += src[i++];
    }
    i++;
    return s;
  };
  let prev = '';
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 2;
    } else if (c === '/' && /[(,=:[!&|?{};\n]/.test(prev)) {
      i++;
      while (i < n && src[i] !== '/' && src[i] !== '\n') {
        if (src[i] === '[') {
          while (i < n && src[i] !== ']') i += src[i] === '\\' ? 2 : 1;
        }
        i += src[i] === '\\' ? 2 : 1;
      }
      i++;
    } else if (c === "'" || c === '"') {
      i++;
      let s = '';
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') {
          s += src[i + 1] === 'n' ? '\n' : src[i + 1];
          i += 2;
        } else s += src[i++];
      }
      i++;
      out.push(s);
      prev = c;
      continue;
    } else if (c === '`') {
      i++;
      out.push(skipTemplate());
      prev = c;
      continue;
    } else i++;
    if (!/\s/.test(c)) prev = c;
  }
  return out;
}
// Testo che non arriva all'utente così com'è (frammenti composti in pagina o tradotti a pezzi): motivato caso per caso.
const ALLOW = [
  /^#\//, // percorsi interni (#/protocolli/…)
  /^ · (Nodo spento|Non raggiungibile)$/, // topo.js: suffisso di un'etichetta, coperto dal pattern «X · Nodo spento»
  /^ · Con riserve: $/, // games.js: prefisso di un elenco, coperto dal pattern «· Con riserve: …»
];
let nJs = 0;
for (const f of fs.readdirSync('wwwroot/js').filter(x => x.endsWith('.js'))) {
  for (const s of literals(fs.readFileSync(`wwwroot/js/${f}`, 'utf8'))) {
    if (s.length < 3 || /^[\w.#-]+$/.test(s) || /^[\w-]+:[^ ]|^\.|:\s*\w+\(|^M-?\d/.test(s)) continue; // identificatori, dichiarazioni CSS, percorsi SVG
    nJs++;
    if (looksItalian(s) && !translated(s) && !ALLOW.some(r => r.test(s))) err.push(`interfaccia ${f}: «${s.slice(0, 110)}»`);
  }
}
if (err.length) {
  console.error(`TRADUZIONI MANCANTI (${err.length}):\n- ` + err.join('\n- '));
  process.exit(1);
}
console.log(`Traduzioni OK: ${nData} testi nei dati, ${nJs} letterali dell'interfaccia`);
