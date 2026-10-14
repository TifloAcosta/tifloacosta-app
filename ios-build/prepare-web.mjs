import { cp, mkdir, readdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { enrichIosMediaCatalog } from './enrich-actualidad-media.mjs';
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

// Build-time safety barrier: never ship the obsolete TifloLector screen.
// The iOS pipeline packages the root web UI, not mobile/src. A stale release
// branch previously brought back the old paste-based reader after corrections.
const readerHtml = await readFile(join(output, 'index.html'), 'utf8');
const readerStart = readerHtml.indexOf('  <section id="reading-section"');
const readerEnd = readerHtml.indexOf('  <section id="news-view"', readerStart);
if (readerStart < 0 || readerEnd <= readerStart) {
  throw new Error('iOS: no se encuentra la pantalla de TifloLector para verificarla.');
}
const readerSection = readerHtml.slice(readerStart, readerEnd);
const mandatoryReaderMarkup = [
  'Abre un libro o documento para escucharlo',
  'id="reading-settings-disclosure"',
  'id="reading-pronunciation-settings"',
  'id="reading-default-navigation"',
  'id="reading-reader"',
  'id="reading-library-filter"',
  'id="reading-library-query"',
  'id="reading-library-pager"',
  'id="reading-marks-new-type"',
  'id="reading-play"',
  'value="mainHeading"',
  '<div hidden aria-hidden="true">'
];
const obsoleteReaderMarkup = [
  'Abrir o pegar contenido',
  'Los documentos guardados permanecen en este navegador.'
];
if (mandatoryReaderMarkup.some(marker => !readerSection.includes(marker)) ||
    obsoleteReaderMarkup.some(marker => readerSection.includes(marker))) {
  throw new Error('iOS: detectada una versión antigua de TifloLector. Se impide el envío a TestFlight.');
}
const readerScript = await readFile(join(output, 'web-reading.js'), 'utf8');
if (!readerScript.includes("intro: 'Abre un libro o documento para escucharlo") ||
    readerScript.includes("intro: 'Importa un archivo o pega un texto")) {
  throw new Error('iOS: el guion de TifloLector no corresponde a la interfaz vigente.');
}
// Protect restored functionality, not just the visible heading and labels.
// These checks are not acceptance tests, but catch regression to stale sources
// before any IPA can be created; DAISY and real VoiceOver still block release.
const requiredReaderFeatures = [
  'shared.adjacentWebReadingStructure(',
  'shared.createPronunciationSpeechAdapter(',
  'setupPronunciationDictionary()',
  'await useMp3File(savedAudio.blob',
  'persistActiveAudio = persistPosition',
  'reading-audio-marks-controls',
  'shared.parseDaisyArchive(',
  'daisy-audio-only',
  'exportCompletedTranslation(',
  'reading-translation-export-txt',
  'Marcar posición del audio',
  'setReaderAudioOnlyMode(true)',
  'setReaderAudioOnlyMode(false)',
  'libraryClient.listMarks(currentBookId)',
  'card.append(title, detailsToggle, details)',
  'libraryPage = 1'
];
const structuralNav = await readFile(join(output, 'shared/web-reading-navigation.mjs'), 'utf8');
const pronunciationEngine = await readFile(join(output, 'shared/web-reading-pronunciation.mjs'), 'utf8');
const mediaStorage = await readFile(join(output, 'shared/web-reading-library-adapter.mjs'), 'utf8');
const daisyAdapter = await readFile(join(output, 'shared/web-reading-daisy-adapter.mjs'), 'utf8');
const readerGuide = await readFile(join(output, 'tifloacosta-guide.js'), 'utf8');
if (requiredReaderFeatures.some(marker => !readerScript.includes(marker)) ||
    !structuralNav.includes('export function adjacentWebReadingStructure(') ||
    !pronunciationEngine.includes('export function createPronunciationSpeechAdapter(') ||
    !mediaStorage.includes("createObjectStore('media'") ||
    !mediaStorage.includes('async function openAudioFile(id)') ||
    !mediaStorage.includes('async function importAudioFile(') ||
    !daisyAdapter.includes('export async function parseDaisyArchive(') ||
    !readerHtml.includes('src="tifloacosta-guide.js"') ||
    !readerGuide.includes('guide-chapters') ||
    (readerSection.match(/id="reading-play"/g) || []).length !== 1 ||
    readerSection.includes('id="reading-pause"')) {
  throw new Error('iOS: faltan mejoras recuperadas de TifloLector, su guía o el botón único Reproducir/Pausa. Se impide empaquetar.');
}

// A markup check alone passed build 300071 but shipped a legacy web reader.
// Fail closed until iOS has genuine DAISY ZIP import AND native document actions.
// The full visual/VoiceOver acceptance still needs a device test (issue #170).
// A filename or a mention of SMIL must never count as complete DAISY audio.
// Only explicit synchronized playback and on-device validation can release it.
const daisyZipSupported = readerScript.includes('playSynchronizedDaisyAudio(')
  && readerScript.includes('seekSynchronizedDaisyClip(')
  && readerScript.includes('resumeSynchronizedDaisyClip(');
const accessibilityNativePath = join(root, 'ios-build/native/TifloReadingAccessibilityPlugin.swift');
const nativeAccessibilitySource = await readFile(accessibilityNativePath, 'utf8').catch(() => '');
const nativeControllerSource = await readFile(
  join(root, 'ios-build/native/TifloYouTubeViewController.swift'), 'utf8'
).catch(() => '');
const nativeReaderBridge = await readFile(
  join(root, 'ios-build/ios-reader-native.js'), 'utf8'
).catch(() => '');
const nativeAccessibleDocumentActions =
  nativeAccessibilitySource.includes('UIAccessibilityCustomAction(name: name, target: self, selector: selector)')
  && nativeAccessibilitySource.includes('notifyListeners("documentAction"')
  && nativeAccessibilitySource.includes('setDocumentActions')
  && nativeAccessibilitySource.includes('pickDocument')
  && nativeControllerSource.includes('registerPluginInstance(TifloReadingAccessibilityPlugin())')
  && nativeReaderBridge.includes("installLibraryNativeActions()")
  && nativeReaderBridge.includes("installNativeFilesImport()")
  && nativeReaderBridge.includes("plugin.pickDocument()");
if (!daisyZipSupported || !nativeAccessibleDocumentActions) {
  // Diagnostic unsigned builds may compile native Swift, but NEVER publish an IPA.
  // The TestFlight workflow does not opt in to this bypass.
  if (process.env.TIFLO_IOS_AUDIT_UNSIGNED !== '1') {
    throw new Error('BLOQUEO PREVENTIVO iOS: lector web antiguo incompleto. Falta importar DAISY ZIP'
    + ' y/o integrar acciones nativas de documentos para VoiceOver. Se prohíbe publicar'
    + ' otra compilación que resucite TifloLector anterior. Ver issue #170.');
  }
  console.warn('DIAGNÓSTICO iOS SIN FIRMA: se omite SOLO el bloqueo de aceptación DAISY/VoiceOver. PROHIBIDO DISTRIBUIR.');
}
console.log('Prechequeos de estructura, DAISY y accesibilidad completados; queda validación real en dispositivo.');

// Only the packaged iOS copy receives episode enclosures: no change to the
// published website, Android resources, or repository source catalogue.
const mediaPath = join(output, 'actualidad-media.json');
const sourceCatalog = JSON.parse(await readFile(join(root, 'actualidad-media-sources.json'), 'utf8'));
const mediaCatalog = JSON.parse(await readFile(mediaPath, 'utf8'));
const iosAudio = await enrichIosMediaCatalog({ items: mediaCatalog, sources: sourceCatalog });
console.log('Audio iOS: ' + iosAudio.stats.playableCount + ' de ' + iosAudio.stats.audioCount +
  ' episodios con URL directa; fuentes RSS accesibles: ' + iosAudio.stats.feedsOk +
  '; fuentes fallidas: ' + iosAudio.stats.feedsFailed.join(', '));
if (iosAudio.stats.audioCount && !iosAudio.stats.playableCount) {
  throw new Error('No hay enlaces de audio reproducibles en el catálogo iOS. Se cancela la compilación.');
}
await writeFile(mediaPath, JSON.stringify(iosAudio.items, null, 2) + '\n');
// Native WKWebView may reject fetch of local JSON depending on the custom
// URL scheme. Ship the same enriched episodes in a small JavaScript fallback,
// preserving the local file as the primary source.
await writeFile(join(output, 'ios-actualidad-media-fallback.js'),
  'window.TIFLO_IOS_ACTUALIDAD_MEDIA = ' +
  JSON.stringify(iosAudio.items).replace(/</g, '\\u003c') + ';\n');



/* iOS uses a packaged copy of the web UI. Remove PWA-only controls without
   changing the public website or Android implementation. */
const iosOverrides = `<style id="tiflo-ios-ui">
.site-footer, #install-section, #notifications-heading, #notifications-heading + .panel,
#update-heading, #update-heading + .panel { display:none!important; }
/* Keep visual controls in the reading order and close the optional panel initially. */
#config-section #settings-toggle { display:inline-flex; }
#apps-browser [data-isolated-back] { display:none!important; }
#download-paste-link { display:none!important; }
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
  const choices = document.createElement('div');
  choices.id = 'ios-app-language';
  choices.className = 'resource-actions';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', label.textContent);
  const current = (() => { try { return localStorage.getItem('tifloLang') === 'en' ? 'en' : 'es'; } catch { return 'es'; } })();
  const buttons = [];
  const update = value => {
    buttons.forEach(([key, button]) => button.setAttribute('aria-pressed', String(key === value)));
    label.textContent = value === 'en' ? 'App language' : 'Idioma de la aplicación';
    choices.setAttribute('aria-label', label.textContent);
  };
  for (const [value, text] of [['es', 'Español'], ['en', 'English']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.addEventListener('click', () => {
      document.getElementById(value === 'en' ? 'lang-en' : 'lang-es')?.click();
      update(value);
    });
    buttons.push([value, button]);
    choices.append(button);
  }
  update(current);
  wrapper.append(label, choices);
  heading.insertAdjacentElement('afterend', wrapper);

  // Optional settings must remain collapsed until the user activates them.
  const visualToggle = document.getElementById('settings-toggle');
  const visualPanel = document.getElementById('settings-panel');
  if (visualToggle && visualPanel) {
    visualToggle.setAttribute('aria-expanded', 'false');
    visualPanel.hidden = true;
    visualToggle.hidden = false;
    visualPanel.removeAttribute('inert');
  }
})();
<\/script>`;
// Bundle an executable fallback: WKWebView file:// fetch may reject local JSON.
// iOS-only button groups avoid the WKWebView native picker in VoiceOver.
await writeFile(join(output, 'ios-choice-groups.js'), "(() => {\n  'use strict';\n  // WKWebView/VoiceOver: bypass the native select popup in frequently used\n  // navigation and filtering controls. Preserve the original change events.\n  const ids = [\n    'video-sort', 'news-category', 'apps-platform',\n    'download-type-filter', 'setting-text-size', 'setting-theme',\n    'setting-spacing', 'sound-category', 'sound-provider'\n  ];\n  for (const id of ids) {\n    const select = document.getElementById(id);\n    if (!(select instanceof HTMLSelectElement)) continue;\n    const label = document.querySelector('label[for=\"' + id + '\"]');\n    const group = document.createElement('div');\n    group.className = 'resource-actions ios-choice-buttons';\n    group.setAttribute('role', 'group');\n    group.setAttribute('aria-label', label?.textContent?.trim() || id);\n    select.insertAdjacentElement('afterend', group);\n    function markActive() {\n      for (const button of group.querySelectorAll('button')) {\n        button.setAttribute('aria-pressed', String(button.dataset.value === select.value));\n      }\n    }\n    function repaint() {\n      const options = [...select.options];\n      if (options.length < 2 || options.length > 40) {\n        group.hidden = true;\n        select.hidden = false;\n        if (label) label.hidden = false;\n        return;\n      }\n      select.hidden = true;\n      if (label) label.hidden = true;\n      group.hidden = false;\n      group.setAttribute('aria-label', label?.textContent?.trim() || id);\n      group.replaceChildren();\n      for (const option of options) {\n        const button = document.createElement('button');\n        button.type = 'button';\n        button.dataset.value = option.value;\n        button.textContent = option.textContent;\n        button.disabled = option.disabled;\n        button.addEventListener('click', () => {\n          select.value = option.value;\n          select.dispatchEvent(new Event('change', { bubbles: true }));\n          markActive();\n        });\n        group.append(button);\n      }\n      markActive();\n    }\n    new MutationObserver(repaint).observe(select, { childList: true, subtree: true });\n    select.addEventListener('change', markActive);\n    repaint();\n  }\n})();\n");
await cp(join(root, 'ios-build/ios-choice-collapse.js'), join(output, 'ios-choice-collapse.js'));
await cp(join(root, 'ios-build/ios-reader-selects.js'), join(output, 'ios-reader-selects.js'));
await cp(join(root, 'ios-build/ios-reader-minimal.js'), join(output, 'ios-reader-minimal.js'));
await cp(join(root, 'ios-build/ios-reader-native.js'), join(output, 'ios-reader-native.js'));

const commitSha = String(process.env.GITHUB_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());
if (!/^[a-f0-9]{40}$/iu.test(commitSha)) throw new Error('No se puede identificar la revisión de código iOS');
const runNumber = Number(process.env.GITHUB_RUN_NUMBER);
const buildCode = Number.isInteger(runNumber) && runNumber >= 0
  ? String(400000 + runNumber) : 'desarrollo';
const buildIdentity = { sourceSha: commitSha, buildCode, reader: 'web-reading.js',
  schema: 'tiflolector-ios-reader-2' };
await writeFile(join(output, 'tiflo-build-identity.json'), JSON.stringify(buildIdentity, null, 2));
await writeFile(join(output, 'tiflo-build-identity.js'), [
  '(() => {',
  '  const build = ' + JSON.stringify(buildIdentity) + ';',
  '  window.TIFLO_IOS_BUILD_IDENTITY = Object.freeze(build);',
  "  document.addEventListener('DOMContentLoaded', () => {",
  "    const label = document.getElementById('reading-build-identity');",
  '    if (!label) return;',
  "    label.textContent = 'TifloLector iOS · compilación ' + build.buildCode +",
  "      ' · código ' + build.sourceSha.slice(0, 12);",
  '    label.hidden = true;',
  '  }, { once: true });',
  '})();',
  ''
].join('\n'));

// Bundled archive decoder: TifloLector must import local EPUB/Office archives offline.
await cp(join(root, 'ios-build/node_modules/jszip/dist/jszip.min.js'), join(output, 'ios-jszip.min.js'));

const bundledVideos = JSON.parse(await readFile(join(output, 'videos.json'), 'utf8'));
if (!Array.isArray(bundledVideos.videos) || !bundledVideos.videos.length) throw new Error('Catálogo de vídeos vacío');
await writeFile(join(output, 'ios-videos-fallback.js'),
  'window.TIFLO_IOS_VIDEOS = ' + JSON.stringify(bundledVideos).replace(/</g, '\\u003c') + ';');
await cp(join(root, 'ios-build/ios-parity.js'), join(output, 'ios-parity.js'));
for (const name of ['index.html','videos.html','podcast.html','actualidad.html']) {
  const path = join(output, name);
  let html = await readFile(path, 'utf8');
  if (!html.includes('</head>')) throw new Error('Falta el cierre de cabecera: ' + name);
  html = html.replace('</head>', iosOverrides + '\n</head>');
  if (name === 'index.html') {
    // Build the actual download screens in the packaged app. Previously the
    // route existed but none of the scripts mounting its content were loaded.
    html = html.replace('</head>', '<link rel="stylesheet" href="downloads.css?v=1.1">\n</head>');
    const downloadScripts = [
      'download-config.js', 'downloads-core.js',
      'sound-search-core.js', 'sound-search-config.js',
      'downloads.js', 'downloads-hub.js', 'sound-search.js',
      'downloads-iphone-bridge.js'
    ].map(src => '<script src="' + src + '"></script>').join('\n');
    html = html.replace('</body>', downloadScripts + '\n' + iosLanguage + '\n</body>');
  }
  if (name === 'videos.html') html = html.replace('<script src="videos.js?v=2.5"></script>', '<script src="ios-videos-fallback.js"></script>\n<script src="videos.js?v=2.5"></script>');
  if (name === 'actualidad.html') {
    const script = '<script src="actualidad-media.js?v=1.1"></script>';
    if (!html.includes(script)) throw new Error('No se encuentra el script de multimedia en Actualidad');
    html = html.replace(script, '<script src="ios-actualidad-media-fallback.js"></script>\n' + script);
  }
  html = html.replace('</body>', '<script src="ios-choice-groups.js"></script>' + '\n</body>');
  if (name === 'actualidad.html') html = html.replace('</body>', '<script src="ios-choice-collapse.js"></script>' + '\n</body>');
  if (name === 'index.html' || name === 'actualidad.html' || name === 'videos.html') html = html.replace('</body>', '<script src="ios-parity.js"></script>' + '\n</body>');
  if (name === 'index.html') {
    html = html.replace('</head>', '<script src="ios-reader-native.js"></script>\n</head>');
    html = html.replace('</head>', '<script src="tiflo-build-identity.js"></script>\n</head>');
    html = html.replace('</body>', '<script src="ios-reader-selects.js"></script><script src="ios-reader-minimal.js"></script>' + '\n</body>');
  }
  if (name === 'podcast.html') {
    html = html.replace('</body>', '<script>requestAnimationFrame(() => { const heading = document.getElementById("podcast-heading"); heading?.setAttribute("tabindex", "-1"); heading?.focus({preventScroll:true}); });</script>' + '\n</body>');
  }
  await writeFile(path, html);
}

// Keep VoiceOver focus in the active iOS view even if a rapid hash change
// schedules an older requestAnimationFrame callback.
const iosIndexPath = join(output, 'index.html');
let iosIndex = await readFile(iosIndexPath, 'utf8');
const oldFocus = "requestAnimationFrame(() => screenHeading.focus({ preventScroll: true }))";
const newFocus = "requestAnimationFrame(() => { if (!target.hidden && screenHeading.isConnected) screenHeading.focus({ preventScroll: true }); })";
if (!iosIndex.includes(oldFocus)) throw new Error('No se encuentra gestión de foco de la vista iOS');
iosIndex = iosIndex.replace(oldFocus, newFocus);
await writeFile(iosIndexPath, iosIndex);

// The iOS home page already focuses the active heading after navigation.
// Disable a second, synchronous focus movement from actualidad-core.js on
// this packaged copy; keep the Actualidad subview focus controller intact.
const iosNavigationCorePath = join(output, 'actualidad-core.js');
let iosNavigationCore = await readFile(iosNavigationCorePath, 'utf8');
const oldHomeFocus = [
  '    if (!focusChangedView) return;',
  '    const target = home ? hero : document.getElementById(state.view);',
  "    const heading = target?.querySelector('h1, h2, h3') || target;",
  '    focusElement(heading);'
].join('\n');
if (!iosNavigationCore.includes(oldHomeFocus)) throw new Error('No se encuentra el movimiento de foco duplicado del inicio iOS');
iosNavigationCore = iosNavigationCore.replace(oldHomeFocus,
  '    // El foco del inicio lo controla showHomeView de index.html.\n    return;');
await writeFile(iosNavigationCorePath, iosNavigationCore);


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
// Avoid carrying a stale VoiceOver error announcement into a working video.
const iosReadyCode = '    youtubePlayer = event.target;\n    playerReady = true;';
if (!iosVideos.includes(iosReadyCode)) throw new Error('No se encuentra la inicialización del reproductor iOS');
iosVideos = iosVideos.replace(iosReadyCode,
  "    youtubePlayer = event.target;\\n    els.playerNote?.removeAttribute('role');\\n    playerReady = true;".replaceAll('\\n', '\n'));
const iosVideoOpen = "  function openPlayer(video) {\n    lastPlayerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;";
if (!iosVideos.includes(iosVideoOpen)) throw new Error('No se encuentra openPlayer de Vídeos');
iosVideos = iosVideos.replace(iosVideoOpen, "  function openPlayer(video) {\n    lastPlayerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;\n    const nativeId = videoId(video);\n    const native = window.Capacitor?.Plugins?.TifloYouTube;\n    if (native && /^[A-Za-z0-9_-]{11}$/.test(nativeId)) {\n      void native.open({ videoId: nativeId, title: String(video.title || ''), description: String(video.fullDescription || video.description || ''), channel: 'TifloAcosta', publishedAt: String(video.publishedAt || '') }).then(() => {\n        if (lastPlayerTrigger?.isConnected) lastPlayerTrigger.focus({ preventScroll: true });\n      }).catch(() => {\n        window.open(youtubeUrl(video), '_blank', 'noopener');\n      });\n      return;\n    }\n    // Do not retry the embedded WKWebView iframe that gave YouTube error 153.\n    window.open(youtubeUrl(video), '_blank', 'noopener');\n    return;\n    lastPlayerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;");
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
// In the native bundle prefer the freshly published web catalogs, but keep
// the embedded data available when offline or when WKWebView blocks cross-origin IO.
const networkFirst = file =>
  // Native URLSession avoids cross-origin restrictions in Capacitor's WKWebView.
  // It accepts only the five public catalog filenames whitelisted in Swift.
  "(window.Capacitor?.Plugins?.TifloYouTube?.publicFile" +
  " ? window.Capacitor.Plugins.TifloYouTube.publicFile({ file: '" + file + "' })" +
  ".then(result => new Response(result.text, { status: result.status || 200 }))" +
  " : fetch('https://tifloacosta.com/" + file + "', { cache: 'no-store' }))" +
  ".then(response => response.ok ? response : fetch('" + file + "', { cache: 'no-cache' }))" +
  ".catch(() => fetch('" + file + "', { cache: 'no-cache' }))";
const appNewsCall = "fetch('actualidad.json',{cache:'no-cache'})";
if (!iosApp.includes(appNewsCall)) throw new Error('No se encuentra el feed de Actualidad en el inicio');
iosApp = iosApp.replace(appNewsCall, networkFirst('actualidad.json'));

const oldCatalogDeclaration = '  const data = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];';
if (!iosApp.includes(oldCatalogDeclaration)) throw new Error('No se encuentra la declaración de recursos iOS');
iosApp = iosApp.replace(oldCatalogDeclaration,
  '  let data = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];');
const newsRenderPoint = '  function makeNewsItem(item) {';
if (!iosApp.includes(newsRenderPoint)) throw new Error('No se encuentra renderizado de Novedades');
iosApp = iosApp.replace(newsRenderPoint, "  async function refreshIosResourceCatalog() {\n    try {\n      const response = await fetch('https://tifloacosta.com/data.js', { cache: 'no-store' });\n      if (!response.ok) return;\n      const source = await response.text();\n      const match = /^\\s*window\\.TIFLO_RESOURCES\\s*=\\s*(\\[[\\s\\S]*\\]);?\\s*$/.exec(source);\n      if (!match) return;\n      const items = JSON.parse(match[1]);\n      if (!Array.isArray(items) || items.length === 0) return;\n      const valid = items.every(item => item && typeof item.id === 'string' &&\n        typeof item.title === 'string' && (item.lang === 'es' || item.lang === 'en'));\n      if (!valid) return;\n      data = items;\n      window.TIFLO_RESOURCES = items;\n      renderNews();\n      renderCategories();\n      renderFavoritesScreen();\n      window.dispatchEvent(new CustomEvent('tiflo-resources-updated', { detail: { items } }));\n    } catch {\n      // Offline and network failures must preserve the packaged catalog.\n    }\n  }\n\n" + newsRenderPoint);
const originalResourceFetch = "await fetch('https://tifloacosta.com/data.js', { cache: 'no-store' })";
if (!iosApp.includes(originalResourceFetch)) throw new Error('Falta lectura de Novedades remotas');
iosApp = iosApp.replace(originalResourceFetch, "await " + networkFirst('data.js'));
const iosStartPoint = 'applyPrefs();applyLanguage();loadActualidadHome();trackLanguageUse();announceCompletedUpdate();';
if (!iosApp.includes(iosStartPoint)) throw new Error('No se encuentra inicialización de Novedades');
iosApp = iosApp.replace(iosStartPoint, iosStartPoint +
  'void refreshIosResourceCatalog();\n' +
  'window.addEventListener("hashchange",()=>{if(location.hash==="#news")void refreshIosResourceCatalog();});\n' +
  'document.addEventListener("visibilitychange",()=>{if(!document.hidden){void refreshIosResourceCatalog();loadActualidadHome();}});');

await writeFile(iosAppPath, iosApp);

const iosNewsVideoPath = join(output, 'news-videos.js');
let iosNewsVideo = await readFile(iosNewsVideoPath, 'utf8');
const oldSnapshot = '  const resources = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];';
if (!iosNewsVideo.includes(oldSnapshot)) throw new Error('No se encuentra captura inicial de Novedades');
iosNewsVideo = iosNewsVideo.replace(oldSnapshot,
  '  let resources = Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [];');
const newsVideoFetch = "fetch('videos.json', { cache: 'no-store' })";
if (!iosNewsVideo.includes(newsVideoFetch)) throw new Error('No se encuentra refresco de vídeo de Novedades');
iosNewsVideo = iosNewsVideo.replace(newsVideoFetch, networkFirst('videos.json'));
const newsVideoStart = '  void loadVideos();';
if (!iosNewsVideo.includes(newsVideoStart)) throw new Error('No se encuentra inicio de noticias con vídeo');
iosNewsVideo = iosNewsVideo.replace(newsVideoStart,
  "  window.addEventListener('tiflo-resources-updated', event => {\n" +
  "    if (!Array.isArray(event.detail?.items)) return;\n" +
  "    resources = event.detail.items;\n" +
  "    renderCombinedNews();\n" +
  "  });\n" + newsVideoStart);
await writeFile(iosNewsVideoPath, iosNewsVideo);


// iOS WKWebView uses a local/custom origin: YouTube can reject embeds that
// cannot provide an HTTP Referer (player error 153). Never show a Play button
// leading to a known unreliable iframe. Keep Web and Android unchanged.
const iosMediaPath = join(output, 'actualidad-media.js');
let iosMedia = await readFile(iosMediaPath, 'utf8');
const coreDeclaration = '    const core = window.TIFLO_ACTUALIDAD_CORE;';
if (!iosMedia.includes(coreDeclaration)) throw new Error('No se encuentra la declaración del navegador de Actualidad');
iosMedia = iosMedia.replace(coreDeclaration,
  coreDeclaration + '\n    const iosExternalVideo = true;');
const videoCard = "if (item.type === 'video' && item.embedUrl) {";
if (!iosMedia.includes(videoCard)) throw new Error('No se encuentra botón de reproducción de vídeos en Actualidad');
iosMedia = iosMedia.replace(videoCard,
  "if (item.type === 'video' && item.embedUrl && iosExternalVideo) {");
const iosNativeVideoAnchor = "      if (item.type === 'video' && item.embedUrl && button) {";
if (!iosMedia.includes(iosNativeVideoAnchor)) throw new Error('No se encuentra addPlayer de Actualidad');
iosMedia = iosMedia.replace(iosNativeVideoAnchor, "      if (item.type === 'video' && item.embedUrl && button && iosExternalVideo) {\n        button.removeAttribute('aria-expanded');\n        let parsed;\n        try { parsed = new URL(item.embedUrl); } catch { parsed = null; }\n        const match = /^\\/embed\\/([A-Za-z0-9_-]{11})(?:\\/|$)/.exec(parsed?.pathname || '');\n        const validYouTube = parsed && /^(?:www\\.)?youtube(?:-nocookie)?\\.com$/.test(parsed.hostname) && match;\n        if (!validYouTube) { button.remove(); return; }\n        const videoId = match[1];\n        button.textContent = currentLanguage() === 'es' ? 'Reproducir dentro de TifloAcosta' : 'Play inside TifloAcosta';\n        button.addEventListener('click', () => {\n          const plugin = window.Capacitor?.Plugins?.TifloYouTube;\n          if (!plugin) { window.open(item.originalUrl, '_blank', 'noopener'); return; }\n          void plugin.open({ videoId, title: String(item.title || ''), description: String(item.summary || ''), channel: String(item.sourceName || ''), publishedAt: String(item.publishedAt || '') }).then(() => { if (button.isConnected) button.focus({ preventScroll: true }); }).catch(() => { window.open(item.originalUrl, '_blank', 'noopener'); });\n        });\n        return;\n      }\n      if (item.type === 'video' && item.embedUrl && button) {");
const originalLabel = "mediaOriginal.textContent = item.type === 'audio' && !item.mediaUrl";
if (!iosMedia.includes(originalLabel)) throw new Error('No se encuentra etiqueta de enlace de fuente original');
iosMedia = iosMedia.replace(originalLabel,
  "mediaOriginal.textContent = item.type === 'video' && iosExternalVideo\n" +
  "          ? (currentLanguage() === 'es' ? 'Abrir vídeo en YouTube' : 'Open video on YouTube')\n" +
  "          : item.type === 'audio' && !item.mediaUrl");
// Prefer the live HTTPS catalog with the packaged catalog as offline fallback.
// Existing episodes retain the playable audio URLs generated at build time.
const jsonLoad = [
  "      fetch('actualidad-media.json', { cache: 'no-cache' })",
  '        .then(response => {'
].join('\n');
if (!iosMedia.includes(jsonLoad)) throw new Error('No se encuentra carga de catálogo de Actualidad');
iosMedia = iosMedia.replace(jsonLoad, [
  "      " + networkFirst('actualidad-media.json'),
  '        .then(response => {'
].join('\n'));
const mediaDataLine = '          items = Array.isArray(data) ? data : [];';
if (!iosMedia.includes(mediaDataLine)) throw new Error('No se encuentra normalización del catálogo multimedia');
iosMedia = iosMedia.replace(mediaDataLine, [
  '          items = Array.isArray(data) ? data : [];',
  '          const packaged = Array.isArray(window.TIFLO_IOS_ACTUALIDAD_MEDIA) ? window.TIFLO_IOS_ACTUALIDAD_MEDIA : [];',
  '          const enclosures = new Map(packaged.filter(i => i.type === "audio" && i.mediaUrl).map(i => [i.id, i.mediaUrl]));',
  '          items = items.map(i => i.type === "audio" && !i.mediaUrl && enclosures.has(i.id) ? { ...i, mediaUrl: enclosures.get(i.id) } : i);'
].join("\n"));
const jsonError = [
  '        .catch(() => {',
  '          items = [];',
  '          loadFailed = true;',
  '          mediaLoaded = false;',
  '          mediaLoading = false;',
  '          render();',
  '        });'
].join('\n');
if (!iosMedia.includes(jsonError)) throw new Error('No se encuentra la recuperación de catálogo de Actualidad');
iosMedia = iosMedia.replace(jsonError, [
  '        .catch(() => {',
  '          const packaged = window.TIFLO_IOS_ACTUALIDAD_MEDIA;',
  '          items = Array.isArray(packaged) ? packaged : [];',
  '          loadFailed = !items.length;',
  '          mediaLoaded = Boolean(items.length);',
  '          mediaLoading = false;',
  '          render();',
  '        });'
].join('\n'));

// The isolation controller already moves VoiceOver focus after hashchange;
// its job must not be duplicated by the media script's link click listener.
const focusStart = iosMedia.indexOf('    // Move VoiceOver focus only after an explicit section navigation action.');
const focusEnd = iosMedia.indexOf("    window.addEventListener('hashchange', ensureMediaForRoute);",focusStart);
if (focusStart < 0 || focusEnd < focusStart) throw new Error('No se encuentra controlador de foco redundante');
iosMedia = iosMedia.slice(0,focusStart) +
  '    // VoiceOver focus belongs exclusively to actualidad-core.js navigation.\n' +
  iosMedia.slice(focusEnd);
await writeFile(iosMediaPath, iosMedia);
// News and the accessible-app directory must also refresh without a new IPA.
const iosActualidadPath = join(output, 'actualidad.js');
let iosActualidad = await readFile(iosActualidadPath, 'utf8');
for (const file of ['actualidad.json', 'actualidad-apps.json']) {
  const localFetch = "fetch('" + file + "', { cache: 'no-cache' })";
  if (!iosActualidad.includes(localFetch)) throw new Error('No se encuentra catálogo local: ' + file);
  iosActualidad = iosActualidad.replace(localFetch, networkFirst(file));
}
await writeFile(iosActualidadPath, iosActualidad);


// Patch only the iOS packaged web reader to use the native iPhone speech and translation plugins.
await import('./patch-reading-native.mjs');

// Fail before signing or uploading if an injected iOS-only script is invalid.
for (const file of ['app.js', 'videos.js', 'actualidad.js', 'actualidad-media.js', 'actualidad-core.js', 'ios-choice-groups.js', 'ios-videos-fallback.js', 'ios-actualidad-media-fallback.js', 'ios-choice-collapse.js', 'ios-reader-selects.js', 'ios-reader-minimal.js', 'ios-reader-native.js', 'web-reading.js', 'ios-parity.js', 'news-videos.js']) {
  execFileSync(process.execPath, ['--check', join(output, file)], { stdio: 'pipe' });
}
console.log('Validación sintáctica de scripts iOS completada');

console.log('Archivos preparados para iOS:',copied);
