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

test('Tiflo Audio uses its stable podcast feed instead of fragile page HTML', () => {
  const source = byId.get('tifloaudio');
  assert.equal(source?.adapter, 'feed');
  assert.equal(source?.endpoint, 'https://www.ivoox.com/feed_fg_f1185986_filtro_1.xml');
});

test('Double Tap uses its current Simplecast feed', () => {
  assert.equal(byId.get('double-tap')?.endpoint, 'https://feeds.simplecast.com/MhX_XZQZ');
});

test('approved general technology channels stay explicitly outside accessibility', () => {
  const expected = new Map([
    ['la-manzana-mordida', '@lammordida'],
    ['imanu-mx', '@imanumx'],
    ['marcianotech', '@marcianotech'],
    ['topes-de-gama', '@topesdegama'],
    ['me-llaman-geek', '@MellamanGeek'],
    ['chicageek', '@chicageek'],
    ['tuapplemundo', '@tuapplemundo'],
    ['isenacode', '@isenacodetv'],
    ['xataka', '@XatakaTV'],
    ['migue-baena-ia', '@MigueBaenaIA'],
    ['urban-tecno', '@urbantecno']
  ]);
  for (const [id, handle] of expected) {
    const source = byId.get(id);
    assert.ok(source, `${id} is registered`);
    assert.equal(source.enabled, true, `${id} is enabled`);
    assert.equal(source.section, 'technology', `${id} stays in technology`);
    assert.equal(source.type, 'video', `${id} is video`);
    assert.equal(source.lang, 'es', `${id} is Spanish`);
    assert.equal(source.adapter, 'youtube-handle', `${id} uses YouTube handle adapter`);
    assert.equal(source.youtubeHandle, handle, `${id} uses the verified handle`);
    assert.ok(Number(source.maxItems) <= 4, `${id} is source-limited`);
  }
});

test('approved English general technology channels are enabled for the English multimedia view', () => {
  const expected = new Map([
    ['mkbhd', '@mkbhd'],
    ['mrwhosetheboss', '@Mrwhosetheboss'],
    ['linus-tech-tips', '@LinusTechTips'],
    ['the-verge-video', '@TheVerge'],
    ['cnet', '@CNET']
  ]);
  for (const [id, handle] of expected) {
    const source = byId.get(id);
    assert.ok(source, `${id} is registered`);
    assert.equal(source.enabled, true, `${id} is enabled`);
    assert.equal(source.section, 'technology', `${id} stays in technology`);
    assert.equal(source.type, 'video', `${id} is video`);
    assert.equal(source.lang, 'en', `${id} is English`);
    assert.equal(source.editorialClass, 'generalist', `${id} is generalist`);
    assert.equal(source.adapter, 'youtube-handle', `${id} uses YouTube handle adapter`);
    assert.equal(source.youtubeHandle, handle, `${id} uses the verified handle`);
    assert.ok(Number(source.maxItems) <= 3, `${id} is source-limited`);
  }
});
