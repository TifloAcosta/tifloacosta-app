export function createMusicQueue(trackIds, startIndex = 0) {
  const ids = [...trackIds];
  if (!Number.isInteger(startIndex) || startIndex < 0 || (ids.length && startIndex >= ids.length)) {
    throw new RangeError('Posición de inicio fuera de la cola');
  }
  return { trackIds: ids, index: ids.length ? startIndex : -1, currentId: ids[startIndex] ?? null, repeat: 'off' };
}

export function setMusicRepeat(queue, repeat) {
  if (!['off', 'one', 'all'].includes(repeat)) throw new TypeError('Modo de repetición no admitido');
  return { ...queue, repeat };
}

export function nextMusicTrack(queue) {
  if (!queue.trackIds.length || queue.index < 0) return queue;
  if (queue.repeat === 'one') return queue;
  const index = queue.index + 1;
  if (index >= queue.trackIds.length) {
    if (queue.repeat === 'all') return { ...queue, index: 0, currentId: queue.trackIds[0] };
    return { ...queue, index: -1, currentId: null };
  }
  return { ...queue, index, currentId: queue.trackIds[index] };
}

export function previousMusicTrack(queue) {
  if (!queue.trackIds.length) return queue;
  const index = queue.index <= 0 ? (queue.repeat === 'all' ? queue.trackIds.length - 1 : 0) : queue.index - 1;
  return { ...queue, index, currentId: queue.trackIds[index] };
}

export function seekMusicPosition(positionMs, durationMs) {
  return Math.min(Math.max(0, Number(positionMs) || 0), Math.max(0, Number(durationMs) || 0));
}

export function resolvePlayableTrack(track) {
  const location = track?.locations?.find((item) => item.available !== false) ?? null;
  return location ? { location, reason: null } : { location: null, reason: 'unavailable' };
}
