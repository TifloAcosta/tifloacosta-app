import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeReaderExternalVoiceCredentials.swift', import.meta.url), 'utf8');

test('La guía Gemini devuelve el foco al pegado al cerrar Google AI Studio', () => {
  assert.match(source, /\.sheet\(isPresented: \$showGoogle, onDismiss:/);
  assert.match(source, /focusPasteButton = true/);
  assert.match(source, /\.accessibilityFocused\(\$focusPasteButton\)/);
  assert.match(source, /NativeGeminiKeyBrowser\(isPresented: \$showGoogle\)/);
  assert.match(source, /func safariViewControllerDidFinish\(_ controller: SFSafariViewController\)/);
  assert.match(source, /parent\.isPresented = false/);
});

test('Después de copiar la clave, Guardar recibe el foco VoiceOver', () => {
  assert.match(source, /returnedFromGeminiGuide = true/);
  assert.match(source, /\.sheet\(isPresented: \$showGeminiGuide, onDismiss:/);
  assert.match(source, /focusGeminiSave = true/);
  assert.match(source, /focusGeminiPaste = true/);
  assert.match(source, /\.accessibilityFocused\(\$focusGeminiSave\)/);
});

test('Gemini solo lee portapapeles por iniciativa del usuario y guarda en Keychain', () => {
  assert.match(source, /Button\("Pegar la clave copiada"\)/);
  assert.match(source, /Button\("Pegar clave copiada"\)/);
  assert.match(source, /UIPasteboard\.general\.string/);
  assert.match(source, /NativeVoiceCredentialStore\.save\(keyInput, provider: "gemini"\)/);
  assert.match(source, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  assert.doesNotMatch(source, /\.onAppear\s*\{[^}]*UIPasteboard/s);
});

test('La guía expone un único paso principal y evita controles innecesarios', () => {
  assert.match(source, /hasVisitedGoogle \? "Paso 2 de 2\. Pegar" : "Paso 1 de 2\. Crear y copiar"/);
  assert.match(source, /if !hasVisitedGoogle \{/);
  assert.match(source, /Button\("Abrir creación de clave en Google"\)/);
  assert.match(source, /Button\("Volver a Google AI Studio"\)/);
  assert.match(source, /hasVisitedGoogle = true/);
});

test('Después de Guardar, VoiceOver se dirige a Comprobar conexión', () => {
  assert.match(source, /@AccessibilityFocusState private var focusGeminiCheck: Bool/);
  assert.match(source, /focusGeminiCheck = true/);
  assert.match(source, /Button\("Comprobar conexión"\)/);
  assert.match(source, /\.accessibilityFocused\(\$focusGeminiCheck\)/);
});
