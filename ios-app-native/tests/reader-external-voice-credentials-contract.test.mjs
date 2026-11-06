import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const voices = readFileSync(new URL('NativeReaderExternalVoiceCredentials.swift', root), 'utf8');
const settings = readFileSync(new URL('NativeReaderSettings.swift', root), 'utf8');

test('Gemini credential is stored in Keychain and not UserDefaults', () => {
  assert.match(voices, /SecItemAdd/);
  assert.match(voices, /SecItemUpdate/);
  assert.match(voices, /SecItemDelete/);
  assert.match(voices, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.doesNotMatch(voices, /UserDefaults/);
});

test('API setup is accessible and does not claim synthesis is working', () => {
  assert.match(settings, /NavigationLink\("Motores externos"\)/);
  assert.match(voices, /SecureField\("Pegar clave"/);
  assert.match(voices, /Button\("Guardar"\)/);
  assert.match(voices, /Button\("Eliminar", role: \.destructive\)/);
  assert.match(voices, /Button\("Comprobar"\)/);
  assert.match(voices, /Conexión correcta\. La generación de audio todavía no está activada/);
  assert.match(voices, /Phonon/);
  assert.match(voices, /No necesitan clave API/);
});
