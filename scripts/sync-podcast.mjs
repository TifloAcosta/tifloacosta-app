import fs from 'node:fs';
import { feedEntriesFromXml } from './actualidad-media-adapters.mjs';

export const PODCAST_SOURCE = {
  id: 'tifloacosta-podcast',
  name: 'Canal TifloAcosta',
  endpoint: 'https://anchor.fm/s/5b48ca28/podcast/rss',
  lang: 'es',
  platform: 'podcast'
};

function requireText(response) {
  if (!response?.ok) throw new Error(`HTTP ${response?.status || 'error'}`);
  return response.text();
}

export function podcastItemsFromXml(xml) {
  return feedEntriesFromXml(xml, PODCAST_SOURCE)
    .map((item, index) => {
      const title = String(item?.title || '').trim();
      const url = String(item?.originalUrl || '').trim();
      if (!title || !url) return null;
      return {
        id: url || `tifloacosta-podcast-${index}`,
        lang: 'es',
        title,
        summary: String(item?.summary || '').trim(),
        publishedAt: String(item?.publishedAt || '').trim(),
        url
      };
    })
    .filter(Boolean);
}

export async function buildPodcastCatalog({ fetchImpl = fetch } = {}) {
  const xml = await requireText(await fetchImpl(PODCAST_SOURCE.endpoint));
  const items = podcastItemsFromXml(xml);
  if (!items.length) throw new Error('No valid TifloAcosta podcast episodes parsed');
  return items;
}

export async function syncPodcastCatalog({ fetchImpl = fetch, outputPath = 'podcast.json' } = {}) {
  const items = await buildPodcastCatalog({ fetchImpl });
  const output = `${JSON.stringify(items, null, 2)}\n`;
  let previous = '';
  try { previous = fs.readFileSync(outputPath, 'utf8'); } catch {}
  const changed = previous !== output;
  if (changed) fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`TifloAcosta podcast: ${items.length}. Changed: ${changed ? 'yes' : 'no'}.`);
  return { items, changed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncPodcastCatalog().catch(error => {
    console.error(`Podcast synchronization failed: ${error?.message || error}`);
    process.exit(1);
  });
}
