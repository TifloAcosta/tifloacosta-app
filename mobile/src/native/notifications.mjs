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
  let initialized = false;

  return {
    async initialize() {
      if (initialized) return;
      await oneSignal.initialize(appId);
      oneSignal.Notifications.addEventListener('click', event => {
        const value = notificationTargetUrl(event);
        if (!value) return;
        const target = resolveRoute(value);
        if (!target) return;
        router.enterExternal(target.route);
      });
      initialized = true;
    },

    async getPermissionStatus() {
      if (await oneSignal.Notifications.hasPermission()) return 'granted';
      return await oneSignal.Notifications.canRequestPermission() ? 'available' : 'denied';
    },

    async requestPermission() {
      return oneSignal.Notifications.requestPermission(false);
    }
  };
}
