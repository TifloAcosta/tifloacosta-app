import { normalizeNotificationDestination } from '../core/notification-destination.mjs';

export const NOTIFICATION_CONSENT_KEY = 'tiflo-mobile-notifications-opt-in-v1';

function createConsentState(storage) {
  let cached = null;

  function read() {
    if (typeof cached === 'boolean') return cached;
    try {
      cached = storage?.getItem?.(NOTIFICATION_CONSENT_KEY) === '1';
    } catch {
      cached = false;
    }
    return cached;
  }

  function grant() {
    cached = true;
    try {
      storage?.setItem?.(NOTIFICATION_CONSENT_KEY, '1');
    } catch {
      // Keep the in-memory grant for this session; a later restart fails closed.
    }
    return true;
  }

  return { read, grant };
}

export function createOneSignalNotifications({ sdk, appId, onDestination = () => {}, storage = null } = {}) {
  let started = false;
  let failed = false;
  let startPromise = null;
  const consent = createConsentState(storage);

  function pushSubscription() {
    return sdk?.User?.pushSubscription || null;
  }

  function validateSdk() {
    const push = pushSubscription();
    return Boolean(
      sdk &&
      typeof sdk.initialize === 'function' &&
      sdk.Notifications &&
      typeof sdk.Notifications.hasPermission === 'function' &&
      typeof sdk.Notifications.canRequestPermission === 'function' &&
      typeof sdk.Notifications.requestPermission === 'function' &&
      typeof sdk.Notifications.addEventListener === 'function' &&
      push &&
      typeof push.getOptedInAsync === 'function' &&
      typeof push.optIn === 'function' &&
      typeof push.optOut === 'function'
    );
  }

  async function reconcileAuthorizedSubscription() {
    const push = pushSubscription();
    if (!(await sdk.Notifications.hasPermission())) return false;
    if (!(await push.getOptedInAsync())) {
      await push.optIn();
    }
    return await push.getOptedInAsync();
  }

  async function state() {
    if (!started || failed) return 'unavailable';
    if (!consent.read()) return 'not-requested';
    if (await sdk.Notifications.hasPermission()) {
      return (await reconcileAuthorizedSubscription()) ? 'authorized' : 'unavailable';
    }
    return (await sdk.Notifications.canRequestPermission()) ? 'not-requested' : 'denied';
  }

  function start() {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      try {
        if (!validateSdk()) throw new Error('OneSignal SDK unavailable');
        await sdk.initialize(appId);
        sdk.Notifications.addEventListener('click', event => {
          onDestination(normalizeNotificationDestination(event?.notification?.additionalData));
        });

        if (!consent.read()) {
          await pushSubscription().optOut();
        } else if (await sdk.Notifications.hasPermission()) {
          await reconcileAuthorizedSubscription();
        }
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
        if (!(await ensureStarted()) || failed) return 'unavailable';
        return await state();
      } catch {
        return 'unavailable';
      }
    },
    request: async () => {
      if (!(await ensureStarted()) || failed) return 'unavailable';
      try {
        const accepted = await sdk.Notifications.requestPermission(false);
        consent.grant();
        if (accepted || await sdk.Notifications.hasPermission()) {
          await pushSubscription().optIn();
        }
        return await state();
      } catch {
        return 'unavailable';
      }
    },
    openSettings: async () => {
      if (!(await ensureStarted()) || failed) return false;
      try {
        await sdk.Notifications.requestPermission(true);
        if (consent.read() && await sdk.Notifications.hasPermission()) {
          await reconcileAuthorizedSubscription();
        }
        return true;
      } catch {
        return false;
      }
    }
  };

  return { start, adapter };
}
