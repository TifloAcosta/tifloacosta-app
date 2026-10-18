/**
 * DAISY 2/3 audio from its original IndexedDB ZIP. Each SMIL clip is a track.
 * Clip boundaries, queue changes and stop are protected against late async
 * metadata events. No extraction is persisted outside the existing archive.
 */
import { openIosZip } from './ios-zip-reader.mjs';
import { parseDaisyArchive } from '../../../shared/web-reading-daisy-adapter.mjs';

async function defaultOpenArchive(blob) {
  const zip = await openIosZip(blob);
  return { zip, model: await parseDaisyArchive(zip) };
}
const toInt = value => Math.max(0, Math.round(Number(value) || 0));
const clipMime = path => /\\.(m4a|mp4)$/i.test(path) ? 'audio/mp4'
  : /\\.aac$/i.test(path) ? 'audio/aac' : 'audio/mpeg';

export function createIosDaisyAudio({
  library,
  openArchive = defaultOpenArchive,
  createAudio = () => new Audio(),
  urls = globalThis.URL
} = {}) {
  let loaded = null, audio = null, objectUrl = '', activeId = '';
  let trackIndex = 0, ready = false, rate = 1, generation = 0, advancing = false;
  const listeners = new Map();
  const currentClip = () => loaded?.model?.audioClips?.[trackIndex] || null;
  const trackCount = () => loaded?.model?.audioClips?.length || 0;
  function durationMs() {
    const clip = currentClip();
    if (!clip) return 0;
    const start = toInt(clip.clipBeginMs), end = toInt(clip.clipEndMs);
    if (end > start) return end - start;
    return audio && Number.isFinite(audio.duration) ? Math.max(0, toInt(audio.duration * 1000) - start) : 0;
  }
  function state() {
    const start = toInt(currentClip()?.clipBeginMs);
    return { bookId: activeId, trackIndex, trackCount: trackCount(),
      positionMs: audio ? Math.max(0, toInt(audio.currentTime * 1000) - start) : 0,
      durationMs: durationMs(),
      playing: Boolean(ready && audio && !audio.paused && !audio.ended),
      speed: rate, prepared: ready };
  }
  function emit(name, extra = {}) {
    for (const listener of listeners.get(name) || []) {
      try { listener({ ...state(), ...extra }); } catch {}
    }
  }
  function addListener(name, callback) {
    if (typeof callback !== 'function') return Promise.resolve({ remove() {} });
    const group = listeners.get(name) || new Set();
    group.add(callback);
    listeners.set(name, group);
    return Promise.resolve({ remove() { group.delete(callback); } });
  }
  function releasePlayer() {
    ready = false;
    if (audio) {
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch {}
    }
    audio = null;
    if (objectUrl) {
      try { urls.revokeObjectURL(objectUrl); } catch {}
    }
    objectUrl = '';
  }
  async function archive(bookId) {
    if (loaded?.bookId === bookId) return loaded;
    const stored = await library?.openDaisyArchive?.(bookId);
    if (!stored?.blob || stored.book?.id !== bookId) return null;
    const parsed = await openArchive(stored.blob);
    if (!Array.isArray(parsed?.model?.audioClips)) return null;
    loaded = { ...parsed, bookId };
    return loaded;
  }
  async function listAudioTracks({ bookId } = {}) {
    try {
      const data = await archive(bookId);
      if (!data) return { tracks: [] };
      return { tracks: data.model.audioClips.map((clip, index) => ({
        bookId, trackIndex: index, relativePath: clip.audioHref,
        originalName: String(clip.audioHref || '').split('/').at(-1),
        title: 'Segmento ' + (index + 1), durationMs:
          Math.max(0, toInt(clip.clipEndMs) - toInt(clip.clipBeginMs)), sizeBytes: 0
      })) };
    } catch {
      return { tracks: [] };
    }
  }
  async function prepareAudio({ bookId, trackIndex: nextIndex = 0, positionMs = 0 } = {}) {
    const request = ++generation;
    try {
      const data = await archive(bookId);
      if (request !== generation || !data?.model.audioClips.length) return null;
      const index = Math.min(data.model.audioClips.length - 1, toInt(nextIndex));
      const clip = data.model.audioClips[index];
      const bytes = await data.zip.file(clip.audioHref)?.async('uint8array');
      if (request !== generation || !bytes?.length) return null;
      releasePlayer();
      activeId = bookId;
      trackIndex = index;
      const element = createAudio();
      audio = element;
      objectUrl = urls.createObjectURL(new Blob([bytes], { type: clipMime(clip.audioHref) }));
      element.preload = 'metadata';
      element.src = objectUrl;
      element.playbackRate = rate;
      const valid = () => request === generation && element === audio;
      element.addEventListener('timeupdate', () => {
        if (!valid() || advancing) return;
        emit('audioPosition');
        const end = toInt(currentClip()?.clipEndMs);
        if (end && toInt(element.currentTime * 1000) >= end - 100) void advanceAutomatically(request);
      });
      element.addEventListener('play', () => { if (valid()) emit('audioState'); });
      element.addEventListener('pause', () => { if (valid()) emit('audioState'); });
      element.addEventListener('ended', () => { if (valid()) void advanceAutomatically(request); });
      element.addEventListener('error', () => {
        if (valid()) emit('audioInterrupted', { reason: 'playback-error' });
      });
      await new Promise((resolve, reject) => {
        const finish = () => {
          clearTimeout(timer);
          element.removeEventListener('loadedmetadata', success);
          element.removeEventListener('error', failed);
        };
        const success = () => { finish(); resolve(); };
        const failed = () => { finish(); reject(Error('daisy-audio-metadata')); };
        const timer = setTimeout(() => { finish(); reject(Error('daisy-audio-timeout')); }, 10000);
        element.addEventListener('loadedmetadata', success);
        element.addEventListener('error', failed);
        element.load();
        if (element.readyState >= 1) success();
      });
      if (!valid()) return null;
      const from = toInt(clip.clipBeginMs);
      const limit = toInt(clip.clipEndMs) > from
        ? toInt(clip.clipEndMs)
        : Number.isFinite(element.duration) ? toInt(element.duration * 1000) : Number.MAX_SAFE_INTEGER;
      element.currentTime = Math.min(limit, from + toInt(positionMs)) / 1000;
      ready = true;
      emit('audioState');
      return state();
    } catch {
      if (request === generation) releasePlayer();
      return null;
    }
  }
  async function advanceAutomatically(request) {
    if (request !== generation || advancing) return;
    advancing = true;
    try {
      const next = trackIndex + 1;
      if (next >= trackCount()) {
        audio?.pause();
        emit('audioEnded');
        emit('audioState');
      } else {
        const bookId = activeId;
        const result = await prepareAudio({ bookId, trackIndex: next, positionMs: 0 });
        if (result) await playAudio();
      }
    } finally { advancing = false; }
  }
  async function playAudio() {
    if (!ready || !audio) return null;
    const element = audio;
    try { await element.play(); return audio === element ? state() : null; }
    catch {
      if (audio === element) emit('audioInterrupted', { reason: 'playback-error' });
      return null;
    }
  }
  async function pauseAudio() {
    if (!ready || !audio) return null;
    audio.pause();
    emit('audioState');
    return state();
  }
  async function seekAudio({ positionMs = 0 } = {}) {
    if (!ready || !audio) return null;
    const start = toInt(currentClip()?.clipBeginMs);
    const requested = Math.min(durationMs() || Number.MAX_SAFE_INTEGER, toInt(positionMs));
    audio.currentTime = (start + requested) / 1000;
    emit('audioPosition');
    return state();
  }
  async function skipAudio({ deltaMs = 0 } = {}) {
    return seekAudio({ positionMs: state().positionMs + Number(deltaMs || 0) });
  }
  async function move(delta) {
    if (!activeId || !trackCount()) return state();
    const bookId = activeId;
    const index = Math.min(trackCount() - 1, Math.max(0, trackIndex + delta));
    const playing = state().playing;
    const result = await prepareAudio({ bookId, trackIndex: index, positionMs: 0 });
    if (result && playing) await playAudio();
    return result || state();
  }
  async function setAudioSpeed({ speed = 1 } = {}) {
    rate = Math.max(0.5, Math.min(3, Number(speed) || 1));
    if (audio) audio.playbackRate = rate;
    return state();
  }
  async function stopAudio() {
    generation += 1;
    releasePlayer();
    loaded = null; activeId = ''; trackIndex = 0;
    return state();
  }
  return {
    listAudioTracks, prepareAudio, playAudio, pauseAudio, seekAudio, skipAudio,
    previousAudioTrack: () => move(-1),
    nextAudioTrack: () => move(1),
    setAudioSpeed, getAudioState: async () => state(), stopAudio, addListener
  };
}
