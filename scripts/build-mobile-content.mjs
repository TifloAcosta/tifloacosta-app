import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

export function buildMobileContent({ resources, videos, generatedAt = new Date().toISOString() }) {
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

export async function readResources(fileUrl = new URL('../data.js', import.meta.url)) {
  const source = await readFile(fileUrl, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: fileURLToPath(fileUrl) });
  if (!Array.isArray(context.window.TIFLO_RESOURCES)) {
    throw new Error('data.js does not expose window.TIFLO_RESOURCES');
  }
  return context.window.TIFLO_RESOURCES;
}

export async function readVideos(fileUrl = new URL('../videos.json', import.meta.url)) {
  const parsed = JSON.parse(await readFile(fileUrl, 'utf8'));
  if (!Array.isArray(parsed.videos)) throw new Error('videos.json does not contain a videos array');
  return parsed.videos;
}

export async function generateMobileContent({ outputUrl = new URL('../mobile-content.json', import.meta.url) } = {}) {
  const [resources, videos] = await Promise.all([readResources(), readVideos()]);
  const content = buildMobileContent({ resources, videos });
  await writeFile(outputUrl, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return content;
}

const isDirect = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirect) {
  await generateMobileContent();
}
