import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
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
/* Keep visual settings open and their toggle out of VoiceOver's swipe order on iOS. */
#config-section:not([hidden]) #settings-panel { display:block!important; }
#config-section #settings-toggle { display:none!important; }
.language-switch { display:none!important; }
.skip-link { display:none!important; }
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

  // In the native iOS shell the visual preferences should be directly
  // discoverable after the language choice, without an extra collapsed menu.
  // Leave the web and Android navigation untouched.
  const visualToggle = document.getElementById('settings-toggle');
  const visualPanel = document.getElementById('settings-panel');
  if (visualToggle && visualPanel) {
    visualToggle.setAttribute('aria-expanded', 'true');
    visualPanel.hidden = false;
    visualToggle.hidden = true;
    visualPanel.removeAttribute('inert');
  }
})();
<\/script>`;
// Bundle an executable fallback: WKWebView file:// fetch may reject local JSON.
const bundledVideos = JSON.parse(await readFile(join(output, 'videos.json'), 'utf8'));
if (!Array.isArray(bundledVideos.videos) || !bundledVideos.videos.length) throw new Error('Catálogo de vídeos vacío');
await writeFile(join(output, 'ios-videos-fallback.js'),
  'window.TIFLO_IOS_VIDEOS = ' + JSON.stringify(bundledVideos).replace(/</g, '\\u003c') + ';');
for (const name of ['index.html','videos.html','podcast.html','actualidad.html']) {
  const path = join(output, name);
  let html = await readFile(path, 'utf8');
  if (!html.includes('</head>')) throw new Error('Falta el cierre de cabecera: ' + name);
  html = html.replace('</head>', iosOverrides + '\n</head>');
  if (name === 'index.html') html = html.replace('</body>', iosLanguage + '\n</body>');
  if (name === 'videos.html') html = html.replace('<script src="videos.js?v=2.5"></script>', '<script src="ios-videos-fallback.js"></script>\n<script src="videos.js?v=2.5"></script>');
  await writeFile(path, html);
}

// Only patch the packaged iOS video controller: preserve Android and web behavior.
// Report YouTube IFrame failures, disable unusable transport controls and keep the
// direct YouTube link reachable for VoiceOver users.
const iosVideosPath = join(output, 'videos.js');
let iosVideos = await readFile(iosVideosPath, 'utf8');
const originalEvents = 'onReady: handlePlayerReady,\n            onStateChange: handlePlayerStateChange';
if (!iosVideos.includes(originalEvents)) throw new Error('No se encuentra el registro de eventos YouTube para iOS');
iosVideos = iosVideos.replace(originalEvents,
  'onReady: handlePlayerReady,\n            onStateChange: handlePlayerStateChange,\n            onError: handleIosPlayerError');
const readyDeclaration = '  function handlePlayerReady(event) {';
if (!iosVideos.includes(readyDeclaration)) throw new Error('No se encuentra handlePlayerReady');
iosVideos = iosVideos.replace(readyDeclaration, `  function handleIosPlayerError(event) {
    const code = Number(event?.data);
    playerReady = false;
    playerIsPlaying = false;
    stopPositionTimer();
    setPlayerControlsEnabled(false);
    updateToggleLabel();
    updatePlayerControlStatus('unavailable');
    if (els.playerNote) {
      const detail = Number.isFinite(code) ? ' (YouTube ' + code + ')' : '';
      const guidance = lang === 'en'
        ? 'Playback failed' + detail + '. Use the Open in YouTube link to play this video.'
        : 'Error de reproducción' + detail + '. Utiliza el enlace Abrir este vídeo en YouTube.';
      els.playerNote.textContent = guidance;
      els.playerNote.setAttribute('role', 'alert');
    }
  }

` + readyDeclaration);
await writeFile(iosVideosPath, iosVideos);

// In iOS, category pages already identify the category in the result status.
// Avoid announcing that same label after every title, while retaining it for
// global search results and other contexts where the category adds information.
const iosAppPath = join(output, 'app.js');
let iosApp = await readFile(iosAppPath, 'utf8');
const iosCategoryRender = 'showResults(items,c.categoryFound(cat,items.length),c.noResults);';
if (!iosApp.includes(iosCategoryRender)) throw new Error('No se encuentra el renderizado por categoría');
iosApp = iosApp.replace(iosCategoryRender,
  `showResults(items,c.categoryFound(cat,items.length),c.noResults);
    els.results.querySelectorAll('.resource-meta').forEach(meta => {
      if (meta.textContent.trim() === String(cat).trim()) meta.remove();
    });`);
await writeFile(iosAppPath, iosApp);

// Fail before signing or uploading if an injected iOS-only script is invalid.
for (const file of ['app.js', 'videos.js', 'ios-videos-fallback.js']) {
  execFileSync(process.execPath, ['--check', join(output, file)], { stdio: 'pipe' });
}
console.log('Validación sintáctica de scripts iOS completada');

console.log('Archivos preparados para iOS:',copied);
