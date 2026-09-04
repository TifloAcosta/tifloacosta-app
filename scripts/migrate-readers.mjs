import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_HOME = 'https://tifloacosta.github.io/tifloacosta-app/';
const READER_BASE = `${APP_HOME}docs`;

const LABELS = {
  es: 'Volver a la pantalla principal de TifloAcosta App',
  en: 'Back to the TifloAcosta App main screen'
};

// A small number of catalog entries point to a non-HTML representation even
// though an equivalent public HTML copy exists in Drive. Use that HTML copy
// only as the direct-reader source; keep the catalog's original URL untouched
// so download behavior does not change.
const SOURCE_OVERRIDES = {
  'en-1Qfn5zjvOriEdIqjFVNNqM1ZWIgcRN4mX': 'https://drive.google.com/file/d/1Ik-v1BREcnbWdOIfqSRIy3YAm-WkSNYx/view?usp=drivesdk'
};

export function readerUrl(lang, driveId) {
  if (!['es', 'en'].includes(lang)) throw new Error(`Unsupported language: ${lang}`);
  return `${READER_BASE}/${lang}/reader-${driveId}.html`;
}

export function addReturnControl(html, lang) {
  const label = LABELS[lang];
  if (!label) throw new Error(`Unsupported language: ${lang}`);
  if (html.includes('id="volver-app"')) return html;

  const bodyMatch = html.match(/<body\b[^>]*>/i);
  if (!bodyMatch || bodyMatch.index == null) throw new Error('HTML document has no body element');

  const control = `\n<nav aria-label="${label}" style="margin:0 0 1rem 0">\n  <a id="volver-app" href="${APP_HOME}" role="button" aria-label="${label}" style="display:inline-block;font:inherit;font-weight:700;padding:.7rem 1rem;border:2px solid currentColor;border-radius:.35rem;color:inherit;background:transparent;text-decoration:none">${label}</a>\n</nav>`;
  const insertAt = bodyMatch.index + bodyMatch[0].length;
  return `${html.slice(0, insertAt)}${control}${html.slice(insertAt)}`;
}

export function addOpenUrlToCatalog(source, resourceId, openUrl) {
  const idToken = `"id": "${resourceId}"`;
  const idPos = source.indexOf(idToken);
  if (idPos < 0) throw new Error(`Resource not found: ${resourceId}`);

  const objectStart = source.lastIndexOf('  {', idPos);
  const objectEndMarker = source.indexOf('\n  }', idPos);
  if (objectStart < 0 || objectEndMarker < 0) throw new Error(`Could not isolate resource: ${resourceId}`);
  const objectEnd = objectEndMarker + 4;
  const objectText = source.slice(objectStart, objectEnd);
  if (/"openUrl"\s*:/.test(objectText)) return source;

  const updatedObject = objectText.replace(
    /(\n\s*"url"\s*:\s*"[^"]+",)/,
    `$1\n    "openUrl": "${openUrl}",`
  );
  if (updatedObject === objectText) throw new Error(`Resource has no URL field: ${resourceId}`);
  return `${source.slice(0, objectStart)}${updatedObject}${source.slice(objectEnd)}`;
}

export function extractDriveId(url) {
  const value = String(url || '');
  const pathMatch = value.match(/\/(?:file|document)\/d\/([^/?#]+)/);
  if (pathMatch) return pathMatch[1];
  try {
    const parsed = new URL(value);
    return parsed.searchParams.get('id');
  } catch {
    return null;
  }
}

function parseResources(source) {
  const marker = 'window.TIFLO_RESOURCES = ';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Resource array marker not found');
  const arrayStart = source.indexOf('[', start + marker.length);
  const arrayEnd = source.indexOf('];', arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) throw new Error('Resource array bounds not found');
  return JSON.parse(source.slice(arrayStart, arrayEnd + 1));
}

function validateHtml(html) {
  if (!/<html\b/i.test(html) || !/<body\b/i.test(html)) return 'notHtml';
  if (/accounts\.google\.com|ServiceLogin/i.test(html)) return 'signIn';
  return 'ok';
}

async function downloadDriveHtml(driveId) {
  const candidates = [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`
  ];
  let lastReason = 'notHtml';

  for (const url of candidates) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      lastReason = `http:${response.status}`;
      continue;
    }
    const html = await response.text();
    const result = validateHtml(html);
    if (result === 'ok') return html;
    lastReason = result;
  }

  if (lastReason === 'signIn') throw new Error('Drive returned a sign-in page instead of the document');
  if (lastReason.startsWith('http:')) throw new Error(`Drive returned HTTP ${lastReason.split(':')[1]}`);
  throw new Error('Drive response is not a usable HTML document');
}

function parseArgs(argv) {
  const langArg = argv.find(arg => arg.startsWith('--lang='));
  const limitArg = argv.find(arg => arg.startsWith('--limit='));
  const lang = langArg ? langArg.split('=')[1] : 'es';
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
  if (!['es', 'en'].includes(lang)) throw new Error('Use --lang=es or --lang=en');
  if (!(limit > 0)) throw new Error('--limit must be greater than zero');
  return { lang, limit };
}

async function runMigration() {
  const { lang, limit } = parseArgs(process.argv.slice(2));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '..');
  const dataPath = path.join(root, 'data.js');
  let source = await readFile(dataPath, 'utf8');
  const resources = parseResources(source);
  const pending = resources.filter(item => item.lang === lang && !item.openUrl).slice(0, limit);

  if (!pending.length) {
    console.log(`No ${lang} resources need migration.`);
    return;
  }

  const targetDir = path.join(root, 'docs', lang);
  await mkdir(targetDir, { recursive: true });
  const failures = [];
  let migrated = 0;

  for (const item of pending) {
    const readerSourceUrl = SOURCE_OVERRIDES[item.id] || item.url;
    const driveId = extractDriveId(readerSourceUrl);
    if (!driveId) {
      failures.push(`${item.title}: Drive id not found`);
      continue;
    }

    try {
      const html = await downloadDriveHtml(driveId);
      const reader = addReturnControl(html, lang);
      const filename = `reader-${driveId}.html`;
      await writeFile(path.join(targetDir, filename), reader, 'utf8');
      source = addOpenUrlToCatalog(source, item.id, readerUrl(lang, driveId));
      migrated += 1;
      console.log(`Migrated: ${item.title}`);
    } catch (error) {
      failures.push(`${item.title}: ${error.message}`);
    }
  }

  if (migrated) await writeFile(dataPath, source, 'utf8');
  console.log(`Migrated ${migrated} ${lang} resource(s).`);

  if (failures.length) {
    console.error('Failures:');
    failures.forEach(item => console.error(`- ${item}`));
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  runMigration().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
