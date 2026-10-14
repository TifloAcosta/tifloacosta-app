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
    const summary = controls.querySelector('details.reading-settings-disclosure > summary');
    setText(summary, tr('Ajustes', 'Settings'));

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
