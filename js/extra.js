import { S, h, T, isPro, levelInfo, toast } from './core.js';

export function glossario(app, { id } = {}) {
  const terms = S.data.glossary.terms;
  const list = h('div');
  const q = h('input', {
    type: 'search',
    placeholder: 'Cerca un termine…',
    'aria-label': 'Cerca nel glossario',
    style:
      'width:100%;padding:.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit',
    oninput: () => draw(),
  });
  if (id) q.value = decodeURIComponent(id); // arrivo dalla ricerca globale: #/glossario/<termine>
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    const r = terms.filter(t => !f || t.t.toLowerCase().includes(f) || t.b.toLowerCase().includes(f) || t.p.toLowerCase().includes(f));
    list.replaceChildren(
      r.length
        ? h(
            'div',
            { class: 'card' },
            h(
              'dl',
              { class: 'spec' },
              r.flatMap(t => [h('dt', {}, t.t), h('dd', {}, T(t))]),
            ),
          )
        : h('p', { class: 'muted' }, 'Nessun termine trovato.'),
    );
  };
  app.append(
    h('h1', {}, 'Glossario'),
    h('p', { class: 'muted' }, isPro() ? 'Definizioni tecniche.' : 'Definizioni in parole semplici.'),
    q,
    h('div', { style: 'height:1rem' }),
    list,
  );
  draw();
}

export function approfondimenti(app) {
  app.append(
    h('h1', {}, 'Approfondimenti'),
    ...S.data.topics.topics.map(t =>
      h(
        'div',
        { class: 'card', style: 'margin-bottom:1rem' },
        h('h2', { style: 'margin-top:0' }, t.title),
        T(t).map(x => h('p', {}, x)),
      ),
    ),
  );
}

/* ---------- STRUMENTI DI CALCOLO ---------- */
const num = (id, label, val, min = 0, step = 1) =>
  h(
    'label',
    { style: 'display:flex;flex-direction:column;gap:.2rem' },
    label,
    h('input', {
      type: 'number',
      id,
      value: val,
      min,
      step,
      style: 'padding:.4rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit',
    }),
  );
const v = id => parseFloat(document.getElementById(id).value) || 0;
const fmt = us => (us >= 1000 ? `${(us / 1000).toFixed(2)} ms` : `${us.toFixed(1)} µs`);

