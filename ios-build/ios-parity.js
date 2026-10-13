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
    const sourceLaunchers = {
      '#resources': 'home-open-resources',
      '#favorites': 'home-open-favorites',
      '#reading': 'home-open-reading',
      '#news': 'home-open-news',
      '#book': 'home-open-book',
      '#contact': 'home-open-contact',
      '#privacy': 'home-open-privacy',
      '#config': 'home-open-config',
      '#downloads': 'home-open-downloads',
      '#downloads-link': 'home-open-downloads',
      '#downloads-sounds': 'home-open-downloads'
    };
    document.addEventListener?.('click', event => {
      if (!event.target?.closest?.('[data-home-back]')) return;
      const id = sourceLaunchers[window.location.hash];
      if (id) write(lastEntryKey, id);
      write(returnKey, '1');
    }, true);
    let previousHash = window.location.hash;
    window.addEventListener('hashchange', () => {
      const nextHash = window.location.hash;
      if (isHome() && previousHash && previousHash !== '#home') {
        const origin = sourceLaunchers[previousHash];
        if (origin) write(lastEntryKey, origin);
        restoreAfterRender();
      }
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
      const isHome=isIndex&&(!window.location.hash||window.location.hash==='#home');
      if(brand){brand.hidden=!isHome;brand.setAttribute('aria-hidden',String(!isHome));}
    }
    (document.querySelectorAll?.('main > section') || []).forEach(section=>{
      const backs=[...section.querySelectorAll('[data-home-back]')];
      for(const item of backs.slice(1))item.closest('p')?.remove();
    });
    update();
    window.addEventListener('hashchange',update);
  }

  // iOS reading experience uses the packaged web reader, not Android's native plugins.
  function improveReaderExperience() {
    const section = document.getElementById('reading-section');
    if (!section) return;
    const localized = (es, en) => text(es, en);
    const storageGet = (key, otherwise = '') => {
      try { return window.localStorage?.getItem(key) || otherwise; } catch { return otherwise; }
    };
    const storageSet = (key, value) => {
      try { window.localStorage?.setItem(key, value); } catch {}
    };
    const validUnits = ['block', 'paragraph', 'sentence', 'heading', 'mainHeading', 'listItem', 'quote', 'tableCell'];
    const globalUnitKey = 'tiflo-ios-default-reading-unit-v1';
    const overrideKey = 'tiflo-ios-document-units-v1';
    function globalUnit() {
      const canonical = document.getElementById('reading-default-navigation')?.value;
      if (validUnits.includes(canonical)) return canonical;
      const saved = storageGet(globalUnitKey, 'block');
      return validUnits.includes(saved) ? saved : 'block';
    }
    function readOverrides() {
      try {
        const value = JSON.parse(storageGet(overrideKey, '{}'));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch { return {}; }
    }

    // OCR remains available contextually after an image or a scanned PDF is opened.
    // Do not duplicate file selection or clutter the main TifloLector screen.

    // One global default. Each document may override it without changing the default.
    const settings = document.getElementById('reading-settings-web');
    if (settings && !document.getElementById('reading-settings-disclosure') && !document.getElementById('ios-reading-settings-disclosure')) {
      const toggle = document.createElement('button');
      toggle.id = 'ios-reading-settings-disclosure';
      toggle.type = 'button';
      toggle.textContent = localized('Ajustes de lectura', 'Reading settings');
      toggle.setAttribute('aria-controls', settings.id);
      toggle.setAttribute('aria-expanded', 'false');
      settings.before(toggle);
      settings.hidden = true;
      toggle.addEventListener('click', () => {
        settings.hidden = !settings.hidden;
        toggle.setAttribute('aria-expanded', String(!settings.hidden));
        if (!settings.hidden) settings.querySelector('h3')?.focus({ preventScroll: true });
        else toggle.focus({ preventScroll: true });
      });
    }
    if (settings && !document.getElementById('reading-default-navigation') && !document.getElementById('ios-reading-default-unit')) {
      const label = document.createElement('label');
      label.htmlFor = 'ios-reading-default-unit';
      label.textContent = localized('Avance predeterminado para todos los documentos', 'Default navigation unit for all documents');
      const select = document.createElement('select');
      select.id = 'ios-reading-default-unit';
      for (const [value, es, en] of [
        ['block', 'Bloque', 'Block'], ['paragraph', 'Párrafo', 'Paragraph'],
        ['sentence', 'Frase', 'Sentence'], ['heading', 'Encabezado', 'Heading'],
        ['mainHeading', 'Encabezado principal', 'Main heading'],
        ['listItem', 'Elemento de lista', 'List item'],
        ['quote', 'Cita', 'Quote'], ['tableCell', 'Celda de tabla', 'Table cell']
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = localized(es, en);
        select.append(option);
      }
      select.value = globalUnit();
      select.addEventListener('change', () => {
        storageSet(globalUnitKey, select.value);
        const notice = document.getElementById('reading-settings-status');
        if (notice) notice.textContent = localized(
          'Unidad predeterminada guardada. Podrás cambiarla dentro de cada documento.',
          'Default unit saved. You can override it inside each document.'
        );
      });
      const note = document.createElement('p');
      note.textContent = localized(
        'Este ajuste se aplica al abrir documentos sin una preferencia particular.',
        'This setting applies to documents without their own preference.'
      );
      const container = document.createElement('div');
      container.append(label, select, note);
      settings.append(container);
    }

    // Correct browser-oriented language without claiming unavailable native voices.
    function amendText(node, replacements) {
      if (!node) return;
      const normalize = () => {
        let value = node.textContent || '';
        for (const [from, to] of replacements) value = value.replace(from, to);
        if (value !== node.textContent) node.textContent = value;
      };
      new MutationObserver(normalize).observe(node, { childList: true, subtree: true, characterData: true });
      normalize();
    }
    const voiceSelect = document.getElementById('reading-voice');
    if (voiceSelect) {
      const adjust = () => {
        for (const option of voiceSelect.options) {
          const next = option.textContent
            .replace('Voz predeterminada del navegador', 'Voz predeterminada del lector')
            .replace('Browser default voice', 'Reader default voice');
          if (option.textContent !== next) option.textContent = next;
        }
      };
      new MutationObserver(adjust).observe(voiceSelect, { childList: true });
      adjust();
    }
    amendText(document.getElementById('reading-voice-status'), [
      [/Esperando las voces del navegador/g, 'Consultando las voces disponibles para este lector en iOS'],
      [/Waiting for browser voices/g, 'Checking voices available to this iOS reader']
    ]);
    amendText(document.getElementById('reading-external-voices-intro'), [
      [/Consulta proveedores externos[^.]*\.[^.]*\./g,
        'Las voces disponibles aquí pueden ser menos que las configuradas para VoiceOver. Para gestionar las voces del iPhone, consulta Ajustes, Accesibilidad y las opciones de voz del sistema. Los proveedores externos no garantizan integración con TifloLector.'],
      [/Browse external providers[^.]*\.[^.]*\./g,
        'The voices available here may differ from your VoiceOver voices. Manage iPhone voices in Settings, Accessibility and the system voice options. External providers may not work with TifloReader.']
    ]);
    amendText(document.getElementById('reading-translation-intro'), [
      [/Traduce el documento con el motor disponible en tu navegador\. El original se conserva\./g,
        'La traducción utiliza los idiomas del sistema iOS y conserva el documento original.'],
      [/Translate the document with the engine available in your browser\. The original is preserved\./g,
        'Translation uses iOS language models and preserves your original document.']
    ]);
    amendText(document.getElementById('reading-translation-status'), [
      [/Este navegador no ofrece traducción integrada para TifloLector\./g,
        'Comprueba la disponibilidad de los idiomas necesarios en el sistema.'],
      [/This browser does not provide built-in translation for TifloReader\./g,
        'Check that the required translation languages are available in iOS.']
    ]);

    function installDocumentControls() {
      const controls = document.getElementById('reading-document-controls');
      if (!controls || controls.dataset.iosReadingImproved) return;
      const audio = document.getElementById('reading-document-open-audio');
      const visual = document.getElementById('reading-document-open-visual');
      const more = document.getElementById('reading-document-open-more');
      const unit = document.getElementById('reading-navigation-unit');
      const title = document.getElementById('reading-document-title');
      if (!audio || !visual || !more || !unit || !title) return;
      controls.dataset.iosReadingImproved = '1';

      // A single settings menu contains sound/voices and visual preferences.
      const group = document.createElement('div');
      group.className = 'resource-actions';
      group.hidden = true;
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.textContent = localized('Ajustes de lectura', 'Reading settings');
      menu.setAttribute('aria-expanded', 'false');
      const wrapper = document.createElement('div');
      wrapper.append(menu, group);
      more.before(wrapper);
      group.append(audio, visual);
      menu.addEventListener('click', () => {
        group.hidden = !group.hidden;
        menu.setAttribute('aria-expanded', String(!group.hidden));
        if (!group.hidden) audio.focus();
        else menu.focus();
      });

      // Translation is easy to find without hiding its availability message.
      const translate = document.createElement('button');
      translate.type = 'button';
      translate.textContent = localized('Traducción', 'Translation');
      translate.addEventListener('click', () => {
        more.click();
        queueMicrotask(() => {
          const heading = document.getElementById('reading-translation-heading');
          if (heading && !heading.closest('[hidden]')) {
            heading.tabIndex = -1;
            heading.focus();
          }
        });
      });
      more.before(translate);

      // OCR for another scanned document, without exposing an unusable OCR command.
      const morePanel = document.getElementById('reading-document-more-actions');
      if (morePanel) {
        const ocr = document.createElement('button');
        ocr.type = 'button';
        ocr.textContent = localized('OCR: abrir imagen o PDF escaneado', 'OCR: open an image or scanned PDF');
        ocr.addEventListener('click', () => {
          const back = document.getElementById('reading-reader-back');
          back?.click();
          queueMicrotask(() => fileInput?.focus());
        });
        morePanel.append(ocr);
      }

      let documentKey = null;
      const restoreUnit = () => {
        const key = unit.dataset.iosBookKey || '';
        if (!key || key === documentKey) return;
        documentKey = key;
        const overrides = readOverrides();
        const selected = overrides[key];
        unit.value = validUnits.includes(selected) ? selected : globalUnit();
        unit.dispatchEvent(new Event('change', { bubbles: true }));
      };
      // Initialization is separate so restoring a setting does not store a spurious override.
      restoreUnit();
      unit.addEventListener('change', () => {
        const key = unit.dataset.iosBookKey || documentKey;
        if (!key || !validUnits.includes(unit.value)) return;
        const overrides = readOverrides();
        overrides[key] = unit.value;
        storageSet(overrideKey, JSON.stringify(overrides));
      });
      new MutationObserver(restoreUnit).observe(title, { childList: true, subtree: true, characterData: true });
      new MutationObserver(restoreUnit).observe(unit, { attributes: true, attributeFilter: ['data-ios-book-key'] });
    }

    installDocumentControls();
    new MutationObserver(installDocumentControls).observe(section, { childList: true, subtree: true });
  }

  function init() {
    maintainSingleBackAction();
    if (isIndex) {
      preserveBackNavigationFocus();
      improveReaderExperience();
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
