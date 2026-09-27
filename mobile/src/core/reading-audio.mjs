const AUDIO_PROGRESS_SAVE_INTERVAL_MS = 5000;
const AUDIO_SPEED_MIN = 0.5;
const AUDIO_SPEED_MAX = 3;
const AUDIO_SKIP_SECONDS = new Set([10, 30, 60]);

export const READING_AUDIO_SLEEP_MINUTES = Object.freeze([15, 30, 45, 60]);

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(numberOr(value, fallback)));
}

function clamp(value, min, max, fallback) {
  return Math.min(max, Math.max(min, numberOr(value, fallback)));
}

function clean(value) {
  return String(value ?? '').trim();
}

function supportedSkipSeconds(value) {
  const seconds = Math.trunc(numberOr(value, 30));
  return AUDIO_SKIP_SECONDS.has(seconds) ? seconds : 30;
}

function percentFor(positionMs, durationMs, fallback = 0) {
  if (durationMs <= 0) return Math.min(100, Math.max(0, numberOr(fallback, 0)));
  return Math.min(100, Math.max(0, (positionMs / durationMs) * 100));
}

function normalizeTracks(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((track, index) => ({
      trackIndex: nonNegativeInteger(track?.trackIndex, index),
      durationMs: nonNegativeInteger(track?.durationMs, 0)
    }))
    .sort((a, b) => a.trackIndex - b.trackIndex);
}

function audiobookPercent(tracks, trackIndex, positionMs, currentDurationMs, fallback = 0) {
  if (!tracks.length) return percentFor(positionMs, currentDurationMs, fallback);
  const total = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  if (total <= 0) return percentFor(positionMs, currentDurationMs, fallback);
  let completed = 0;
  for (const track of tracks) {
    if (track.trackIndex < trackIndex) completed += track.durationMs;
    else if (track.trackIndex === trackIndex) completed += Math.min(positionMs, track.durationMs || positionMs);
  }
  return Math.min(100, Math.max(0, (completed / total) * 100));
}

function defaultTimers() {
  return {
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: id => globalThis.clearTimeout(id)
  };
}

