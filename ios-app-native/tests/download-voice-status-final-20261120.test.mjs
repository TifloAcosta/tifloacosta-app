import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../Sources/${name}`, import.meta.url), 'utf8');

test('External voice and download status messages are not hardcoded Spanish', () => {
  for (const file of ['NativeReaderExternalVoiceCredentials.swift','NativeDownloads.swift']) {
    const content = read(file);
    assert.doesNotMatch(content, /\b(?:message|status)\s*=\s*"[^"\n]*[A-Za-zÁÉÍÓÚáéíóúñÑ][^"\n]*"/, file);
  }
  for (const file of ['NativeCloudGooglePickerScreen.swift','NativeCloudFolderBrowserScreen.swift']) {
    assert.doesNotMatch(read(file), /(?:error|alertMessage)\s*=\s*"No hay una conexión permitida/);
  }
});

test('Download and voice-service notices have translations in every app language', () => {
  const keys = [
    'No hay texto copiado. Vuelve a Google, copia la clave y regresa.',
    'Clave copiada en el campo. Pulsa Guardar para almacenarla de forma segura.',
    'No hay ninguna clave guardada.',
    'Gemini respondió, pero no devolvió audio compatible.',
    'Prueba de voz correcta. Gemini está preparado para leer y convertir documentos.',
    'Google rechazó la clave o sus permisos. Revisa Google AI Studio.',
    'No se pudo generar la muestra de voz: %@',
    'No hay una clave de texto copiada. Abre Crear clave API con guía e inténtalo de nuevo.',
    'Clave guardada en el dispositivo. Pulsa Comprobar conexión.',
    'Clave eliminada.',
    'Enlace de Google Drive reconocido, pero no se pudo verificar el acceso previamente. Prueba Descargar. Si falla, abre el enlace original y revisa sus permisos.',
    '%@ reconocido. %@', 'Descargando archivo…',
    'Archivo descargado en TifloAcosta: %@. Está disponible en Mis descargas para importar a TifloLector o compartir.',
    'La descarga ha agotado el tiempo de espera. Comprueba la conexión.',
    'No hay conexión a Internet disponible para descargar.',
    'No fue posible descargar el archivo. Comprueba el enlace y vuelve a intentarlo.',
    'No se pudo guardar el archivo: %@',
  ];
  for (const code of ['en','pt','fr','it','de']) {
    const catalog = read(`${code}.lproj/Localizable.strings`);
    for (const key of keys) assert.ok(catalog.includes(`"${key}" = `), `${code}: ${key}`);
  }
});
