function mark(value) {
  return value ? 'CORRECTO' : 'FALLO';
}

function playStatus(play = {}) {
  if (play.committed) return 'PUBLICADO';
  if (play.uploaded) return 'SUBIDO COMO BORRADOR';
  return 'NO SUBIDO';
}

export function buildReleaseInfo(data = {}) {
  const lines = [
    'COMPILACIÓN ANDROID TIFLOACOSTA',
    '',
    `Versión: ${data.versionName || ''}`,
    `Código: ${data.versionCode ?? ''}`,
    `Fecha: ${data.date || ''}`,
    `Commit: ${data.commit || ''}`,
    `Pista: ${data.track || ''}`,
    `Estado: ${data.status || ''}`,
    '',
    `Pruebas: ${mark(data.checks?.tests)}`,
    `Firma: ${data.checks?.signing ? 'CORRECTA' : 'FALLO'}`,
    `AAB: ${mark(data.checks?.aab)}`,
    `APK: ${mark(data.checks?.apk)}`,
    `Notificaciones: ${mark(data.checks?.notifications)}`,
    `Google Play: ${playStatus(data.play)}`,
    `Aviso de actualización: ${data.notification?.sent ? 'ENVIADO' : 'NO ENVIADO'}`,
    `Paquete: ${data.artifact || ''}`,
    ''
  ];
  return lines.join('\n');
}

export function buildGithubSummary(data = {}) {
  const ok = data.checks && Object.values(data.checks).every(Boolean);
  return [
    '# COMPILACIÓN ANDROID',
    '',
    `- Resultado: ${ok ? 'CORRECTO' : 'REVISAR'}`,
    `- Versión ${data.versionName || ''}, código ${data.versionCode ?? ''}`,
    `- Pista: ${data.track || ''}`,
    `- Firma: ${data.checks?.signing ? 'correcta' : 'fallo'}`,
    `- AAB: ${data.checks?.aab ? 'correcto' : 'fallo'}`,
    `- APK: ${data.checks?.apk ? 'correcto' : 'fallo'}`,
    `- Google Play: ${playStatus(data.play).toLowerCase()}`,
    `- Aviso de actualización: ${data.notification?.sent ? 'enviado' : 'no enviado'}`,
    `- Paquete: ${data.artifact || ''}`,
    ''
  ].join('\n');
}

export function buildPlayNotes(request = {}) {
  const es = String(request.notes?.es || '').trim();
  const en = String(request.notes?.en || '').trim();
  if (!es || !en) throw new TypeError('Spanish and English release notes are required');
  return `<es-ES>\n${es}\n</es-ES>\n\n<en-US>\n${en}\n</en-US>\n`;
}
