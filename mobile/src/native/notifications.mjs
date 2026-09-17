const VALID_STATES = new Set(['unavailable', 'not-requested', 'denied', 'authorized']);

function normalizeState(value) {
  return VALID_STATES.has(value) ? value : 'unavailable';
}

export function createNotificationService(adapter) {
  return {
    async status() {
      if (!adapter || typeof adapter.status !== 'function') return 'unavailable';
      try {
        return normalizeState(await adapter.status());
      } catch {
        return 'unavailable';
      }
    },

    async requestFromUserAction() {
      if (!adapter || typeof adapter.request !== 'function') return 'unavailable';
      try {
        return normalizeState(await adapter.request());
      } catch {
        return 'unavailable';
      }
    },

    async openSystemSettings() {
      if (!adapter || typeof adapter.openSettings !== 'function') return false;
      try {
        return (await adapter.openSettings()) !== false;
      } catch {
        return false;
      }
    }
  };
}
