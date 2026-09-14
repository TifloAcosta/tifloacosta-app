import assert from 'node:assert/strict';
import test from 'node:test';
import { detectNewDiscoveryItems, parseBuscaAppsHtml } from '../scripts/actualidad-feed.mjs';

const source = {
  id: 'buscaapps',
  homepage: 'https://www.buscaapps.com/'
};

const fixture = `
<section>
  <h2><a href="/ficha/sonicroom">SonicRoom:</a> (Web)</h2>
  <p>Una plataforma de comunicación audiovisual accesible y de baja latencia</p>
  <h2><a href="https://www.buscaapps.com/ficha/pingkit">PingKit:</a> (iOS)</h2>
  <p>Herramienta accesible para pruebas de red.</p>
</section>`;

test('BuscaApps listing becomes stable discovery items without invented dates', () => {
  const items = parseBuscaAppsHtml(fixture, source);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'SonicRoom');
  assert.equal(items[0].platform, 'Web');
  assert.equal(items[0].url, 'https://www.buscaapps.com/ficha/sonicroom');
  assert.equal(items[0].summary, 'Una plataforma de comunicación audiovisual accesible y de baja latencia');
  assert.equal('publishedAt' in items[0], false);
  assert.match(items[0].id, /^buscaapps-[a-f0-9]{16}$/);
});

test('BuscaApps discovery deduplicates stable IDs and returns only unseen items', () => {
  const items = parseBuscaAppsHtml(`${fixture}${fixture}`, source);
  assert.equal(items.length, 2);

  const unseenFromSet = detectNewDiscoveryItems(items, new Set([items[0].id]));
  assert.deepEqual(unseenFromSet.map(item => item.id), [items[1].id]);

  const unseenFromArray = detectNewDiscoveryItems(items, [items[1].id]);
  assert.deepEqual(unseenFromArray.map(item => item.id), [items[0].id]);
});
