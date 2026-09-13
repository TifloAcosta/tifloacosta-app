import { parseTifloAcostaUrl } from './deep-links.mjs';

export function notificationTargetUrl(event) {
  const notification = event?.notification;
  if (!notification) return null;
  if (typeof notification.launchURL === 'string' && notification.launchURL) return notification.launchURL;
  const data = notification.additionalData;
  if (data && typeof data.url === 'string' && data.url) return data.url;
  return null;
}

export function createNotificationService({
  oneSignal,
  appId,
  router,
  resolveRoute = parseTifloAcostaUrl
}) {
  let initializePromise = null;

  const initialize = () => {
    if (initializePromise) return initializePromise;
    initializePromise = Promise.resolve(oneSignal.initialize(appId)).then(() => {
      oneSignal.Notifications.addEventListener('click', event => {
        const value = notificationTargetUrl(event);
        if (!value) return;
        const target = resolveRoute(value);
        if (!target) return;
        router.enterExternal(target.route);
      });
    });
    return initializePromise;
  };

  return {
    initialize,

    async getPermissionStatus() {
      await initialize();
      if (await oneSignal.Notifications.hasPermission()) return 'granted';
      return await oneSignal.Notifications.canRequestPermission() ? 'available' : 'denied';
    },

    async requestPermission() {
      await initialize();
      return oneSignal.Notifications.requestPermission(false);
    }
  };
}
