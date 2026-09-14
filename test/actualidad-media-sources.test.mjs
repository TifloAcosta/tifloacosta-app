import assert from 'node:assert/strict';
import test from 'node:test';
import sources from '../actualidad-media-sources.json' with { type: 'json' };

const byId = new Map(sources.map(source => [source.id, source]));

test('approved Spanish accessibility podcasts are enabled in multimedia', () => {
  const ids = ['tifloaudio', 'arroba-sonora', 'varelalia', 'sucdepoma', 'gafotas-cegatos', 'podcast-ilumina'];
  for (const id of ids) {
    const source = byId.get(id);
    assert.ok(source, `${id} is registered`);
    assert.equal(source.enabled, true, `${id} is enabled`);
    assert.equal(source.section, 'accessibility', `${id} stays in accessibility`);
    assert.equal(source.type, 'audio', `${id} is audio`);
    assert.equal(source.lang, 'es', `${id} is Spanish`);
  }
});

test('Double Tap uses its current Simplecast feed', () => {
  assert.equal(byId.get('double-tap')?.endpoint, 'https://feeds.simplecast.com/MhX_XZQZ');
});

test('La Manzana Mordida stays technology and uses the exact current YouTube handle', () => {
  const source = byId.get('la-manzana-mordida');
  assert.equal(source?.section, 'technology');
  assert.equal(source?.youtubeHandle, '@lammordida');
});
