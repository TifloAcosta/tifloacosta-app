import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public privacy policy documents current Android TifloLector local processing', async () => {
  const html = await read('privacidad/index.html');

  for (const token of [
    '6 de octubre de 2026',
    'espacio privado de la aplicación',
    'excluidos de la copia de seguridad en la nube',
    'transferencia automática de datos entre dispositivos',
    'componentes de traducción en el dispositivo',
    'componentes de reconocimiento de texto en el dispositivo',
    'October 6, 2026',
    'app private space on the device',
    'excluded from Android cloud backup',
    'on-device components'
  ]) {
    assert.ok(html.includes(token), `Missing Android privacy disclosure: ${token}`);
  }

  assert.ok(html.includes('TifloAcosta no envía el texto del documento a un servicio de traducción propio.'));
  assert.ok(html.includes('TifloAcosta no envía el contenido del documento o de la imagen a un servidor propio'));
});

test('mobile privacy screen keeps the same Android privacy promises visible in-app', async () => {
  const screen = await read('mobile/src/screens/privacy.mjs');

  for (const token of [
    'espacio privado de la aplicación',
    'componentes en el dispositivo',
    'modelos de idioma',
    'copia de seguridad en la nube',
    'transferencia automática entre dispositivos',
    'app private space on this device',
    'on-device components',
    'language models',
    'cloud backup',
    'device-to-device transfer'
  ]) {
    assert.ok(screen.includes(token), `Missing in-app Android privacy disclosure: ${token}`);
  }
});
