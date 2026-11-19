import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../Sources/NativeJamendoService.swift', import.meta.url);
const service = existsSync(file) ? readFileSync(file, 'utf8') : '';
const screen = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('Jamendo uses application client ID for read-only search and HTTPS streams', () => {
  assert.match(service, /api\.jamendo\.com\/v3\.0\/tracks/);
  assert.match(service, /client_id/);
  assert.match(service, /URLSession\.shared\.data\(/);
  assert.match(service, /https/);
  assert.match(service, /AVPlayer\(/);
  assert.doesNotMatch(service, /client_secret|clientSecret|AuthKey_/);
});

test('Jamendo is an optional accessible source in Mi Música', () => {
  assert.match(screen, /Section\("Jamendo"\)/);
  assert.match(screen, /Buscar en Jamendo/);
  assert.match(screen, /Pausar Jamendo/);
  assert.match(screen, /Section\("Mi biblioteca"\)/);
});
