// Gioco «Costruisci la rete»: trascina bus, topologia e dispositivi; la verifica usa i dati di scenarios.json.
import { S, h, svgEl, T, isPro, addXP, checkBadges, save } from './core.js';
import { evaluate, reqTags } from './games.js';
import { logo } from './logos.js';
import { model, nodeShape, SIZE, topoIcon } from './topo.js';

const lvKey = () => (isPro() ? 'professional' : 'beginner');

export function build(app, { cleanups }) {
  const G = S.data.game.build, topos = S.data.topologies.topologies;
  const list = G.missions.filter(m => m.level === lvKey());
  const box = h('div');
  S.progress.built ||= [];
  app.append(h('a', { href: '#/test' }, '← Test'), h('h1', {}, 'Costruisci la rete'), box);
  let stop = () => {};
  cleanups.push(() => stop());

  const menu = () => {
    stop();
    box.replaceChildren(h('p', { class: 'muted' }, 'Scegli una missione: dovrai trascinare sul banco il bus giusto, la topologia e i dispositivi.'),
      h('div', { class: 'grid' }, list.map(m => h('button', { class: 'card', onclick: () => play(m) }, h('h3', {}, m.title), h('p', { class: 'muted' }, m.text), S.progress.built.includes(m.id) ? h('span', { class: 'tag' }, '✔ rete costruita') : null))));
  };

  const play = m => {
    stop();
    const st = { bus: null, topo: null, placed: new Set() };
    let picked = null, narrow = false, drag = null, suppress = false;
    const bench = h('div', { class: 'bench' }), result = h('div', { 'aria-live': 'polite' });
    const proto = id => S.data.protocols.protocols.find(p => p.id === id);
    const slotsOf = () => (st.topo ? model(st.topo, narrow).nodes.filter(n => n.kind === 'dev') : []);

    /* ---- trascinamento con eventi pointer (mouse, penna, tocco) + alternativa a clic/tastiera ---- */
    const accepts = (el, type) => el?.dataset.drop === type;
    const targetAt = (x, y, type) => { const el = document.elementFromPoint(x, y)?.closest('[data-drop]'); return accepts(el, type) ? el : null; };
    const place = (item, target) => {
      if (item.type === 'bus') st.bus = item.id;
      else if (item.type === 'topo') { if (st.topo !== item.id) st.placed.clear(); st.topo = item.id; }
      else if (item.type === 'dev' && target.dataset.slot) st.placed.add(target.dataset.slot);
      picked = null; result.replaceChildren(); render();
    };
    const mark = () => bench.querySelectorAll('[data-drop]').forEach(t => t.classList.toggle('ready', !!picked && accepts(t, picked.type)));
    function makeDraggable(el, item) {
      el.addEventListener('pointerdown', e => {
        if (e.button) return;
        drag = { item, el, x: e.clientX, y: e.clientY, ghost: null, over: null, id: e.pointerId };
      });
      el.addEventListener('click', () => { if (suppress) return; picked = picked && picked.type === item.type && picked.id === item.id ? null : item; bench.querySelectorAll('.pick').forEach(c => c.classList.toggle('picked', c === el && !!picked)); mark(); });
    }
    const move = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return;
        drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('ghost'); document.body.append(drag.ghost);
        picked = drag.item; mark();
      }
      e.preventDefault();
      drag.px = e.clientX; drag.py = e.clientY;
      track();
      if (!drag.raf) drag.raf = requestAnimationFrame(autoScroll);
    };
    const track = () => {
      drag.ghost.style.left = drag.px + 'px'; drag.ghost.style.top = drag.py + 'px';
      const t = targetAt(drag.px, drag.py, drag.item.type);
      if (t !== drag.over) { drag.over?.classList.remove('over'); t?.classList.add('over'); drag.over = t; }
    };
    // vicino ai bordi dello schermo la pagina scorre, così si raggiunge il banco anche su schermi piccoli
    const autoScroll = () => {
      if (!drag?.ghost) return;
      const edge = 70, dy = drag.py < edge ? -Math.ceil((edge - drag.py) / 5) : drag.py > innerHeight - edge ? Math.ceil((drag.py - (innerHeight - edge)) / 5) : 0;
      if (dy) { window.scrollBy(0, dy); track(); }
      drag.raf = requestAnimationFrame(autoScroll);
    };
    const up = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.ghost) return; // semplice clic: gestito da "click"
      cancelAnimationFrame(d.raf); d.ghost.remove(); d.over?.classList.remove('over');
      const t = targetAt(e.clientX, e.clientY, d.item.type);
      suppress = true; // il rilascio non deve valere come clic
      setTimeout(() => { suppress = false; if (t) place(d.item, t); else { picked = null; mark(); } }, 0);
    };
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { const n = (bench.clientWidth || 800) < 560; if (n !== narrow) { narrow = n; render(); } }) : null;
    stop = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); ro?.disconnect(); if (drag) { cancelAnimationFrame(drag.raf); drag.ghost?.remove(); drag = null; } stop = () => {}; };

    const dropZone = (type, label, content, extra = {}) => {
      const z = h('div', { class: 'dropzone' + (content ? ' full' : ''), 'data-drop': type, role: 'button', tabindex: 0, 'aria-label': label, ...extra }, h('span', { class: 'dzlabel' }, label), content || h('span', { class: 'muted small' }, 'Trascina qui'));
      const act = () => { if (!suppress && picked && accepts(z, picked.type)) place(picked, z); };
      z.addEventListener('click', act);
      z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
      return z;
    };

    function canvas() {
      if (!st.topo) return dropZone('topo', 'Topologia', null, { class: 'dropzone canvas' });
      const M = model(st.topo, narrow), byId = Object.fromEntries(M.nodes.map(n => [n.id, n]));
      const svg = svgEl('svg', { class: 'toposvg', viewBox: `0 0 ${M.W} ${M.H}`, role: 'group', 'aria-label': 'Banco di lavoro: rete in costruzione' });
      svg.style.maxWidth = M.W + 'px';
      for (const [a, b, kind] of M.links) { const g = svgEl('g', { class: 'tlinkg' + (kind === 'trunk' ? ' trunk' : '') }); g.style.cursor = 'default'; g.append(svgEl('line', { class: 'tlink', x1: byId[a].x, y1: byId[a].y, x2: byId[b].x, y2: byId[b].y })); svg.append(g); }
      for (const n of M.nodes) {
        const isDev = n.kind === 'dev', on = isDev && st.placed.has(n.id), [w, hh] = SIZE[n.kind];
        let g;
        if (isDev && !on) {
          g = svgEl('g', { class: 'tnode slot', 'data-drop': 'dev', 'data-slot': n.id, role: 'button', tabindex: 0, 'aria-label': 'Posto libero per un dispositivo' });
          g.append(svgEl('rect', { class: 'tbox', x: n.x - w / 2, y: n.y - hh / 2, width: w, height: hh, rx: 9 }), svgEl('path', { class: 'tin', d: `M${n.x - 7} ${n.y}H${n.x + 7}M${n.x} ${n.y - 7}V${n.y + 7}` }));
          const act = () => { if (picked?.type === 'dev') place(picked, g); };
          g.addEventListener('click', act); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        } else {
          g = nodeShape(n);
          if (n.kind !== 'junc' && n.kind !== 'term') { const t = svgEl('text', { class: 'tlbl', x: n.x, y: n.y + hh / 2 + 14 }); t.textContent = n.label; g.append(t); }
          if (on) { g.setAttribute('role', 'button'); g.setAttribute('tabindex', 0); g.setAttribute('aria-label', n.label + ' · Rimuovi'); const rm = () => { st.placed.delete(n.id); result.replaceChildren(); render(); }; g.addEventListener('click', rm); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rm(); } }); }
        }
        svg.append(g);
      }
      const wrap = h('div', { class: 'topobox canvasbox', 'data-drop': 'topo' }, svg);
      wrap.addEventListener('click', () => { if (picked?.type === 'topo') place(picked, wrap); });
      return wrap;
    }

    function render() {
      const slots = slotsOf(), left = slots.length - st.placed.size, p = st.bus && proto(st.bus), tp = st.topo && topos.find(t => t.id === st.topo);
      const chip = (item, cls, ...kids) => { const b = h('button', { class: `tag chip pick ${cls}` + (picked && picked.type === item.type && picked.id === item.id ? ' picked' : ''), 'aria-pressed': 'false' }, kids); makeDraggable(b, item); return b; };
      bench.replaceChildren(
        h('div', { class: 'benchtop' },
          dropZone('bus', 'Bus', p ? h('span', { class: 'row', style: 'gap:.4rem' }, logo(p, 24), h('strong', {}, p.name)) : null),
          dropZone('topo', 'Topologia', tp ? h('span', { class: 'row', style: 'gap:.4rem' }, topoIcon(tp.id, 16), h('strong', {}, tp.name)) : null)),
        canvas(),
        st.topo ? h('p', { class: 'muted small', style: 'margin:.3rem 0' }, `Dispositivi collegati: ${st.placed.size} su ${slots.length}`, ' · ', h('span', {}, `Ogni dispositivo sul disegno rappresenta una parte dei ${m.req.nodes || slots.length} nodi della missione.`)) : null,
        h('div', { class: 'tray' },
          h('div', { class: 'traygrp' }, h('strong', {}, 'Dispositivi'), h('div', { class: 'row' }, left > 0 ? Array.from({ length: left }, (_, i) => chip({ type: 'dev', id: 'dev' + i }, 'devchip', h('span', { class: 'devico', 'aria-hidden': 'true' }), h('span', {}, 'Dispositivo'))) : h('span', { class: 'muted small' }, st.topo ? 'Tutti collegati.' : 'Scegli prima una topologia.'))),
          h('div', { class: 'traygrp' }, h('strong', {}, 'Topologie'), h('div', { class: 'row' }, topos.map(t => chip({ type: 'topo', id: t.id }, '', topoIcon(t.id, 16), h('span', {}, t.name))))),
          h('div', { class: 'traygrp' }, h('strong', {}, 'Bus'), h('div', { class: 'row' }, S.data.protocols.protocols.map(x => chip({ type: 'bus', id: x.id }, '', logo(x, 18), h('span', {}, x.name)))))),
        h('div', { class: 'row', style: 'margin-top:.8rem' }, h('button', { class: 'primary', onclick: verify }, '✔ Verifica la rete'), h('button', { onclick: () => { st.bus = st.topo = null; st.placed.clear(); picked = null; result.replaceChildren(); render(); } }, '↺ Svuota il banco')));
      mark();
    }

    function verify() {
      const slots = slotsOf();
      if (!st.bus || !st.topo || st.placed.size < slots.length) {
        result.replaceChildren(h('div', { class: 'fb ko' }, 'La rete non è completa: scegli un bus, una topologia e collega tutti i dispositivi.'));
        return;
      }
      const p = proto(st.bus), r = evaluate(st.bus, { ...m.req, topo: st.topo });
      const checks = r.checks.slice();
      if (m.topoAllowed?.length) {
        const ok = m.topoAllowed.includes(st.topo);
        checks.unshift({ status: ok ? 'ok' : 'fail', text: ok ? 'Topologia adatta alla missione.' : 'Topologia non adatta alla missione.', hint: ok ? null : m.topoHint });
      }
      const verdict = checks.some(c => c.status === 'fail') ? 'fail' : checks.some(c => c.status === 'warn') ? 'warn' : 'ok';
      const first = !S.progress.built.includes(m.id);
      let xp = 0;
      if (verdict === 'ok' && first) { S.progress.built.push(m.id); xp = G.pointsCorrect; }
      else if (verdict === 'warn' && first) xp = G.pointsPartial;
      if (xp) addXP(xp); else { checkBadges(); save(); }
      const title = { ok: '✅ Rete adatta', warn: '⚠ Rete adatta con riserve', fail: '❌ Rete non adatta' }[verdict];
      result.replaceChildren(h('div', { class: 'card', style: 'margin-top:1rem' },
        h('h3', { style: 'margin-top:0' }, h('span', {}, title), ': ', p.name, ' · ', topos.find(t => t.id === st.topo).name, xp ? h('span', { class: 'tag' }, `+${xp} XP`) : null),
        ...checks.map(c => h('div', { class: 'chk ' + c.status }, (c.status === 'ok' ? '✔ ' : c.status === 'warn' ? '⚠ ' : '✖ ') + c.text, c.hint ? h('span', {}, ' ', c.hint) : null)),
        verdict === 'ok' ? h('div', { class: 'note analogy' }, m.why ? T(m.why) : 'Missione completata.') : h('p', { class: 'muted' }, 'Cambia bus o topologia e verifica di nuovo: i controlli indicano che cosa non va.'),
        h('div', { class: 'row' }, verdict === 'ok' ? h('button', { class: 'primary', onclick: menu }, 'Altre missioni') : null)));
      result.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }

    box.replaceChildren(h('button', { onclick: menu }, '← Missioni'), h('h2', {}, m.title),
      h('div', { class: 'card' }, h('p', {}, m.text), reqTags(m.req)),
      h('p', { class: 'muted' }, 'Trascina un bus, una topologia e i dispositivi sul banco (oppure clicca un elemento e poi la sua destinazione), quindi premi «Verifica la rete».'),
      bench, result);
    render(); ro?.observe(bench);
  };
  list.length ? menu() : box.append(h('p', {}, 'Nessuna missione per questo livello.'));
}
