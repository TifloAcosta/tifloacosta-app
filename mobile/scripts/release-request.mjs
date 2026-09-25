import { readFile } from 'node:fs/promises';

const TRACKS = new Set(['alpha', 'beta', 'production']);
const STATUSES = new Set(['draft', 'completed']);

function fail(message) {
  throw new Error(`Invalid release request: ${message}`);
}

export function parseReleaseRequest(value = {}) {
  const versionName = String(value.versionName || '').trim();
  const track = String(value.track || '').trim();
  const status = String(value.status || 'draft').trim();
  const priority = Number(value.priority ?? 0);
  const notifyUpdate = value.notifyUpdate === true;
  const notes = {
    es: String(value.notes?.es || '').trim(),
    en: String(value.notes?.en || '').trim()
  };

  if (!/^\d+\.\d+\.\d+$/.test(versionName)) fail('versionName must use x.y.z');
  if (!TRACKS.has(track)) fail('unknown track');
  if (!STATUSES.has(status)) fail('unknown status');
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) fail('priority must be 0-5');
  if (!notes.es || !notes.en) fail('Spanish and English notes are required');
  if (track === 'production' && value.confirmProduction !== true) fail('production requires confirmProduction=true');

  return { versionName, track, status, priority, notifyUpdate, notes };
}

export async function readReleaseRequest(path) {
  return parseReleaseRequest(JSON.parse(await readFile(path, 'utf8')));
}

export function artifactNames({ versionName, versionCode }) {
  const stem = `TifloAcosta-Android-${versionName}-code${versionCode}`;
  return {
    aab: `${stem}.aab`,
    apk: `${stem}-debug.apk`,
    zip: `${stem}.zip`
  };
}
