function status(value) {
  return value ? 'CORRECTO' : 'FALLO';
}

export function buildReleaseInfo(data = {}) {
  const checks = data.checks || {};
  return [
    'COMPILACIÓN ANDROID',
    `Versión: ${data.versionName || ''}`,
    `Código: ${data.versionCode ?? ''}`,
    `Pista: ${data.track || ''}`,
    `Estado: ${data.status || ''}`,
    `Commit: ${data.commit || ''}`,
    `Pruebas: ${status(checks.tests)}`,
    `Firma: ${checks.signing ? 'CORRECTA' : 'FALLO'}`,
    `AAB: ${status(checks.aab)}`,
    `APK: ${status(checks.apk)}`,
    `OneSignal: ${status(checks.oneSignal)}`,
    ''
  ].join('\n');
}

export function buildGithubSummary(data = {}) {
  const checks = data.checks || {};
  return [
    '## Compilación Android',
    '',
    `- Versión: ${data.versionName || ''}`,
    `- Código: ${data.versionCode ?? ''}`,
    `- Pista: ${data.track || ''}`,
    `- Estado: ${data.status || ''}`,
    `- Pruebas: ${status(checks.tests)}`,
    `- Firma: ${checks.signing ? 'CORRECTA' : 'FALLO'}`,
    `- AAB: ${status(checks.aab)}`,
    `- APK: ${status(checks.apk)}`,
    `- OneSignal: ${status(checks.oneSignal)}`,
    data.artifact ? `- Paquete: ${data.artifact}` : '',
    ''
  ].filter(Boolean).join('\n');
}

export function buildPlayNotes(request = {}) {
  const es = String(request?.notes?.es || '').trim();
  const en = String(request?.notes?.en || '').trim();
  return `<es-ES>\n${es}\n</es-ES>\n\n<en-US>\n${en}\n</en-US>\n`;
}
