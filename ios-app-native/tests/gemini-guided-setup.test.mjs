import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../Sources/NativeReaderExternalVoiceCredentials.swift', import.meta.url), 'utf8');

test('la portada de motores muestra solo un enlace por proveedor', () => {
  const start = source.indexOf('struct NativeReaderExternalVoiceSettingsScreen: View');
  const end = source.indexOf('struct NativeReaderExternalVoiceDetailScreen: View');
  const overview = source.slice(start, end);
  assert.match(overview, /NavigationLink\("Phonon"\)/);
  assert.match(overview, /NavigationLink\("Gemini"\)/);
  assert.equal((overview.match(/NavigationLink\(/g) || []).length, 2);
  assert.doesNotMatch(overview, /SecureField|Descargar modelo|Picker\(/);
});
test('la guía Gemini conserva la navegación en TifloLector y requiere pegado explícito', () => {
  assert.match(source, /SFSafariViewController\(url: url\)/);
  assert.match(source, /https:\/\/aistudio\.google\.com\/api-keys/);
  assert.match(source, /Tres pasos/);
  assert.match(source, /Pegar la clave copiada/);
  assert.match(source, /UIPasteboard\.general\.string/);
  assert.match(source, /showGeminiGuide/);
  assert.match(source, /NativeVoiceCredentialStore\.save\(keyInput, provider: "gemini"\)/);
});
