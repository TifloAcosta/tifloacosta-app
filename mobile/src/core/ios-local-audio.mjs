/**
 * Single-track MP3 playback from the existing on-device IndexedDB media store.
 * Original book IDs and Blobs remain untouched; URLs exist in memory only.
 * HTML audio is deliberately limited to MP3, not unsynchronized DAISY.
 */
export function createIosLocalAudio({ library, createAudio = () => new Audio(),
  urls = globalThis.URL } = {}) {
  let audio = null;
  let objectUrl = '';
  let activeBookId = '';
  let ready = false;
  let speed = 1;
  // A late metadata/error event from an older track must not replace a newer one.
  let preparation = 0;
  const listeners = new Map();

  function snapshot() {
    return { bookId: activeBookId, trackIndex: 0, trackCount: activeBookId ? 1 : 0,
      positionMs: audio ? Math.round((audio.currentTime || 0) * 1000) : 0,
      durationMs: audio && Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0,
      playing: ready && !audio.paused && !audio.ended, speed, prepared: ready };
  }
  function emit(name, additional = {}) {
    for (const callback of listeners.get(name) || []) {
      try { callback({ ...snapshot(), ...additional }); } catch {}
    }
  }
  function addListener(name, callback) {
    const key = String(name || '');
    if (typeof callback !== 'function') return Promise.resolve({ remove() {} });
    const group = listeners.get(key) || new Set();
    group.add(callback);
    listeners.set(key, group);
    return Promise.resolve({ remove() {
      group.delete(callback);
      if (!group.size) listeners.delete(key);
    } });
  }

  function attachEvents(element) {
    const emitIfActive = (name, additional = {}) => {
      if (audio === element) emit(name, additional);
    };
    element.addEventListener('timeupdate', () => emitIfActive('audioPosition'));
    element.addEventListener('play', () => emitIfActive('audioState'));
    element.addEventListener('pause', () => emitIfActive('audioState'));
    element.addEventListener('ratechange', () => emitIfActive('audioState'));
    element.addEventListener('ended', () => {
      emitIfActive('audioEnded');
      emitIfActive('audioState');
    });
    element.addEventListener('error', () => emitIfActive('audioInterrupted', { reason: 'playback-error' }));
  }
  function release() {
    ready = false;
    if (audio) {
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch {}
      audio = null;
    }
    if (objectUrl) {
      try { urls.revokeObjectURL(objectUrl); } catch {}
      objectUrl = '';
    }
    activeBookId = '';
  }
  async function listAudioTracks({ bookId } = {}) {
    if (!bookId) return { tracks: [] };
    const stored = await library?.openAudioFile?.(bookId);
    if (!stored?.blob?.size || stored?.book?.id !== bookId) return { tracks: [] };
    return { tracks: [{ bookId, trackIndex: 0, relativePath: 'local-mp3',
      originalName: stored.book.title || 'Audio MP3',
      title: stored.book.title || 'Audio MP3', sizeBytes: stored.blob.size, durationMs: 0 }] };
  }
  async function prepareAudio({ bookId, positionMs = 0 } = {}) {
    const currentPreparation = ++preparation;
    if (!bookId) return null;
    try {
      const stored = await library?.openAudioFile?.(bookId);
      if (currentPreparation !== preparation) return null;
      if (stored?.book?.id !== bookId || !stored.blob?.size) return null;
      release();
      activeBookId = bookId;
      objectUrl = urls.createObjectURL(stored.blob);
      const element = createAudio();
      audio = element;
      attachEvents(element);
      element.preload = 'metadata';
      element.src = objectUrl;
      element.playbackRate = speed;
      // Metadata is asynchronous on WKWebView. Playback remains a user action.
      // Use the captured element: a subsequent prepare may replace audio.
      await new Promise((resolve, reject) => {
        const done = () => {
          clearTimeout(timer);
          element.removeEventListener('loadedmetadata', loaded);
          element.removeEventListener('error', failed);
        };
        const loaded = () => { done(); resolve(); };
        const failed = () => { done(); reject(Error('mp3-metadata-error')); };
        const timer = setTimeout(() => { done(); reject(Error('mp3-metadata-timeout')); }, 10000);
        element.addEventListener('loadedmetadata', loaded);
        element.addEventListener('error', failed);
        element.load();
        if (element.readyState >= 1) loaded();
      });
      if (currentPreparation !== preparation || audio !== element) return null;
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      element.currentTime = Math.min(duration, Math.max(0, Number(positionMs) / 1000 || 0));
      ready = true;
      emit('audioState');
      return snapshot();
    } catch {
      if (currentPreparation === preparation) release();
      return null;
    }
  }
  async function playAudio() {
    if (!ready || !audio) return null;
    const element = audio;
    try {
      await element.play();
      return audio === element && ready ? snapshot() : null;
    } catch {
      if (audio === element) emit('audioInterrupted', { reason: 'playback-error' });
      return null;
    }
  }
  async function pauseAudio() {
    if (!ready || !audio) return null;
    audio.pause();
    emit('audioState');
    return snapshot();
  }
  async function seekAudio({ positionMs = 0 } = {}) {
    if (!ready || !audio) return null;
    const limit = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
    audio.currentTime = Math.min(limit, Math.max(0, Number(positionMs) / 1000 || 0));
    emit('audioPosition');
    return snapshot();
  }
  async function skipAudio({ deltaMs = 0 } = {}) {
    return seekAudio({ positionMs: snapshot().positionMs + Number(deltaMs || 0) });
  }
  async function setAudioSpeed({ speed: next = 1 } = {}) {
    speed = Math.max(0.5, Math.min(3, Number(next) || 1));
    if (audio) audio.playbackRate = speed;
    return snapshot();
  }
  async function stopAudio() {
    preparation += 1;
    if (audio) audio.pause();
    release();
    return snapshot();
  }
  return { listAudioTracks, prepareAudio, playAudio, pauseAudio, seekAudio, skipAudio,
    setAudioSpeed, getAudioState: async () => snapshot(), stopAudio, addListener };
}
