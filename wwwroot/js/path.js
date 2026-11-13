// Percorso guidato: lezioni in sequenza che riusano schede, animazioni, topologie, scenari, missioni e quiz.
import { S, h, T, protoById, stepDone, lessonDone, addXP, toast, save } from './core.js';
import { quiz } from './games.js';
import { logo } from './logos.js';
import { topoIcon } from './topo.js';

const lessons = () => S.data.path.lessons;
const inLesson = l => q => (q.protos || []).some(x => (l.protos || []).includes(x)) || (q.area || []).some(x => (l.area || []).includes(x));
const remember = id => { try { sessionStorage.setItem('lesson', id); } catch { /* ignora */ } };

export function percorso(app, ctx) {
  if (ctx.id && ctx.arg === 'quiz') return lessonQuiz(app, ctx);
  if (ctx.id) return lesson(app, ctx);
  try { sessionStorage.removeItem('lesson'); } catch { /* ignora */ }
  const P = S.data.path, done = lessons().filter(lessonDone).length, next = lessons().find(l => !lessonDone(l));
  app.append(h('h1', {}, 'Percorso guidato'), h('p', {}, T(P.intro)),
    h('div', { class: 'card' }, h('strong', {}, `Lezioni completate: ${done} di ${lessons().length}`), h('div', { class: 'progress', style: 'margin-top:.5rem' }, h('i', { style: `width:${(done / lessons().length) * 100}%` }))),
    h('ol', { class: 'lessons' }, lessons().map((l, i) => {
      const n = l.steps.filter(s => stepDone(s, l)).length, ok = lessonDone(l);
      return h('li', {}, h('a', { class: 'card lesson' + (ok ? ' done' : '') + (l === next ? ' next' : ''), href: `#/percorso/${l.id}` },
        h('span', { class: 'lnum', 'aria-hidden': 'true' }, ok ? '✔' : String(i + 1)),
        h('span', { class: 'lbody' }, h('span', { class: 'muted small' }, `Lezione ${i + 1}`), h('strong', {}, l.title),
          h('span', { class: 'row', style: 'gap:.3rem' }, (l.protos || []).map(id => protoById(id)).filter(Boolean).map(p => logo(p, 20)), h('span', { class: 'tag' }, ok ? '✔ completata' : `${n} passi su ${l.steps.length}`), l === next ? h('span', { class: 'tag nextag' }, 'Continua da qui') : null))));
    })));
}

function stepRow(s, l) {
  const done = stepDone(s, l), P = S.data.path;
  const go = (href, tab) => () => { remember(l.id); if (tab) { try { sessionStorage.setItem('tab', tab); } catch { /* ignora */ } } location.hash = href; };
  let icon = null, label, action, extra = null;
  if (s.type === 'card' || s.type === 'anim') {
    const p = protoById(s.id); if (!p) return null;
    icon = logo(p, 24); label = s.type === 'card' ? `Leggi la scheda: ${p.name}` : `Guarda l'animazione: ${p.name}`; action = go(`#/protocolli/${p.id}`, s.type === 'card' ? 'scheda' : 'animazione');
  } else if (s.type === 'topo') {
    const t = S.data.topologies.topologies.find(x => x.id === s.id); if (!t) return null;
    icon = topoIcon(t.id, 18); label = `Prova la topologia: ${t.name}`; action = go(`#/topologie/${t.id}`);
  } else if (s.type === 'scenario') { label = 'Risolvi scenari di fattibilità'; extra = `(${Math.min(S.progress.scenariosSolved.length, s.n)} su ${s.n})`; action = go('#/test/scenari'); }
  else if (s.type === 'build') { label = 'Completa missioni di «Costruisci la rete»'; extra = `(${Math.min((S.progress.built || []).length, s.n)} su ${s.n})`; action = go('#/test/rete'); }
  else { const best = S.progress.lessons?.[l.id]; label = 'Quiz della lezione'; extra = best != null ? `miglior risultato ${best}%, serve almeno il ${P.passPct}%` : null; action = go(`#/percorso/${l.id}/quiz`); }
  return h('li', { class: 'step' + (done ? ' done' : '') },
    h('span', { class: 'stepmark', role: 'img', 'aria-label': done ? 'fatto' : 'da fare' }, done ? '✔' : '○'),
    h('button', { class: 'steplink', onclick: action }, icon, h('span', {}, label), extra ? h('span', { class: 'muted small' }, extra) : null));
}

function lesson(app, { id }) {
  const all = lessons(), i = all.findIndex(l => l.id === id), l = all[i];
  if (!l) { app.append(h('p', {}, 'Lezione non trovata.'), h('a', { href: '#/percorso' }, '← Percorso')); return; }
  remember(l.id);
  // premio alla prima volta che la lezione risulta completa
  const p = S.progress; p.lessonsAwarded ||= [];
  if (lessonDone(l) && !p.lessonsAwarded.includes(l.id)) { p.lessonsAwarded.push(l.id); toast(`Lezione completata: ${l.title}`); addXP(S.data.path.xpLesson || 0); save(); }
  app.append(h('a', { href: '#/percorso' }, '← Percorso'),
    h('p', { class: 'muted small', style: 'margin:.6rem 0 0' }, `Lezione ${i + 1} di ${all.length}`), h('h1', { style: 'margin-top:.1rem' }, l.title),
    h('p', {}, T(l.text)),
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Passi della lezione'), h('ol', { class: 'steps' }, l.steps.map(s => stepRow(s, l))),
      lessonDone(l) ? h('div', { class: 'fb ok' }, '✔ completata') : null),
    h('div', { class: 'row', style: 'margin-top:1rem;justify-content:space-between' },
      i > 0 ? h('a', { class: 'btn', href: `#/percorso/${all[i - 1].id}` }, '← ', h('span', {}, 'Lezione precedente')) : h('span', {}),
      i + 1 < all.length ? h('a', { class: 'btn', href: `#/percorso/${all[i + 1].id}` }, h('span', {}, 'Lezione successiva'), ' →') : h('span', {})));
}

function lessonQuiz(app, ctx) {
  const l = lessons().find(x => x.id === ctx.id), P = S.data.path;
  if (!l) { app.append(h('p', {}, 'Lezione non trovata.'), h('a', { href: '#/percorso' }, '← Percorso')); return; }
  remember(l.id);
  quiz(app, ctx, false, {
    filter: inLesson(l), count: P.quizCount, title: `Quiz della lezione: ${l.title}`, empty: 'Nessuna domanda disponibile per questa lezione.',
    back: { href: `#/percorso/${l.id}`, label: '← ', text: 'Torna alla lezione' },
    onEnd: pct => {
      S.progress.lessons ||= {};
      S.progress.lessons[l.id] = Math.max(S.progress.lessons[l.id] || 0, pct); save();
      return h('div', { class: 'fb ' + (pct >= P.passPct ? 'ok' : 'ko') }, pct >= P.passPct ? `Quiz superato: ${pct}%. Lezione aggiornata.` : `Quiz non superato: ${pct}% (serve almeno il ${P.passPct}%).`);
    }
  });
}

// Collegamento per tornare alla lezione in corso, mostrato sulle altre pagine.
export function backToLesson(root) {
  let id = null; try { id = sessionStorage.getItem('lesson'); } catch { /* ignora */ }
  const l = id && S.data.path?.lessons.find(x => x.id === id);
  if (!l || root === 'percorso' || root === 'home') return null;
  return h('a', { class: 'backlesson', href: `#/percorso/${l.id}` }, '↩ Torna alla lezione');
}
