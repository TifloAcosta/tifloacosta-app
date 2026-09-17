import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Capacitor config uses the official TifloAcosta identity and bundled web output', async () => {
  const config = JSON.parse(await read('capacitor.config.json'));
  assert.equal(config.appId, 'com.tifloacosta.app');
  assert.equal(config.appName, 'TifloAcosta');
  assert.equal(config.webDir, 'dist');
  assert.equal(config.server?.androidScheme, 'https');
  assert.equal(config.server?.url, undefined, 'mobile shell must not be a remote-site wrapper');
});

test('mobile package pins Capacitor 8 native dependencies and builds before platform sync', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dependencies?.['@capacitor/core'], '8.5.2');
  assert.equal(pkg.dependencies?.['@capacitor/app'], '8.1.1');
  assert.equal(pkg.dependencies?.['@capacitor/share'], '8.0.1');
  assert.equal(pkg.dependencies?.['@capacitor/browser'], '8.0.4');
  assert.equal(pkg.devDependencies?.['@capacitor/cli'], '8.5.2');
  assert.equal(pkg.devDependencies?.['@capacitor/android'], '8.5.2');
  assert.equal(pkg.devDependencies?.['@capacitor/ios'], '8.5.2');
  assert.equal(pkg.devDependencies?.esbuild, '0.28.2');
  assert.equal(pkg.scripts?.test, 'node --test test/*.test.mjs');
  assert.equal(pkg.scripts?.build, 'node scripts/build.mjs');
  assert.equal(pkg.scripts?.['sync:android'], 'npm run build && npx cap sync android');
  assert.equal(pkg.scripts?.['sync:ios'], 'npm run build && npx cap sync ios');
});

test('mobile shell stays accessible and source entry remains bundle-ready', async () => {
  const [html, app, shared, home, buildScript] = await Promise.all([
    read('src/index.html'),
    read('src/app.mjs'),
    read('src/screens/shared.mjs'),
    read('src/screens/home.mjs'),
    read('scripts/build.mjs')
  ]);
  assert.match(html, /<html\s+lang="es"/i);
  assert.match(html, /<a[^>]+href="#app"[^>]*>[^<]+<\/a>/i);
  assert.equal((html.match(/<main\b/gi) || []).length, 1);
  assert.match(html, /<main\s+id="app"\s+tabindex="-1"><\/main>/i);
  assert.match(html, /<script\s+type="module"\s+src="\.\/app\.mjs"><\/script>/i);
  assert.doesNotMatch(html, /autofocus/i);
  assert.match(app, /renderHome\(context\)/);
  assert.match(shared, /document\.createElement\('h1'\)/);
  assert.match(shared, /heading\.dataset\.screenHeading\s*=\s*['"]['"]/);
  assert.match(shared, /heading\.tabIndex\s*=\s*-1/);
  assert.match(home, /heading\.dataset\.screenHeading\s*=\s*['"]['"]/);
  assert.match(buildScript, /app\.mjs/);
  assert.match(buildScript, /app\.js/);
  assert.match(buildScript, /bundle:\s*true/);
});

test('native dependencies, generated output, build products and signing material stay out of git', async () => {
  const ignore = await read('../.gitignore');
  for (const expected of [
    'mobile/node_modules/',
    'mobile/dist/',
    'mobile/android/.gradle/',
    'mobile/android/**/build/',
    'mobile/ios/App/DerivedData/',
    'mobile/*.jks',
    'mobile/*.keystore',
    'mobile/keystore.properties'
  ]) {
    assert.ok(ignore.split(/\r?\n/).includes(expected), `Missing .gitignore rule: ${expected}`);
  }
});
