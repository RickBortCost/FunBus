import { S, h, T, isPro, mark, protoById, save, stepDone, lessonDone } from './core.js';
import { createSim } from './sim.js';
import { logo } from './logos.js';
import { pyramid, pyramidLegend } from './osi.js';
import { securityBox } from './normative.js';
import { topoChips } from './topo.js';
import { illustration } from './illus.js';

const FIELDS = () => S.data.protocols.fields;

// Primo avvio: tre passi (che cos'è, livello, da dove cominciare). Il passo resta in memoria tra un ridisegno e l'altro.
let welcomeStep = 0;
function welcome(rerender) {
  const finish = href => {
    S.levelChosen = true;
    welcomeStep = 0;
    save();
    if (href) location.hash = href;
    else rerender(true);
  };
  const go = n => {
    welcomeStep = n;
    rerender(true);
  };
  const first = S.data.course?.lessons[0];
  const steps = [
    () => [
      h('img', { src: 'logo-splash.svg', alt: '', width: 96, height: 96 }),
      h('h2', {}, 'Benvenuto in FunBus'),
      h(
        'p',
        {},
        'Qui impari come si parlano PLC, sensori e azionamenti: i bus di campo e i protocolli industriali, spiegati con schede, animazioni e giochi.',
      ),
      h(
        'ul',
        { class: 'clean wlist' },
        h('li', {}, '🧭 Un percorso guidato in nove lezioni'),
        h('li', {}, '▶ Animazioni da seguire un passo alla volta'),
        h('li', {}, '🎮 Quiz e giochi con punti e badge'),
        h('li', {}, '🔌 Tutto è simulato: non serve alcun hardware'),
      ),
      h('div', { class: 'row wact' }, h('button', { class: 'primary', onclick: () => go(1) }, 'Avanti')),
    ],
    () => [
      h('h2', {}, 'Scegli il tuo livello'),
      h('p', {}, 'Puoi cambiarlo in qualsiasi momento dal selettore in alto.'),
      h(
        'div',
        { class: 'two' },
        ...[
          ['beginner', 'Beginner — concetti base, analogie, terminologia semplice'],
          ['professional', 'Professional — livello fisico/data link, frame, cicli, topologie, diagnostica'],
        ].map(([lv, label]) =>
          h(
            'button',
            {
              class: 'primary',
              onclick: () => {
                S.level = lv;
                save();
                go(2);
              },
            },
            label,
          ),
        ),
      ),
      h('div', { class: 'row wact' }, h('button', { onclick: () => go(0) }, 'Indietro')),
    ],
    () => [
      h('h2', {}, 'Da dove vuoi cominciare?'),
      h('p', {}, 'Se è la prima volta, il percorso guidato ti accompagna dalle basi. Puoi sempre esplorare liberamente dal menu.'),
      h(
        'div',
        { class: 'two' },
        first ? h('button', { class: 'primary', onclick: () => finish(`#/percorso/${first.id}`) }, '🧭 Inizia dalla prima lezione') : null,
        h('button', { onclick: () => finish() }, 'Esplora da solo'),
      ),
      h('div', { class: 'row wact' }, h('button', { onclick: () => go(1) }, 'Indietro')),
    ],
  ];
  return h(
    'section',
    { class: 'card welcome', id: 'welcome', 'aria-label': 'Primo avvio' },
    h(
      'div',
      { class: 'wdots' },
      h('span', { class: 'muted small' }, `Passo ${welcomeStep + 1} di 3`),
      h(
        'span',
        { class: 'wdot', 'aria-hidden': 'true' },
        steps.map((_, i) => h('i', { class: i === welcomeStep ? 'on' : '' })),
      ),
      h('button', { class: 'textbtn', id: 'welcomeSkip', onclick: () => finish() }, "Salta l'introduzione"),
    ),
    ...steps[welcomeStep](),
  );
}

