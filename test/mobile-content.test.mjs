import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMobileContent, downloadUrlForResource } from '../scripts/build-mobile-content.mjs';

test('mobile content feed normalizes resources and videos and exposes news', () => {
  const feed = buildMobileContent({
    resources: [{ id: 'r1', lang: 'es', category: 'iPhone', title: 'Guía', url: 'https://download', openUrl: 'https://read', new: true }],
    videos: [{ id: 'v1', title: 'Vídeo', publishedAt: '2026-09-13T09:00:00Z', url: 'https://youtube' }],
    generatedAt: '2026-09-13T18:00:00.000Z'
  });

  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.resources[0].kind, 'resource');
  assert.equal(feed.resources[0].isNew, true);
  assert.equal(feed.resources[0].downloadUrl, 'https://download');
  assert.equal(feed.videos[0].kind, 'video');
  assert.deepEqual(feed.news, []);
});

test('Google Drive preview links become direct download links', () => {
  assert.equal(
    downloadUrlForResource('https://drive.google.com/file/d/ABC_123/view?usp=drivesdk'),
    'https://drive.google.com/uc?export=download&id=ABC_123'
  );
});
