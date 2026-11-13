// Validazione dei contenuti JSON e dei contrasti dei colori. Uso: node tests/validate.mjs
import fs from 'node:fs';
const rd = f => JSON.parse(fs.readFileSync(`wwwroot/data/${f}.json`, 'utf8'));
const P = rd('protocols'), A = rd('animations'), Q = rd('quiz'), M = rd('matching'), SC = rd('scenarios'), D = rd('decode');
const GM = rd('game'); rd('glossary'); rd('topics');
const EN = JSON.parse(fs.readFileSync('wwwroot/data/lang/en.json', 'utf8'));
for (const [re] of EN.patterns) new RegExp(re);
const NM = rd('normative');
const TP = rd('topologies');
const err = [];
const ids = P.protocols.map(p => p.id);
if (new Set(ids).size !== ids.length) err.push('id protocollo duplicati');
for (const p of P.protocols) {
  for (const f of P.fields) if (!p.card[f.key]) err.push(`${p.id}: campo ${f.key} mancante`);
  for (const k of ['story', 'example', 'tagline']) if (!p[k]?.b || !p[k]?.p) err.push(`${p.id}: ${k} b/p mancante`);
  if (!p.osi?.own?.length || [...p.osi.own, ...p.osi.via].some(n => n < 1 || n > 7)) err.push(`${p.id}: livelli OSI mancanti o non validi`);
  if (!NM.bus[p.id] || !NM.reqs.every(r => ['native', 'partial', 'none'].includes(NM.bus[p.id][r.id]))) err.push(`${p.id}: valutazione normative mancante o non valida`);
  if (!A[p.id]) err.push(`${p.id}: animazione mancante`);
  if (!SC.matrix[p.id]) err.push(`${p.id}: matrice scenari mancante`);
  else { const w = SC.matrix[p.id].wiring; if (!w || !(w.segLenM > 0) || typeof w.regen !== 'boolean' || typeof w.term !== 'boolean' || !EN.strings[w.lenNote]) err.push(`${p.id}: dati di cablaggio (wiring) mancanti o senza nota tradotta`); }
  if (!/^#[0-9a-f]{6}$/i.test(p.color)) err.push(`${p.id}: colore non valido`);
  if (!p.illus?.left || !p.illus?.right || !p.illus?.conn || !/^#[0-9a-f]{6}$/i.test(p.illus.cable || '')) err.push(`${p.id}: illustrazione (illus) incompleta`);
  else if (!EN.strings[p.illus.text]) err.push(`${p.id}: didascalia dell'illustrazione senza traduzione EN`);
  if (!p.sources?.length) err.push(`${p.id}: fonti (sources) mancanti`);
  for (const s of p.sources || []) if (!s.n || !s.d || (EN.strings[s.d] === undefined && /[àèéìòù]| (e|di|per|su|il|la) /.test(s.d))) err.push(`${p.id}: fonte «${s.n}» senza descrizione tradotta`);
  if (!(p.attrs.mbps > 0)) err.push(`${p.id}: attrs.mbps (bit rate tipico in Mbit/s, usato dai grafici) mancante`);
}
// Varianti (OPC UA, PROFINET RT/IRT, PROFIBUS DP/PA, Modbus TCP/RTU, CIP/EtherNet/IP): ogni riga ha un valore tradotto per ogni colonna
const trOk = x => typeof x === 'string' && x && (EN.strings[x] !== undefined || !/[àèéìòù]| (e|di|per|su|il|la|con|da|a) /.test(x));
for (const v of P.variants || []) {
  for (const x of [...v.show, ...(v.compare || []), ...v.cols.map(c => c.proto).filter(Boolean)]) if (!ids.includes(x)) err.push(`varianti ${v.id}: protocollo ${x} inesistente`);
  if (v.cols.length < 2) err.push(`varianti ${v.id}: servono almeno due colonne`);
  for (const c of v.cols) if (!trOk(c.head)) err.push(`varianti ${v.id}: intestazione ${c.key} mancante o non tradotta`);
  for (const k of ['b', 'p']) if (!v.intro?.[k] || !EN.strings[v.intro[k]]) err.push(`varianti ${v.id}: intro/${k} mancante o senza traduzione EN`);
  if (!EN.strings[v.title]) err.push(`varianti ${v.id}: titolo senza traduzione EN`);
  for (const r of v.rows) { if (!EN.strings[r.label]) err.push(`varianti ${v.id}: riga «${r.label}» senza traduzione EN`); for (const c of v.cols) if (!trOk(r.values?.[c.key])) err.push(`varianti ${v.id}: «${r.label}» senza valore tradotto per ${c.key}`); }
}
// Gioco «Costruisci la rete»: ogni missione deve avere almeno una soluzione pienamente adatta (stessa logica di evaluate() nell'app)
const RANK = { none: 0, soft: 1, det: 2, hard: 3 };
for (const m of GM.build.missions) {
  for (const c of m.req.caps || []) if (!SC.capLabels[c]) err.push(`missione ${m.id}: capability ${c} sconosciuta`);
  for (const k of ['title', 'text', ...(m.topoHint ? ['topoHint'] : [])]) if (!EN.strings[m[k]]) err.push(`missione ${m.id}: ${k} senza traduzione EN`);
  for (const k of ['b', 'p']) if (!m.why?.[k] || !EN.strings[m.why[k]]) err.push(`missione ${m.id}: spiegazione why/${k} mancante o senza traduzione EN`);
  const sol = [];
  for (const p of P.protocols) for (const t of TP.topologies.map(x => x.id)) {
    const x = SC.matrix[p.id], r = m.req;
    const w = x.wiring, reps = [...Array((w.repMax || 0) + 1).keys()];
    const wired = reps.some(R => (w.regen ? !r.spanM || r.spanM <= w.segLenM * (R + 1) : !r.totalM || r.totalM <= w.segLenM * (R + 1)) && (w.regen || !w.segNodes || !r.nodes || r.nodes <= w.segNodes * (R + 1)));
    const ok = wired && (!m.topoAllowed || m.topoAllowed.includes(t)) && p.attrs.topo.includes(t) && (r.maxCycleUs == null || (x.cycleMinUs <= r.maxCycleUs && !(x.rt === 'none' && x.cycleMinUs * 5 > r.maxCycleUs)))
      && (!r.rtMin || RANK[x.rt] >= RANK[r.rtMin]) && (!r.nodes || x.maxNodes >= r.nodes) && (r.caps || []).every(c => x.caps[c] === 'yes');
    if (ok) sol.push(`${p.id}/${t}`);
  }
  if (!sol.length) err.push(`missione ${m.id}: nessuna combinazione bus/topologia la risolve`);
}
for (const lv of ['beginner', 'professional']) if (GM.build.missions.filter(m => m.level === lv).length < 3) err.push(`costruisci la rete ${lv}: meno di 3 missioni`);
// Topologie: ogni topologia citata dai protocolli deve esistere, con testi b/p e traduzione EN
const tids = TP.topologies.map(t => t.id);
for (const p of P.protocols) for (const t of p.attrs.topo) if (!tids.includes(t)) err.push(`${p.id}: topologia ${t} senza scheda in topologies.json`);
const needEn = (s, where) => { if (typeof s !== 'string' || !s) err.push(`${where}: testo mancante`); else if (EN.strings[s] === undefined) err.push(`${where}: senza traduzione EN`); };
for (const k of ['b', 'p']) needEn(TP.intro?.[k], `topologie intro/${k}`);
needEn(TP.ipNote, 'topologie ipNote');
for (const t of TP.topologies) {
  needEn(t.name, `topologia ${t.id} name`); needEn(t.title, `topologia ${t.id} title`);
  for (const f of ['text', 'cable', 'node', ...(t.drop ? ['drop'] : [])]) for (const k of ['b', 'p']) needEn(t[f]?.[k], `topologia ${t.id} ${f}/${k}`);
  for (const f of ['pros', 'cons']) (t[f] || []).forEach((s, i) => needEn(s, `topologia ${t.id} ${f}[${i}]`));
  if (t.id === 'ring' && !t.mechs?.length) err.push('topologia ring: meccanismi di ridondanza mancanti');
  for (const m of t.mechs || []) {
    if (m.phases?.length !== 6) err.push(`anello ${m.id}: servono 6 fasi`);
    (m.phases || []).forEach((ph, i) => { for (const k of ['b', 'p']) needEn(ph[k], `anello ${m.id} fase ${i}/${k}`); });
    for (const f of ['full', 'manager', 'recovery']) needEn(m[f], `anello ${m.id} ${f}`);
    for (const pid of m.protos) if (!ids.includes(pid)) err.push(`anello ${m.id}: protocollo ${pid} inesistente`);
  }
}
for (const [id, a] of Object.entries(A)) {
  if (!ids.includes(id)) err.push(`animazione orfana ${id}`);
  const n = a.nodes.map(x => x.id);
  for (const [x, y] of a.links) if (!n.includes(x) || !n.includes(y)) err.push(`${id}: link con nodo inesistente`);
  if (a.loopFrom >= a.steps.length) err.push(`${id}: loopFrom fuori range`);
  a.steps.forEach((s, i) => {
    for (const x of [s.from, ...(Array.isArray(s.to) ? s.to : [s.to]), ...(s.path || [])].filter(Boolean)) if (!n.includes(x)) err.push(`${id} passo ${i}: nodo ${x}`);
    if (s.frame && !a.frames?.[s.frame]) err.push(`${id} passo ${i}: frame ${s.frame} inesistente`);
    if (!s.note?.b || !s.note?.p) err.push(`${id} passo ${i}: nota b/p mancante`);
    if (!['cyc', 'acy', 'alm', 'tok', 'err'].includes(s.kind)) err.push(`${id} passo ${i}: tipo di pacchetto (kind) mancante o non valido`);
    if (s.us != null && !(s.us > 0)) err.push(`${id} passo ${i}: tempo "us" non valido`);
  });
  if (a.cycleUs != null && !(a.cycleUs > 0)) err.push(`${id}: cycleUs non valido`);
  if (a.timeNote && !EN.strings[a.timeNote]) err.push(`${id}: timeNote senza traduzione EN`);
  const f = a.faults || {};
  if (!f.cable?.link || !a.links.some(([x, y]) => (x === f.cable.link[0] && y === f.cable.link[1]) || (y === f.cable.link[0] && x === f.cable.link[1]))) err.push(`${id}: guasto cavo senza link valido`);
  if (!n.includes(f.node?.id)) err.push(`${id}: guasto nodo senza id valido`);
  for (const k of ['cable', 'node', 'crc']) for (const lv of ['b', 'p']) {
    if (!f[k]?.[lv]) err.push(`${id}: spiegazione guasto ${k}/${lv} mancante`);
    else if (!EN.strings[f[k][lv]]) err.push(`${id}: guasto ${k}/${lv} senza traduzione EN`);
  }
}
const qids = new Set();
for (const q of Q.questions) {
  if (qids.has(q.id)) err.push(`quiz id duplicato ${q.id}`); qids.add(q.id);
  if (q.a < 0 || q.a >= q.o.length) err.push(`quiz ${q.id}: risposta fuori range`);
  if (new Set(q.o).size !== q.o.length) err.push(`quiz ${q.id}: opzioni duplicate`);
}
for (const lv of ['beginner', 'professional']) if (Q.questions.filter(q => q.level === lv).length < 10) err.push(`quiz ${lv}: meno di 10 domande`);
for (const e of M.exercises) {
  const l = e.pairs.map(p => p[0]), r = e.pairs.map(p => p[1]);
  if (new Set(l).size !== l.length || new Set(r).size !== r.length) err.push(`abbinamento ${e.id}: elementi duplicati`);
}
for (const s of SC.scenarios) for (const c of s.req.caps || []) if (!SC.capLabels[c]) err.push(`scenario ${s.id}: capability ${c} sconosciuta`);
// Ogni scenario deve avere almeno un protocollo pienamente adatto (stessa logica di evaluate() nell'app)
{
  const R = { none: 0, soft: 1, det: 2, hard: 3 };
  const full = (p, r) => { const x = SC.matrix[p.id]; return (r.maxCycleUs == null || (x.cycleMinUs <= r.maxCycleUs && !(x.rt === 'none' && x.cycleMinUs * 5 > r.maxCycleUs))) && (!r.rtMin || R[x.rt] >= R[r.rtMin]) && (!r.topo || p.attrs.topo.includes(r.topo)) && (!r.nodes || x.maxNodes >= r.nodes) && (r.caps || []).every(c => x.caps[c] === 'yes'); };
  for (const s of SC.scenarios) if (!P.protocols.some(p => full(p, s.req))) err.push(`scenario ${s.id} «${s.title}»: nessun protocollo pienamente adatto`);
}
for (const [pid, m] of Object.entries(SC.matrix)) for (const c of Object.keys(m.caps)) if (!SC.capLabels[c]) err.push(`matrice ${pid}: capability ${c} sconosciuta`);
for (const it of D.items) for (const q of it.q) if (q.a >= q.o.length) err.push(`decode ${it.id}: risposta fuori range`);

// Contrasto WCAG AA (4.5:1) per le coppie principali del tema
const css = fs.readFileSync('wwwroot/css/style.css', 'utf8');
const vars = blk => Object.fromEntries([...blk.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map(m => [m[1], m[2].length === 4 ? '#' + [...m[2].slice(1)].map(c => c + c).join('') : m[2]]));
const light = vars(css.match(/:root\{([^}]*)\}/)[1]), dark = { ...light, ...vars(css.match(/\[data-theme=dark\]\{([^}]*)\}/)[1]) }, hc = { ...light, ...vars(css.match(/\[data-theme=hc\]\{([^}]*)\}/)[1]) };
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [name, t, min] of [['chiaro', light, 4.5], ['scuro', dark, 4.5], ['alto contrasto', hc, 7]]) {
  for (const [fg, bg] of [['text', 'bg'], ['text', 'surface'], ['text', 'surface2'], ['text', 'diff'], ['muted', 'surface'], ['muted', 'surface2'], ['muted', 'bg'], ['accent-t', 'accent'], ['accent', 'surface'], ['ok', 'surface'], ['bad', 'surface'], ['warn', 'surface'], ['k-t', 'ok'], ['k-t', 'bad']]) {
    const r = ratio(t[fg], t[bg]);
    if (r < (fg === 'k-t' ? 4.5 : min)) err.push(`contrasto tema ${name}: ${fg} su ${bg} = ${r.toFixed(2)}`);
  }
  // Elementi grafici (WCAG 1.4.11, 3:1): colori dei tipi di pacchetto sugli sfondi delle animazioni
  for (const k of ['k-cyc', 'k-acy', 'k-alm', 'k-tok', 'k-err', 's1', 's2', 's3', 's4', 's5', 's6']) for (const bg of ['surface', 'surface2']) {
    const r = ratio(t[k], t[bg]);
    if (r < 3) err.push(`contrasto grafico tema ${name}: ${k} su ${bg} = ${r.toFixed(2)}`);
  }
  for (const k of ['k-cyc', 'k-acy', 'k-alm', 'k-tok', 'k-err']) { const r = ratio(t['k-t'], t[k]); if (r < 3) err.push(`contrasto grafico tema ${name}: k-t su ${k} = ${r.toFixed(2)}`); }
}
if (err.length) { console.error('ERRORI:\n- ' + err.join('\n- ')); process.exit(1); }
console.log(`OK: ${P.protocols.length} protocolli, ${Q.questions.length} domande, ${SC.scenarios.length} scenari`);
