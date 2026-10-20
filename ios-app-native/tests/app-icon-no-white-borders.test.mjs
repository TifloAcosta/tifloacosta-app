import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('El AppIcon no conserva las esquinas blancas de la imagen de origen', () => {
  const icon = read('ios-app-native/scripts/make-app-icon.swift');
  const project = read('ios-app-native/scripts/prepare-testflight-project.mjs');
  const release = read('.github/workflows/ios-native-testflight-upload.yml');
  const validation = read('.github/workflows/ios-native-swiftui-build.yml');

  // No puede bastar con ampliar a 1024 píxeles la imagen original con
  // esquinas redondeadas: iOS ya recorta las esquinas de forma nativa.
  assert.match(icon, /func isExteriorLight\(/);
  assert.match(icon, /func enqueueExterior\(/);
  assert.match(icon, /while cursor < queue\.count/);
  assert.match(icon, /for index in queue/);
  assert.match(icon, /guard pixels\[offset\] == navy\.0/);
  assert.match(icon, /exported\.pixelsWide == dimension/);
  assert.match(icon, /exported\.pixelsHigh == dimension/);
  assert.match(icon, /!exported\.hasAlpha/);
  assert.match(project, /AppIcon\.png/);

  // Tanto las comprobaciones como la subida real usan el mismo generador.
  const invocation = 'swift ios-app-native/scripts/make-app-icon.swift tifloacosta-icon-512.png';
  assert.ok(release.includes(invocation), 'La distribución debe regenerar el icono');
  assert.ok(validation.includes(invocation), 'El CI debe comprobar el icono');
});
