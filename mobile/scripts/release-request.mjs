import { readFile } from 'node:fs/promises';

const RELEASE_STATUSES = new Set(['draft', 'completed', 'inProgress', 'halted']);
const RELEASE_TRACKS = new Set(['internal', 'alpha', 'beta', 'production']);

function cleanText(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function fail(message) {
  throw new Error(`Invalid release request: ${message}`);
}

export function parseReleaseRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('expected an object');

  const versionName = cleanText(value.versionName, 64);
  const track = cleanText(value.track, 32);
  const status = cleanText(value.status, 32);
  const priority = Number(value.priority);
  const notifyUpdate = value.notifyUpdate === true;
  const notes = {
    es: cleanText(value.notes?.es),
    en: cleanText(value.notes?.en)
  };

  if (!/^\d+\.\d+\.\d+$/.test(versionName)) fail('versionName must use x.y.z');
  if (!RELEASE_TRACKS.has(track)) fail('unsupported track');
  if (!RELEASE_STATUSES.has(status)) fail('unsupported status');
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) fail('priority must be an integer from 0 to 5');
  if (!notes.es || !notes.en) fail('Spanish and English release notes are required');

  if (track === 'production' && value.confirmProduction !== true) {
    throw new Error('Production release requires explicit confirmProduction=true');
  }

  return { versionName, track, status, priority, notifyUpdate, notes };
}

export async function readReleaseRequest(path) {
  const raw = await readFile(path, 'utf8');
  return parseReleaseRequest(JSON.parse(raw));
}

export function artifactNames({ versionName, versionCode } = {}) {
  const version = cleanText(versionName, 64);
  const code = Number(versionCode);
  if (!/^\d+\.\d+\.\d+$/.test(version) || !Number.isInteger(code) || code < 1) {
    fail('valid versionName and positive versionCode are required for artifact names');
  }
  const stem = `TifloAcosta-Android-${version}-code${code}`;
  return {
    aab: `${stem}.aab`,
    apk: `${stem}-debug.apk`,
    zip: `${stem}.zip`
  };
}
