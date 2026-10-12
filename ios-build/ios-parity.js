(() => {
  'use strict';
  // iOS-only parity adjustments: never loaded by the public website or Android.
  const isIndex = Boolean(document.getElementById('home-blocks'));
  const isActualidad = Boolean(document.getElementById('actualidad-sections'));
  const isVideos = Boolean(document.getElementById('youtube-accessible-section'));
  const english = () => document.documentElement.lang === 'en';

  function text(es, en) { return english() ? en : es; }

  function alignHomeSections() {
    const navigation = document.querySelector('#home-blocks nav');
    if (!navigation) return;
    // Follow the Android logical order; no controls are removed.
    const ids = [
      'home-open-news', 'home-open-actualidad', 'home-open-resources',
      'home-open-reading', 'home-open-downloads', 'home-open-favorites',
      'home-open-videos', 'home-open-book', 'home-open-podcast',
      'home-open-contact', 'home-open-privacy', 'home-open-config'
    ];
    ids.forEach(id => {
      const control = document.getElementById(id);
      if (control && control.parentElement === navigation) navigation.append(control);
    });
  }

  function alignVideoSections() {
    const youtube = document.getElementById('youtube-accessible-section');
    const ownCatalog = document.getElementById('video-controls-section');
    if (youtube && ownCatalog && youtube.parentElement === ownCatalog.parentElement) {
      ownCatalog.parentElement.insertBefore(youtube, ownCatalog);
    }
  }

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

  // Preserve the launcher button when a user returns from a section.
  // Running this after the main hash router prevents its heading focus from
  // overriding the intended VoiceOver return position.
  function preserveBackNavigationFocus() {
    const returnKey = 'tiflo-ios-restore-home-origin';
    const lastEntryKey = 'tiflo-last-home-entry';
    const isHome = () => !window.location.hash || window.location.hash === '#home';
    const stored = key => {
      try { return window.sessionStorage.getItem(key) || ''; } catch { return ''; }
    };
    const write = (key, value) => {
      try { window.sessionStorage.setItem(key, value); } catch {}
    };
    const remove = key => {
      try { window.sessionStorage.removeItem(key); } catch {}
    };
    function focusLauncher() {
      if (!isHome()) return;
      const id = stored(lastEntryKey);
      if (!/^home-open-[a-z-]+$/.test(id)) return;
      const control = document.getElementById(id);
      if (!control || control.closest('[hidden]')) return;
      control.focus({ preventScroll: true });
      control.scrollIntoView?.({ block: 'nearest' });
    }
    function restoreAfterRender() {
      requestAnimationFrame(() => requestAnimationFrame(focusLauncher));
      // WKWebView may reset its accessibility cursor after the DOM focus event.
      setTimeout(focusLauncher, 180);
      // A returning WKWebView page can update its VoiceOver tree after the
      // first DOM focus. Restore the same origin once after that update.
      setTimeout(focusLauncher, 420);
    }
    document.getElementById('home-blocks')?.addEventListener('click', event => {
      const entry = event.target.closest?.('[id^="home-open-"]');
      const href = entry?.getAttribute?.('href') || '';
      if (/^(actualidad|videos|podcast)\.html(?:#.*)?$/.test(href)) write(returnKey, '1');
    }, true);
    let previousHash = window.location.hash;
    window.addEventListener('hashchange', () => {
      const nextHash = window.location.hash;
      if (isHome() && previousHash && previousHash !== '#home') restoreAfterRender();
      previousHash = nextHash;
    });
    if (isHome() && stored(returnKey) === '1') {
      remove(returnKey);
      restoreAfterRender();
    }
    // BFCache returns do not recreate the document, so run on pageshow too.
    window.addEventListener('pageshow', () => {
      if (!isHome() || stored(returnKey) !== '1') return;
      remove(returnKey);
      restoreAfterRender();
    });
  }

  // A system Back gesture does not use the custom back button and therefore
  // does not set actualidad-core's pendingFocusSelector. Infer the source
  // view from the hash transition and restore its launcher after rendering.
  function preserveActualidadBackFocus() {
    const returnTargets = {
      '#actualidad-home': {
        '#news-browser': 'section-news-link',
        '#apps-browser': 'section-apps-link',
        '#media-browser': 'section-media-link',
        '#media-accessibility': 'section-media-link',
        '#media-technology': 'section-media-link'
      },
      '#media-browser': {
        '#media-accessibility': 'media-accessibility-link',
        '#media-technology': 'media-technology-link'
      }
    };
    let previousHash = window.location.hash;
    window.addEventListener('hashchange', () => {
      const destination = window.location.hash;
      const origin = previousHash;
      previousHash = destination;
      const targetId = returnTargets[destination]?.[origin];
      if (!targetId) return;
      const restore = () => {
        if (window.location.hash !== destination) return;
        const target = document.getElementById(targetId);
        if (!target || target.closest?.('[hidden]')) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ block: 'nearest' });
      };
      requestAnimationFrame(() => requestAnimationFrame(restore));
      setTimeout(restore, 180);
    });
  }

  function maintainSingleBackAction() {
    const brand=document.querySelector('.site-header .brand');
    function update() {
      const isHome=isIndex&&(!location.hash||location.hash==='#home');
      if(brand){brand.hidden=!isHome;brand.setAttribute('aria-hidden',String(!isHome));}
    }
    document.querySelectorAll('main > section').forEach(section=>{
      const backs=[...section.querySelectorAll('[data-home-back]')];
      for(const item of backs.slice(1))item.closest('p')?.remove();
    });
    update();
    window.addEventListener('hashchange',update);
  }
  function init() {
    maintainSingleBackAction();
    if (isIndex) {
      preserveBackNavigationFocus();
      alignHomeSections();
      // Accessible apps now live under the Apps resource category.
      configureNativeSettings();
      replaceUnavailableClipboardAction();
      window.addEventListener('hashchange', () => {
        correctDownloadsFocus();
        replaceUnavailableClipboardAction();
      });
      correctDownloadsFocus();
    }
    if (isVideos) alignVideoSections();
    if (isActualidad) {
      preserveActualidadBackFocus();
      moveAppsOutOfActualidad();
      window.addEventListener('hashchange', correctAppsFocus);
      correctAppsFocus();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
