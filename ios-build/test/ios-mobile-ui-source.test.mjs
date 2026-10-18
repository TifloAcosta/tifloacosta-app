import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
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
async function listPackagedFiles(directory = folder, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listPackagedFiles(join(directory, entry.name), name));
    else if (entry.isFile() && name !== 'tiflo-ios-ui-identity.json') files.push(name);
    else if (!entry.isFile()) assert.fail(`Unexpected packaged item: ${name}`);
  }
  return files.sort();
}

test('bundle identity pins every file, including auxiliary scripts and assets, and forbids remote web shell', async () => {
  const identity = JSON.parse(await load('tiflo-ios-ui-identity.json'));
  assert.equal(identity.mobileUiOnly, true);
  assert.equal(identity.publicWebUiExcluded, true);
  assert.equal(identity.entryPoint, 'mobile/src/index.html');
  const files = await listPackagedFiles();
  assert.deepEqual(identity.includedFiles, files, 'The manifest must enumerate the exact staged files');
  assert.deepEqual(Object.keys(identity.fileHashes).sort(), files,
    'All assets and scripts must be hashed; no extra or missing files');
  for (const filename of files) {
    const sha = createHash('sha256').update(await readFile(join(folder, filename))).digest('hex');
    assert.equal(identity.fileHashes[filename], sha, `Package integrity: ${filename}`);
  }
  for (const critical of ['index.html', 'app.js', 'app.css', 'update-bootstrap.js']) {
    assert.ok(files.includes(critical), `Missing iPhone entrypoint: ${critical}`);
  }
  if (process.env.GITHUB_SHA) assert.equal(identity.sourceCommit, process.env.GITHUB_SHA);
  const config = JSON.parse(await readFile(fileURLToPath(new URL('../../mobile/capacitor.config.json', import.meta.url)), 'utf8'));
  assert.equal(config.server?.url, undefined);
  // WebKit's origin must not move: legacy IndexedDB lives at capacitor://localhost.
  assert.equal(config.server?.iosScheme, 'capacitor');
  assert.equal(config.server?.hostname, 'localhost');
  assert.equal(config.webDir, 'dist');
});
test('mobile screens are single-root and navigation never loads the public web home', async () => {
  const app = await readFile(join(source, 'app.mjs'), 'utf8');
  assert.match(app, /router\.start\('home'\)/);
  assert.doesNotMatch(app, /window\.location\s*=\s*['"]https:\/\/tifloacosta\.com/);
  await stat(join(source, 'screens/reading-library.mjs'));
  await stat(join(source, 'screens/videos.mjs'));
});
