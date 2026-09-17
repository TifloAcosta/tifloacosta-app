import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

export function buildMobileContent({ resources = [], videos = [], generatedAt = new Date().toISOString() }) {
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
    news: []
  };
}

async function loadResources() {
  const source = await readFile(new URL('../data.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'data.js' });
  return Array.isArray(context.window.TIFLO_RESOURCES) ? context.window.TIFLO_RESOURCES : [];
}

async function loadVideos() {
  const source = await readFile(new URL('../videos.json', import.meta.url), 'utf8');
  const catalog = JSON.parse(source);
  return Array.isArray(catalog?.videos) ? catalog.videos : [];
}

async function main() {
  const [resources, videos] = await Promise.all([loadResources(), loadVideos()]);
  const feed = buildMobileContent({ resources, videos });
  const output = new URL('../mobile-content.json', import.meta.url);
  await writeFile(output, `${JSON.stringify(feed, null, 2)}\n`, 'utf8');
  console.log(`Mobile content generated: ${feed.resources.length} resources, ${feed.videos.length} videos.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
