import { S, h, loadData, loadState, save } from './core.js';
import * as pages from './pages.js';
import { compare } from './compare.js';
import * as games from './games.js';

const app = document.getElementById('app');
let cleanups = [];

function parse() {
  const p = (location.hash.replace(/^#\/?/, '') || '').split('/');
  return { root: p[0] || 'home', sub: p[1] };
}

function render(scroll = false) {
  cleanups.splice(0).forEach(f => f());
  app.replaceChildren();
  const { root, sub } = parse();
  const ctx = { rerender: render, cleanups, id: sub };
  try {
    if (root === 'home') pages.home(app, ctx);
    else if (root === 'protocolli') (sub ? pages.protocol : pages.protocols)(app, ctx);
    else if (root === 'confronto') compare(app, ctx);
    else if (root === 'test') (({ quiz: games.quiz, match: games.match, scenari: games.scenari })[sub] || games.hub)(app, ctx);
    else if (root === 'profilo') games.profilo(app, ctx);
    else pages.home(app, ctx);
  } catch (e) { app.append(h('pre', {}, 'Errore: ' + e.message)); console.error(e); }
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === root));
  document.getElementById('lvB').classList.toggle('on', S.level === 'beginner');
  document.getElementById('lvP').classList.toggle('on', S.level === 'professional');
  if (scroll) window.scrollTo(0, 0);
}

function applyTheme() {
  const t = S.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
}

async function init() {
  await loadState();
  try { await loadData(); } catch (e) { app.textContent = 'Impossibile caricare i contenuti JSON: ' + e.message; return; }
  applyTheme();
  document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { S.level = b.dataset.level; S.levelChosen = true; save(); render(); }));
  document.getElementById('themeBtn').addEventListener('click', () => {
    S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save();
  });
  window.addEventListener('hashchange', () => render(true));
  render();
  const ping = () => fetch('/api/ping').catch(() => {});
  ping(); setInterval(ping, 20000);
}
init();
