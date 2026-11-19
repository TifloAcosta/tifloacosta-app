import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const base = '../android-native-prototype/app/src/main/java/com/tifloacosta/nativeprototype/';
const read = (name) => {
  const path = new URL(base + name, import.meta.url);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

test('Android Jamendo uses the public read API and does not embed a client secret', () => {
  const client = read('NativeJamendo.kt');
  assert.match(client, /api\.jamendo\.com\/v3\.0\/tracks/);
  assert.match(client, /client_id/);
  assert.match(client, /MediaPlayer/);
  assert.doesNotMatch(client, /client_secret|clientSecret/);
});

test('Android Mi Música presents optional Jamendo search and playback actions', () => {
  const screen = read('NativeMyMusic.kt');
  assert.match(screen, /Buscar en Jamendo/);
  assert.match(screen, /Pausar Jamendo/);
});
