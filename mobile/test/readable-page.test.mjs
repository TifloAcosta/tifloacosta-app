import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReadablePage, isUsefulContentLink } from '../src/core/readable-page.mjs';

test('removes executable and promotional noise but preserves editorial links', () => {
  const page = extractReadablePage({
    url: 'https://example.com/article',
    contentType: 'text/html',
    html: '<html><head><title>Guide</title><script>alert(1)</script></head><body><header>Menu</header><main><h1>Guide</h1><p>Useful introduction with enough real article text for reading. <a href="/chapter-2">Chapter 2</a> continues the guide with more detail.</p><p>Second substantive paragraph keeps the page comfortably above the reliability threshold for clean reading.</p><aside class="promo"><a href="https://ads.example">Buy now</a></aside></main><footer>Privacy</footer></body></html>'
  });
  const json = JSON.stringify(page.blocks);
  assert.equal(page.reliable, true);
  assert.equal(page.title, 'Guide');
  assert.equal(page.source, 'example.com');
  assert.match(json, /Chapter 2/);
  assert.match(json, /https:\/\/example\.com\/chapter-2/);
  assert.doesNotMatch(json, /Menu|Buy now|alert\(1\)|Privacy/);
});

test('keeps a useful link index even with little prose', () => {
  const page = extractReadablePage({
    url: 'https://example.com/courses',
    contentType: 'text/html',
    html: '<main><h1>Courses</h1><ul><li><a href="/voiceover">VoiceOver course</a></li><li><a href="/nvda">NVDA course</a></li></ul></main>'
  });
  const links = page.blocks.flatMap(block => block.parts || []).filter(part => part.type === 'link');
  assert.equal(page.reliable, true);
  assert.deepEqual(links.map(link => link.text), ['VoiceOver course', 'NVDA course']);
});

test('keeps modern card-style content links that are not wrapped in paragraphs or list items', () => {
  const page = extractReadablePage({
    url: 'https://example.com/resources',
    contentType: 'text/html',
    html: '<main><h1>Resources</h1><div class="cards"><a class="card" href="/voiceover"><h2>VoiceOver course</h2></a><a class="card" href="/nvda"><h2>NVDA course</h2></a></div></main>'
  });
  const links = page.blocks.flatMap(block => block.parts || []).filter(part => part.type === 'link');
  assert.equal(page.reliable, true);
  assert.deepEqual(links.map(link => link.text), ['VoiceOver course', 'NVDA course']);
});

test('never exposes javascript or mailto as interactive links', () => {
  const page = extractReadablePage({
    url: 'https://example.com/',
    contentType: 'text/html',
    html: '<main><h1>Safe</h1><p>Long enough safe paragraph for the parser to inspect. <a href="javascript:alert(1)">Bad</a> <a href="mailto:x@example.com">Mail</a> and useful explanatory text continues here.</p><p>Another useful paragraph with enough text to make the page reliable for an accessible reading view.</p></main>'
  });
  assert.doesNotMatch(JSON.stringify(page.blocks), /javascript:|mailto:/);
  assert.match(JSON.stringify(page.blocks), /Bad/);
  assert.match(JSON.stringify(page.blocks), /Mail/);
});

test('decodes entities and removes duplicate adjacent paragraphs', () => {
  const body = 'This is a sufficiently long paragraph about AT&amp;T and accessibility with more than enough characters to count as substantive content.';
  const page = extractReadablePage({
    url: 'https://example.com/story',
    contentType: 'application/xhtml+xml; charset=utf-8',
    html: `<article><h1>A &amp; B</h1><p>${body}</p><p>${body}</p><p>A second different paragraph adds enough additional useful text for reliable clean reading.</p></article>`
  });
  assert.equal(page.title, 'A & B');
  assert.equal(page.blocks.filter(block => JSON.stringify(block).includes('AT&T')).length, 1);
});

test('plain text is reliable at the approved threshold and keeps paragraphs', () => {
  const text = 'Readable note\n\nThis is a plain text document with enough non whitespace characters to exceed the threshold for a reliable clean reading result. It contains useful information for the user.';
  const page = extractReadablePage({ url: 'https://example.com/note.txt', contentType: 'text/plain', html: text });
  assert.equal(page.reliable, true);
  assert.equal(page.title, 'Readable note');
  assert.match(JSON.stringify(page.blocks), /plain text document/);
});

test('empty or noisy pages are not presented as reliable reading', () => {
  const page = extractReadablePage({
    url: 'https://example.com/',
    contentType: 'text/html',
    html: '<html><head><title>Site</title></head><body><nav>Home</nav><aside>Ad</aside><footer>Privacy</footer></body></html>'
  });
  assert.equal(page.reliable, false);
  assert.deepEqual(page.blocks, []);
});

test('generic link labels are not invented', () => {
  const page = extractReadablePage({
    url: 'https://example.com/',
    contentType: 'text/html',
    html: '<main><h1>Index</h1><ul><li><a href="/one">Click here</a></li><li><a href="/two">Read more</a></li></ul></main>'
  });
  assert.match(JSON.stringify(page.blocks), /Click here/);
  assert.match(JSON.stringify(page.blocks), /Read more/);
});

test('link usefulness rejects promotional destinations and non-http protocols', () => {
  assert.equal(isUsefulContentLink({ href: '/chapter', text: 'Chapter 1', baseUrl: 'https://example.com/' }), true);
  assert.equal(isUsefulContentLink({ href: 'mailto:x@example.com', text: 'Email us', baseUrl: 'https://example.com/' }), false);
  assert.equal(isUsefulContentLink({ href: '/subscribe', text: 'Subscribe now', baseUrl: 'https://example.com/' }), false);
  assert.equal(isUsefulContentLink({ href: 'https://facebook.com/share', text: 'Share on Facebook', baseUrl: 'https://example.com/' }), false);
});
