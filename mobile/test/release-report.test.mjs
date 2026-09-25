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
  date: '2026-09-25T15:00:00Z',
  artifact: 'TifloAcosta-Android-1.3.2-code11.zip',
  checks: {
    tests: true,
    signing: true,
    aab: true,
    apk: true,
    notifications: true
  },
  play: { uploaded: true, committed: false },
  notification: { sent: false }
};

test('plain build information is linear and screen-reader friendly', () => {
  const text = buildReleaseInfo(data);
  assert.match(text, /Versión: 1\.3\.2/);
  assert.match(text, /Código: 11/);
  assert.match(text, /Firma: CORRECTA/);
  assert.match(text, /Google Play: SUBIDO COMO BORRADOR/);
  assert.match(text, /Paquete: TifloAcosta-Android-1\.3\.2-code11\.zip/);
  assert.doesNotMatch(text, /\|/);
});

test('GitHub summary stays short and avoids wide tables', () => {
  const text = buildGithubSummary(data);
  assert.match(text, /COMPILACIÓN ANDROID/);
  assert.match(text, /1\.3\.2/);
  assert.match(text, /código 11/i);
  assert.doesNotMatch(text, /\|\s*---/);
});

test('Play notes produce deterministic Spanish and English blocks', () => {
  const text = buildPlayNotes({
    notes: { es: 'Mejoras de Novedades.', en: 'News improvements.' }
  });
  assert.equal(text, '<es-ES>\nMejoras de Novedades.\n</es-ES>\n\n<en-US>\nNews improvements.\n</en-US>\n');
});
