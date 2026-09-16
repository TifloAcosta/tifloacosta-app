import assert from 'node:assert/strict';
import test from 'node:test';

import { podcastItemsFromXml } from '../scripts/sync-podcast.mjs';

test('podcast catalog keeps old TifloAcosta episodes searchable instead of limiting to recent items', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>Canal TifloAcosta</title>
    <item>
      <title>Episodio reciente</title>
      <link>https://example.com/reciente</link>
      <pubDate>Tue, 15 Sep 2026 10:00:00 GMT</pubDate>
      <description>Último episodio</description>
    </item>
    <item>
      <title>No me gusta el calor</title>
      <link>https://example.com/no-me-gusta-el-calor</link>
      <pubDate>Sat, 08 Jul 2023 10:00:00 GMT</pubDate>
      <description>Un episodio antiguo que debe seguir apareciendo en búsquedas.</description>
    </item>
  </channel></rss>`;

  const items = podcastItemsFromXml(xml);
  assert.equal(items.length, 2);
  assert.equal(items.some(item => item.title === 'No me gusta el calor'), true);
  assert.equal(items.find(item => item.title === 'No me gusta el calor')?.url, 'https://example.com/no-me-gusta-el-calor');
  assert.equal(items.every(item => item.lang === 'es'), true);
});
