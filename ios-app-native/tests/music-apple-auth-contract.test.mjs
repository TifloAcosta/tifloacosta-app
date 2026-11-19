import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = (name) => {
  const path = new URL(`../Sources/${name}`, import.meta.url);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

test('Apple Music uses native per-user consent and checks subscription before playing', () => {
  const service = source('NativeAppleMusicService.swift');
  assert.match(service, /MusicAuthorization\.request\(/);
  assert.match(service, /MusicSubscription\.current/);
  assert.match(service, /canPlayCatalogContent/);
  assert.match(service, /guard.*authorizationStatus.*authorized/s);
});

test('Apple Music connection is optional in Mi Música', () => {
  const screen = source('NativeMyMusic.swift');
  assert.match(screen, /NativeAppleMusicService\(/);
  assert.match(screen, /Section\("Apple Music"\)/);
  assert.match(screen, /Conectar Apple Music/);
  assert.match(screen, /Mi biblioteca/);
});