// «Riprendi»: lezione in corso, ultima scheda aperta, domande da ripassare.
function resume() {
  const p = S.progress,
    lessons = S.data.course?.lessons || [];
  if (!(p.xp > 0 || p.visited.length || p.animated.length)) return null;
  const tiles = [];
  const next = lessons.find(l => !lessonDone(l));
  if (next) {
    const n = next.steps.filter(s => stepDone(s, next)).length;
    tiles.push(
      h(
        'a',
        { class: 'rtile', href: `#/percorso/${next.id}` },
        h('span', { class: 'ric', 'aria-hidden': 'true' }, '🧭'),
        h(
          'span',
          { class: 'rbody' },
          h('span', { class: 'muted small' }, `Lezione ${lessons.indexOf(next) + 1}`),
          h('strong', {}, next.title),
          h('span', { class: 'tag' }, `${n} passi su ${next.steps.length}`),
        ),
      ),
    );
  }
  const last = p.lastProto && protoById(p.lastProto);
  if (last)
    tiles.push(
      h(
        'a',
        { class: 'rtile', href: `#/protocolli/${last.id}`, style: `--pc:${last.color}` },
        logo(last, 36),
        h('span', { class: 'rbody' }, h('span', { class: 'muted small' }, 'Ultima scheda aperta'), h('strong', {}, last.name)),
      ),
    );
  const wrong = (p.wrong || []).length;
  if (wrong)
    tiles.push(
      h(
        'a',
        { class: 'rtile', href: '#/test/ripasso' },
        h('span', { class: 'ric', 'aria-hidden': 'true' }, '🔁'),
        h(
          'span',
          { class: 'rbody' },
          h('span', { class: 'muted small' }, 'Ripasso errori'),
          h('strong', {}, `Domande da rivedere: ${wrong}`),
        ),
      ),
    );
  if (!tiles.length) return null;
  return h('section', { class: 'card resume', id: 'resume' }, h('h2', {}, 'Riprendi da dove eri'), h('div', { class: 'rtiles' }, tiles));
}

export function home(app, { rerender }) {
  app.append(
    h('h1', {}, 'FunBus'),
    h(
      'p',
      {},
      'Impara i protocolli industriali con schede, animazioni, confronti e test a punti. Tutto è simulato, nessun hardware richiesto.',
    ),
  );
  if (!S.levelChosen) {
    app.append(welcome(rerender));
    return;
  }
  const again = resume();
  app.append(
    again || '',
    again?.querySelector('[href^="#/percorso/"]')
      ? ''
      : h(
          'a',
          { class: 'card pathcard', href: '#/percorso' },
          h('h3', { style: 'margin-top:0' }, '🧭 Percorso guidato'),
          h(
            'p',
            { class: 'muted', style: 'margin-bottom:0' },
            'Nove lezioni in ordine, con schede, animazioni e quiz: il modo più semplice per cominciare.',
          ),
        ),
    commSection(),
    h('h2', {}, 'Tutti i protocolli'),
    protocolGrid(),
    h(
      'div',
      { class: 'two' },
      h(
        'a',
        { class: 'card', href: '#/confronto' },
        h('h3', {}, '⚖ Confronto'),
        h('p', { class: 'muted' }, 'Tabella filtrabile e protocolli affiancati.'),
      ),
      h(
        'a',
        { class: 'card', href: '#/test' },
        h('h3', {}, '🎮 Test e giochi'),
        h('p', { class: 'muted' }, 'Quiz, abbinamenti e scenari di fattibilità con punti e badge.'),
      ),
    ),
  );
}

function protocolGrid() {
  return h(
    'div',
    { class: 'grid' },
    S.data.protocols.protocols.map(p =>
      h(
        'a',
        { class: 'card', href: `#/protocolli/${p.id}`, style: `--pc:${p.color}` },
        h('div', { class: 'row' }, logo(p, 36), h('h3', { style: 'margin:0' }, p.name)),
        h('p', { class: 'muted' }, T(p.tagline)),
        h('span', { class: 'tag' }, p.family),
      ),
    ),
  );
}

export function protocols(app) {
  const i = S.data.protocols.intro;
  app.append(
    h('h1', {}, 'Protocolli'),
    h(
      'div',
      { class: 'card' },
      h('h2', { style: 'margin-top:0' }, i.title),
      T(i).map(t => h('p', {}, t)),
    ),
    h('h2', {}, 'Scegli un protocollo'),
    protocolGrid(),
  );
}