export function createReadingAudioController({
  client = {},
  book = {},
  tracks = [],
  initialPosition = {},
  settings = {},
  onPosition = () => {},
  now = () => Date.now(),
  timers = defaultTimers()
} = {}) {
  const bookId = clean(book?.id);
  const relativePath = clean(book?.relativePath);
  const configuredSpeed = clamp(settings?.['audio.speed'], AUDIO_SPEED_MIN, AUDIO_SPEED_MAX, 1);
  const skipSeconds = supportedSkipSeconds(settings?.['audio.skipSeconds']);
  const audioTracks = normalizeTracks(tracks);

  let state = {
    bookId,
    trackIndex: nonNegativeInteger(initialPosition?.trackIndex ?? book?.mediaTrackIndex, 0),
    trackCount: audioTracks.length,
    positionMs: nonNegativeInteger(initialPosition?.positionMs ?? book?.mediaPositionMs, 0),
    durationMs: 0,
    playing: false,
    speed: configuredSpeed,
    prepared: false,
    readingState: clean(book?.state) === 'read' ? 'read' : 'in-reading',
    interruptionReason: ''
  };
  let lastPersistedAt = Number.NEGATIVE_INFINITY;
  let destroyed = false;
  let sleepTimerId = null;
  let sleepAtTrackEnd = false;
  let sleepTimerMode = null;
  const listenerHandles = [];

  function snapshot() {
    return {
      bookId: state.bookId,
      trackIndex: state.trackIndex,
      trackCount: state.trackCount,
      positionMs: state.positionMs,
      durationMs: state.durationMs,
      playing: state.playing,
      speed: state.speed,
      prepared: state.prepared,
      readingState: state.readingState,
      interruptionReason: state.interruptionReason,
      sleepTimer: sleepTimerMode
    };
  }

  function belongsToCurrentBook(value) {
    const eventBookId = clean(value?.bookId);
    return !eventBookId || eventBookId === bookId;
  }

  function updateFromNative(value = {}) {
    if (!value || typeof value !== 'object' || !belongsToCurrentBook(value)) return false;
    if (Object.prototype.hasOwnProperty.call(value, 'trackIndex')) {
      state.trackIndex = nonNegativeInteger(value.trackIndex, state.trackIndex);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'trackCount')) {
      state.trackCount = nonNegativeInteger(value.trackCount, state.trackCount || audioTracks.length);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'positionMs')) {
      state.positionMs = nonNegativeInteger(value.positionMs, state.positionMs);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'durationMs')) {
      state.durationMs = nonNegativeInteger(value.durationMs, state.durationMs);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'playing')) {
      state.playing = value.playing === true;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'speed')) {
      state.speed = clamp(value.speed, AUDIO_SPEED_MIN, AUDIO_SPEED_MAX, state.speed);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'prepared')) {
      state.prepared = value.prepared === true;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'reason')) {
      state.interruptionReason = clean(value.reason);
      if (state.interruptionReason === 'sleep-timer' || state.interruptionReason === 'sleep-track-end') {
        sleepAtTrackEnd = false;
        sleepTimerId = null;
        sleepTimerMode = null;
      }
    }
    try {
      onPosition(snapshot());
    } catch {
    }
    return true;
  }

  async function persist({ force = false, completed = false } = {}) {
    if (!bookId || !client?.saveProgress) return false;
    const currentNow = numberOr(now(), 0);
    if (!force && currentNow - lastPersistedAt < AUDIO_PROGRESS_SAVE_INTERVAL_MS) return false;

    const readingState = completed ? 'read' : state.readingState === 'read' ? 'read' : 'in-reading';
    const saved = await client.saveProgress({
      id: bookId,
      mediaTrackIndex: state.trackIndex,
      mediaPositionMs: state.positionMs,
      percent: completed
        ? 100
        : audiobookPercent(audioTracks, state.trackIndex, state.positionMs, state.durationMs, book?.percent),
      state: readingState
    });
    if (saved) {
      lastPersistedAt = currentNow;
      state.readingState = readingState;
    }
    return saved;
  }

  async function addNativeListener(name, listener) {
    if (!client?.addListener) return;
    const handle = await client.addListener(name, listener);
    if (handle?.remove) listenerHandles.push(handle);
  }

  const listenersReady = Promise.all([
    addNativeListener('audioState', async value => {
      if (destroyed || !belongsToCurrentBook(value)) return;
      const previousTrackIndex = state.trackIndex;
      if (!updateFromNative(value)) return;
      if (state.trackIndex !== previousTrackIndex) {
        if (sleepAtTrackEnd) {
          sleepAtTrackEnd = false;
          sleepTimerMode = null;
          if (client?.pauseAudio) {
            const paused = await client.pauseAudio();
            if (paused && belongsToCurrentBook(paused)) updateFromNative(paused);
          }
          state.playing = false;
        }
        await persist({ force: true });
      }
    }),
    addNativeListener('audioPosition', async value => {
      if (destroyed || !belongsToCurrentBook(value)) return;
      if (!updateFromNative(value)) return;
      await persist();
    }),
    addNativeListener('audioInterrupted', async value => {
      if (destroyed || !belongsToCurrentBook(value)) return;
      if (!updateFromNative(value)) return;
      state.playing = false;
      await persist({ force: true });
    }),
    addNativeListener('audioEnded', async value => {
      if (destroyed || !belongsToCurrentBook(value)) return;
      if (!updateFromNative(value)) return;
      state.playing = false;
      state.readingState = 'read';
      sleepAtTrackEnd = false;
      sleepTimerMode = null;
      await persist({ force: true, completed: true });
    })
  ]);

  async function prepare() {
    await listenersReady;
    if (destroyed || !bookId || !client?.prepareAudio) return null;
    const prepared = await client.prepareAudio({
      bookId,
      relativePath,
      trackIndex: state.trackIndex,
      positionMs: state.positionMs
    });
    if (!prepared || !belongsToCurrentBook(prepared)) return null;
    updateFromNative(prepared);
    state.playing = false;
    state.prepared = true;

    if (client?.setAudioSpeed) {
      const speedState = await client.setAudioSpeed({ speed: configuredSpeed });
      if (speedState && belongsToCurrentBook(speedState)) updateFromNative(speedState);
      state.speed = configuredSpeed;
    }
    return snapshot();
  }

  async function play() {
    await listenersReady;
    if (destroyed || !client?.playAudio) return null;
    const result = await client.playAudio();
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    return snapshot();
  }

  async function pause() {
    await listenersReady;
    if (destroyed) return null;
    if (client?.pauseAudio) {
      const result = await client.pauseAudio();
      if (result && belongsToCurrentBook(result)) updateFromNative(result);
    }
    state.playing = false;
    await persist({ force: true });
    return snapshot();
  }

  async function seek(positionMs) {
    await listenersReady;
    if (destroyed || !client?.seekAudio) return null;
    let target = nonNegativeInteger(positionMs, state.positionMs);
    if (state.durationMs > 0) target = Math.min(target, state.durationMs);
    const result = await client.seekAudio({ positionMs: target });
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    return snapshot();
  }

  async function skip(direction) {
    await listenersReady;
    if (destroyed || !client?.skipAudio) return null;
    const sign = Math.sign(numberOr(direction, 0));
    if (!sign) return snapshot();

    let deltaMs = sign * skipSeconds * 1000;
    if (sign < 0) {
      deltaMs = Math.max(deltaMs, -state.positionMs);
    } else if (state.durationMs > 0) {
      deltaMs = Math.min(deltaMs, Math.max(0, state.durationMs - state.positionMs));
    }
    const result = await client.skipAudio({ deltaMs });
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    return snapshot();
  }

  async function previousTrack() {
    await listenersReady;
    if (destroyed || !client?.previousAudioTrack) return snapshot();
    const result = await client.previousAudioTrack();
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    await persist({ force: true });
    return snapshot();
  }

  async function nextTrack() {
    await listenersReady;
    if (destroyed || !client?.nextAudioTrack) return snapshot();
    const result = await client.nextAudioTrack();
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    await persist({ force: true });
    return snapshot();
  }

  async function setSpeed(speed) {
    await listenersReady;
    const normalized = clamp(speed, AUDIO_SPEED_MIN, AUDIO_SPEED_MAX, state.speed);
    if (destroyed || !client?.setAudioSpeed) return snapshot();
    const result = await client.setAudioSpeed({ speed: normalized });
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    state.speed = normalized;
    return snapshot();
  }

  async function refreshState() {
    await listenersReady;
    if (destroyed || !client?.getAudioState) return snapshot();
    const result = await client.getAudioState();
    if (result && belongsToCurrentBook(result)) updateFromNative(result);
    return snapshot();
  }

  async function cancelSleepTimer() {
    if (sleepTimerId != null) {
      timers.clearTimeout(sleepTimerId);
      sleepTimerId = null;
    }
    sleepAtTrackEnd = false;
    sleepTimerMode = null;
    if (client?.cancelAudioSleepTimer) {
      try {
        await client.cancelAudioSleepTimer();
      } catch {
      }
    }
    return true;
  }

  async function setSleepTimer(value) {
    await cancelSleepTimer();
    if (value === 'track-end') {
      if (client?.setAudioSleepTimer) {
        try {
          const scheduled = await client.setAudioSleepTimer({ minutes: 0, atTrackEnd: true });
          if (scheduled) {
            sleepTimerMode = 'track-end';
            return true;
          }
        } catch {
        }
      }
      sleepAtTrackEnd = true;
      sleepTimerMode = 'track-end';
      return true;
    }

    const minutes = Math.trunc(numberOr(value, 0));
    if (!READING_AUDIO_SLEEP_MINUTES.includes(minutes)) return false;
    if (client?.setAudioSleepTimer) {
      try {
        const scheduled = await client.setAudioSleepTimer({ minutes, atTrackEnd: false });
        if (scheduled) {
          sleepTimerMode = 'timed';
          return true;
        }
      } catch {
      }
    }

    sleepTimerMode = 'timed';
    sleepTimerId = timers.setTimeout(async () => {
      sleepTimerId = null;
      sleepTimerMode = null;
      if (destroyed) return;
      if (client?.pauseAudio) {
        const result = await client.pauseAudio();
        if (result && belongsToCurrentBook(result)) updateFromNative(result);
      }
      state.playing = false;
      await persist({ force: true });
    }, minutes * 60 * 1000);
    return true;
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    await cancelSleepTimer();
    await listenersReady;
    await persist({ force: true, completed: state.readingState === 'read' });
    const handles = listenerHandles.splice(0);
    await Promise.all(handles.map(async handle => {
      try {
        await handle.remove();
      } catch {
      }
    }));
  }

  return {
    prepare,
    play,
    pause,
    seek,
    skip,
    previousTrack,
    nextTrack,
    setSpeed,
    refreshState,
    setSleepTimer,
    cancelSleepTimer,
    getState: snapshot,
    destroy
  };
}