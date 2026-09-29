import { registerPlugin } from '@capacitor/core';

const NativeTifloReadingBackup = registerPlugin('TifloReadingBackup');

async function safeCall(plugin, method, args, fallback) {
  if (!plugin?.[method]) return fallback;
  try {
    return args === undefined ? await plugin[method]() : await plugin[method](args);
  } catch {
    return fallback;
  }
}

export function createReadingBackupPlugin(plugin = NativeTifloReadingBackup) {
  async function exportReadingBackup(options = {}) {
    return safeCall(plugin, 'exportReadingBackup', options, { exported: false, cancelled: true });
  }

  async function pickReadingRestore() {
    return safeCall(plugin, 'pickReadingRestore', undefined, { cancelled: true });
  }

  async function applyReadingRestore(options = {}) {
    return safeCall(plugin, 'applyReadingRestore', options, { restored: false });
  }

  async function cancelReadingRestore() {
    return safeCall(plugin, 'cancelReadingRestore', undefined, { cancelled: true });
  }

  async function checkReadingLibrary() {
    return safeCall(plugin, 'checkReadingLibrary', undefined, {
      healthy: false,
      bookCount: 0,
      missingItems: []
    });
  }

  async function deleteAllReadingData(options = {}) {
    return safeCall(plugin, 'deleteAllReadingData', options, {
      deleted: false,
      confirmationRequired: true,
      booksDeleted: 0
    });
  }

  return {
    exportReadingBackup,
    pickReadingRestore,
    applyReadingRestore,
    cancelReadingRestore,
    checkReadingLibrary,
    deleteAllReadingData
  };
}

export const TifloReadingBackup = createReadingBackupPlugin();
