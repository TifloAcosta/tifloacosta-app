import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const folder = fileURLToPath(new URL('../www/', import.meta.url));
const source = fileURLToPath(new URL('../../mobile/src/', import.meta.url));
const load = name => readFile(join(folder, name), 'utf8');

test('staged iOS HTML contains one mobile root, without public website shell', async () => {
  const html = await load('index.html');
  assert.equal((html.match(/<main\b/g) || []).length, 1);
  assert.match(html, /<main id="app" tabindex="-1"><\/main>/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /home-blocks|global-search-shell|id="reading-section"|src="app\.js\?v=/);
});
test('staged mobile JavaScript originates from the unified mobile router', async () => {
  const app = await load('app.js');
  assert.match(app, /Missing mobile app root/);
  assert.match(app, /renderReadingBook/);
  assert.match(app, /renderVideos/);
  assert.match(app, /renderHome/);
});
test('bundle identity pins every included entrypoint and forbids remote web shell', async () => {
  const identity = JSON.parse(await load('tiflo-ios-ui-identity.json'));
  assert.equal(identity.mobileUiOnly, true);
  assert.equal(identity.publicWebUiExcluded, true);
  assert.equal(identity.entryPoint, 'mobile/src/index.html');
  for (const filename of ['index.html', 'app.js', 'app.css']) {
    const sha = createHash('sha256').update(await readFile(join(folder, filename))).digest('hex');
    assert.equal(identity.fileHashes[filename], sha);
  }
  const config = JSON.parse(await readFile(fileURLToPath(new URL('../capacitor.config.json', import.meta.url)), 'utf8'));
  assert.equal(config.server?.url, undefined);
  assert.equal(config.webDir, 'www');
});
test('mobile screens are single-root and navigation never loads the public web home', async () => {
  const app = await readFile(join(source, 'app.mjs'), 'utf8');
  assert.match(app, /router\.start\('home'\)/);
  assert.doesNotMatch(app, /window\.location\s*=\s*['"]https:\/\/tifloacosta\.com/);
  await stat(join(source, 'screens/reading-library.mjs'));
  await stat(join(source, 'screens/videos.mjs'));
});
