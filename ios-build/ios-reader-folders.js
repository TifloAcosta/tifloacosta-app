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
    const bookView = document.getElementById('reading-reader');
    if (!root || !options || !toggle || !bookView || documentInstalled === root) return;
    const audio = document.getElementById('reading-document-audio');
    const visual = document.getElementById('reading-document-visual');
    const more = document.getElementById('reading-document-more-actions');
    if (!audio || !visual || !more) return;
    documentInstalled = root;
    options.append(audio, visual, more);
    installBookManagement(options);
    const audioButton = document.getElementById('reading-document-open-audio');
    const visualButton = document.getElementById('reading-document-open-visual');
    const moreButton = document.getElementById('reading-document-open-more');
    const panels = [audio, visual, more];
    let previous = null;
    let selected = null;
    let source = null;
    const close = button(tr('Cerrar', 'Close'), 'ios-reading-document-close', leaveFolder);
    options.append(close);
    function restore() {
      if (!previous) return;
      for (const [element, hidden] of previous) if (element.isConnected) element.hidden = hidden;
      previous = null;
    }
    function enterFolder() {
      if (previous) return;
      previous = new Map();
      for (const element of [...bookView.children]) {
        if (element === root) continue;
        previous.set(element, element.hidden);
        element.hidden = true;
      }
      const primary = root.querySelector('.resource-actions');
      for (const element of [...root.children]) {
        previous.set(element, element.hidden);
        element.hidden = element !== primary;
      }
      if (primary) for (const element of [...primary.children]) {
        previous.set(element, element.hidden);
        element.hidden = element !== options;
      }
      toggle.hidden = true;
      options.hidden = false;
      for (const panel of panels) panel.hidden = true;
      selected = null;
      source = null;
      focus(audioButton || visualButton || moreButton || close);
    }
    function leaveFolder() {
      if (!previous) return;
      selected = null; source = null;
      for (const panel of panels) panel.hidden = true;
      options.hidden = true;
      restore();
      toggle.hidden = false;
      focus(toggle);
    }
    function listFolders() {
      if (!selected) return;
      selected.hidden = true;
      selected = null;
      for (const child of [...options.children]) if (!panels.includes(child)) child.hidden = false;
      focus(source || toggle);
      source = null;
    }
    function openSubfolder(panel, button) {
      if (!previous) enterFolder();
      for (const item of panels) item.hidden = item !== panel;
      for (const item of [...options.children]) if (!panels.includes(item)) item.hidden = true;
      selected = panel;
      source = button;
      const first = [...panel.querySelectorAll('input,select,button,textarea')]
        .find(item => !item.hidden && !item.disabled && !item.closest('[hidden]'));
      focus(first || panel);
    }
    toggle.removeAttribute('aria-expanded');
    toggle.removeAttribute('aria-controls');
    toggle.addEventListener('click', enterFolder);
    options.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if ([audioButton, visualButton, moreButton].includes(target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSubfolder(target === audioButton ? audio : target === visualButton ? visual : more, target);
      } else if (selected && selected.contains(target) &&
        ['Volver a la lectura', 'Back to reading', 'Cerrar', 'Close'].includes(target.textContent?.trim())) {
        event.preventDefault();
        event.stopImmediatePropagation();
        listFolders();
      }
    }, true);
    options.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (selected) listFolders(); else leaveFolder();
    });
    // The back-to-library control must never leave a hidden document state.
    document.getElementById('reading-reader-back')?.addEventListener('click', leaveFolder, true);
  }

  // Carpetas personales locales; nunca contienen una copia de los libros,
  // sólo la relación libro-carpeta, preservando progreso y marcadores.
  const folderKey = 'tifloacosta-ios-folders-v1';
  function readFolders() {
    try {
      const parsed = JSON.parse(localStorage.getItem(folderKey) || '{}');
      return { folders: Array.isArray(parsed.folders) ? parsed.folders : [],
        books: parsed.books && typeof parsed.books === 'object' ? parsed.books : {} };
    } catch { return {folders:[],books:{}}; }
  }
  function writeFolders(data) {
    try { localStorage.setItem(folderKey, JSON.stringify(data)); return true; }
    catch { return false; }
  }
  let activeFolder = '';
  const folders = {
    get activeFolder() { return activeFolder; },
    list: () => readFolders().folders,
    folderFor: id => readFolders().books[String(id)] || '',
    assign(id, folderId) {
      if (!id) return false;
      const data = readFolders();
      if (folderId && !data.folders.some(item => item.id === folderId)) return false;
      if (folderId) data.books[String(id)] = folderId;
      else delete data.books[String(id)];
      if (!writeFolders(data)) return false;
      document.dispatchEvent(new Event('tiflo-ios-folder-change'));
      return true;
    },
    promptAssignment(id) {
      const names = readFolders().folders;
      if (!names.length) {
        globalThis.alert?.(tr('Primero crea una carpeta.', 'Create a folder first.')); return;
      }
      const question = tr('Escribe el nombre de la carpeta:', 'Enter folder name:') +
        '\\n' + names.map(item => item.name).join(', ');
      const name = globalThis.prompt?.(question);
      if (!name) return;
      const target = names.find(item => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
      if (target) folders.assign(id, target.id);
      else globalThis.alert?.(tr('Carpeta no encontrada.', 'Folder not found.'));
    }
  };
  window.TifloIOSFolders = folders;

  function installLibraryFolders() {
    const list = document.getElementById('reading-library-list');
    if (!list || document.getElementById('ios-reading-folders')) return;
    const section = document.createElement('section');
    section.id = 'ios-reading-folders';
    const create = button(tr('Crear carpeta', 'Create folder'), 'ios-reading-create-folder', () => {
      const name = globalThis.prompt?.(tr('Nombre de la nueva carpeta:', 'New folder name:'))?.trim();
      if (!name) return;
      const data = readFolders();
      if (data.folders.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        globalThis.alert?.(tr('Ya existe una carpeta con ese nombre.', 'A folder with that name exists.')); return;
      }
      data.folders.push({id:'folder-'+Date.now()+'-'+data.folders.length,name});
      if (writeFolders(data)) render();
    });
    const current = document.createElement('p');
    current.id = 'ios-reading-current-folder';
    const exit = button(tr('Cerrar carpeta', 'Close folder'), 'ios-reading-exit-folder', () => {
      activeFolder = '';
      render(); refresh();
    });
    const names = document.createElement('div');
    names.id = 'ios-reading-folder-list';
    const label = document.createElement('p');
    label.textContent = tr('Carpetas', 'Folders');
    function refresh() {
      document.getElementById('reading-library-filter')?.dispatchEvent(new Event('change', {bubbles:true}));
    }
    function render() {
      const all = readFolders().folders;
      const folder = all.find(x=>x.id===activeFolder);
      current.textContent = folder ? tr('Carpeta: ', 'Folder: ') + folder.name : '';
      current.hidden = !folder;
      exit.hidden = !folder;
      names.hidden = Boolean(folder);
      names.replaceChildren();
      for (const item of all) {
        const line = document.createElement('div');
        line.className = 'resource-actions';
        const open = button(item.name, 'ios-folder-open-'+item.id, () => {
          activeFolder = item.id; render(); refresh();
        });
        const rename = button(tr('Cambiar nombre', 'Rename'), 'ios-folder-rename-'+item.id, () => {
          const name = globalThis.prompt?.(tr('Nuevo nombre:', 'New name:'), item.name)?.trim();
          if (!name) return;
          const data = readFolders();
          if (data.folders.some(f=>f.id!==item.id && f.name.toLocaleLowerCase()===name.toLocaleLowerCase())) return;
          const match = data.folders.find(f=>f.id===item.id);
          if (match) match.name = name;
          if (writeFolders(data)) render();
        });
        const remove = button(tr('Eliminar carpeta', 'Delete folder'), 'ios-folder-delete-'+item.id, () => {
          if (!globalThis.confirm?.(tr('¿Eliminar esta carpeta? Los documentos se conservarán.', 'Delete this folder? Documents will be kept.'))) return;
          const data = readFolders();
          data.folders = data.folders.filter(f=>f.id!==item.id);
          for (const book of Object.keys(data.books)) if (data.books[book]===item.id) delete data.books[book];
          if (writeFolders(data)) {
            if (activeFolder===item.id) activeFolder='';
            render(); refresh();
          }
        });
        line.append(open, rename, remove); names.append(line);
      }
      document.dispatchEvent(new Event('tiflo-ios-folder-change'));
    }
    section.append(create, current, exit, label, names);
    list.before(section);
    render();
  }

  function installLibrarySort() {
    const selection = document.getElementById('reading-library-filter');
    const refreshButton = document.getElementById('reading-library-refresh');
    if (!selection || !refreshButton || document.getElementById('ios-reading-library-sort')) return;
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
    refreshButton.before(label, select);
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
    const folderLabel = document.createElement('label');
    folderLabel.htmlFor = 'ios-reading-book-folder';
    folderLabel.textContent = tr('Guardar en carpeta', 'Place in folder');
    const folderSelect = document.createElement('select');
    folderSelect.id = 'ios-reading-book-folder';
    function syncFolders() {
      const api = window.TifloIOSFolders;
      const selected = api?.folderFor?.(window.TifloIOSBookActions?.currentId?.() || '') || '';
      folderSelect.replaceChildren();
      for (const folder of [{id:'',name:tr('Sin carpeta','No folder')}, ...(api?.list?.() || [])]) {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        folderSelect.append(option);
      }
      folderSelect.value = selected;
    }
    syncFolders();
    document.addEventListener('tiflo-ios-folder-change', syncFolders);
    const assign = button(tr('Mover a carpeta', 'Move to folder'), 'ios-reading-book-folder-save', () => {
      const id = window.TifloIOSBookActions?.currentId?.();
      const done = id && window.TifloIOSFolders?.assign?.(id, folderSelect.value);
      feedback.textContent = done ? tr('Carpeta actualizada.', 'Folder updated.')
        : tr('Guarda el documento antes de moverlo.', 'Save before moving.');
    });
    section.append(label, format, exportButton, rename, form, folderLabel, folderSelect, assign, remove, feedback);
    const close = [...options.children].find(el => el.tagName === 'BUTTON'
      && el.textContent?.trim() === tr('Cerrar', 'Close'));
    if (close) close.before(section);
    else options.append(section);
  }

  function reconcile() {
    installLibrarySort();
    installLibraryFolders();
    installSettingsFolders();
    tidyIdleStatus();
    labelUnannouncedControls();
    installDocumentFolders();
  }
  reconcile();
  // El contenido del documento se genera después de abrir cada libro.
  new MutationObserver(reconcile).observe(reader, { childList: true, subtree: true, characterData: true });
})();
