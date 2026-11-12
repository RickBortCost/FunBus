import { S, h, T, isPro, mark, protoById, save } from './core.js';
import { createSim } from './sim.js';
import { logo } from './logos.js';
import { pyramid, pyramidLegend } from './osi.js';
import { securityBox } from './normative.js';
import { topoChips } from './topo.js';
import { illustration } from './illus.js';

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
    h('h1', {}, 'FunBus'),
    h('p', {}, 'Impara i protocolli industriali con schede, animazioni, confronti e test a punti. Tutto è simulato, nessun hardware richiesto.'),
    ...box,
    commSection(),
    h('h2', {}, 'Tutti i protocolli'),
    protocolGrid(),
    h('div', { class: 'two' },
      h('a', { class: 'card', href: '#/confronto' }, h('h3', {}, '⚖ Confronto'), h('p', { class: 'muted' }, 'Tabella filtrabile e protocolli affiancati.')),
      h('a', { class: 'card', href: '#/test' }, h('h3', {}, '🎮 Test e giochi'), h('p', { class: 'muted' }, 'Quiz, abbinamenti e scenari di fattibilità con punti e badge.'))));
}

function protocolGrid() {
  return h('div', { class: 'grid' }, S.data.protocols.protocols.map(p =>
    h('a', { class: 'card', href: `#/protocolli/${p.id}`, style: `--pc:${p.color}` },
      h('div', { class: 'row' }, logo(p, 36), h('h3', { style: 'margin:0' }, p.name)),
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
    h('div', { class: 'phead' },
      h('div', { class: 'pheadmain' }, h('div', { class: 'row' }, logo(p, 56), h('h1', { style: 'margin:0' }, p.name)), h('p', {}, T(p.tagline)), h('span', { class: 'tag' }, p.family)),
      illustration(p)),
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
    h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', { style: 'margin-top:0' }, 'Piramide dei livelli OSI'), pyramid(p, { width: 300 }), pyramidLegend(p)),
    h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', { style: 'margin-top:0' }, 'Topologie supportate'), topoChips(p), h('p', { class: 'muted small', style: 'margin-bottom:0' }, T(p.card.topology))),
    securityBox(p),
    h('div', { class: 'two', style: 'margin-top:1rem' }, list('Vantaggi', p.pros), list('Limiti', p.cons)),
    h('div', { style: 'margin-top:1rem' }, list('Casi d\'uso tipici', p.usecases)),
    isPro() ? h('div', { class: 'card', style: 'margin-top:1rem' }, h('h3', {}, 'Dati tecnici'), h('dl', { class: 'spec' }, p.tech.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))) : null,
    p.notes.map(n => h('div', { class: 'note' }, h('strong', {}, 'Accuratezza: '), n)));
}

function commSection() {
  const P = S.data.protocols, mode = { polling: '🔄', notify: '🔔', both: '⚖' };
  const col = k => h('div', { class: 'card', style: `border-top:4px solid var(--${k === 'polling' ? 'accent' : k === 'notify' ? 'ok' : 'warn'})` },
    h('h3', { style: 'margin-top:0' }, `${mode[k]} ${P.commText[k].title}`),
    h('p', { class: 'muted' }, T(P.commText[k])),
    h('ul', { class: 'clean', style: 'list-style:none;padding:0' }, P.protocols.filter(x => x.comm.mode === k).map(x =>
      h('li', { style: 'margin:.5rem 0' }, h('div', { class: 'row' }, logo(x, 24), h('a', { href: `#/protocolli/${x.id}` }, h('strong', {}, x.name))), h('div', { class: 'muted', style: 'font-size:.88rem' }, T({ b: x.comm.b, p: x.comm.p })))))
  );
  return h('div', {}, h('h2', {}, 'Come arrivano i dati? Polling o notifica'),
    h('div', { class: 'note analogy' }, T(P.commIntro)),
    h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(280px,1fr))' }, col('polling'), col('both'), col('notify')),
    h('div', { class: 'note' }, h('strong', {}, 'Performance vs determinismo: '), isPro()
      ? 'nei protocolli ibridi la modalità scelta per ogni variabile decide il compromesso. Ciclico = carico costante e, su un mezzo deterministico, latenza limitata; on-change = banda e latenza migliori in media, ma il caso peggiore (tutte le variabili cambiano insieme) non è limitato.'
      : 'nei protocolli che fanno entrambe le cose, scegli «ciclico» quando servono tempi certi e «a notifica» quando vuoi risparmiare traffico e reagire subito.'));
}
