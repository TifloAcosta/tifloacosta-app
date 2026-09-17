import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('mobile build stages an explicit set of runtime assets', async () => {
  const source = await read('scripts/build-mobile.mjs');

  for (const expected of [
    "const ROOT_FILES = [",
    "'index.html'",
    "'actualidad.html'",
    "'videos.html'",
    "'styles.css'",
    "'app.js'",
    "'data.js'",
    "'manifest.webmanifest'",
    "'offline.html'",
    "'sw.js'",
    "const RUNTIME_DIRECTORIES = ['docs/es', 'docs/en', 'push']"
  ]) {
    assert.ok(source.includes(expected), `Missing mobile runtime asset declaration: ${expected}`);
  }

  assert.match(source, /rm\(OUTPUT_DIR, \{ recursive: true, force: true \}\)/);
  assert.match(source, /cp\(source, destination, \{ recursive: true \}\)/);
  assert.match(source, /access\(join\(OUTPUT_DIR, 'index\.html'\)\)/);
  assert.doesNotMatch(source, /README\.txt|SECURITY\.md|reader-payloads|\.github\/|test\//);
});

test('mobile and signing outputs are ignored from source control', async () => {
  const ignore = await read('.gitignore');

  for (const expected of [
    'node_modules/',
    'www/',
    'android/.gradle/',
    'android/**/build/',
    'ios/App/DerivedData/',
    '*.jks',
    '*.keystore',
    'keystore.properties'
  ]) {
    assert.ok(ignore.split(/\r?\n/).includes(expected), `Missing .gitignore rule: ${expected}`);
  }
});
