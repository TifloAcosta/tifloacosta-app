import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseRequest, artifactNames } from '../scripts/release-request.mjs';

test('accepts a closed-test release request', () => {
  assert.deepEqual(parseReleaseRequest({
    versionName: '1.3.2',
    track: 'alpha',
    status: 'completed',
    priority: 2,
    notifyUpdate: true,
    notes: { es: 'Mejoras de accesibilidad.', en: 'Accessibility improvements.' }
  }), {
    versionName: '1.3.2',
    track: 'alpha',
    status: 'completed',
    priority: 2,
    notifyUpdate: true,
    notes: { es: 'Mejoras de accesibilidad.', en: 'Accessibility improvements.' }
  });
});

test('rejects malformed versions and invalid priorities', () => {
  assert.throws(() => parseReleaseRequest({
    versionName: 'v1',
    track: 'alpha',
    status: 'completed',
    priority: 6,
    notifyUpdate: true,
    notes: { es: 'x', en: 'y' }
  }), /release request/i);
});

test('requires explicit confirmation for production', () => {
  assert.throws(() => parseReleaseRequest({
    versionName: '1.3.2',
    track: 'production',
    status: 'completed',
    priority: 2,
    notifyUpdate: true,
    notes: { es: 'x', en: 'y' }
  }), /production/i);
});

test('creates screen-reader-friendly artifact names', () => {
  assert.deepEqual(artifactNames({ versionName: '1.3.2', versionCode: 11 }), {
    aab: 'TifloAcosta-Android-1.3.2-code11.aab',
    apk: 'TifloAcosta-Android-1.3.2-code11-debug.apk',
    zip: 'TifloAcosta-Android-1.3.2-code11.zip'
  });
});