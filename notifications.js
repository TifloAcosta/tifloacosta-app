(() => {
  'use strict';

  const ONESIGNAL_APP_ID = 'ed030723-7f6f-4745-8cd3-6938a9d04377';
  const ONESIGNAL_WORKER_PATH = 'tifloacosta-app/push/onesignal/OneSignalSDKWorker.js';
  const ONESIGNAL_WORKER_SCOPE = '/tifloacosta-app/push/onesignal/';
  const DEFAULT_URL = 'https://tifloacosta.github.io/tifloacosta-app/';

  const heading = document.querySelector('#notifications-heading');
  const intro = document.querySelector('#notifications-intro');
  const toggle = document.querySelector('#notifications-toggle');
  const status = document.querySelector('#notifications-status');
  if (!heading || !intro || !toggle || !status) return;

  const copy = {
    es: {
      heading: 'Notificaciones',
      intro: 'Recibe avisos cuando haya nuevos recursos, vídeos o novedades importantes. Solo se activarán si tú lo decides.',
      preparing: 'Preparando notificaciones…',
      activate: 'Activar notificaciones',
      deactivate: 'Desactivar notificaciones',
      activating: 'Activando…',
      deactivating: 'Desactivando…',
      enabled: 'Notificaciones activadas.',
      disabled: 'Notificaciones desactivadas.',
      notActivated: 'No se activaron las notificaciones. Puedes intentarlo de nuevo cuando quieras.',
      blocked: 'Las notificaciones están bloqueadas en el navegador. Cambia el permiso del sitio y vuelve a esta pantalla para poder activarlas.',
      unsupported: 'Este navegador o dispositivo no admite notificaciones web.',
      iosInstall: 'En iPhone o iPad, añade TifloAcosta App a la pantalla de inicio y ábrela desde allí para activar las notificaciones.',
      unavailable: 'No se pudo conectar con el servicio de notificaciones. Comprueba la conexión a Internet e inténtalo de nuevo.'
    },
    en: {
      heading: 'Notifications',
      intro: 'Receive alerts for new resources, videos, or important updates. Notifications are enabled only if you choose to turn them on.',
      preparing: 'Preparing notifications…',
      activate: 'Enable notifications',
      deactivate: 'Disable notifications',
      activating: 'Enabling…',
      deactivating: 'Disabling…',
      enabled: 'Notifications enabled.',
      disabled: 'Notifications disabled.',
      notActivated: 'Notifications were not enabled. You can try again whenever you want.',
      blocked: 'Notifications are blocked in your browser. Change this site’s notification permission, then return here to enable them.',
      unsupported: 'This browser or device does not support web notifications.',
      iosInstall: 'On iPhone or iPad, add TifloAcosta App to the Home Screen and open it from there to enable notifications.',
      unavailable: 'The notification service could not be reached. Check your internet connection and try again.'
    }
  };

  let OneSignalInstance = null;
  let state = 'preparing';
  let busy = false;
  let notice = '';

  const currentLanguage = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'es';
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const permissionDenied = () => 'Notification' in window && Notification.permission === 'denied';

  function render() {
    const c = copy[currentLanguage()];
    heading.textContent = c.heading;
    intro.textContent = c.intro;

    if (busy) {
      toggle.disabled = true;
      toggle.textContent = state === 'enabled' ? c.deactivating : c.activating;
      status.textContent = '';
      return;
    }

    toggle.setAttribute('aria-pressed', String(state === 'enabled'));

    if (state === 'preparing') {
      toggle.disabled = true;
      toggle.textContent = c.preparing;
      status.textContent = '';
    } else if (state === 'enabled') {
      toggle.disabled = false;
      toggle.textContent = c.deactivate;
      status.textContent = c.enabled;
    } else if (state === 'disabled') {
      toggle.disabled = false;
      toggle.textContent = c.activate;
      status.textContent = notice === 'notActivated' ? c.notActivated : c.disabled;
    } else if (state === 'blocked') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      status.textContent = c.blocked;
    } else if (state === 'iosInstall') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      status.textContent = c.iosInstall;
    } else if (state === 'unsupported') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      status.textContent = c.unsupported;
    } else {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      status.textContent = c.unavailable;
    }
  }

  function syncOneSignalLanguage() {
    if (!OneSignalInstance) return;
    try {
      OneSignalInstance.User.setLanguage(currentLanguage());
    } catch (_) {}
  }

  function refreshState() {
    if (!OneSignalInstance) return;
    notice = '';

    if (isIOS() && !isStandalone()) {
      state = 'iosInstall';
      render();
      return;
    }

    let supported = false;
    try {
      supported = OneSignalInstance.Notifications.isPushSupported();
    } catch (_) {}

    if (!supported) {
      state = 'unsupported';
    } else if (permissionDenied()) {
      state = 'blocked';
    } else {
      state = OneSignalInstance.User.PushSubscription.optedIn ? 'enabled' : 'disabled';
    }
    render();
  }

  async function toggleNotifications() {
    if (!OneSignalInstance || busy || !['enabled', 'disabled'].includes(state)) return;

    if (state === 'disabled' && permissionDenied()) {
      state = 'blocked';
      render();
      return;
    }

    const wasEnabled = state === 'enabled';
    busy = true;
    notice = '';
    render();

    try {
      if (wasEnabled) {
        await OneSignalInstance.User.PushSubscription.optOut();
      } else {
        await OneSignalInstance.User.PushSubscription.optIn();
      }
      refreshState();
      if (!wasEnabled && state === 'disabled') {
        notice = 'notActivated';
        render();
      }
    } catch (_) {
      state = permissionDenied() ? 'blocked' : 'unavailable';
      render();
    } finally {
      busy = false;
      render();
    }
  }

  toggle.addEventListener('click', toggleNotifications);

  const languageObserver = new MutationObserver(() => {
    syncOneSignalLanguage();
    render();
  });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.addEventListener('focus', () => {
    if (OneSignalInstance) refreshState();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && OneSignalInstance) refreshState();
  });

  render();

  const startupTimeout = window.setTimeout(() => {
    if (!OneSignalInstance) {
      state = 'unavailable';
      render();
    }
  }, 8000);

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        safari_web_id: 'web.onesignal.auto.5f8d50ad-7ec3-4f1c-a2de-134e8949294e',
        serviceWorkerPath: ONESIGNAL_WORKER_PATH,
        serviceWorkerParam: { scope: ONESIGNAL_WORKER_SCOPE },
        notifyButton: { enable: false },
        welcomeNotification: { disable: true },
        autoResubscribe: true
      });

      OneSignal.Notifications.setDefaultTitle('TifloAcosta App');
      OneSignal.Notifications.setDefaultUrl(DEFAULT_URL);
      OneSignalInstance = OneSignal;
      window.clearTimeout(startupTimeout);

      OneSignal.User.PushSubscription.addEventListener('change', refreshState);
      OneSignal.Notifications.addEventListener('permissionChange', refreshState);
      syncOneSignalLanguage();
      refreshState();
    } catch (_) {
      window.clearTimeout(startupTimeout);
      state = 'unavailable';
      render();
    }
  });
})();
