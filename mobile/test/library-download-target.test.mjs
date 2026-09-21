import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');

test('library keeps the accessible reader URL separate from the real download URL', () => {
  assert.match(source, /const openUrl\s*=\s*item\.openUrl\s*\|\|\s*item\.url\s*\|\|\s*''/);
  assert.match(source, /const downloadUrl\s*=\s*item\.url\s*\|\|\s*item\.openUrl\s*\|\|\s*''/);
  assert.match(source, /href:\s*openUrl/);
  assert.match(source, /addSaveButton\(article,\s*item,\s*downloadUrl,\s*nativeActions,\s*t\)/);
});

test('library resolves known provider links before asking Android to save them', () => {
  assert.match(source, /resolveLocal/);
  assert.match(source, /resolveLocal\(url\)/);
  assert.match(source, /nativeActions\?\.saveFile\(\{[\s\S]*url:\s*targetUrl/);
});
