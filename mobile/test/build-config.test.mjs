import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Capacitor consumes built mobile assets', async () => {
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');

  assert.equal(config.webDir, 'dist');
  assert.equal(pkg.scripts.build, 'node scripts/build.mjs');
  assert.match(pkg.scripts['sync:android'], /^npm run build && /);
  assert.match(pkg.scripts['sync:ios'], /^npm run build && /);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /app\.mjs/);
});