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

  return {
    exportReadingBackup,
    pickReadingRestore,
    applyReadingRestore,
    cancelReadingRestore
  };
}

export const TifloReadingBackup = createReadingBackupPlugin();
