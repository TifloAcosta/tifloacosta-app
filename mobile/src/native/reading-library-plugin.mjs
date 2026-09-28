import { registerPlugin } from '@capacitor/core';

const NativeTifloReading = registerPlugin('TifloReading');
const NativeTifloReadingTts = registerPlugin('TifloReadingTts');
const NativeTifloReadingAudio = registerPlugin('TifloReadingAudio');
const NativeTifloReadingAudioGroup = registerPlugin('TifloReadingAudioGroup');

function emptyBatch(cancelled = false) {
  return {
    cancelled,
    audioChoiceRequired: false,
    selectionId: '',
    selectedNames: [],
    imported: [],
    duplicates: [],
    rejected: []
  };
}

function emptyListener() {
  return { remove: async () => {} };
}

function queueBookId(value) {
  return String(value && typeof value === 'object' ? value.bookId ?? '' : value ?? '').trim();
}

function queueTargetIndex(value, fallback = 0) {
  const source = value && typeof value === 'object' ? value.targetIndex : fallback;
  return Math.max(0, Math.trunc(Number(source) || 0));
}

async function safeCall(plugin, method, args, fallback) {
  if (!plugin?.[method]) return fallback;
  try {
    return args === undefined ? await plugin[method]() : await plugin[method](args);
  } catch {
    return fallback;
  }
}