export function strumenti(app) {
  const note = t => h('p', { class: 'muted' }, t);
  // PROFIBUS DP
  const pbOut = h('div', { class: 'note analogy' });
  const pb = () => {
    const baud = v('pb_baud') * 1000,
      n = v('pb_n'),
      din = v('pb_in'),
      dout = v('pb_out');
    const bt = 1 / baud; // tempo di bit
    const per = ((9 + dout) * 11 + (9 + din) * 11 + 15 + 37) * bt; // request + response + TSDR + idle (valori tipici)
    const tot = per * n;
    pbOut.replaceChildren(h('strong', {}, `Ciclo DP stimato: ${fmt(tot * 1e6)}`), ` (${fmt(per * 1e6)} per slave).`);
  };
  // EtherCAT
  const ecOut = h('div', { class: 'note analogy' });
  const ec = () => {
    const n = v('ec_n'),
      data = v('ec_d'),
      speed = v('ec_s') * 1e6,
      tn = v('ec_t'),
      ov = v('ec_o');
    const bytes = 14 + 2 + 12 + data + 2 + 4 + 20; // header Eth + EC + datagram + dati + WKC + FCS + preambolo/IFG
    const tFrame = ((Math.max(bytes, 84) * 8) / speed) * 1e6; // µs (frame minimo 64 B + 20 B)
    const tProp = (n * 2 * tn) / 1000; // andata e ritorno nei nodi (ns → µs)
    ecOut.replaceChildren(
      h('strong', {}, `Ciclo minimo stimato: ${fmt(tFrame + tProp + ov)}`),
      ` (frame ${fmt(tFrame)} + propagazione ${fmt(tProp)} + overhead master ${fmt(ov)}).`,
    );
  };
  // CAN
  const canOut = h('div', { class: 'note analogy' });
  const can = () => {
    const bit = v('can_b') * 1000,
      dlc = v('can_dlc'),
      nf = v('can_n'),
      cyc = v('can_c') * 1000;
    const bits = 8 * dlc + 47 + Math.floor((34 + 8 * dlc - 1) / 4); // CAN 2.0A, caso peggiore con bit stuffing
    const t = (bits / bit) * 1e6,
      load = ((nf * t) / cyc) * 100;
    canOut.replaceChildren(
      h('strong', {}, `Frame (caso peggiore): ${bits} bit ≈ ${fmt(t)}`),
      ` · ${nf} frame in ${fmt(cyc)} = carico bus ${load.toFixed(1)} %`,
      load > 70
        ? h('span', { style: 'color:var(--bad)' }, ' — oltre il 70 %: rischio di latenze elevate per i messaggi a bassa priorità.')
        : null,
    );
  };
  const sel = (id, opts, def) =>
    h(
      'label',
      { style: 'display:flex;flex-direction:column;gap:.2rem' },
      id === 'pb_baud' ? 'Baud rate (kbit/s)' : id === 'can_b' ? 'Bitrate (kbit/s)' : 'Velocità (Mbit/s)',
      h(
        'select',
        {
          id,
          style: 'padding:.4rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit',
        },
        opts.map(o => h('option', { value: o, selected: o === def }, o)),
      ),
    );
  const grid = (...k) =>
    h(
      'div',
      {
        class: 'grid',
        oninput: () => {
          pb();
          ec();
          can();
        },
      },
      k,
    );
  app.append(
    h('h1', {}, 'Strumenti di calcolo'),
    note(
      "Stime semplificate a scopo didattico: i valori reali dipendono dall'implementazione, dai tempi di risposta e dalla configurazione.",
    ),
    h(
      'div',
      { class: 'card', style: 'margin-bottom:1rem' },
      h('h2', { style: 'margin-top:0' }, 'PROFIBUS DP — tempo di ciclo'),
      grid(
        sel('pb_baud', [93.75, 187.5, 500, 1500, 3000, 6000, 12000], 1500),
        num('pb_n', 'Numero di slave', 10, 1),
        num('pb_in', 'Byte di ingresso per slave', 4),
        num('pb_out', 'Byte di uscita per slave', 4),
      ),
      pbOut,
      isPro()
        ? note(
            'Formula: Σ[(9+out)·11 + (9+in)·11 + TSDR(15) + TID(37)] bit-time per slave; 11 bit per carattere UART, 9 caratteri di overhead SD2.',
          )
        : null,
    ),
    h(
      'div',
      { class: 'card', style: 'margin-bottom:1rem' },
      h('h2', { style: 'margin-top:0' }, 'EtherCAT — ciclo minimo'),
      grid(
        num('ec_n', 'Numero di slave', 10, 1),
        num('ec_d', 'Dati di processo totali (byte)', 40),
        sel('ec_s', [100, 1000], 100),
        num('ec_t', 'Ritardo per nodo andata (ns)', 500, 0, 50),
        num('ec_o', 'Overhead del master (µs)', 20),
      ),
      ecOut,
      isPro()
        ? note(
            'Frame: 14 B Ethernet + 2 B header EtherCAT + 12 B datagram + dati + 2 B WKC + 4 B FCS + 20 B preambolo/IFG; ritardo di nodo ×2 per andata e ritorno.',
          )
        : null,
    ),
    h(
      'div',
      { class: 'card' },
      h('h2', { style: 'margin-top:0' }, 'CAN / CANopen — carico del bus'),
      grid(
        sel('can_b', [125, 250, 500, 1000], 1000),
        num('can_dlc', 'Byte dati per frame (0–8)', 8, 0),
        num('can_n', 'Frame per ciclo', 10, 1),
        num('can_c', 'Ciclo (ms)', 5, 0.1, 0.1),
      ),
      canOut,
      isPro() ? note('Lunghezza frame CAN 2.0A: 8n + 47 + ⌊(34 + 8n − 1)/4⌋ bit nel caso peggiore con bit stuffing (IFS incluso).') : null,
    ),
  );
  pb();
  ec();
  can();
}

/* ---------- CERTIFICATO ---------- */
export function certificato(app) {
  const p = S.progress,
    li = levelInfo();
  const name = h('input', {
    type: 'text',
    placeholder: 'Il tuo nome',
    value: localStorage.getItem('certName') || '',
    'aria-label': 'Nome sul certificato',
    style: 'padding:.5rem;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit',
  });
  const cert = h('div', { class: 'card', id: 'cert', style: 'text-align:center;padding:2rem;border:3px double var(--accent)' });
  const draw = () => {
    try {
      localStorage.setItem('certName', name.value);
    } catch {
      /* ignora */
    }
    cert.replaceChildren(
      h('img', { src: 'logo.svg', width: 72, height: 72, alt: '' }),
      h('h2', {}, 'Certificato di partecipazione'),
      h('p', {}, 'Si attesta che'),
      h('h1', { style: 'margin:.2rem' }, name.value || '________________'),
      h('p', {}, `ha raggiunto il livello ${li.index + 1} «${li.name}» con ${p.xp} XP in FunBus,`),
      h('p', {}, `${Object.keys(p.badges).length} badge ottenuti, ${p.scenariosSolved.length} scenari risolti.`),
      h('p', { class: 'muted' }, new Date().toLocaleDateString('it-IT')),
    );
  };
  name.addEventListener('input', draw);
  app.append(
    h('h1', {}, 'Certificato'),
    h('div', { class: 'row no-print' }, name, h('button', { class: 'primary', onclick: () => window.print() }, 'Stampa / Salva PDF')),
    h('div', { style: 'height:1rem' }),
    cert,
  );
  draw();
}

/* ---------- ESPORTA / IMPORTA PROGRESSI ---------- */
export function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: 'FunBus', progress: S.progress }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'funbus-progressi.json' });
  document.body.append(a);
  a.click();
  a.remove();
}
export function importProgress(file, done) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      if (!j.progress || typeof j.progress.xp !== 'number') throw new Error('formato');
      Object.assign(S.progress, j.progress);
      done();
    } catch {
      toast('File non valido');
    }
  };
  r.readAsText(file);
}
