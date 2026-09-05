(() => {
  'use strict';

  const config = window.TIFLO_PUSHALERT_CONFIG || {};
  const integrationScriptUrl = typeof config.integrationScriptUrl === 'string' ? config.integrationScriptUrl.trim() : '';

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

  let ready = false;
  let state = 'preparing';
  let busy = false;
  let clearNoticeTimer = null;

  const currentLanguage = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'es';
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const permissionDenied = () => 'Notification' in window && Notification.permission === 'denied';
  const pushSupported = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const setStatus = value => { if (status.textContent !== value) status.textContent = value; };

  function announceStatus(message) {
    window.clearTimeout(clearNoticeTimer);
    setStatus(message);
    clearNoticeTimer = window.setTimeout(() => setStatus(''), 2500);
  }

  function render() {
    const c = copy[currentLanguage()];
    heading.textContent = c.heading;
    intro.textContent = c.intro;

    if (busy) {
      toggle.disabled = true;
      toggle.textContent = state === 'enabled' ? c.deactivating : c.activating;
      setStatus('');
      return;
    }

    toggle.setAttribute('aria-pressed', String(state === 'enabled'));

    if (state === 'preparing') {
      toggle.disabled = true;
      toggle.textContent = c.preparing;
      setStatus('');
    } else if (state === 'enabled') {
      toggle.disabled = false;
      toggle.textContent = c.deactivate;
      setStatus('');
    } else if (state === 'disabled') {
      toggle.disabled = false;
      toggle.textContent = c.activate;
      setStatus('');
    } else if (state === 'blocked') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      setStatus('');
    } else if (state === 'iosInstall') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      setStatus('');
    } else if (state === 'unsupported') {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      setStatus('');
    } else {
      toggle.disabled = true;
      toggle.textContent = c.activate;
      setStatus('');
    }
  }

  function getSubscriptionInfo() {
    try {
      if (!window.PushAlertCo || typeof window.PushAlertCo.getSubsInfo !== 'function') return null;
      return window.PushAlertCo.getSubsInfo();
    } catch (_) {
      return null;
    }
  }

  function refreshState() {
    if (isIOS() && !isStandalone()) {
      state = 'iosInstall';
      render();
      return;
    }

    if (!pushSupported()) {
      state = 'unsupported';
      render();
      return;
    }

    if (permissionDenied()) {
      state = 'blocked';
      render();
      return;
    }

    if (!ready) {
      state = 'preparing';
      render();
      return;
    }

    const info = getSubscriptionInfo();
    if (!info) {
      state = 'unavailable';
    } else if (info.status === 'subscribed') {
      state = 'enabled';
    } else if (info.status === 'denied') {
      state = 'blocked';
    } else {
      state = 'disabled';
    }
    render();
  }

  function finishAction(message) {
    busy = false;
    refreshState();
    if (message) announceStatus(message);
  }

  function onReady() {
    ready = true;
    refreshState();
  }

  function onSuccess(result) {
    const wasNew = result && result.alreadySubscribed === false;
    finishAction(wasNew ? copy[currentLanguage()].enabled : '');
  }

  function onFailure(result) {
    const code = result && Number(result.status);
    if (code === -1) {
      busy = false;
      state = 'blocked';
      render();
      announceStatus(copy[currentLanguage()].blocked);
      return;
    }
    if (code === 1) {
      finishAction(copy[currentLanguage()].disabled);
      return;
    }
    finishAction(copy[currentLanguage()].notActivated);
  }

  function toggleNotifications() {
    if (!ready || busy || !['enabled', 'disabled'].includes(state) || !window.PushAlertCo) return;

    if (state === 'disabled' && permissionDenied()) {
      state = 'blocked';
      render();
      return;
    }

    const wasEnabled = state === 'enabled';
    busy = true;
    render();

    try {
      if (wasEnabled) {
        window.PushAlertCo.unsubscribe();
        window.setTimeout(() => {
          if (busy) finishAction(copy[currentLanguage()].disabled);
        }, 1200);
      } else {
        window.PushAlertCo.forceSubscribe();
        window.setTimeout(() => {
          if (busy) {
            refreshState();
            if (state !== 'enabled') finishAction(copy[currentLanguage()].notActivated);
          }
        }, 5000);
      }
    } catch (_) {
      busy = false;
      state = permissionDenied() ? 'blocked' : 'unavailable';
      render();
      announceStatus(state === 'blocked' ? copy[currentLanguage()].blocked : copy[currentLanguage()].unavailable);
    }
  }

  function loadPushAlert() {
    if (!integrationScriptUrl || !/^https:\/\/cdn\.pushalert\.co\/integrate_[A-Za-z0-9_-]+\.js(?:\?.*)?$/.test(integrationScriptUrl)) {
      state = 'unavailable';
      render();
      return;
    }

    window.pushalertbyiw = window.pushalertbyiw || [];
    window.pushalertbyiw.push(['disableAutoInit', true]);
    window.pushalertbyiw.push(['onReady', onReady]);
    window.pushalertbyiw.push(['onSuccess', onSuccess]);
    window.pushalertbyiw.push(['onFailure', onFailure]);

    const script = document.createElement('script');
    script.src = integrationScriptUrl;
    script.async = true;
    script.onerror = () => {
      ready = false;
      state = 'unavailable';
      render();
    };
    document.head.append(script);
  }

  toggle.addEventListener('click', toggleNotifications);

  const languageObserver = new MutationObserver(render);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.addEventListener('focus', refreshState);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshState();
  });

  render();

  if (isIOS() && !isStandalone()) {
    state = 'iosInstall';
    render();
  } else if (!pushSupported()) {
    state = 'unsupported';
    render();
  } else {
    loadPushAlert();
  }
})();
