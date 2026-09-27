import { registerPlugin } from '@capacitor/core';

const NativeTifloReading = registerPlugin('TifloReading');
const NativeTifloReadingTts = registerPlugin('TifloReadingTts');

function emptyBatch(cancelled = false) {
  return { cancelled, imported: [], duplicates: [], rejected: [] };
}

function emptyListener() {
  return { remove: async () => {} };
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
  ttsPlugin = NativeTifloReadingTts
) {
  async function pickDocuments() {
    return safeCall(plugin, 'pickDocuments', undefined, emptyBatch(true));
  }

  async function consumeInitialSharedDocuments() {
    return safeCall(plugin, 'consumeInitialSharedDocuments', undefined, emptyBatch(false));
  }

  async function listBooks(options = {}) {
    const page = Number(options?.page) || 1;
    const pageSize = Number(options?.pageSize) || 10;
    return safeCall(plugin, 'listBooks', options, { items: [], total: 0, page, pageSize, pages: 0 });
  }

  async function openBook(id) {
    return safeCall(plugin, 'openBook', { id: String(id ?? '') }, null);
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
    const source = String(eventName ?? '').startsWith('tts') ? ttsPlugin : plugin;
    if (!source?.addListener) return emptyListener();
    try {
      return await source.addListener(eventName, listener);
    } catch {
      return emptyListener();
    }
  }

  return {
    pickDocuments,
    consumeInitialSharedDocuments,
    listBooks,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    listTtsVoices,
    startTts,
    stopTts,
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
