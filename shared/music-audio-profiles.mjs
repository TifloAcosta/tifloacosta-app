export const MUSIC_EQ_FREQUENCIES = Object.freeze([80, 250, 1000, 4000, 12000]);

export const MUSIC_EQ_PRESETS = Object.freeze({
  normal: Object.freeze([0, 0, 0, 0, 0]),
  rock: Object.freeze([4, 2, -1, 3, 2]),
  pop: Object.freeze([2, 1, 0, 2, 2]),
  classical: Object.freeze([0, 0, 0, 1, 2]),
  jazz: Object.freeze([2, 1, 0, 1, 1]),
  clarity: Object.freeze([-2, -1, 1, 3, 2]),
  bass: Object.freeze([5, 3, 0, -1, -1]),
});

export function normalizeMusicEqBands(bands) {
  if (!Array.isArray(bands) || bands.length !== 5 || bands.some((value) => !Number.isFinite(value))) {
    throw new TypeError('El ecualizador necesita cinco bandas numéricas');
  }
  return bands.map((value) => Math.min(12, Math.max(-12, value)));
}

function profile(input) {
  if (typeof input === 'string' && Object.hasOwn(MUSIC_EQ_PRESETS, input)) {
    return { name: input, bands: [...MUSIC_EQ_PRESETS[input]] };
  }
  if (input?.name && Array.isArray(input.bands)) {
    return { name: String(input.name), bands: normalizeMusicEqBands(input.bands) };
  }
  throw new TypeError('Perfil de audio desconocido');
}

export function createMusicAudioSettings(general = 'normal') {
  return { version: 1, general: profile(general), album: {}, playlist: {}, song: {} };
}

export function setMusicAudioOverride(settings, scope, id, input) {
  if (!['album', 'playlist', 'song'].includes(scope) || !id) throw new TypeError('Destino de perfil desconocido');
  return { ...settings, [scope]: { ...settings[scope], [id]: profile(input) } };
}

export function resolveMusicAudioProfile(settings, { songId, playlistId, albumId } = {}) {
  const selected = (songId && settings.song[songId]) ||
    (playlistId && settings.playlist[playlistId]) ||
    (albumId && settings.album[albumId]) || settings.general;
  return { name: selected.name, bands: [...selected.bands] };
}
