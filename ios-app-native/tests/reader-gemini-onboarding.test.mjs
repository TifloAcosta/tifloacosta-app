import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');
const gemini = readFileSync(new URL('../Sources/NativeGeminiSetup.swift', import.meta.url), 'utf8');

test('los ajustes ofrecen acceso a la configuración accesible de Gemini', () => {
  assert.match(settings, /NativeGeminiSetupScreen\(\)/);
});

test('el navegador integrado regresa al campo de clave con foco VoiceOver', () => {
  assert.match(gemini, /SFSafariViewController/);
  assert.match(gemini, /onDismiss: \{ returnToKeyField\(\) \}/);
  assert.match(gemini, /private func returnToKeyField\(\)[\s\S]*focusAPIKey = true/);
  assert.match(gemini, /accessibilityFocused\(\$focusAPIKey\)/);
  assert.match(gemini, /Button\("Pegar clave copiada"\)/);
});

test('las credenciales no se guardan en UserDefaults y la clave no se anuncia', () => {
  assert.match(gemini, /SecItemAdd/);
  assert.match(gemini, /SecItemCopyMatching/);
  assert.match(gemini, /SecItemDelete/);
  assert.doesNotMatch(gemini, /UserDefaults/);
  assert.match(gemini, /x-goog-api-key/);
});
