import { registerPlugin } from '@capacitor/core';

const NativeTifloReading = registerPlugin('TifloReading');

function emptyBatch(cancelled = false) {
  return { cancelled, imported: [], duplicates: [], rejected: [] };
}

function emptyListener() {
  return { remove: async () => {} };
}

export function createReadingLibraryPlugin(plugin = NativeTifloReading) {
  async function pickDocuments() {
    if (!plugin?.pickDocuments) return emptyBatch(true);
    try {
      return await plugin.pickDocuments();
    } catch {
      return emptyBatch(true);
    }
  }

  async function consumeInitialSharedDocuments() {
    if (!plugin?.consumeInitialSharedDocuments) return emptyBatch(false);
    try {
      return await plugin.consumeInitialSharedDocuments();
    } catch {
      return emptyBatch(false);
    }
  }

  async function listBooks(options = {}) {
    const page = Number(options?.page) || 1;
    const pageSize = Number(options?.pageSize) || 10;
    if (!plugin?.listBooks) return { items: [], total: 0, page, pageSize, pages: 0 };
    try {
      return await plugin.listBooks(options);
    } catch {
      return { items: [], total: 0, page, pageSize, pages: 0 };
    }
  }

  async function openBook(id) {
    if (!plugin?.openBook) return null;
    try {
      return await plugin.openBook({ id: String(id ?? '') });
    } catch {
      return null;
    }
  }

  async function saveProgress(progress = {}) {
    if (!plugin?.saveProgress) return false;
    try {
      return await plugin.saveProgress(progress);
    } catch {
      return false;
    }
  }

  async function deleteBook(id) {
    if (!plugin?.deleteBook) return false;
    try {
      return await plugin.deleteBook({ id: String(id ?? '') });
    } catch {
      return false;
    }
  }

  async function getLatestInProgress() {
    if (!plugin?.getLatestInProgress) return null;
    try {
      return await plugin.getLatestInProgress();
    } catch {
      return null;
    }
  }

  async function addListener(eventName, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') return emptyListener();
    try {
      return await plugin.addListener(eventName, listener);
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
    addListener
  };
}

export const TifloReading = createReadingLibraryPlugin();
