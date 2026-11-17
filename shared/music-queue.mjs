export function createMusicQueue(trackIds, startIndex = 0) {
  const ids = [...trackIds];
  if (!Number.isInteger(startIndex) || startIndex < 0 || (ids.length && startIndex >= ids.length)) {
    throw new RangeError('Posición de inicio fuera de la cola');
  }
  return { trackIds: ids, originalTrackIds: [...ids], originalPositions: ids.map((_, index) => index), index: ids.length ? startIndex : -1, currentId: ids[startIndex] ?? null, repeat: 'off', shuffle: false };
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

export function setMusicShuffle(queue, enabled, random = Math.random) {
  if (!enabled) {
    const trackIds = [...(queue.originalTrackIds ?? queue.trackIds)];
    const index = queue.index < 0 ? -1 : queue.originalPositions[queue.index];
    return { ...queue, trackIds, originalPositions: trackIds.map((_, position) => position), index, shuffle: false };
  }
  if (queue.shuffle) return queue;
  const currentId = queue.currentId;
  const others = queue.trackIds.map((id, index) => ({ id, originalPosition: queue.originalPositions[index] }))
    .filter((_, index) => index !== queue.index);
  for (let index = others.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.max(0, Math.min(0.999999, random())) * (index + 1));
    [others[index], others[randomIndex]] = [others[randomIndex], others[index]];
  }
  const selected = queue.index < 0 ? [] : [{ id: currentId, originalPosition: queue.originalPositions[queue.index] }];
  const ordered = [...selected, ...others];
  const trackIds = ordered.map((item) => item.id);
  return { ...queue, originalTrackIds: [...(queue.originalTrackIds ?? queue.trackIds)], trackIds, originalPositions: ordered.map((item) => item.originalPosition), index: currentId === null ? -1 : 0, shuffle: true };
}

export function sleepDeadline(nowMs, minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) throw new RangeError('Duración del temporizador no válida');
  return nowMs + Math.round(minutes * 60_000);
}

export function remainingSleepSeconds(deadlineMs, nowMs) {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
