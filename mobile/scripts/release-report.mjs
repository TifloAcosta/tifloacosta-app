function status(ok, good = 'CORRECTO', bad = 'ERROR') {
  return ok ? good : bad;
}

export function buildReleaseInfo(data = {}) {
  return [
    'COMPILACIÓN ANDROID',
    '',
    `Versión: ${data.versionName || ''}`,
    `Código: ${data.versionCode ?? ''}`,
    `Fecha: ${data.date || ''}`,
    `Commit: ${data.commit || ''}`,
    `Pista: ${data.track || ''}`,
    `Estado: ${data.status || ''}`,
    `Pruebas: ${status(data.checks?.tests, 'CORRECTAS')}`,
    `Firma: ${status(data.checks?.signing, 'CORRECTA')}`,
    `AAB: ${status(data.checks?.aab)}`,
    `APK: ${status(data.checks?.apk)}`,
    `OneSignal: ${status(data.checks?.oneSignal)}`,
    `Publicación: ${data.publication || ''}`,
    `Aviso de actualización: ${data.updateNotification || ''}`,
    `Paquete: ${data.artifact || ''}`,
    ''
  ].join('\n');
}

export function buildGithubSummary(data = {}) {
  return [
    '# Compilación Android',
    '',
    `- Versión: ${data.versionName || ''}`,
    `- Código: ${data.versionCode ?? ''}`,
    `- Pruebas: ${status(data.checks?.tests, 'CORRECTAS')}`,
    `- Firma: ${status(data.checks?.signing, 'CORRECTA')}`,
    `- AAB: ${status(data.checks?.aab)}`,
    `- APK: ${status(data.checks?.apk)}`,
    `- OneSignal: ${status(data.checks?.oneSignal)}`,
    `- Pista: ${data.track || ''}`,
    `- Publicación: ${data.publication || ''}`,
    `- Aviso de actualización: ${data.updateNotification || ''}`,
    `- Paquete: ${data.artifact || ''}`,
    ''
  ].join('\n');
}

export function buildPlayNotes(request = {}) {
  const es = String(request.notes?.es || '').trim();
  const en = String(request.notes?.en || '').trim();
  return `<es-ES>\n${es}\n</es-ES>\n\n<en-US>\n${en}\n</en-US>\n`;
}
