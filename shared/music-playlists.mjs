export function createPlaylist({ id, name, trackIds = [] }) {
  if (!id || !name) throw new TypeError('La lista necesita identificador y nombre');
  return { id: String(id), name: String(name), trackIds: [...trackIds] };
}

function validIndex(index, length, allowEnd = false) {
  if (!Number.isInteger(index) || index < 0 || index >= length + Number(allowEnd)) {
    throw new RangeError('Posición fuera de la lista');
  }
}

export function insertTrack(playlist, trackId, index = playlist.trackIds.length) {
  validIndex(index, playlist.trackIds.length, true);
  const trackIds = [...playlist.trackIds];
  trackIds.splice(index, 0, trackId);
  return { ...playlist, trackIds };
}

export function moveTrack(playlist, fromIndex, toIndex) {
  validIndex(fromIndex, playlist.trackIds.length);
  validIndex(toIndex, playlist.trackIds.length);
  const trackIds = [...playlist.trackIds];
  trackIds.splice(toIndex, 0, ...trackIds.splice(fromIndex, 1));
  return { ...playlist, trackIds };
}

export function removeTrack(playlist, index) {
  validIndex(index, playlist.trackIds.length);
  return { ...playlist, trackIds: playlist.trackIds.filter((_, position) => position !== index) };
}

export function evaluateSmartRule(rule, tracks) {
  if (!['artist', 'album', 'genre', 'dateAdded', 'playCount'].includes(rule.field)) {
    throw new TypeError('Campo no admitido para lista inteligente');
  }
  if (!['equals', 'atLeast'].includes(rule.operator)) throw new TypeError('Operador desconocido');
  return tracks.filter((track) => {
    const value = track[rule.field];
    if (value === undefined || value === null) return false;
    if (rule.operator === 'atLeast') return Number(value) >= Number(rule.value);
    return String(value).localeCompare(String(rule.value), 'es', { sensitivity: 'base' }) === 0;
  });
}
