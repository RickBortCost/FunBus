// Ricerca globale su schede, varianti, glossario, topologie, lezioni, approfondimenti, normative, scenari e missioni.
// L'indice è costruito dai dati già caricati, nella lingua e nel livello correnti: nessuna richiesta in rete.
import { S, h, T } from './core.js';

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const flat = v =>
  v == null
    ? ''
    : typeof v === 'string'
      ? v
      : Array.isArray(v)
        ? v.map(flat).join(' ')
        : typeof v === 'object'
          ? Object.values(v).map(flat).join(' ')
          : String(v);

function buildIndex() {
  const D = S.data,
    out = [];
  const add = (group, title, text, href) => out.push({ group, title, text: flat(text), href, nt: norm(title), nx: norm(flat(text)) });
  for (const p of D.protocols.protocols) {
    const vs = (D.protocols.variants || [])
      .filter(v => v.show.includes(p.id))
      .map(v => [v.title, v.rows.map(r => [r.label, Object.values(r.values)])]);
    add(
      'Protocolli',
      p.name,
      [
        p.family,
        T(p.tagline),
        T(p.story),
        T(p.example),
        Object.values(p.card).map(T),
        p.pros,
        p.cons,
        p.usecases,
        p.tech,
        p.notes,
        p.illus?.text,
        vs,
      ],
      `#/protocolli/${p.id}`,
    );
  }
  for (const t of D.glossary.terms) add('Glossario', t.t, T(t), `#/glossario/${encodeURIComponent(t.t)}`);
  for (const t of D.topologies.topologies)
    add(
      'Topologie',
      t.title,
      [T(t.text), T(t.cable), T(t.node), t.pros, t.cons, (t.mechs || []).map(m => [m.full, m.recovery, m.phases.map(T)])],
      `#/topologie/${t.id}`,
    );
  for (const l of D.course.lessons) add('Percorso guidato', l.title, T(l.text), `#/percorso/${l.id}`);
  for (const t of D.topics.topics) add('Approfondimenti', t.title, T(t), '#/approfondimenti');
  for (const r of D.normative.regs) add('Normative', r.name, [r.kind, T(r.short), T(r.who), T(r.dates), T(r.impact)], '#/normative');
  const lv = S.level === 'professional' ? 'professional' : 'beginner';
  for (const s of D.scenarios.scenarios.filter(x => x.level === lv)) add('Scenari di fattibilità', s.title, s.text, '#/test/scenari');
  for (const m of D.game.build.missions.filter(x => x.level === lv)) add('Costruisci la rete', m.title, m.text, '#/test/rete');
  return out;
}

// Estratto attorno alla prima parola trovata, con le corrispondenze evidenziate.
function snippet(text, words) {
  const n = norm(text);
  let at = -1;
  for (const w of words) {
    const i = n.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return [text.slice(0, 150) + (text.length > 150 ? '…' : '')];
  const from = Math.max(0, at - 60),
    to = Math.min(text.length, at + 110),
    part = text.slice(from, to),
    np = norm(part),
    hits = [];
  // norm() non cambia la lunghezza per i testi dell'app (lettere accentate precomposte → base + segno rimosso): gli indici coincidono
  if (np.length === part.length)
    for (const w of words) for (let i = np.indexOf(w); i >= 0; i = np.indexOf(w, i + w.length)) hits.push([i, i + w.length]);
  hits.sort((a, b) => a[0] - b[0]);
  const kids = [from > 0 ? '…' : ''];
  let pos = 0;
  for (const [a, b] of hits) {
    if (a < pos) continue;
    kids.push(part.slice(pos, a), h('mark', {}, part.slice(a, b)));
    pos = b;
  }
  kids.push(part.slice(pos), to < text.length ? '…' : '');
  return kids;
}

export function cerca(app, { id }) {
  const index = buildIndex();
  const out = h('div', { 'aria-live': 'polite' });
  const q = h('input', {
    type: 'search',
    class: 'searchbox',
    placeholder: "Cerca in tutta l'app…",
    'aria-label': "Cerca in tutta l'app",
    value: id ? decodeURIComponent(id) : '',
  });
  const run = () => {
    const words = norm(q.value)
      .split(/\s+/)
      .filter(w => w.length >= 2);
    try {
      history.replaceState(null, '', '#/cerca' + (q.value.trim() ? '/' + encodeURIComponent(q.value.trim()) : ''));
    } catch {
      /* ignora */
    }
    if (!words.length) {
      out.replaceChildren(
        h(
          'p',
          { class: 'muted' },
          'Scrivi almeno due lettere: la ricerca guarda schede, glossario, topologie, lezioni, approfondimenti, normative, scenari e missioni.',
        ),
      );
      return;
    }
    const res = index
      .map(e => ({
        e,
        score: words.every(w => e.nt.includes(w) || e.nx.includes(w))
          ? words.reduce((a, w) => a + (e.nt.includes(w) ? 10 : 0) + Math.min(5, e.nx.split(w).length - 1), 0)
          : 0,
      }))
      .filter(r => r.score)
      .sort((a, b) => b.score - a.score);
    if (!res.length) {
      out.replaceChildren(h('p', { class: 'muted' }, 'Nessun risultato.'));
      return;
    }
    const groups = [...new Set(res.map(r => r.e.group))];
    out.replaceChildren(
      h('p', { class: 'muted' }, `Risultati: ${res.length}`),
      ...groups.map(g => {
        const rs = res.filter(r => r.e.group === g);
        return h(
          'section',
          {},
          h('h2', {}, h('span', {}, g), ' ', h('span', { class: 'tag' }, String(rs.length))),
          h(
            'ul',
            { class: 'results' },
            rs
              .slice(0, 12)
              .map(({ e }) => h('li', {}, h('a', { href: e.href }, e.title), h('p', { class: 'muted small' }, snippet(e.text, words)))),
          ),
        );
      }),
    );
  };
  q.addEventListener('input', run);
  app.append(h('h1', {}, 'Cerca'), q, out);
  run();
  setTimeout(() => q.focus(), 0);
}
