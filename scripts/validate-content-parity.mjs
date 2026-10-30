import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { assertContentParity } from '../shared/content-parity.mjs';

export async function readContentInputs() {
  const [catalogText, source, videosText] = await Promise.all([
    readFile(new URL('../mobile-content.json', import.meta.url), 'utf8'),
    readFile(new URL('../data.js', import.meta.url), 'utf8'),
    readFile(new URL('../videos.json', import.meta.url), 'utf8')
  ]);
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'data.js', timeout: 5000 });
  const resources = Array.isArray(context.window.TIFLO_RESOURCES)
    ? Array.from(context.window.TIFLO_RESOURCES, item => ({ ...item }))
    : [];
  const catalog = JSON.parse(videosText);
  return {
    feed: JSON.parse(catalogText),
    resources,
    videos: Array.isArray(catalog.videos) ? catalog.videos : []
  };
}

export async function validatePublishedContent() {
  const counts = assertContentParity(await readContentInputs());
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validatePublishedContent().then(counts => {
    console.log('Contenido coherente: ' + counts.resources + ' recursos, ' +
      counts.videos + ' vídeos y ' + counts.news + ' noticias para las apps.');
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
