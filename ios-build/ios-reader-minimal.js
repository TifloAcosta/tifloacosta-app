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
    const importPanel = document.getElementById('reading-start-heading')?.closest('.panel');
    importPanel?.removeAttribute('aria-labelledby');
    importPanel?.classList.add('ios-reader-import-panel');

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
    if (!controls || document.getElementById('ios-reading-document-controls-toggle')) return;
    const disclosure = controls.querySelector('details.reading-settings-disclosure');
    if (!disclosure) return;
    const summary = disclosure.querySelector(':scope > summary');
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = 'ios-reading-document-controls-toggle';
    toggle.textContent = tr('Controles', 'Controls');
    const options = document.createElement('section');
    options.id = 'ios-reading-document-controls-options';
    options.hidden = true;
    options.setAttribute('aria-label', tr('Controles del documento', 'Document controls'));
    for (const node of [...disclosure.children]) if (node !== summary) options.append(node);
    disclosure.replaceWith(toggle, options);
    function moveSetting(id, target, before) {
      const select = document.getElementById(id);
      const label = select && document.querySelector('label[for="' + id + '"]');
      if (!select || !label) return;
      const companion = select.nextElementSibling;
      const field = companion?.classList.contains('ios-reader-adjustable-field') ? companion : null;
      const adjusted = companion?.classList.contains('ios-reader-choice');
      const choices = adjusted && companion.nextElementSibling?.classList.contains('ios-reader-choice-options')
        ? companion.nextElementSibling : null;
      // Move the accessible control and its visual caption as ONE component.
      // Moving only the hidden select leaves orphaned bars in the old panel.
      for (const node of [label, select, field, adjusted ? companion : null, choices].filter(Boolean)) {
        if (before) target.insertBefore(node, before);
        else target.append(node);
      }
    }
    // Autoapagado y avance siempre a mano en la pantalla de lectura.
    const actions = controls.querySelector('.resource-actions');
    moveSetting('reading-document-timer', controls, actions);
    moveSetting('reading-navigation-unit', controls, actions);
    // La posición está en Controles, no en un General duplicado.
    moveSetting('reading-document-progress-percent', options, options.firstElementChild);
    options.querySelector('details.reading-settings-disclosure')?.remove();
    const more = document.getElementById('reading-document-open-more');
    const translation = more?.previousElementSibling;
    if (translation?.tagName === 'BUTTON' && /^(Traducción|Translation)$/.test(translation.textContent?.trim() || '')) {
      options.append(translation);
    }
    if (more) options.append(more);
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
