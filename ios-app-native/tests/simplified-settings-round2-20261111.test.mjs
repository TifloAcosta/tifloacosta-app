import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = source('NativeReaderSettings.swift');
const reader = source('NativeTifloLector.swift');
const ocr = source('NativeReaderAdvanced.swift');

test('Modo de lectura y avance se ajustan en la primera pantalla, sin submenú', () => {
  assert.match(settings, /title: "Modo de lectura"/);
  assert.match(settings, /title: "Unidad de avance"/);
  assert.doesNotMatch(settings, /NavigationLink\("Modo de lectura"\)|NavigationLink\("Navegación y avances"\)/);
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\)/);
  assert.match(settings, /@AppStorage\("native-reader-navigation-unit"\)/);
});

test('Opciones de audio muestran solo ajustes que pertenecen al motor elegido', () => {
  const start = settings.indexOf('struct NativeReaderAudioControls: View');
  const end = settings.indexOf('struct NativeReaderVisualControls: View', start);
  const audio = settings.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(audio, /if chosenEngine == 0 \{/);
  const systemOnly = audio.slice(audio.indexOf('if chosenEngine == 0 {'));
  for (const title of ['Tono de lectura', 'Mostrar voces', 'Voz del sistema']) {
    assert.ok(systemOnly.includes('title: "' + title + '"'), title);
  }
  assert.match(systemOnly, /NativeReaderPunctuationControls\(\)/);
  assert.match(audio, /title: "Velocidad de voz"/);
});

test('Visual usa un interruptor estándar y no ofrece un selector de dos estados', () => {
  assert.match(settings, /Toggle\("Texto reforzado", isOn: strongTextBinding\)/);
  assert.doesNotMatch(settings, /title: "Texto reforzado",\s*choices: \["Desactivado", "Activado"\]/);
  assert.match(settings, /strongTextSelection: Binding\(/);
});

test('OCR tiene dos ajustables directos sin texto explicativo navegable', () => {
  assert.match(ocr, /title: "Idioma del OCR"/);
  assert.match(ocr, /title: "Precisión del OCR"/);
  assert.doesNotMatch(ocr, /Section\("Reconocimiento de texto"\)/);
});

test('Búsqueda y carpetas no requieren pasar por encabezados antes del control', () => {
  assert.match(reader, /Button\("Carpetas"\) \{ showFolderPicker = true \}/);
  assert.doesNotMatch(reader, /Button\("Ver por carpetas"\)/);
  assert.match(reader, /TextField\("Palabra o frase", text: \$documentSearchText\)/);
  assert.doesNotMatch(reader, /Section\("Texto que quieres buscar"\)/);
  assert.match(reader, /Button\("Volver a donde estaba leyendo"\)/);
});

test('El borrado de libros y las claves de voz mantienen sus confirmaciones y protecciones', () => {
  assert.match(reader, /confirmationDialog\("Eliminar documentos seleccionados"/);
  assert.match(reader, /role: \.destructive/);
  assert.match(settings, /library\.resetPreferences\(document\)/);
  assert.match(settings, /NativeVoiceCredentialStore\.hasKey\("gemini"\)/);
  assert.match(settings, /Gemini necesita una clave API guardada en Motores externos/);
});
