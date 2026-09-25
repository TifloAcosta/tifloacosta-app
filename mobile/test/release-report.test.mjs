import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReleaseInfo,
  buildGithubSummary,
  buildPlayNotes
} from '../scripts/release-report.mjs';

const data = {
  versionName: '1.3.2',
  versionCode: 11,
  track: 'alpha',
  status: 'draft',
  commit: 'abc123',
  date: '2026-09-25',
  checks: {
    tests: true,
    signing: true,
    aab: true,
    apk: true,
    oneSignal: true
  },
  publication: 'BORRADOR',
  updateNotification: 'NO ENVIADA',
  artifact: 'TifloAcosta-Android-1.3.2-code11.zip'
};

test('plain-text report is linear and explicit for screen readers', () => {
  const text = buildReleaseInfo(data);
  assert.match(text, /Versión: 1\.3\.2/);
  assert.match(text, /Código: 11/);
  assert.match(text, /Firma: CORRECTA/);
  assert.match(text, /OneSignal: CORRECTO/);
  assert.match(text, /Paquete: TifloAcosta-Android-1\.3\.2-code11\.zip/);
  assert.doesNotMatch(text, /\|/);
  assert.ok(text.split('\n').every(line => !line.includes('\t')));
});

test('GitHub summary stays short and avoids wide tables', () => {
  const text = buildGithubSummary(data);
  assert.match(text, /^# Compilación Android/m);
  assert.match(text, /- Versión: 1\.3\.2/);
  assert.match(text, /- AAB: CORRECTO/);
  assert.match(text, /- Publicación: BORRADOR/);
  assert.doesNotMatch(text, /\|/);
});

test('Play notes are deterministic Spanish then English language blocks', () => {
  const text = buildPlayNotes({
    notes: {
      es: 'Mejoras de Novedades y accesibilidad.',
      en: 'Improvements to What\'s New and accessibility.'
    }
  });
  assert.equal(text,
    '<es-ES>\nMejoras de Novedades y accesibilidad.\n</es-ES>\n\n' +
    '<en-US>\nImprovements to What\'s New and accessibility.\n</en-US>\n');
});
