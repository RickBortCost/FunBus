import { S, h, T, isPro, mark, protoById, save } from './core.js';
import { createSim } from './sim.js';

const FIELDS = () => S.data.protocols.fields;

export function home(app, { rerender }) {
  const choose = lv => { S.level = lv; S.levelChosen = true; save(); rerender(true); };
  const box = [];
  if (!S.levelChosen) {
    box.push(h('div', { class: 'card' },
      h('h2', {}, 'Scegli il tuo livello'),
      h('p', {}, 'Puoi cambiarlo in qualsiasi momento dal selettore in alto.'),
      h('div', { class: 'two' },
        h('button', { class: 'primary', onclick: () => choose('beginner') }, 'Beginner — concetti base, analogie, terminologia semplice'),
        h('button', { class: 'primary', onclick: () => choose('professional') }, 'Professional — livello fisico/data link, frame, cicli, topologie, diagnostica'))));
  }
  app.append(
    h('h1', {}, 'Industrial Protocols Lab'),
    h('p', {}, 'Impara i protocolli industriali con schede, animazioni, confronti e test a punti. Tutto è simulato, nessun hardware richiesto.'),
    ...box,
    h('h2', {}, 'Protocolli'),
    protocolGrid(),
    h('div', { class: 'two' },
      h('a', { class: 'card', href: '#/confronto' }, h('h3', {}, '⚖ Confronto'), h('p', { class: 'muted' }, 'Tabella filtrabile e protocolli affiancati.')),
      h('a', { class: 'card', href: '#/test' }, h('h3', {}, '🎮 Test e giochi'), h('p', { class: 'muted' }, 'Quiz, abbinamenti e scenari di fattibilità con punti e badge.'))));
}

function protocolGrid() {
  return h('div', { class: 'grid' }, S.data.protocols.protocols.map(p =>
    h('a', { class: 'card', href: `#/protocolli/${p.id}`, style: `--pc:${p.color}` },
      h('h3', {}, p.name),
      h('p', { class: 'muted' }, T(p.tagline)),
      h('span', { class: 'tag' }, p.family))));
}

export function protocols(app) {
  const i = S.data.protocols.intro;
  app.append(h('h1', {}, 'Protocolli'),
    h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, i.title), T(i).map(t => h('p', {}, t))),
    h('h2', {}, 'Scegli un protocollo'), protocolGrid());
}

export function protocol(app, { id, cleanups }) {
  const p = protoById(id);
  if (!p) { app.append(h('p', {}, 'Protocollo non trovato.'), h('a', { href: '#/protocolli' }, '← Elenco')); return; }
  mark('visited', p.id);
  let tab = sessionStorage.getItem('tab') || 'scheda';
  const body = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const show = t => {
    tab = t; try { sessionStorage.setItem('tab', t); } catch { /* ignora */ }
    tabs.replaceChildren(...[['scheda', 'Scheda'], ['animazione', 'Animazione']].map(([k, l]) =>
      h('button', { role: 'tab', class: k === t ? 'on' : '', onclick: () => { cleanups.splice(0).forEach(f => f()); show(k); } }, l)));
    body.replaceChildren();
    if (t === 'scheda') body.append(card(p));
    else {
      const sim = createSim(p, S.data.animations[p.id]);
      cleanups.push(sim.stop);
      body.append(sim.el); if (!isPro()) body.append(h('p', { class: 'muted' }, 'Passa a Professional per esplorare i frame campo per campo.'));
    }
  };
  app.append(
    h('a', { href: '#/protocolli' }, '← Tutti i protocolli'),
    h('h1', { style: `border-left:6px solid ${p.color};padding-left:.6rem` }, p.name),
    h('p', {}, T(p.tagline)),
    h('span', { class: 'tag' }, p.family),
    tabs, body);
  show(tab === 'animazione' ? 'animazione' : 'scheda');
}

function card(p) {
  const list = (title, arr) => h('div', { class: 'card' }, h('h3', {}, title), h('ul', { class: 'clean' }, arr.map(x => h('li', {}, x))));
  return h('div', {},
    h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'In parole semplici'), T(p.story).map(t => h('p', {}, t)),
      h('div', { class: 'note analogy' }, h('strong', {}, 'Esempio pratico: '), T(p.example))),
    !isPro() && p.analogy ? h('div', { class: 'note analogy' }, h('strong', {}, 'Analogia: '), p.analogy) : null,
    h('div', { class: 'card', style: 'margin-top:1rem' }, h('dl', { class: 'spec' }, FIELDS().flatMap(f => [h('dt', {}, f.label), h('dd', {}, T(p.card[f.key]))]))),
    h('div', { class: 'two', style: 'margin-top:1rem' }, list('Vantaggi', p.pros), list('Limiti', p.cons)),
    h('div', { style: 'margin-top:1rem' }, list('Casi d\'uso tipici', p.usecases)),
    isPro() ? h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, 'Dati tecnici'), h('dl', { class: 'spec' }, p.tech.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null,
    p.notes.map(n => h('div', { class: 'note' }, h('strong', {}, 'Accuratezza: '), n)));
}
