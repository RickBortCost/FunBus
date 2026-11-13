import { S, h, loadData, loadState, save, toast, DATA_FILES } from './core.js';
import * as pages from './pages.js';
import { compare } from './compare.js';
import * as games from './games.js';
import * as extra from './extra.js';
import { normative } from './normative.js';
import { topologie } from './topo.js';
import { build } from './build.js';
import { percorso, backToLesson } from './path.js';
import { cerca } from './search.js';
import { loadDict, translateData, startDomLocalizer } from './i18n.js';

const app = document.getElementById('app');
let cleanups = [];

function parse() {
  const p = (location.hash.replace(/^#\/?/, '') || '').split('/');
  return { root: p[0] || 'home', sub: p[1], arg: p[2] };
}

let lastHash = null;
function render(scroll = false) {
  cleanups.splice(0).forEach(f => f());
  app.replaceChildren();
  document.title = 'FunBus';
  const { root, sub, arg } = parse();
  const ctx = { rerender: render, cleanups, id: sub, arg };
  try {
    if (root === 'home') pages.home(app, ctx);
    else if (root === 'protocolli') (sub ? pages.protocol : pages.protocols)(app, ctx);
    else if (root === 'confronto') compare(app, ctx);
    else if (root === 'test') (({ quiz: games.quiz, match: games.match, scenari: games.scenari, frame: games.frame, rete: build, ripasso: (ap, cx) => games.quiz(ap, cx, true) })[sub] || games.hub)(app, ctx);
    else if (root === 'profilo') games.profilo(app, ctx);
    else if (root === 'glossario') extra.glossario(app, ctx);
    else if (root === 'normative') normative(app, ctx);
    else if (root === 'topologie') topologie(app, ctx);
    else if (root === 'percorso') percorso(app, ctx);
    else if (root === 'cerca') cerca(app, ctx);
    else if (root === 'approfondimenti') extra.approfondimenti(app, ctx);
    else if (root === 'strumenti') extra.strumenti(app, ctx);
    else if (root === 'certificato') extra.certificato(app, ctx);
    else pages.home(app, ctx);
  } catch (e) { app.append(h('pre', {}, 'Errore: ' + e.message)); console.error(e); }
  const back = backToLesson(root); if (back) app.append(back);
  app.classList.toggle('wide', root === 'confronto');
  document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.r === root; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  // transizione leggera solo al cambio di pagina (disattivata da prefers-reduced-motion nel CSS)
  if (location.hash !== lastHash) { lastHash = location.hash; app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); }
  const cur = document.querySelector('#nav a.on'), nav = document.getElementById('nav');
  if (cur && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = cur.offsetLeft - nav.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
  app.focus({ preventScroll: true });
  document.getElementById('lvB').classList.toggle('on', S.level === 'beginner');
  document.getElementById('lvP').classList.toggle('on', S.level === 'professional');
  if (scroll) window.scrollTo(0, 0);
}

const THEMES = { light: ['◐', 'chiaro'], dark: ['◑', 'scuro'], hc: ['◉', 'alto contrasto'] };
function applyTheme() {
  const t = THEMES[S.theme] ? S.theme : matchMedia('(prefers-contrast: more)').matches ? 'hc' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  document.getElementById('themeBtn').textContent = THEMES[t][0];
}

const wait = ms => new Promise(r => setTimeout(r, ms));
function splash(pct, msg) {
  document.getElementById('spFill').style.width = pct + '%';
  document.getElementById('spPct').textContent = pct;
  if (msg) document.getElementById('spMsg').textContent = msg;
}

async function setLang(lang, rerender) {
  S.lang = lang;
  if (lang === 'en') { try { await loadDict(); } catch { S.lang = 'it'; } }
  S.data = S.lang === 'en' ? translateData(structuredClone(S.raw)) : S.raw;
  startDomLocalizer();
  if (rerender) { save(); render(); }
}

async function init() {
  const t0 = Date.now();
  splash(5, 'Caricamento impostazioni');
  await loadState();
  splash(15, 'Caricamento contenuti');
  let done = 0;
  try { await loadData(n => { done++; splash(15 + Math.round((done / DATA_FILES.length) * 70), `Contenuti: ${n}`); }); }
  catch (e) { document.getElementById('splash').classList.add('hide'); app.textContent = 'Impossibile caricare i contenuti JSON: ' + e.message; return; }
  splash(90, 'Preparazione interfaccia');
  await setLang(S.lang, false);
  applyTheme();
  const sel = document.getElementById('langSel');
  sel.value = S.lang;
  sel.addEventListener('change', async () => { await setLang(sel.value, true); });
  document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { S.level = b.dataset.level; S.levelChosen = true; save(); render(); }));
  document.getElementById('themeBtn').addEventListener('click', () => {
    const k = Object.keys(THEMES); S.theme = k[(k.indexOf(document.documentElement.dataset.theme) + 1) % k.length]; applyTheme(); save();
    toast(`Tema: ${THEMES[S.theme][1]}`);
  });
  // la ricerca aggiorna l'indirizzo mentre si scrive: non deve ridisegnare la pagina a ogni lettera
  window.addEventListener('hashchange', () => render(true));
  // «/» apre la ricerca (se non si sta già scrivendo in un campo)
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) { e.preventDefault(); location.hash = '#/cerca'; } });
  render();
  splash(100, 'Pronto');
  await wait(Math.max(300, 1500 - (Date.now() - t0)));
  document.getElementById('splash').classList.add('hide');
  setTimeout(() => document.getElementById('splash').remove(), 600);
  fetch('/api/version').then(r => r.ok ? r.text() : '').then(v => { if (v && v.length < 20) document.getElementById('ver').textContent = `FunBus v${v} · Autore: Riccardo Bortolussi`; }).catch(() => {});
  const ping = () => fetch('/api/ping').catch(() => {});
  ping(); setInterval(ping, 20000);
}
init();
