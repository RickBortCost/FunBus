// Prepara la versione web (statica, installabile, usabile senza rete dopo la prima visita) a partire da wwwroot.
// Uso: node web/build.mjs [cartella di uscita, predefinita _site]
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] || '_site');
const version = /<Version>([^<]+)</.exec(fs.readFileSync('FunBus.csproj', 'utf8'))[1];
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync('wwwroot', out, { recursive: true });
fs.cpSync('web/icons', path.join(out, 'icons'), { recursive: true });
fs.copyFileSync('web/manifest.webmanifest', path.join(out, 'manifest.webmanifest'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

// index.html: segnala all'app che non c'è il server locale e aggiunge ciò che serve per installarla
const head = [
  `<meta name="funbus-web" content="${version}">`,
  '<meta name="theme-color" content="#0b6bcb">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
].join('\n');
const index = path.join(out, 'index.html');
const html = fs.readFileSync(index, 'utf8');
if (!html.includes('<title>')) throw new Error('index.html: <title> non trovato');
fs.writeFileSync(index, html.replace('<title>', head + '\n<title>'));

// service worker: elenco completo dei file, così dopo la prima visita l'app funziona anche senza rete
const walk = (dir, base = dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e =>
      e.isDirectory() ? walk(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')],
    );
const files = ['./', ...walk(out).filter(f => f !== '.nojekyll' && f !== 'sw.js')].sort();
const sw = fs.readFileSync('web/sw.js', 'utf8');
if (!sw.includes('__VERSION__') || !sw.includes('__FILES__')) throw new Error('web/sw.js: segnaposto mancanti');
fs.writeFileSync(path.join(out, 'sw.js'), sw.replace('__VERSION__', version).replace("'__FILES__'", JSON.stringify(files)));
console.log(`Versione web ${version}: ${files.length} file in ${out}`);
