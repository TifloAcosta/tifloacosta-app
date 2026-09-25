import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const dataPath = path.join(root, 'data.js');
const medicalPath = path.join(root, 'medical-studies.js');

const driveIdFromUrl = value => {
  if (typeof value !== 'string') return null;
  const match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return match ? match[1] : null;
};

const localUrlFor = (lang, driveId) =>
  `https://tifloacosta.com/docs/${lang}/reader-${driveId}.html`;

const localPathFor = (lang, driveId) =>
  path.join(root, 'docs', lang, `reader-${driveId}.html`);

async function evaluateResources(dataSource, medicalSource) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(dataSource, context, { filename: 'data.js' });
  vm.runInContext(medicalSource, context, { filename: 'medical-studies.js' });
  return context.window.TIFLO_RESOURCES;
}

async function downloadHtml(driveId, destination) {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Drive ${driveId}: HTTP ${response.status}`);
  const text = await response.text();
  const lower = text.toLowerCase();
  if (!lower.includes('<html') && !lower.includes('<!doctype html')) {
    throw new Error(`Drive ${driveId}: el archivo descargado no parece HTML`);
  }
  if (lower.includes('accounts.google.com') || lower.includes('request access')) {
    throw new Error(`Drive ${driveId}: Drive devolvió una página de acceso, no el recurso`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, text, 'utf8');
}

let dataSource = await fs.readFile(dataPath, 'utf8');
let medicalSource = await fs.readFile(medicalPath, 'utf8');
const resources = await evaluateResources(dataSource, medicalSource);

if (!Array.isArray(resources)) throw new Error('No se pudo cargar TIFLO_RESOURCES');

const driveResources = resources.filter(resource =>
  driveIdFromUrl(resource.url) || driveIdFromUrl(resource.openUrl)
);

const mapping = new Map();
for (const resource of driveResources) {
  const driveId = driveIdFromUrl(resource.openUrl) || driveIdFromUrl(resource.url);
  if (!driveId) continue;
  const lang = resource.lang === 'en' ? 'en' : 'es';
  const destination = localPathFor(lang, driveId);
  const localUrl = localUrlFor(lang, driveId);

  let exists = true;
  try {
    await fs.access(destination);
  } catch {
    exists = false;
  }

  const alreadyHasLocalReader = typeof resource.openUrl === 'string' &&
    resource.openUrl.startsWith('https://tifloacosta.com/docs/');

  if (!exists && !alreadyHasLocalReader) {
    console.log(`Copiando ${resource.title} (${driveId})`);
    await downloadHtml(driveId, destination);
  }

  mapping.set(driveId, localUrl);
}

for (const [driveId, localUrl] of mapping) {
  const escapedId = driveId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directDriveUrl = new RegExp(`https://drive\\.google\\.com/file/d/${escapedId}/view\\?usp=drivesdk`, 'g');
  dataSource = dataSource.replace(directDriveUrl, localUrl);
  medicalSource = medicalSource.replace(directDriveUrl, localUrl);
}

medicalSource = medicalSource
  .replaceAll('`https://drive.google.com/file/d/${driveId}/view?usp=drivesdk`', '`https://tifloacosta.com/docs/es/reader-${driveId}.html`');

await fs.writeFile(dataPath, dataSource, 'utf8');
await fs.writeFile(medicalPath, medicalSource, 'utf8');

const finalResources = await evaluateResources(dataSource, medicalSource);
const remaining = finalResources.filter(resource =>
  driveIdFromUrl(resource.url) || driveIdFromUrl(resource.openUrl)
);

if (remaining.length) {
  throw new Error(`Siguen dependiendo de Drive ${remaining.length} recursos: ${remaining.map(x => x.id).join(', ')}`);
}

console.log(`Migración documental completada: ${driveResources.length} recursos revisados; cero enlaces de Drive en el catálogo.`);
