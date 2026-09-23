import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export function buildMobileContent({ resources = [], videos = [], news = [], generatedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    generatedAt,
    resources: resources.map(item => ({
      kind: 'resource',
      id: item.id,
      lang: item.lang,
      category: item.category,
      title: item.title,
      url: item.url,
      openUrl: item.openUrl || item.url,
      isNew: Boolean(item.new)
    })),
    videos: videos.map(item => ({
      kind: 'video',
      id: item.id,
      title: item.title || '',
      publishedAt: item.publishedAt || '',
      description: item.description || '',
      excerpt: item.excerpt || '',
      thumbnail: item.thumbnail || '',
      url: item.url || ''
    })),
    news: news.map(item => ({
      kind: 'news',
      id: `${item.id}:${item.lang}`,
      sourceId: item.id,
      lang: item.lang,
      title: item.title || '',
      summary: item.summary || '',
      sourceName: item.sourceName || '',
      originalUrl: item.originalUrl || '',
      publishedAt: item.publishedAt || '',
      categories: Array.isArray(item.categories) ? [...item.categories] : []
    }))
  };
}

async function loadResources() {
  const source = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'data.js' });

  const baseResources = Array.isArray(context.window.TIFLO_RESOURCES)
    ? context.window.TIFLO_RESOURCES.map(item => ({ ...item }))
    : [];
  const baseIds = new Set(baseResources.map(item => item.id));

  const supplementalSource = await readFile(new URL('../medical-studies.js', import.meta.url), 'utf8');
  vm.runInNewContext(supplementalSource, context, { filename: 'medical-studies.js' });

  const mobileAdditions = Array.isArray(context.window.TIFLO_RESOURCES)
    ? context.window.TIFLO_RESOURCES
        .filter(item => item?.mobile === true && !baseIds.has(item.id))
        .map(item => ({ ...item }))
    : [];

  return [...mobileAdditions, ...baseResources];
}

async function loadVideos() {
  const source = await readFile(new URL('../videos.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(source);
  return Array.isArray(catalog?.videos) ? catalog.videos : [];
}

async function loadNews() {
  const [coreSource, newsSource] = await Promise.all([
    readFile(new URL('../actualidad-core.js', import.meta.url), 'utf8'),
    readFile(new URL('../actualidad.json', import.meta.url), 'utf8')
  ]);
  const context = { URL };
  vm.runInNewContext(coreSource, context, { filename: 'actualidad-core.js' });
  const core = context.TIFLO_ACTUALIDAD_CORE;
  if (!core || typeof core.publicStories !== 'function') throw new Error('Actualidad core unavailable');
  const raw = JSON.parse(newsSource);
  const items = Array.isArray(raw) ? raw : [];
  return [
    ...core.publicStories(items, 'es'),
    ...core.publicStories(items, 'en')
  ].filter(item => item?.type === 'news');
}

async function main() {
  const [resources, videos, news] = await Promise.all([loadResources(), loadVideos(), loadNews()]);
  const feed = buildMobileContent({ resources, videos, news });
  const output = new URL('../mobile-content.json', import.meta.url);
  await writeFile(output, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  console.log(`Mobile content generated: ${feed.resources.length} resources, ${feed.videos.length} videos, ${feed.news.length} news.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
