(() => {
  'use strict';
  // Solo en el lector empaquetado para iOS: no modifica Web ni Android.
  const reader = document.getElementById('reading-section');
  if (!reader) return;
  const tr = (es, en) => document.documentElement.lang === 'en' ? en : es;

  function hide(id) {
    const node = document.getElementById(id);
    if (node && !node.hidden) node.hidden = true;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function compactMain() {
    for (const id of [
      'reading-build-identity',
      'reading-intro',
      'reading-start-heading',
      'reading-settings-heading',
      'reading-library-intro'
    ]) hide(id);

    // El encabezado "Abrir documento" no debe preceder al único botón Importar.
    document.getElementById('reading-start-heading')
      ?.closest('.panel')?.removeAttribute('aria-labelledby');

    const settings = document.getElementById('reading-settings-web');
    settings?.removeAttribute('aria-labelledby');
    setText(document.getElementById('reading-settings-summary'), tr('Ajustes', 'Settings'));
    setText(document.getElementById('reading-library-filter-label'), tr('Filtro', 'Filter'));
    setText(document.getElementById('reading-library-query-label'), tr('Buscar', 'Search'));

    // No repetir Audio y voz ni Presentación visual como encabezado y leyenda.
    hide('reading-audio-settings-heading');
    hide('reading-visual-settings-heading');

    // Un cierre explícito evita continuar de General a la biblioteca sin límite de submenú.
    const general = document.getElementById('reading-general-settings');
    if (general && !general.querySelector('[data-ios-close-general]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.dataset.iosCloseGeneral = '1';
      setText(close, tr('Cerrar', 'Close'));
      close.addEventListener('click', () => {
        general.open = false;
        general.querySelector('summary')?.focus({ preventScroll: true });
      });
      general.append(close);
    }
    const settingsMenu = document.getElementById('reading-settings-disclosure');
    if (settingsMenu && !settingsMenu.querySelector('[data-ios-close-settings]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.dataset.iosCloseSettings = '1';
      setText(close, tr('Cerrar ajustes', 'Close settings'));
      close.addEventListener('click', () => {
        if (general) general.open = false;
        settingsMenu.open = false;
        document.getElementById('reading-settings-summary')?.focus({ preventScroll: true });
      });
      document.getElementById('reading-settings-web')?.append(close);
    }

    for (const id of ['reading-audio-view', 'reading-visual-view', 'reading-queue-web', 'reading-marks-web']) {
      const panel = document.getElementById(id);
      if (!panel) continue;
      const buttons = panel.querySelectorAll('[data-reading-back]');
      buttons.forEach((button, index) => {
        if (index > 0) {
          if (!button.hidden) button.hidden = true;
        } else setText(button, tr('Cerrar', 'Close'));
      });
    }
  }

  function compactDocument() {
    const controls = document.getElementById('reading-document-controls');
    if (!controls) return;
    const disclosure = controls.querySelector('details.reading-settings-disclosure');
    if (disclosure && !document.getElementById('ios-reading-document-controls-toggle')) {
      // Un botón auténtico elimina el triángulo de <summary> que VoiceOver
      // puede anunciar por separado sin nombre. No se alteran los manejadores
      // de los controles originales.
      const summary = disclosure.querySelector(':scope > summary');
      const toggle = document.createElement('button');
      toggle.id = 'ios-reading-document-controls-toggle';
      toggle.type = 'button';
      setText(toggle, tr('Controles', 'Controls'));
      const options = document.createElement('div');
      options.id = 'ios-reading-document-controls-options';
      options.hidden = true;
      toggle.setAttribute('aria-controls', options.id);
      toggle.setAttribute('aria-expanded', 'false');
      for (const child of [...disclosure.children]) {
        if (child !== summary) options.append(child);
      }
      disclosure.replaceWith(toggle, options);

      // Todas las personalizaciones específicas de este libro deben estar en
      // Controles > General y no escondidas detrás de Más acciones.
      const general = options.querySelector('details.reading-settings-disclosure');
      const morePanel = document.getElementById('reading-document-more-actions');
      if (general && morePanel) {
        for (const id of ['reading-document-progress-percent', 'reading-document-timer']) {
          const select = document.getElementById(id);
          const label = select && document.querySelector('label[for="' + id + '"]');
          if (!select || !label) continue;
          const companion = select.nextElementSibling;
          const accessible = companion?.classList.contains('ios-reader-adjustable')
            || companion?.classList.contains('ios-reader-choice');
          const choices = accessible && companion.nextElementSibling?.classList.contains('ios-reader-choice-options')
            ? companion.nextElementSibling : null;
          general.append(label, select);
          if (accessible) general.append(companion);
          if (choices) general.append(choices);
        }
        const closeGeneral = document.createElement('button');
        closeGeneral.type = 'button';
        setText(closeGeneral, tr('Cerrar', 'Close'));
        closeGeneral.addEventListener('click', () => {
          general.open = false;
          general.querySelector('summary')?.focus({ preventScroll: true });
        });
        general.append(closeGeneral);
      }
      // Traducción, búsqueda y las acciones complementarias permanecen
      // disponibles dentro de Controles; no hay un segundo menú exterior.
      const more = document.getElementById('reading-document-open-more');
      // La adaptación iOS puede haber creado el acceso a Traducción
      // antes que este menú. Reunir también esa acción dentro de Controles.
      const translation = more?.previousElementSibling;
      if (translation?.tagName === 'BUTTON' &&
          translation.textContent?.trim() === tr('Traducción', 'Translation')) {
        options.append(translation);
      }
      if (more) options.append(more);
      const close = document.createElement('button');
      close.type = 'button';
      setText(close, tr('Cerrar', 'Close'));
      const collapse = () => {
        if (general) general.open = false;
        options.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus({ preventScroll: true });
      };
      close.addEventListener('click', collapse);
      options.append(close);
      toggle.addEventListener('click', () => {
        if (!options.hidden) { collapse(); return; }
        options.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        options.querySelector('button:not([hidden]), summary')?.focus({ preventScroll: true });
      });
    }

    for (const id of ['reading-document-audio', 'reading-document-visual', 'reading-document-more-actions']) {
      const panel = document.getElementById(id);
      if (!panel) continue;
      for (const button of panel.querySelectorAll('button')) {
        if (['Volver a la lectura', 'Back to reading'].includes(button.textContent?.trim())) {
          setText(button, tr('Cerrar', 'Close'));
        }
      }
    }
  }

  function reconcile() {
    compactMain();
    compactDocument();
  }

  reconcile();
  // El lector crea menús y actualiza etiquetas después de iniciar. Reconciliar
  // únicamente cambios de contenido; no observar atributos para evitar bucles.
  new MutationObserver(reconcile).observe(reader, {
    childList: true, subtree: true, characterData: true
  });
})();
