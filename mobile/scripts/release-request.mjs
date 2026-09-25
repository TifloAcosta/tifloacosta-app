import { readFile } from 'node:fs/promises';

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const ALLOWED_TRACKS = new Set(['internal', 'alpha', 'beta', 'production']);
const ALLOWED_STATUSES = new Set(['draft', 'completed']);

function fail(message) {
  throw new TypeError(`Invalid release request: ${message}`);
}

function cleanNote(value, language) {
  const note = typeof value === 'string' ? value.trim() : '';
  if (!note) fail(`missing ${language} release notes`);
  return note;
}

export function parseReleaseRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object');

  const versionName = typeof value.versionName === 'string' ? value.versionName.trim() : '';
  const track = typeof value.track === 'string' ? value.track.trim().toLowerCase() : '';
  const status = typeof value.status === 'string' ? value.status.trim().toLowerCase() : '';
  const priority = value.priority;
  const notifyUpdate = value.notifyUpdate;

  if (!VERSION_RE.test(versionName)) fail('versionName must use x.y.z');
  if (!ALLOWED_TRACKS.has(track)) fail('unsupported Google Play track');
  if (!ALLOWED_STATUSES.has(status)) fail('status must be draft or completed');
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) fail('priority must be an integer from 0 to 5');
  if (typeof notifyUpdate !== 'boolean') fail('notifyUpdate must be true or false');

  return {
    versionName,
    track,
    status,
    priority,
    notifyUpdate,
    notes: {
      es: cleanNote(value.notes?.es, 'Spanish'),
      en: cleanNote(value.notes?.en, 'English')
    }
  };
}

export async function readReleaseRequest(path) {
  const raw = await readFile(path, 'utf8');
  return parseReleaseRequest(JSON.parse(raw));
}

export function artifactNames({ versionName, versionCode } = {}) {
  if (!VERSION_RE.test(String(versionName || '').trim())) {
    throw new TypeError('Invalid release versionName');
  }
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new TypeError('Invalid release versionCode');
  }

  const stem = `TifloAcosta-Android-${versionName}-code${versionCode}`;
  return {
    aab: `${stem}.aab`,
    apk: `${stem}-debug.apk`,
    zip: `${stem}.zip`
  };
}