export function protocol(app, { id, cleanups }) {
  const p = protoById(id);
  if (!p) {
    app.append(h('p', {}, 'Protocollo non trovato.'), h('a', { href: '#/protocolli' }, '← Elenco'));
    return;
  }
  mark('visited', p.id);
  if (S.progress.lastProto !== p.id) {
    S.progress.lastProto = p.id;
    save();
  }
  document.title = `${p.name} – FunBus`;
  let tab = sessionStorage.getItem('tab') || 'scheda';
  const body = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const show = t => {
    tab = t;
    try {
      sessionStorage.setItem('tab', t);
    } catch {
      /* ignora */
    }
    tabs.replaceChildren(
      ...[
        ['scheda', 'Scheda'],
        ['animazione', 'Animazione'],
      ].map(([k, l]) =>
        h(
          'button',
          {
            role: 'tab',
            class: k === t ? 'on' : '',
            onclick: () => {
              cleanups.splice(0).forEach(f => f());
              show(k);
            },
          },
          l,
        ),
      ),
    );
    body.replaceChildren();
    if (t === 'scheda')
      body.append(
        h(
          'div',
          { class: 'row no-print', style: 'justify-content:flex-end;margin-bottom:.5rem' },
          h('button', { onclick: () => window.print() }, '🖨 Stampa / PDF'),
        ),
        card(p),
      );
    else {
      const sim = createSim(p, S.data.animations[p.id]);
      cleanups.push(sim.stop);
      body.append(sim.el);
      if (!isPro()) body.append(h('p', { class: 'muted' }, 'Passa a Professional per esplorare i frame campo per campo.'));
    }
  };
  app.append(
    h('a', { href: '#/protocolli' }, '← Tutti i protocolli'),
    h(
      'div',
      { class: 'phead' },
      h(
        'div',
        { class: 'pheadmain' },
        h('div', { class: 'row' }, logo(p, 56), h('h1', { style: 'margin:0' }, p.name)),
        h('p', {}, T(p.tagline)),
        h('span', { class: 'tag' }, p.family),
      ),
      illustration(p),
    ),
    tabs,
    body,
  );
  show(tab === 'animazione' ? 'animazione' : 'scheda');
}

function card(p) {
  const list = (title, arr) =>
    h(
      'div',
      { class: 'card' },
      h('h3', {}, title),
      h(
        'ul',
        { class: 'clean' },
        arr.map(x => h('li', {}, x)),
      ),
    );
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'card' },
      h('h3', { style: 'margin-top:0' }, 'In parole semplici'),
      T(p.story).map(t => h('p', {}, t)),
      h('div', { class: 'note analogy' }, h('strong', {}, 'Esempio pratico: '), T(p.example)),
    ),
    !isPro() && p.analogy ? h('div', { class: 'note analogy' }, h('strong', {}, 'Analogia: '), p.analogy) : null,
    h(
      'div',
      { class: 'card', style: 'margin-top:1rem' },
      h(
        'dl',
        { class: 'spec' },
        FIELDS().flatMap(f => [h('dt', {}, f.label), h('dd', {}, T(p.card[f.key]))]),
      ),
    ),
    h(
      'div',
      { class: 'card', style: 'margin-top:1rem' },
      h('h3', { style: 'margin-top:0' }, 'Piramide dei livelli OSI'),
      pyramid(p, { width: 300 }),
      pyramidLegend(p),
    ),
    h(
      'div',
      { class: 'card', style: 'margin-top:1rem' },
      h('h3', { style: 'margin-top:0' }, 'Topologie supportate'),
      topoChips(p),
      h('p', { class: 'muted small', style: 'margin-bottom:0' }, T(p.card.topology)),
    ),
    variantBox(p),
    securityBox(p),
    h('div', { class: 'two', style: 'margin-top:1rem' }, list('Vantaggi', p.pros), list('Limiti', p.cons)),
    h('div', { style: 'margin-top:1rem' }, list("Casi d'uso tipici", p.usecases)),
    isPro()
      ? h(
          'div',
          { class: 'card', style: 'margin-top:1rem' },
          h('h3', {}, 'Dati tecnici'),
          h(
            'dl',
            { class: 'spec' },
            p.tech.flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
          ),
        )
      : null,
    p.notes.map(n => h('div', { class: 'note' }, h('strong', {}, 'Accuratezza: '), n)),
    p.sources?.length
      ? h(
          'div',
          { class: 'card', style: 'margin-top:1rem' },
          h('h3', { style: 'margin-top:0' }, 'Fonti e riferimenti'),
          h(
            'ul',
            { class: 'clean sources' },
            p.sources.map(s => h('li', {}, h('strong', {}, s.n), s.d ? h('span', { class: 'muted' }, ' — ', h('span', {}, s.d)) : null)),
          ),
          h('p', { class: 'muted small', style: 'margin-bottom:0' }, T(S.data.protocols.sourcesNote)),
        )
      : null,
  );
}

