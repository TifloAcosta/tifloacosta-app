import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../Sources/NativeAudiusService.swift', import.meta.url);
const service = existsSync(file) ? readFileSync(file, 'utf8') : '';
const screen = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('Audius only fetches public catalog data and streams without credentials', () => {
  assert.match(service, /https:\/\/api\.audius\.co\/v1\/tracks\/search/);
  assert.match(service, /URLSession\.shared\.data\(/);
  assert.match(service, /AVPlayer\(/);
  assert.doesNotMatch(service, /clientSecret|privateKey|AuthKey_/);
});

test('Audius browsing is an optional independent section in Mi Música', () => {
  assert.match(screen, /Section\("Audius"\)/);
  assert.match(screen, /Buscar en Audius/);
  assert.match(screen, /Pausar Audius/);
  assert.match(screen, /Section\("Mi biblioteca"\)/);
});
