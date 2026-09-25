import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseInfo, buildGithubSummary, buildPlayNotes } from '../scripts/release-report.mjs';

const data = {
  versionName: '1.3.2',
  versionCode: 11,
  track: 'alpha',
  status: 'draft',
  commit: 'abc123',
  checks: { tests: true, signing: true, aab: true, apk: true, oneSignal: true }
};

test('plain-text report is linear and explicit', () => {
  const text = buildReleaseInfo(data);
  assert.match(text, /Versión: 1\.3\.2/);
  assert.match(text, /Código: 11/);
  assert.match(text, /Firma: CORRECTA/);
  assert.doesNotMatch(text, /\|/);
});

test('GitHub summary avoids wide tables', () => {
  const text = buildGithubSummary(data);
  assert.match(text, /## Compilación Android/);
  assert.match(text, /Versión: 1\.3\.2/);
  assert.doesNotMatch(text, /\| ---/);
});

test('Play notes contain Spanish and English blocks', () => {
  const text = buildPlayNotes({ notes: { es: 'Cambios.', en: 'Changes.' } });
  assert.match(text, /<es-ES>\nCambios\.\n<\/es-ES>/);
  assert.match(text, /<en-US>\nChanges\.\n<\/en-US>/);
});
