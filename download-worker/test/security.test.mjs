import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicUrl } from '../src/security.js';

const blocked = [
  'http://localhost/test', 'http://127.0.0.1/a', 'http://127.99.2.3/a',
  'http://10.0.0.1/a', 'http://172.16.0.1/a', 'http://172.31.255.255/a',
  'http://192.168.1.1/a', 'http://169.254.169.254/latest/meta-data',
  'http://[::1]/a', 'http://[fc00::1]/a', 'http://[fe80::1]/a',
  'http://printer.local/a', 'http://metadata.google.internal/computeMetadata/v1/',
  'file:///tmp/a.pdf', 'javascript:alert(1)'
];

test('blocks local, private, metadata and unsafe destinations', () => {
  for (const value of blocked) assert.equal(validatePublicUrl(value).ok, false, value);
});

test('accepts normal public http and https URLs', () => {
  assert.equal(validatePublicUrl('https://example.com/file.pdf').ok, true);
  assert.equal(validatePublicUrl('http://example.org/page').ok, true);
});
