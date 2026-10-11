(() => {
  'use strict';
  // iOS-only parity adjustments: never loaded by the public website or Android.
  const isIndex = Boolean(document.getElementById('home-blocks'));
  const isActualidad = Boolean(document.getElementById('actualidad-sections'));
  const english = () => document.documentElement.lang === 'en';

  function text(es, en) { return english() ? en : es; }

  function addResourcesDirectory() {
    const view = document.getElementById('resources-view');
    const heading = document.getElementById('resources-view-heading');
    if (!view || !heading || document.getElementById('ios-accessible-apps-directory')) return;
    const wrapper = document.createElement('p');
    const link = document.createElement('a');
    link.id = 'ios-accessible-apps-directory';
    link.className = 'button-link';
    link.href = 'actualidad.html#apps-browser';
    link.textContent = text('Catálogo de apps accesibles', 'Accessible apps directory');
    wrapper.append(link);
    heading.insertAdjacentElement('afterend', wrapper);
  }

  function configureNativeSettings() {
    const visualToggle = document.getElementById('settings-toggle');
    const visualPanel = document.getElementById('settings-panel');
    const root = document.getElementById('config-section');
    if (!root || !visualToggle || !visualPanel) return;

    // The button stays in the VoiceOver order. The panel stays closed by default.
    visualToggle.hidden = false;
    visualToggle.setAttribute('aria-expanded', 'false');
    visualPanel.hidden = true;

    const oldNotifications = document.getElementById('notifications-heading');
    if (document.getElementById('ios-native-app-info')) return;
    const notifications = document.createElement('section');
    notifications.id = 'ios-native-notifications';
    notifications.className = 'panel';
    const notificationHeading = document.createElement('h3');
    notificationHeading.textContent = text('Notificaciones', 'Notifications');
    const notificationStatus = document.createElement('p');
    notificationStatus.textContent = text(
      'Las notificaciones aún no están habilitadas en esta versión para iPhone.',
      'Notifications are not enabled in this iPhone version yet.'
    );
    notifications.append(notificationHeading, notificationStatus);

    const about = document.createElement('section');
    about.id = 'ios-native-app-info';
    about.className = 'panel';
    const aboutHeading = document.createElement('h3');
    aboutHeading.textContent = text('Acerca de TifloAcosta', 'About TifloAcosta');
    const nativeVersion = document.createElement('p');
    nativeVersion.id = 'ios-native-version';
    nativeVersion.setAttribute('aria-live', 'polite');
    nativeVersion.textContent = text('Versión de iOS: consultando…', 'iOS version: checking…');
    const nativeBuild = document.createElement('p');
    nativeBuild.id = 'ios-native-build';
    nativeBuild.textContent = text('Compilación de TestFlight: consultando…', 'TestFlight build: checking…');
    about.append(aboutHeading, nativeVersion, nativeBuild);
    root.insertBefore(notifications, oldNotifications || null);
    root.insertBefore(about, oldNotifications || null);

    const plugin = window.Capacitor?.Plugins?.TifloYouTube;
    if (typeof plugin?.info !== 'function') {
      nativeVersion.textContent = text('Versión de iOS: no disponible', 'iOS version: unavailable');
      nativeBuild.textContent = text('Compilación: no disponible', 'Build: unavailable');
      return;
    }
    Promise.resolve().then(() => plugin.info()).then(info => {
      const version = String(info?.version || '').trim();
      const build = String(info?.build || '').trim();
      nativeVersion.textContent = text('Versión de iOS: ', 'iOS version: ') + (version || text('no disponible', 'unavailable'));
      nativeBuild.textContent = text('Compilación de TestFlight: ', 'TestFlight build: ') + (build || text('no disponible', 'unavailable'));
    }).catch(() => {
      nativeVersion.textContent = text('Versión de iOS: no disponible', 'iOS version: unavailable');
      nativeBuild.textContent = text('Compilación: no disponible', 'Build: unavailable');
    });
  }

  function correctDownloadsFocus() {
    const headings = {
      '#downloads': 'downloads-hub-heading',
      '#downloads-link': 'downloads-heading',
      '#downloads-sounds': 'sound-search-heading'
    };
    const id = headings[window.location.hash];
    if (!id) return;
    requestAnimationFrame(() => {
      const heading = document.getElementById(id);
      if (!heading || heading.closest('[hidden]')) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  }

  function replaceUnavailableClipboardAction() {
    // Pasting with the system edit menu remains available; avoid a denied API read.
    const control = document.getElementById('download-paste-link');
    if (control) control.remove();
  }

  function moveAppsOutOfActualidad() {
    const navigationLink = document.getElementById('section-apps-link');
    navigationLink?.remove();
    const appsSection = document.getElementById('apps-browser');
    if (!appsSection || document.getElementById('ios-apps-back-to-resources')) return;
    const wrapper = document.createElement('p');
    const link = document.createElement('a');
    link.id = 'ios-apps-back-to-resources';
    link.className = 'button-link back-link';
    link.href = 'index.html#resources';
    link.textContent = text('Volver a Recursos', 'Back to Resources');
    wrapper.append(link);
    appsSection.prepend(wrapper);
    const bottom = wrapper.cloneNode(true);
    bottom.querySelector('a')?.removeAttribute('id');
    appsSection.append(bottom);
  }

  function correctAppsFocus() {
    if (window.location.hash !== '#apps-browser') return;
    requestAnimationFrame(() => {
      const target = document.getElementById('ios-apps-back-to-resources');
      if (target && !target.closest('[hidden]')) target.focus({ preventScroll: true });
    });
  }

  function init() {
    if (isIndex) {
      addResourcesDirectory();
      configureNativeSettings();
      replaceUnavailableClipboardAction();
      window.addEventListener('hashchange', () => {
        correctDownloadsFocus();
        replaceUnavailableClipboardAction();
      });
      correctDownloadsFocus();
    }
    if (isActualidad) {
      moveAppsOutOfActualidad();
      window.addEventListener('hashchange', correctAppsFocus);
      correctAppsFocus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
