(() => {
  'use strict';
  // Navegación exclusiva de TifloLector empaquetado para iOS (base 400079).
  // No interviene en la Web pública ni en Android.
  const reader = document.getElementById('reading-section');
  if (!reader) return;
  const tr = (es, en) => document.documentElement.lang === 'en' ? en : es;
  const focus = element => element?.focus({ preventScroll: true });
  const visible = element => !!element && !element.hidden && !element.closest('[hidden]');
  let mainInstalled = false;
  let documentInstalled = null;

  function button(label, id, action) {
    const result = document.createElement('button');
    result.type = 'button';
    result.id = id;
    result.textContent = label;
    result.addEventListener('click', action);
    return result;
  }

  function installSettingsFolders() {
    if (mainInstalled) return;
    const old = document.getElementById('reading-settings-disclosure');
    const menu = document.getElementById('reading-settings-web');
    const general = document.getElementById('reading-general-settings');
    const audio = document.getElementById('reading-audio-view');
    const visual = document.getElementById('reading-visual-view');
    if (!old || !menu || !general || !audio || !visual) return;
    mainInstalled = true;
    const opener = button(tr('Ajustes', 'Settings'), 'ios-reading-settings-open', openRoot);
    const folder = document.createElement('section');
    folder.id = 'ios-reading-settings-folder';
    folder.className = 'panel';
    folder.hidden = true;
    folder.setAttribute('aria-label', tr('Ajustes', 'Settings'));
    old.replaceWith(opener, folder);
    folder.append(menu, audio, visual);
    // Los botones de Audio, Visual y General dan entrada, no despliegan contenido.
    const generalOpener = button('General', 'ios-reading-general-open', () => showSub('general'));
    const generalFolder = document.createElement('section');
    generalFolder.id = 'ios-reading-general-folder';
    generalFolder.hidden = true;
    generalFolder.setAttribute('aria-label', 'General');
    for (const node of [...general.children]) {
      if (node.tagName !== 'SUMMARY' && !node.dataset?.iosCloseGeneral) generalFolder.append(node);
    }
    general.replaceWith(generalOpener);
    folder.append(generalFolder);
    const oldClose = menu.querySelector('[data-ios-close-settings]');
    oldClose?.remove();
    const closeRoot = button(tr('Cerrar', 'Close'), 'ios-reading-settings-close', closeSettings);
    menu.append(closeRoot);
    const closeGeneral = button(tr('Cerrar', 'Close'), 'ios-reading-general-close', () => showList(generalOpener));
    generalFolder.append(closeGeneral);
    const panels = { 'reading-audio-view': audio, 'reading-visual-view': visual, general: generalFolder };
    const openers = { 'reading-audio-view': menu.querySelector('[data-reading-view="reading-audio-view"]'),
      'reading-visual-view': menu.querySelector('[data-reading-view="reading-visual-view"]'), general: generalOpener };
    let saved = null;
    let active = '';

    function showList(returnTo) {
      active = '';
      menu.hidden = false;
      for (const panel of Object.values(panels)) panel.hidden = true;
      focus(returnTo || openers.general);
    }
    function showSub(id) {
      const panel = panels[id];
      if (!panel) return;
      active = id;
      menu.hidden = true;
      for (const candidate of Object.values(panels)) candidate.hidden = candidate !== panel;
      // Evitar dos encabezados con el mismo nombre del botón de entrada.
      const heading = panel.querySelector('h3.reading-subview-heading, h3[id$="-view-heading"]');
      if (heading) heading.hidden = true;
      const first = [...panel.querySelectorAll('input, select, button, textarea')]
        .find(el => !el.hidden && !el.disabled && !el.matches('[data-reading-back]'));
      focus(first || panel.querySelector('[data-reading-back]'));
    }
    function openRoot() {
      if (saved) return;
      saved = new Map([...reader.children].filter(el => el !== folder).map(el => [el, el.hidden]));
      for (const el of saved.keys()) el.hidden = true;
      folder.hidden = false;
      showList(null);
      focus(openers['reading-audio-view'] || generalOpener);
    }
    function closeSettings() {
      if (!saved) return;
      showList(null);
      folder.hidden = true;
      for (const [el, wasHidden] of saved) {
        if (el.isConnected) el.hidden = wasHidden;
      }
      saved = null;
      focus(opener);
    }

    folder.addEventListener('click', event => {
      const launch = event.target.closest('button[data-reading-view]');
      if (launch && menu.contains(launch)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSub(launch.dataset.readingView);
        return;
      }
      const back = event.target.closest('button[data-reading-back]');
      if (back && active) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showList(openers[active]);
      }
    }, true);
    // Un retorno del sistema debe cerrar la carpeta sin mezclar su contenido con Biblioteca.
    folder.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (active) showList(openers[active]);
        else closeSettings();
      }
    });
  }

  function tidyIdleStatus() {
    const status = document.getElementById('reading-status');
    if (!status) return;
    // Conservar anuncios de errores, importaciones y progreso; ocultar solo
    // el texto ocioso que aparece debajo de Importar.
    const idle = /^(lectura preparada|reading ready)[.!]?$/i.test(status.textContent.trim());
    if (status.hidden !== idle) status.hidden = idle;
  }

  function labelUnannouncedControls() {
    const names = {
      'reading-play': tr('Reproducir o pausar', 'Play or pause'),
      'reading-previous': tr('Anterior', 'Previous'),
      'reading-next': tr('Siguiente', 'Next'),
      'reading-reader-back': tr('Cerrar libro', 'Close book'),
      'reading-document-open-audio': tr('Audio y voz', 'Audio and voice'),
      'reading-document-open-visual': tr('Presentación visual', 'Visual presentation'),
      'reading-document-open-more': tr('Más acciones', 'More actions')
    };
    for (const el of reader.querySelectorAll('button')) {
      if (el.hidden || el.hasAttribute('aria-label') || el.textContent.trim() || el.title) continue;
      el.setAttribute('aria-label', names[el.id] || tr('Acción de lectura', 'Reading action'));
    }
  }

  function installDocumentFolders() {
    const root = document.getElementById('reading-document-controls');
    const options = document.getElementById('ios-reading-document-controls-options');
    const toggle = document.getElementById('ios-reading-document-controls-toggle');
    if (!root || !options || !toggle || documentInstalled === root) return;
    documentInstalled = root;
    const audio = document.getElementById('reading-document-audio');
    const visual = document.getElementById('reading-document-visual');
    const more = document.getElementById('reading-document-more-actions');
    if (!audio || !visual || !more) { documentInstalled = null; return; }
    options.append(audio, visual, more);
    installBookManagement(options);
    const general = options.querySelector('details.reading-settings-disclosure');
    let generalFolder = null;
    let generalButton = null;
    if (general) {
      generalFolder = document.createElement('section');
      generalFolder.id = 'ios-reading-document-general-folder';
      generalFolder.setAttribute('aria-label', 'General');
      generalFolder.hidden = true;
      generalButton = button('General', 'ios-reading-document-general-open', () => showPanel(generalFolder, generalButton));
      for (const el of [...general.children]) {
        if (el.tagName !== 'SUMMARY' && !el.dataset?.iosCloseGeneral) generalFolder.append(el);
      }
      general.replaceWith(generalButton, generalFolder);
      generalFolder.append(button(tr('Cerrar', 'Close'), 'ios-reading-document-general-close', closePanel));
    }
    const panels = [audio, visual, more, generalFolder].filter(Boolean);
    const audioButton = document.getElementById('reading-document-open-audio');
    const visualButton = document.getElementById('reading-document-open-visual');
    const moreButton = document.getElementById('reading-document-open-more');
    let current = null;
    let currentOpener = null;
    const primary = [...options.children].filter(item => !panels.includes(item));
    function closePanel() {
      if (!current) return;
      current.hidden = true;
      current = null;
      for (const item of primary) item.hidden = false;
      focus(currentOpener || toggle);
      currentOpener = null;
    }
    function showPanel(panel, opener) {
      if (!panel) return;
      for (const sibling of panels) sibling.hidden = sibling !== panel;
      for (const item of primary) item.hidden = true;
      current = panel;
      currentOpener = opener;
      // Solo controles de la subcarpeta activa: el lector no sigue hasta Biblioteca.
      const first = [...panel.querySelectorAll('select, input, textarea, button')]
        .find(el => !el.hidden && !el.disabled && el.textContent.trim() !== tr('Cerrar', 'Close'));
      focus(first || panel);
    }
    for (const [launch, panel] of [[audioButton, audio], [visualButton, visual], [moreButton, more]]) {
      launch?.addEventListener('click', () => queueMicrotask(() => showPanel(panel, launch)));
    }
    options.addEventListener('click', event => {
      const close = event.target.closest('button');
      if (!current || !close || !current.contains(close)) return;
      if (close.textContent.trim() !== tr('Cerrar', 'Close')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
    }, true);
    toggle.addEventListener('click', () => {
      if (options.hidden && current) closePanel();
    });
    options.addEventListener('keydown', event => {
      if (event.key === 'Escape' && current) { event.preventDefault(); closePanel(); }
    });
  }


  function installLibrarySort() {
    const selection = document.getElementById('reading-library-filter');
    const search = document.getElementById('reading-library-query-label');
    if (!selection || !search || document.getElementById('ios-reading-library-sort')) return;
    const label = document.createElement('label');
    label.htmlFor = 'ios-reading-library-sort';
    label.textContent = tr('Ordenar por', 'Sort by');
    const select = document.createElement('select');
    select.id = 'ios-reading-library-sort';
    for (const [value, es, en] of [
      ['lastRead', 'Última lectura', 'Last read'],
      ['imported', 'Fecha de importación', 'Date imported'],
      ['title', 'Título', 'Title'],
      ['author', 'Autor', 'Author'],
      ['format', 'Formato', 'Format']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = tr(es, en);
      select.append(option);
    }
    select.value = 'lastRead';
    search.before(label, select);
  }

  function compactLibraryCards() {
    const list = document.getElementById('reading-library-list');
    if (!list) return;
    for (const card of list.querySelectorAll('.reading-library-title-card')) {
      const actions = card.querySelector('.reading-library-details-toggle');
      const details = card.querySelector('.reading-library-title-details');
      if (!actions || !details) continue;
      if (actions.textContent !== tr('Acciones', 'Actions')) actions.textContent = tr('Acciones', 'Actions');
      const heading = details.querySelector('h4');
      if (heading && heading.textContent !== tr('Acciones del documento', 'Document actions')) {
        heading.textContent = tr('Acciones del documento', 'Document actions');
      }
      // Los controles especializados de audio/visual se conservan internamente
      // para sus gestores, pero no se presentan en la lista de documentos.
      const group = [...details.querySelectorAll('.resource-actions')].find(el =>
        [...el.children].some(button => button.textContent?.trim() === tr('Audio y voz', 'Audio and voice')));
      if (group) for (const button of group.children) {
        if (['Audio y voz', 'Presentación visual', 'Audio and voice', 'Visual presentation'].includes(button.textContent?.trim())) {
          button.hidden = true;
        }
      }
    }
  }

  function installBookManagement(options) {
    if (options.querySelector('#ios-reading-book-actions')) return;
    const section = document.createElement('section');
    section.id = 'ios-reading-book-actions';
    section.setAttribute('aria-label', tr('Gestión del libro', 'Book management'));
    const label = document.createElement('label');
    label.htmlFor = 'ios-reading-book-export-format';
    label.textContent = tr('Formato de exportación', 'Export format');
    const format = document.createElement('select');
    format.id = 'ios-reading-book-export-format';
    for (const [v, es, en] of [['original', 'Original', 'Original'],
      ['txt', 'TXT', 'TXT'], ['html', 'HTML accesible', 'Accessible HTML']]) {
      const option = document.createElement('option');
      option.value = v; option.textContent = tr(es, en); format.append(option);
    }
    const feedback = document.createElement('p');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    const exportButton = button(tr('Exportar', 'Export'), 'ios-reading-book-export', () => {
      void (async () => {
        if (!window.TifloIOSBookActions?.hasSavedBook()) {
          feedback.textContent = tr('Primero guarda el libro.', 'Save the book first.'); return;
        }
        const ok = await window.TifloIOSBookActions.exportCurrent(format.value);
        feedback.textContent = ok ? tr('Exportación preparada.', 'Export prepared.')
          : tr('No se pudo exportar.', 'Export failed.');
      })();
    });
    const rename = button(tr('Cambiar título', 'Rename'), 'ios-reading-book-rename', () => {
      if (!window.TifloIOSBookActions?.hasSavedBook()) {
        feedback.textContent = tr('Primero guarda el libro.', 'Save the book first.'); return;
      }
      form.hidden = false;
      name.value = document.getElementById('reading-document-title')?.textContent?.trim() || '';
      focus(name);
    });
    const form = document.createElement('form');
    form.hidden = true;
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = 'ios-reading-book-name';
    nameLabel.textContent = tr('Nuevo título', 'New title');
    const name = document.createElement('input');
    name.id = 'ios-reading-book-name';
    name.required = true;
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = tr('Guardar título', 'Save title');
    form.append(nameLabel, name, save);
    form.addEventListener('submit', event => {
      event.preventDefault();
      void (async () => {
        const done = await window.TifloIOSBookActions?.renameCurrent(name.value);
        feedback.textContent = done ? tr('Título guardado.', 'Title saved.')
          : tr('No se pudo cambiar el título.', 'Rename failed.');
        if (done) { form.hidden = true; focus(rename); }
      })();
    });
    const remove = button(tr('Eliminar', 'Delete'), 'ios-reading-book-delete', () => {
      void (async () => {
        if (!window.TifloIOSBookActions?.hasSavedBook()) {
          feedback.textContent = tr('Libro no guardado.', 'Book not saved.'); return;
        }
        const done = await window.TifloIOSBookActions.deleteCurrent();
        if (done) document.getElementById('reading-reader-back')?.click();
        else feedback.textContent = tr('Eliminación cancelada o fallida.', 'Deletion cancelled or failed.');
      })();
    });
    section.append(label, format, exportButton, rename, form, remove, feedback);
    const close = [...options.children].find(el => el.tagName === 'BUTTON'
      && el.textContent?.trim() === tr('Cerrar', 'Close'));
    if (close) close.before(section);
    else options.append(section);
  }

  function reconcile() {
    installLibrarySort();
    compactLibraryCards();
    installSettingsFolders();
    tidyIdleStatus();
    labelUnannouncedControls();
    installDocumentFolders();
  }
  reconcile();
  // El contenido del documento se genera después de abrir cada libro.
  new MutationObserver(reconcile).observe(reader, { childList: true, subtree: true, characterData: true });
})();