export function createReadingLibraryPlugin(
  plugin = NativeTifloReading,
  ttsPlugin = NativeTifloReadingTts,
  audioPlugin = NativeTifloReadingAudio,
  audioGroupPlugin = null
) {
  const groupPlugin = audioGroupPlugin ?? (
    plugin === NativeTifloReading ? NativeTifloReadingAudioGroup : plugin
  );

  async function pickDocuments() {
    return safeCall(groupPlugin, 'pickDocuments', undefined, emptyBatch(true));
  }

  async function resolveAudioSelection(options = {}) {
    return safeCall(groupPlugin, 'resolveAudioSelection', options, emptyBatch(true));
  }

  async function listAudioTracks(options = {}) {
    return safeCall(groupPlugin, 'listAudioTracks', options, { tracks: [] });
  }

  async function consumeInitialSharedDocuments() {
    return safeCall(plugin, 'consumeInitialSharedDocuments', undefined, emptyBatch(false));
  }

  async function listBooks(options = {}) {
    const page = Number(options?.page) || 1;
    const pageSize = Number(options?.pageSize) || 10;
    return safeCall(plugin, 'listBooks', options, { items: [], total: 0, page, pageSize, pages: 0 });
  }

  async function listQueue() {
    return safeCall(plugin, 'listQueue', undefined, { items: [] });
  }

  async function addToQueue(value) {
    const bookId = queueBookId(value);
    if (!bookId) return false;
    const result = await safeCall(plugin, 'addToQueue', { bookId }, { queued: false });
    return result === true || result?.queued === true;
  }

  async function removeFromQueue(value) {
    const bookId = queueBookId(value);
    if (!bookId) return false;
    const result = await safeCall(plugin, 'removeFromQueue', { bookId }, { removed: false });
    return result === true || result?.removed === true;
  }

  async function moveQueueItem(value, targetIndex = 0) {
    const bookId = queueBookId(value);
    if (!bookId) return false;
    const result = await safeCall(plugin, 'moveQueueItem', {
      bookId,
      targetIndex: queueTargetIndex(value, targetIndex)
    }, { moved: false });
    return result === true || result?.moved === true;
  }

  async function openBook(id, options = {}) {
    return safeCall(plugin, 'openBook', {
      id: String(id ?? ''),
      password: String(options?.password ?? '')
    }, null);
  }

  async function saveProgress(progress = {}) {
    return safeCall(plugin, 'saveProgress', progress, false);
  }

  async function deleteBook(id) {
    return safeCall(plugin, 'deleteBook', { id: String(id ?? '') }, false);
  }

  async function getLatestInProgress() {
    return safeCall(plugin, 'getLatestInProgress', undefined, null);
  }

  async function listTtsVoices() {
    return safeCall(ttsPlugin, 'listTtsVoices', undefined, { voices: [] });
  }

  async function startTts(options = {}) {
    return safeCall(ttsPlugin, 'startTts', options, { accepted: false });
  }

  async function stopTts() {
    return safeCall(ttsPlugin, 'stopTts', undefined, { stopped: false });
  }

  async function prepareAudio(options = {}) {
    return safeCall(audioPlugin, 'prepareAudio', options, null);
  }

  async function playAudio() {
    return safeCall(audioPlugin, 'playAudio', undefined, null);
  }

  async function pauseAudio() {
    return safeCall(audioPlugin, 'pauseAudio', undefined, null);
  }

  async function seekAudio(options = {}) {
    return safeCall(audioPlugin, 'seekAudio', options, null);
  }

  async function skipAudio(options = {}) {
    return safeCall(audioPlugin, 'skipAudio', options, null);
  }

  async function previousAudioTrack() {
    return safeCall(audioPlugin, 'previousAudioTrack', undefined, null);
  }

  async function nextAudioTrack() {
    return safeCall(audioPlugin, 'nextAudioTrack', undefined, null);
  }

  async function setAudioSpeed(options = {}) {
    return safeCall(audioPlugin, 'setAudioSpeed', options, null);
  }

  async function setAudioSleepTimer(options = {}) {
    return safeCall(audioPlugin, 'setAudioSleepTimer', options, { scheduled: false });
  }

  async function cancelAudioSleepTimer() {
    return safeCall(audioPlugin, 'cancelAudioSleepTimer', undefined, { cancelled: false });
  }

  async function getAudioState() {
    return safeCall(audioPlugin, 'getAudioState', undefined, null);
  }

  async function stopAudio() {
    return safeCall(audioPlugin, 'stopAudio', undefined, null);
  }

  async function listMarks(options = {}) {
    return safeCall(plugin, 'listMarks', options, { items: [] });
  }

  async function addMark(options = {}) {
    return safeCall(plugin, 'addMark', options, { added: false });
  }

  async function deleteMark(options = {}) {
    return safeCall(plugin, 'deleteMark', options, { deleted: false });
  }

  async function getReadingSettings(options = {}) {
    return safeCall(plugin, 'getReadingSettings', options, { global: {}, book: {} });
  }

  async function setReadingSetting(options = {}) {
    return safeCall(plugin, 'setReadingSetting', options, { saved: false });
  }

  async function resetBookReadingSettings(options = {}) {
    return safeCall(plugin, 'resetBookReadingSettings', options, { reset: false });
  }

  async function addListener(eventName, listener) {
    if (typeof listener !== 'function') return emptyListener();
    const cleanEventName = String(eventName ?? '');
    const source = cleanEventName.startsWith('tts')
      ? ttsPlugin
      : cleanEventName.startsWith('audio')
        ? audioPlugin
        : plugin;
    if (!source?.addListener) return emptyListener();
    try {
      return await source.addListener(eventName, listener);
    } catch {
      return emptyListener();
    }
  }

  return {
    pickDocuments,
    resolveAudioSelection,
    listAudioTracks,
    consumeInitialSharedDocuments,
    listBooks,
    listQueue,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    listTtsVoices,
    startTts,
    stopTts,
    prepareAudio,
    playAudio,
    pauseAudio,
    seekAudio,
    skipAudio,
    previousAudioTrack,
    nextAudioTrack,
    setAudioSpeed,
    setAudioSleepTimer,
    cancelAudioSleepTimer,
    getAudioState,
    stopAudio,
    listMarks,
    addMark,
    deleteMark,
    getReadingSettings,
    setReadingSetting,
    resetBookReadingSettings,
    addListener
  };
}

export const TifloReading = createReadingLibraryPlugin();
