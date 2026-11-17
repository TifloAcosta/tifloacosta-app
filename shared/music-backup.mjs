const FORMAT = 'tifloacosta-mi-musica';
const VERSION = 1;

function safeArray(value) { return Array.isArray(value) ? value : []; }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }

export function createMusicBackup(state, createdAt = new Date().toISOString()) {
  return {
    format: FORMAT,
    version: VERSION,
    createdAt,
    includesAudioFiles: false,
    catalog: { version: 1, tracks: { ...safeObject(state?.catalog?.tracks) } },
    folders: safeArray(state?.folders),
    playlists: safeArray(state?.playlists),
    audioProfiles: safeObject(state?.audioProfiles),
  };
}

export function readMusicBackup(input) {
  let decoded;
  try { decoded = typeof input === 'string' ? JSON.parse(input) : input; }
  catch { throw new TypeError('El respaldo de Mi Música no contiene JSON válido'); }
  if (!decoded || decoded.format !== FORMAT) throw new TypeError('No es un respaldo de Mi Música');
  if (decoded.version !== VERSION) throw new RangeError('Versión de respaldo de Mi Música no compatible');
  if (!decoded.catalog || !decoded.catalog.tracks || Array.isArray(decoded.catalog.tracks) || typeof decoded.catalog.tracks !== 'object') {
    throw new TypeError('El respaldo de Mi Música no contiene un catálogo válido');
  }
  if (!Array.isArray(decoded.folders) || !Array.isArray(decoded.playlists)) {
    throw new TypeError('El respaldo de Mi Música contiene listas no válidas');
  }
  return decoded;
}

function mergeById(existing, incoming) {
  const entries = new Map(safeArray(existing).map(item => [item.id, item]));
  for (const item of incoming) entries.set(item.id, item);
  return [...entries.values()];
}

export function mergeMusicBackup(current, backupInput) {
  const backup = readMusicBackup(backupInput);
  return {
    ...current,
    catalog: { version: 1, tracks: { ...safeObject(current?.catalog?.tracks), ...backup.catalog.tracks } },
    folders: mergeById(current?.folders, backup.folders),
    playlists: mergeById(current?.playlists, backup.playlists),
    audioProfiles: { ...safeObject(current?.audioProfiles), ...safeObject(backup.audioProfiles) },
  };
}

export function shouldCreateAutomaticBackup(settings, now = new Date().toISOString()) {
  if (!settings?.enabled || !Number.isInteger(settings.intervalDays) || settings.intervalDays < 1) return false;
  const current = Date.parse(now);
  if (!Number.isFinite(current)) return false;
  if (!settings.lastBackupAt) return true;
  const previous = Date.parse(settings.lastBackupAt);
  return Number.isFinite(previous) && current - previous >= settings.intervalDays * 86_400_000;
}