// Varianti dello stesso standard (OPC UA client/server, PubSub, FX; PROFINET RT/IRT; Modbus TCP/RTU…): tabelle delle differenze.
// Una colonna può corrispondere a un protocollo dell'app (proto): quella della scheda aperta è in evidenza.
function variantBox(p) {
  return (S.data.protocols.variants || [])
    .filter(v => v.show.includes(p.id))
    .map(v => {
      const head = c => {
        const x = c.proto && protoById(c.proto);
        return h(
          'span',
          { class: 'row', style: 'gap:.4rem;flex-wrap:nowrap' },
          x ? logo(x, 22) : null,
          !x || x.id === p.id ? h('strong', {}, c.head) : h('a', { href: `#/protocolli/${x.id}` }, c.head),
        );
      };
      const cur = c => (c.proto === p.id && v.cols.some(o => o.proto !== p.id) ? 'cur' : '');
      return h(
        'div',
        { class: 'card', style: 'margin-top:1rem' },
        h('h3', { style: 'margin-top:0' }, v.title),
        h('p', {}, T(v.intro)),
        h(
          'div',
          { class: 'vswrap' },
          h(
            'table',
            { class: 'vstable' },
            h(
              'thead',
              {},
              h(
                'tr',
                {},
                h('th', {}, ''),
                v.cols.map(c => h('th', { class: cur(c) }, head(c), cur(c) ? h('span', { class: 'tag' }, 'questa scheda') : null)),
              ),
            ),
            h(
              'tbody',
              {},
              v.rows.map(r =>
                h(
                  'tr',
                  {},
                  h('th', { scope: 'row' }, r.label),
                  v.cols.map(c => h('td', { class: cur(c) }, h('span', { class: 'vh' }, c.head), h('span', {}, r.values[c.key]))),
                ),
              ),
            ),
          ),
        ),
        v.compare?.length
          ? h('p', { style: 'margin-bottom:0' }, h('a', { href: `#/confronto/${v.compare.join(',')}` }, 'Apri nel Confronto →'))
          : null,
      );
    });
}

function commSection() {
  const P = S.data.protocols,
    mode = { polling: '🔄', notify: '🔔', both: '⚖' };
  const col = k =>
    h(
      'div',
      { class: 'card', style: `border-top:4px solid var(--${k === 'polling' ? 'accent' : k === 'notify' ? 'ok' : 'warn'})` },
      h('h3', { style: 'margin-top:0' }, `${mode[k]} ${P.commText[k].title}`),
      h('p', { class: 'muted' }, T(P.commText[k])),
      h(
        'ul',
        { class: 'clean', style: 'list-style:none;padding:0' },
        P.protocols
          .filter(x => x.comm.mode === k)
          .map(x =>
            h(
              'li',
              { style: 'margin:.5rem 0' },
              h('div', { class: 'row' }, logo(x, 24), h('a', { href: `#/protocolli/${x.id}` }, h('strong', {}, x.name))),
              h('div', { class: 'muted', style: 'font-size:.88rem' }, T({ b: x.comm.b, p: x.comm.p })),
            ),
          ),
      ),
    );
  return h(
    'div',
    {},
    h('h2', {}, 'Come arrivano i dati? Polling o notifica'),
    h('div', { class: 'note analogy' }, T(P.commIntro)),
    h(
      'div',
      { class: 'grid', style: 'grid-template-columns:repeat(auto-fit,minmax(280px,1fr))' },
      col('polling'),
      col('both'),
      col('notify'),
    ),
    h(
      'div',
      { class: 'note' },
      h('strong', {}, 'Performance vs determinismo: '),
      isPro()
        ? 'nei protocolli ibridi la modalità scelta per ogni variabile decide il compromesso. Ciclico = carico costante e, su un mezzo deterministico, latenza limitata; on-change = banda e latenza migliori in media, ma il caso peggiore (tutte le variabili cambiano insieme) non è limitato.'
        : 'nei protocolli che fanno entrambe le cose, scegli «ciclico» quando servono tempi certi e «a notifica» quando vuoi risparmiare traffico e reagire subito.',
    ),
  );
}
