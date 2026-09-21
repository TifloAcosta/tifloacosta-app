import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeUrl, normalizeFeedEntry, parseCtiNewsHtml, parseFeedXml, stableStoryId } from '../scripts/actualidad-feed.mjs';

const source = {
  id: 'applevis-apps',
  name: 'AppleVis',
  homepage: 'https://www.applevis.com/',
  feedUrl: 'https://www.applevis.com/feed/apps.xml',
  lang: 'en',
  categories: ['apple', 'apps-accesibles'],
  enabled: true
};

const spanishSource = {
  id: 'spanish-source',
  name: 'Fuente española',
  homepage: 'https://example.es/',
  feedUrl: 'https://example.es/feed/',
  lang: 'es',
  categories: ['tecnologia-accesibilidad'],
  enabled: true
};

test('RSS items are parsed into feed entries', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Accessible App</title><link>https://example.com/app?utm_source=rss</link><pubDate>Sun, 13 Sep 2026 12:00:00 GMT</pubDate><description><![CDATA[Useful app]]></description></item></channel></rss>`;
  const items = parseFeedXml(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Accessible App');
  assert.equal(items[0].url, 'https://example.com/app?utm_source=rss');
});

test('Atom entries use href links and updated dates', () => {
  const xml = `<?xml version="1.0"?><feed><entry><title>NVDA note</title><link rel="alternate" href="https://example.com/nvda"/><updated>2026-09-13T13:00:00Z</updated><summary>Update</summary></entry></feed>`;
  const items = parseFeedXml(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://example.com/nvda');
  assert.equal(items[0].publishedAt, '2026-09-13T13:00:00Z');
});

test('feed entries retain article HTML separately from the short summary', () => {
  const xml = `<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Accessible article</title><link>https://example.com/article</link><pubDate>Sun, 13 Sep 2026 12:00:00 GMT</pubDate><description>Short summary</description><content:encoded><![CDATA[<article><p>First article paragraph with useful information for readers.</p><p>Second article paragraph with more detail.</p></article>]]></content:encoded></item></channel></rss>`;
  const items = parseFeedXml(xml, source);
  assert.equal(items[0].summary, 'Short summary');
  assert.match(items[0].contentHtml, /First article paragraph/);
  assert.match(items[0].contentHtml, /<p>/);
});

test('CTI news listing is parsed into dated entries', () => {
  const html = `
    <section>
      <h2><span>Evaluaciones de APP</span> <a href="/noticias/evaluaciones-de-app-agosto">Evaluaciones de APP actualizadas en agosto</a></h2>
      <span class="date">11/09/2026</span>
      <p>A lo largo del pasado mes se han evaluado nuevas aplicaciones.</p>
      <h2><span>Accesibilidad y Tecnología</span> <a href="https://cti.once.es/noticias/futbol-accesible">Vive el fútbol accesible con Movistar Touch</a></h2>
      <span class="date">10/09/2026</span>
      <p>Una experiencia accesible e inmersiva para personas afiliadas.</p>
    </section>`;

  const items = parseCtiNewsHtml(html, { homepage: 'https://cti.once.es/' });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Evaluaciones de APP actualizadas en agosto');
  assert.equal(items[0].url, 'https://cti.once.es/noticias/evaluaciones-de-app-agosto');
  assert.equal(items[0].publishedAt, '2026-09-11T12:00:00.000Z');
  assert.equal(items[0].summary, 'A lo largo del pasado mes se han evaluado nuevas aplicaciones.');
});

test('canonical URLs drop fragments and common tracking parameters', () => {
  assert.equal(
    canonicalizeUrl('https://example.com/story?utm_source=rss&x=1&fbclid=abc#comments'),
    'https://example.com/story?x=1'
  );
});

test('stable IDs are deterministic for source and canonical URL', () => {
  const one = stableStoryId('applevis-apps', 'https://example.com/story');
  const two = stableStoryId('applevis-apps', 'https://example.com/story');
  assert.equal(one, two);
  assert.match(one, /^applevis-apps-[a-f0-9]{16}$/);
});

test('normalized feed entries inherit source language and categories', () => {
  const item = normalizeFeedEntry({
    title: 'Accessible App',
    url: 'https://example.com/app?utm_medium=rss',
    publishedAt: '2026-09-13T12:00:00Z',
    summary: 'Useful app'
  }, source);

  assert.equal(item.lang, 'en');
  assert.deepEqual(item.categories, ['apple', 'apps-accesibles']);
  assert.equal(item.originalUrl, 'https://example.com/app');
  assert.equal(item.editorialState, 'source-only');
});

test('normalized feed entries turn article HTML into quiet plain paragraphs', () => {
  const item = normalizeFeedEntry({
    title: 'Clean reading test',
    url: 'https://example.com/clean-reading',
    publishedAt: '2026-09-13T12:00:00Z',
    summary: 'Short summary',
    contentHtml: `
      <article>
        <nav>Section menu</nav>
        <p>First useful paragraph with enough information to be part of the article.</p>
        <img src="photo.jpg" alt="decorative image">
        <aside>Related stories</aside>
        <p>Second useful paragraph that should follow the first one cleanly.</p>
        <div class="share-buttons">Share this story</div>
      </article>`
  }, source);

  assert.equal(
    item.body,
    'First useful paragraph with enough information to be part of the article.\n\nSecond useful paragraph that should follow the first one cleanly.'
  );
  assert.doesNotMatch(item.body, /menu|image|Related|Share/i);
});

test('Spanish stories gain specific categories from their own title and summary', () => {
  const cases = [
    ['Evaluaciones de APP actualizadas', 'Nuevas aplicaciones accesibles para móviles.', ['apps-accesibles']],
    ['Novedades de VoiceOver en iOS 27', 'Cambios para usuarios de iPhone.', ['apple']],
    ['TalkBack mejora la navegación en Android', 'Nueva versión del lector de pantalla.', ['android']],
    ['JAWS y NVDA reciben nuevas funciones', 'Lectores de pantalla para Windows.', ['windows', 'jaws', 'nvda']],
    ['Webinar sobre nuevas tecnologías Braille', 'Orbit Research presenta una línea braille.', ['braille']],
    ['Inteligencia artificial para describir imágenes', 'Una herramienta de IA orientada a la accesibilidad.', ['ia-accesibilidad']],
    ['Nuevas gafas inteligentes accesibles', 'Un dispositivo para personas ciegas.', ['gafas-inteligentes']],
    ['Proyecto piloto de orientación accesible', 'Navegación GPS para mejorar los desplazamientos.', ['proyectos-prototipos', 'movilidad']],
    ['Tecnología para personas sordociegas', 'Nuevo sistema de comunicación accesible.', ['sordoceguera']]
  ];

  for (const [title, summary, expected] of cases) {
    const item = normalizeFeedEntry({
      title,
      url: `https://example.es/${encodeURIComponent(title)}`,
      publishedAt: '2026-09-13T12:00:00Z',
      summary
    }, spanishSource);

    assert.ok(item.categories.includes('tecnologia-accesibilidad'));
    for (const category of expected) assert.ok(item.categories.includes(category), `${title} should include ${category}`);
  }
});
