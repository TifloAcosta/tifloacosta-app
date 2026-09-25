import { readFile, writeFile, mkdir, rm, readdir, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://tifloacosta.com';
const DRIVE_RE = /https?:\/\/(?:www\.)?drive\.google\.com\//i;
const TONES_FOLDER = 'https://drive.google.com/drive/folders/1wfOpHewRIXds1MiQNv6TxJWOd8frNu50';

const p = (...parts) => path.join(ROOT, ...parts);

function isDrive(value) {
  return DRIVE_RE.test(String(value || ''));
}

function driveId(value) {
  const text = String(value || '');
  const match = text.match(/\/file\/d\/([^/?#]+)/);
  if (match) return match[1];
  try {
    const url = new URL(text);
    if (url.hostname === 'drive.google.com') return url.searchParams.get('id');
  } catch {}
  return null;
}

function repoPathFromLocalUrl(value) {
  try {
    const url = new URL(value);
    if (!['tifloacosta.com', 'www.tifloacosta.com'].includes(url.hostname)) return null;
    return decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
}

function cleanLocalDownloadUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.toString();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function downloadDriveFile(id, output) {
  execFileSync('gdown', [id, '-O', output], { stdio: 'inherit', cwd: ROOT });
}

async function assertHtml(file, label) {
  const text = await readFile(file, 'utf8');
  if (!/<html\b/i.test(text) || !/<body\b/i.test(text)) {
    throw new Error(`${label} was not downloaded as HTML: ${file}`);
  }
}

async function loadFinalResources() {
  const context = { window: {} };
  const base = await readFile(p('data.js'), 'utf8');
  vm.runInNewContext(base, context, { filename: 'data.js' });
  const supplemental = await readFile(p('medical-studies.js'), 'utf8');
  vm.runInNewContext(supplemental, context, { filename: 'medical-studies.js' });
  if (!Array.isArray(context.window.TIFLO_RESOURCES)) throw new Error('Resource catalog did not load.');
  return context.window.TIFLO_RESOURCES.map(item => ({ ...item }));
}

async function migrateResource(item) {
  const currentOpen = String(item.openUrl || item.url || '');
  const currentDownload = String(item.url || currentOpen);
  const localOpenPath = repoPathFromLocalUrl(currentOpen);

  if (localOpenPath) {
    const localFile = p(localOpenPath);
    if (!(await exists(localFile))) {
      const id = driveId(currentDownload);
      if (!id) throw new Error(`${item.id}: local page is missing and there is no Drive source to recover it.`);
      await mkdir(path.dirname(localFile), { recursive: true });
      downloadDriveFile(id, localFile);
      await assertHtml(localFile, item.id);
    }
    if (isDrive(currentDownload)) item.url = cleanLocalDownloadUrl(currentOpen);
    return item;
  }

  if (isDrive(currentOpen) || isDrive(currentDownload)) {
    const id = driveId(currentOpen) || driveId(currentDownload);
    if (!id) throw new Error(`${item.id}: could not extract Google Drive file ID.`);
    const lang = item.lang === 'en' ? 'en' : 'es';
    const relative = `docs/${lang}/reader-${id}.html`;
    const target = p(relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (!(await exists(target))) {
      downloadDriveFile(id, target);
      await assertHtml(target, item.id);
    }
    const localUrl = `${SITE}/${relative}`;
    item.url = localUrl;
    item.openUrl = localUrl;
  }

  return item;
}

async function consolidateCatalog() {
  const resources = await loadFinalResources();
  for (const item of resources) await migrateResource(item);

  const unresolved = resources.filter(item => isDrive(item.url) || isDrive(item.openUrl));
  if (unresolved.length) throw new Error(`Drive URLs remain in catalog: ${unresolved.map(item => item.id).join(', ')}`);

  await writeFile(p('data.js'), `window.TIFLO_RESOURCES = ${JSON.stringify(resources, null, 2)};\n`, 'utf8');
  await writeFile(
    p('medical-studies.js'),
    "(() => {\n  'use strict';\n  // The supplemental catalog was consolidated into data.js during the Drive migration.\n})();\n",
    'utf8'
  );
  return resources.length;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function encodedRelativeHref(fromDir, file) {
  const relative = path.relative(fromDir, file).split(path.sep).join('/');
  return relative.split('/').map(part => encodeURIComponent(part)).join('/');
}

function listMarkup(files, pageDir) {
  return files
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'es', { sensitivity: 'base' }))
    .map(file => `      <li><a href="${encodedRelativeHref(pageDir, file)}" download>${escapeHtml(path.basename(file))}</a></li>`)
    .join('\n');
}

function tonesPage({ lang, general, nokia, iphone, pageDir }) {
  const es = lang === 'es';
  const text = es ? {
    title: 'Colección de tonos | TifloAcosta', h1: 'Colección de tonos',
    intro: 'Todos los sonidos de esta colección están alojados directamente en TifloAcosta. Puedes reproducirlos o descargarlos sin salir de la página.',
    back: 'Volver a TifloAcosta App', general: 'Colección general', generalText: '13 tonos variados.',
    nokia: 'Tonos Nokia', nokiaText: '30 sonidos de Nokia, entre tonos, avisos y alertas.',
    iphone: 'Tonos instrumentales para iPhone', iphoneText: '80 temas instrumentales en formato M4R, preparados para usarlos como tonos en el iPhone.',
    download: 'Cada nombre es un enlace directo al archivo de audio.'
  } : {
    title: 'Ringtone collection | TifloAcosta', h1: 'Ringtone collection',
    intro: 'Every sound in this collection is hosted directly by TifloAcosta. You can play or download it without leaving the site.',
    back: 'Back to TifloAcosta App', general: 'General collection', generalText: '13 assorted ringtones.',
    nokia: 'Nokia ringtones', nokiaText: '30 Nokia sounds, including ringtones, notifications, and alerts.',
    iphone: 'Instrumental ringtones for iPhone', iphoneText: '80 instrumental tracks in M4R format, ready to use as iPhone ringtones.',
    download: 'Each name is a direct link to the audio file.'
  };

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text.title}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; line-height: 1.65; max-width: 900px; margin: 0 auto; padding: 1.25rem; color: #111; background: #fff; }
  a { color: #0645ad; text-decoration: underline; }
  a:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
  h1, h2 { line-height: 1.25; }
  h2 { margin-top: 2rem; }
  li { margin: .45rem 0; }
  .brand { font-weight: 700; margin: 0 0 1rem; }
  .back { margin: 0 0 1.5rem; }
</style>
</head>
<body>
<header>
  <p class="brand">TifloAcosta</p>
  <p class="back"><a href="../../">${text.back}</a></p>
  <h1>${text.h1}</h1>
  <p>${text.intro}</p>
</header>
<main>
  <p>${text.download}</p>
  <section id="general">
    <h2>${text.general}</h2>
    <p>${text.generalText}</p>
    <ul>
${listMarkup(general, pageDir)}
    </ul>
  </section>
  <section id="nokia">
    <h2>${text.nokia}</h2>
    <p>${text.nokiaText}</p>
    <ul>
${listMarkup(nokia, pageDir)}
    </ul>
  </section>
  <section id="iphone">
    <h2>${text.iphone}</h2>
    <p>${text.iphoneText}</p>
    <ul>
${listMarkup(iphone, pageDir)}
    </ul>
  </section>
</main>
<footer>
  <p class="back"><a href="../../">${text.back}</a></p>
</footer>
</body>
</html>\n`;
}

async function migrateTones() {
  const mediaDir = p('docs', 'media', 'tones');
  await rm(mediaDir, { recursive: true, force: true });
  await mkdir(mediaDir, { recursive: true });
  execFileSync('gdown', ['--folder', TONES_FOLDER, '-O', mediaDir], { stdio: 'inherit', cwd: ROOT });

  const files = await walk(mediaDir);
  const audio = files.filter(file => ['.ogg', '.mp3', '.m4r'].includes(path.extname(file).toLowerCase()));
  const general = audio.filter(file => path.extname(file).toLowerCase() === '.ogg');
  const nokia = audio.filter(file => path.extname(file).toLowerCase() === '.mp3');
  const iphone = audio.filter(file => path.extname(file).toLowerCase() === '.m4r');

  if (general.length !== 13 || nokia.length !== 30 || iphone.length !== 80) {
    throw new Error(`Incomplete tone migration. OGG=${general.length}, MP3=${nokia.length}, M4R=${iphone.length}`);
  }

  await writeFile(
    p('docs', 'es', 'tonos.html'),
    tonesPage({ lang: 'es', general, nokia, iphone, pageDir: p('docs', 'es') }),
    'utf8'
  );
  await writeFile(
    p('docs', 'en', 'ringtones.html'),
    tonesPage({ lang: 'en', general, nokia, iphone, pageDir: p('docs', 'en') }),
    'utf8'
  );
  return audio.length;
}

async function removeDriveDownloadCode() {
  const file = p('app.js');
  let source = await readFile(file, 'utf8');
  const before = source;

  source = source.replace(
    /\n  function extractDriveFileId\(url\) \{[\s\S]*?\n  async function shareResource\(item,status\) \{/,
    '\n  async function shareResource(item,status) {'
  );

  source = source.replace(
    "    const downloadLink=makeLink(labels.download,driveDownloadUrl(item.url));\n    try {\n      const localDownloadUrl=new URL(item.url,location.href);\n      if(!extractDriveFileId(item.url)&&localDownloadUrl.origin===location.origin) downloadLink.setAttribute('download','');\n    } catch(error) {}",
    "    const downloadLink=makeLink(labels.download,item.url,'_self');\n    try {\n      const localDownloadUrl=new URL(item.url,location.href);\n      if(localDownloadUrl.origin===location.origin) downloadLink.setAttribute('download','');\n    } catch(error) {}"
  );

  if (source === before || source.includes('driveDownloadUrl') || source.includes('extractDriveFileId')) {
    throw new Error('Could not remove the old Drive-specific download code from app.js.');
  }
  await writeFile(file, source, 'utf8');
}

async function audit() {
  for (const relative of ['data.js', 'medical-studies.js', 'docs/es/tonos.html', 'docs/en/ringtones.html', 'app.js']) {
    const source = await readFile(p(relative), 'utf8');
    if (DRIVE_RE.test(source)) throw new Error(`Google Drive reference remains in ${relative}`);
  }
}

const resourceCount = await consolidateCatalog();
const toneCount = await migrateTones();
await removeDriveDownloadCode();
await audit();
console.log(`Drive migration prepared: ${resourceCount} resources and ${toneCount} audio files are local.`);
