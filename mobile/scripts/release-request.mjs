import { readFile } from 'node:fs/promises';

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const ALLOWED_TRACKS = new Set(['alpha', 'beta', 'production']);
const ALLOWED_STATUSES = new Set(['draft', 'completed']);

function fail(message) {
  throw new TypeError(`Invalid release request: ${message}`);
}

function cleanNote(value, language) {
  const note = typeof value === 'string' ? value.trim() : '';
  if (!note) fail(`missing ${language} release notes`);
  return note;
}

export function parseReleaseRequest(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object');

  const versionName = String(value.versionName || '').trim();
  const track = String(value.track || '').trim().toLowerCase();
  const status = String(value.status || 'draft').trim().toLowerCase();
  const priority = Number(value.priority ?? 0);
  const notifyUpdate = value.notifyUpdate === true;

  if (!VERSION_RE.test(versionName)) fail('versionName must use x.y.z');
  if (!ALLOWED_TRACKS.has(track)) fail('unsupported Google Play track');
  if (!ALLOWED_STATUSES.has(status)) fail('status must be draft or completed');
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) fail('priority must be an integer from 0 to 5');
  if (track === 'production' && value.confirmProduction !== true) {
    fail('production requires confirmProduction=true');
  }

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
