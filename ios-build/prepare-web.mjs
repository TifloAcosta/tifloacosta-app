import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const output = resolve(import.meta.dirname, 'www');
const allowed = new Set(['.html','.js','.mjs','.css','.json','.webmanifest','.svg','.png','.jpg','.jpeg','.webp','.ico','.gif','.woff','.woff2','.ttf','.txt','.xml','.pdf','.mp3','.mp4','.vtt','.srt','.epub','.zip']);
const skip = new Set(['.git','.github','node_modules','ios-build','test','tests','scripts','.vscode']);
let copied = 0;
async function visit(from, to, depth = 0) {
  if (depth > 12) throw new Error('Profundidad inesperada al preparar archivos web');
  await mkdir(to, { recursive:true });
  for (const entry of await readdir(from, { withFileTypes:true })) {
    if (entry.name.startsWith('.') || skip.has(entry.name)) continue;
    const src = join(from,entry.name), dst = join(to,entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) { await visit(src,dst,depth+1); continue; }
    if (!entry.isFile()) continue;
    if (!allowed.has(extname(entry.name).toLowerCase())) continue;
    await cp(src,dst); copied++;
  }
}
await rm(output,{recursive:true,force:true});
await visit(root,output);
await stat(join(output,'index.html'));

/* iOS uses a packaged copy of the web UI. Remove PWA-only controls without
   changing the public website or Android implementation. */
const iosOverrides = `<style id="tiflo-ios-ui">
.site-footer, #install-section, #notifications-heading, #notifications-heading + .panel,
#update-heading, #update-heading + .panel { display:none!important; }
.language-switch { display:none!important; }
html[data-ios-first-language="true"] .language-switch { display:flex!important; }
</style>`;
const iosLanguage = `<script id="tiflo-ios-settings">
(() => {
  const key = 'tifloIosLanguageChosen';
  const selected = (() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } })();
  if (!selected) document.documentElement.dataset.iosFirstLanguage = 'true';
  const switcher = document.querySelector('.language-switch');
  for (const button of [document.getElementById('lang-es'), document.getElementById('lang-en')]) {
    button?.addEventListener('click', () => {
      try { localStorage.setItem(key, '1'); } catch {}
      delete document.documentElement.dataset.iosFirstLanguage;
    });
  }
  const heading = document.getElementById('config-heading');
  if (!heading) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-group';
  const label = document.createElement('label');
  label.htmlFor = 'ios-app-language';
  label.textContent = document.documentElement.lang === 'en' ? 'App language' : 'Idioma de la aplicación';
  const select = document.createElement('select');
  select.id = 'ios-app-language';
  for (const [value, text] of [['es', 'Español'], ['en', 'English']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = (() => { try { return localStorage.getItem('tifloLang') === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
  select.addEventListener('change', () => {
    document.getElementById(select.value === 'en' ? 'lang-en' : 'lang-es')?.click();
    label.textContent = select.value === 'en' ? 'App language' : 'Idioma de la aplicación';
  });
  wrapper.append(label, select);
  heading.insertAdjacentElement('afterend', wrapper);
})();
<\/script>`;
for (const name of ['index.html','videos.html','podcast.html','actualidad.html']) {
  const path = join(output, name);
  let html = await readFile(path, 'utf8');
  if (!html.includes('</head>')) throw new Error('Falta el cierre de cabecera: ' + name);
  html = html.replace('</head>', iosOverrides + '\n</head>');
  if (name === 'index.html') html = html.replace('</body>', iosLanguage + '\n</body>');
  await writeFile(path, html);
}

console.log('Archivos preparados para iOS:',copied);
