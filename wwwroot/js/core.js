// Stato globale, utilità DOM, persistenza, XP e badge.
export const S = { lang: 'it', raw: null, level: 'beginner', levelChosen: false, theme: null, progress: null, data: {} };

export const defProgress = () => ({
  xp: 0, xpPro: 0, badges: {},
  stats: { quizDone: 0, bestStreak: 0, quizBest: {}, matchPerfect: 0 },
  matchDone: {}, scenariosSolved: [], visited: [], animated: [], wrong: [], built: []
});

export const L = () => (S.level === 'beginner' ? 'b' : 'p');
export const T = v => (v == null ? '' : (typeof v === 'string' || Array.isArray(v) || typeof v === 'number' ? v : v[L()] ?? v.p ?? v.b ?? ''));
export const isPro = () => S.level === 'professional';

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
export function svgEl(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
  return e;
}
// Colore del testo/segno (bianco o scuro) leggibile su un colore pieno: min = 4.5 per il testo, 3 per i segni grafici.
export function onColor(hex, min = 4.5) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (l + 0.05) >= min ? '#fff' : '#0b1520';
}
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const DATA_FILES = ['protocols', 'animations', 'quiz', 'matching', 'scenarios', 'game', 'glossary', 'topics', 'decode', 'normative', 'topologies'];
export async function loadData(onStep = () => {}) {
  const names = DATA_FILES;
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(n); return r.json(); }).then(j => { onStep(n); return j; })));
  names.forEach((n, i) => (S.data[n] = res[i]));
  S.raw = S.data;
}

let saveTimer;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const body = JSON.stringify({ lang: S.lang, level: S.level, levelChosen: S.levelChosen, theme: S.theme, progress: S.progress });
    try { localStorage.setItem('ipl', body); } catch { /* ignora */ }
    try { await fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }); } catch { /* ignora */ }
  }, 250);
}

export async function loadState() {
  let st = {};
  try { const r = await fetch('/api/state'); if (r.ok) st = await r.json(); } catch { /* ignora */ }
  if (!st.progress) { try { st = JSON.parse(localStorage.getItem('ipl') || '{}'); } catch { st = {}; } }
  S.level = st.level === 'professional' ? 'professional' : 'beginner';
  S.levelChosen = !!st.levelChosen;
  S.lang = st.lang === 'en' ? 'en' : 'it';
  S.theme = st.theme || null;
  S.progress = Object.assign(defProgress(), st.progress || {});
  S.progress.stats = Object.assign(defProgress().stats, S.progress.stats || {});
}

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

export function levelInfo(xp = S.progress.xp) {
  const th = S.data.game.xpPerLevel, names = S.data.game.levelNames;
  let i = 0;
  while (i + 1 < th.length && xp >= th[i + 1]) i++;
  const next = th[i + 1];
  return { index: i, name: names[i], base: th[i], next, pct: next ? Math.round(((xp - th[i]) / (next - th[i])) * 100) : 100 };
}

const BADGE_COND = {
  first_quiz: p => p.stats.quizDone >= 1,
  quiz_90: p => Object.values(p.stats.quizBest).some(v => v >= 90),
  streak5: p => p.stats.bestStreak >= 5,
  matcher: p => p.stats.matchPerfect >= 1,
  feasibility: p => p.scenariosSolved.length >= 3,
  explorer: p => p.visited.length >= S.data.protocols.protocols.length,
  animator: p => p.animated.length >= 4,
  pro: p => p.xpPro >= 100,
  builder: p => (p.built || []).length >= 3,
  architect: p => (p.built || []).length >= 5
};

export function checkBadges() {
  const p = S.progress;
  for (const b of S.data.game.badges) {
    if (!p.badges[b.id] && BADGE_COND[b.id]?.(p)) {
      p.badges[b.id] = Date.now();
      toast(`${b.icon} Nuovo badge: ${b.name}`);
    }
  }
}

export function addXP(n) {
  if (n <= 0) { save(); return; }
  const before = levelInfo().index;
  S.progress.xp += n;
  if (isPro()) S.progress.xpPro += n;
  const after = levelInfo();
  if (after.index > before) toast(`⬆ Livello ${after.index + 1}: ${after.name}`);
  checkBadges();
  save();
}

export function mark(listName, id) {
  const l = S.progress[listName];
  if (!l.includes(id)) { l.push(id); checkBadges(); save(); }
}

export const protoById = id => S.data.protocols.protocols.find(p => p.id === id);
export const protoByName = name => S.data.protocols.protocols.find(p => p.name === name);
