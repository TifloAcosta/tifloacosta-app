import { normalizeNotificationDestination } from '../core/notification-destination.mjs';

export function createOneSignalNotifications({ sdk, appId, onDestination = () => {} } = {}) {
  let started = false;
  let failed = false;
  let startPromise = null;

  async function state() {
    if (!started || failed) return 'unavailable';
    if (await sdk.Notifications.hasPermission()) return 'authorized';
    return (await sdk.Notifications.canRequestPermission()) ? 'not-requested' : 'denied';
  }

  function start() {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      try {
        if (!sdk || typeof sdk.initialize !== 'function' || !sdk.Notifications) {
          throw new Error('OneSignal SDK unavailable');
        }
        await sdk.initialize(appId);
        sdk.Notifications.addEventListener('click', event => {
          onDestination(normalizeNotificationDestination(event?.notification?.additionalData));
        });
        started = true;
      } catch {
        failed = true;
        return false;
      }

      try {
        await sdk.User?.addTag?.('tiflo_client', 'android_app');
      } catch {
        // The tag is a secondary segmentation aid. Platform targeting remains authoritative.
      }
      return true;
    })();
    return startPromise;
  }

  async function ensureStarted() {
    if (!startPromise) return false;
    return startPromise;
  }

  const adapter = {
    status: async () => {
      try {
        await ensureStarted();
        return await state();
      } catch {
        return 'unavailable';
      }
    },
    request: async () => {
      if (!(await ensureStarted()) || failed) return 'unavailable';
      try {
        await sdk.Notifications.requestPermission(false);
        return await state();
      } catch {
        return 'unavailable';
      }
    },
    openSettings: async () => {
      if (!(await ensureStarted()) || failed) return false;
      try {
        await sdk.Notifications.requestPermission(true);
        return true;
      } catch {
        return false;
      }
    }
  };

  return { start, adapter };
}
