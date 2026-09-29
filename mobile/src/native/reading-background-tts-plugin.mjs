import { registerPlugin } from '@capacitor/core';

const NativeTifloReadingTts = registerPlugin('TifloReadingTts');

function succeeded(value, key) {
  if (value === true) return true;
  return Boolean(value && typeof value === 'object' && value[key] === true);
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function normalizeState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    sessionId: String(source.sessionId ?? '').trim(),
    bookId: String(source.bookId ?? '').trim(),
    blockIndex: nonNegativeInteger(source.blockIndex, 0),
    unitIndex: nonNegativeInteger(source.unitIndex, 0),
    prepared: source.prepared === true,
    playing: source.playing === true,
    ended: source.ended === true
  };
}

function emptyListener() {
  return { remove: async () => {} };
}

export function createBackgroundTtsBridge(plugin = NativeTifloReadingTts) {
  async function beginTtsSession(options = {}) {
    try { return succeeded(await plugin?.beginTtsSession?.(options), 'prepared') || Boolean(plugin?.beginTtsSession); }
    catch { return false; }
  }

  async function appendTtsUnits(options = {}) {
    if (!plugin?.appendTtsUnits) return false;
    try {
      const result = await plugin.appendTtsUnits(options);
      return result === true || Number(result?.appended) >= 0;
    } catch { return false; }
  }

  async function commitTtsSession(options = {}) {
    if (!plugin?.commitTtsSession) return false;
    try { return succeeded(await plugin.commitTtsSession(options), 'prepared'); }
    catch { return false; }
  }

  async function playTts() {
    if (!plugin?.playTts) return false;
    try { return succeeded(await plugin.playTts(), 'accepted'); }
    catch { return false; }
  }

  async function pauseTts() {
    if (!plugin?.pauseTts) return false;
    try { return succeeded(await plugin.pauseTts(), 'paused'); }
    catch { return false; }
  }

  async function seekTts(options = {}) {
    if (!plugin?.seekTts) return false;
    try { return succeeded(await plugin.seekTts(options), 'accepted'); }
    catch { return false; }
  }

  async function getTtsState() {
    if (!plugin?.getTtsState) return normalizeState(null);
    try { return normalizeState(await plugin.getTtsState()); }
    catch { return normalizeState(null); }
  }

  async function stopTts() {
    if (!plugin?.stopTts) return false;
    try { return succeeded(await plugin.stopTts(), 'stopped'); }
    catch { return false; }
  }

  async function addListener(name, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') return emptyListener();
    try {
      return await plugin.addListener(name, value => listener(normalizeState(value)));
    } catch { return emptyListener(); }
  }

  return {
    beginTtsSession,
    appendTtsUnits,
    commitTtsSession,
    playTts,
    pauseTts,
    seekTts,
    getTtsState,
    stopTts,
    addListener
  };
}

export const TifloBackgroundTts = createBackgroundTtsBridge();
