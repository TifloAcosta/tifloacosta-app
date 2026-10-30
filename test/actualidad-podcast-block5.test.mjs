import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRss } from '../scripts/sync-podcast.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('el catálogo RSS preserva títulos, fecha y URL de audio sin inventar datos', () => {
  const fixture = '<rss><channel><item><guid>ep1</guid><title><![CDATA[La vida & tecnología]]></title><pubDate>Fri, 30 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Un &quot;capítulo&quot; nuevo.</p>]]></description><enclosure url="https://media.example.com/e1.mp3?x=1&amp;y=2" type="audio/mpeg"/></item><item><title>Segundo</title><pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate><enclosure url="https://media.example.com/e2.mp3"/></item><item><title>Sin audio</title></item></channel></rss>';
  const result = parseRss(fixture);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'ep1');
  assert.equal(result[0].title, 'La vida & tecnología');
  assert.equal(result[0].audioUrl, 'https://media.example.com/e1.mp3?x=1&y=2');
  assert.equal(result[0].description, 'Un "capítulo" nuevo.');
  assert.equal(result[0].published, '2026-10-30T10:00:00.000Z');
});

test('se rechazan episodios sin audio HTTPS y duplicados', () => {
  const xml = '<rss><channel><item><guid>uno</guid><title>A</title><enclosure url="https://media.example.com/a.mp3"/></item><item><guid>uno</guid><title>A duplicado</title><enclosure url="https://media.example.com/a.mp3"/></item><item><title>B</title><enclosure url="http://media.example.com/b.mp3"/></item></channel></rss>';
  assert.deepEqual(parseRss(xml).map(x=>x.title), ['A']);
  assert.deepEqual(parseRss('no es xml'), []);
});

test('Actualidad puede filtrar por fuente sin perder categorías ni enlaces originales', () => {
  const html = read('actualidad.html'), js = read('actualidad.js');
  assert.match(html, /id="news-source-label" for="news-source"/);
  assert.match(html, /id="news-source"/);
  assert.match(html, /id="news-clear-filters"/);
  assert.match(js, /function rebuildSources\(\)/);
  assert.match(js, /story\.sourceName === source/);
  assert.match(js, /els\.source\.addEventListener\('change', renderList\)/);
  assert.match(js, /published: 'Publicado'/);
  assert.match(js, /published: 'Published'/);
  assert.match(js, /c\.published.*date/);
  assert.match(html, /id="reader-original"/);
});

test('Podcast tiene catálogo local y recuperación de foco al terminar', () => {
  const html = read('podcast.html'), js = read('podcast.js'), workflow = read('.github/workflows/jekyll-gh-pages.yml');
  assert.match(js, /const LOCAL_FEED_URL = '\.\/podcast-episodes\.json'/);
  assert.match(js, /fetch\(LOCAL_FEED_URL, \{ cache: 'no-store' \}\)/);
  assert.match(workflow, /node scripts\/sync-podcast\.mjs/);
  assert.match(html, /id="podcast-back-episodes" type="button"/);
  assert.match(html, /id="podcast-playback-status".*role="status"/);
  assert.match(js, /activeButton = listen/);
  assert.match(js, /els\.backEpisodes\.addEventListener\('click'/);
  assert.match(js, /els\.audio\.addEventListener\('error'/);
  assert.match(html, /id="podcast-time" class="muted" aria-live="off"/);
});
