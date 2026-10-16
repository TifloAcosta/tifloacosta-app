(() => {
  'use strict';
  const plugin = () => window.Capacitor?.Plugins?.TifloShareInbox;
  const translate = (es, en) => document.documentElement.lang === 'en' ? en : es;
  const section = document.getElementById('reading-section');
  if (!section) return;
  let active = false;
  let refreshing = false;
  let items = [];
  let previousItems = '';
  let hadQueryError = false;

  const region = document.createElement('section');
  region.id = 'ios-share-inbox';
  region.hidden = true;
  region.setAttribute('aria-label', translate('Recibidos mediante Compartir', 'Received via Share'));
  const header = document.createElement('h3');
  const list = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  region.append(header, list, status);

  function mount() {
    const anchor = document.getElementById('ios-reading-import')
      || document.getElementById('reading-file-label');
    // The import controls live inside a panel, not directly in reading-section.
    // Checking against the section moved this region on every refresh.
    if (anchor && anchor.nextElementSibling !== region) anchor.after(region);
  }

  function readerVisible() {
    return !section.hidden && document.getElementById('reading-reader')?.hidden !== false;
  }

  async function exposeInbox() {
    if (!readerVisible() || !items.length) return;
    const accessibility = window.Capacitor?.Plugins?.TifloReadingAccessibility;
    try {
      const result = await accessibility?.dismissNativeActionList?.();
      if (result?.dismissed) {
        list.querySelector('button')?.focus({ preventScroll: true });
      }
    } catch {
      // The HTML inbox remains present even if the native modal cannot close.
    }
  }

  function safeName(value) {
    return String(value || 'Contenido').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 160);
  }

  async function importItem(item, button) {
    if (active) return;
    active = true;
    button.disabled = true;
    status.textContent = translate('Importando contenido compartido…', 'Importing shared content…');
    try {
      const opened = await plugin().openItem({ id: item.id });
      let file;
      if (opened.kind === 'file') {
        const uri = window.Capacitor?.convertFileSrc?.(opened.uri);
        if (!uri) throw new Error('missing-file-url');
        const response = await fetch(uri);
        if (!response.ok) throw new Error('file-unavailable');
        const blob = await response.blob();
        file = new File([blob], safeName(opened.name), {
          type: blob.type || 'application/octet-stream'
        });
      } else if (opened.kind === 'url' || opened.kind === 'text') {
        // Keep the actual URL/text as an offline note, not a fake copy of a page.
        const content = String(opened.value || '').trim();
        if (!content) throw new Error('missing-text');
        file = new File([content], safeName(opened.name) + '.txt', {
          type: 'text/plain;charset=utf-8'
        });
      } else {
        throw new Error('unsupported-kind');
      }
      const reader = window.TifloIOSBookActions;
      if (!reader?.importSharedFile) throw new Error('reader-unavailable');
      const imported = await reader.importSharedFile(file);
      // Importing into the reader is not the same as saving in the Library.
      // The reader can open a file temporarily when local storage is full.
      // Keep the App Group original until the reader reports a saved book.
      if (!imported || reader.hasSavedBook?.() !== true) {
        throw new Error('import-not-persisted');
      }
      // Only remove the staging copy after the Library has persisted the book.
      await plugin().acknowledge({ id: item.id });
      status.textContent = translate('Contenido importado en TifloLector.',
        'Content imported into TifloLector.');
    } catch {
      status.textContent = translate(
        'No se pudo importar. El contenido continúa disponible para reintentar.',
        'Import failed. The item is still available to retry.'
      );
    } finally {
      button.disabled = false;
      active = false;
      await refresh();
    }
  }

  function draw() {
    region.hidden = items.length === 0;
    list.replaceChildren();
    if (!items.length) return;
    header.textContent = translate(
      'Recibidos por Compartir: ' + items.length,
      'Received via Share: ' + items.length
    );
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = translate('Importar ', 'Import ') + safeName(item.name);
      button.addEventListener('click', () => { void importItem(item, button); });
      list.append(button);
    }
  }

  async function refresh() {
    if (refreshing || active) return;
    const inbox = plugin();
    if (!inbox?.pending) return;
    refreshing = true;
    try {
      const result = await inbox.pending();
      items = Array.isArray(result?.items) ? result.items.filter(
        item => item && /^[0-9a-f-]{36}$/i.test(item.id) &&
          ['file','text','url'].includes(item.kind)
      ) : [];
      mount();
      if (hadQueryError) {
        status.textContent = '';
        hadQueryError = false;
      }
      draw();
      const fingerprint = items.map(item => item.id).join('|');
      if (fingerprint !== previousItems) {
        previousItems = fingerprint;
        window.dispatchEvent(new Event('tiflo-share-inbox-changed'));
      }
      await exposeInbox();
    } catch {
      hadQueryError = true;
      mount();
      region.hidden = false;
      header.textContent = translate('Recibidos por Compartir', 'Received via Share');
      list.replaceChildren();
      status.textContent = translate(
        'No se pudo consultar los documentos recibidos. Comprueba que TifloAcosta esté actualizada e inténtalo de nuevo.',
        'Could not check received documents. Check that TifloAcosta is updated and try again.'
      );
      // Do not acknowledge or delete staged files on a failed query.
    } finally {
      refreshing = false;
    }
  }

  window.TifloIOSShareInbox = Object.freeze({ refresh });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { mount(); void refresh(); }, { once: true });
  } else {
    mount();
    void refresh();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh();
  });
  window.addEventListener('hashchange', () => { void refresh(); });
  window.addEventListener('pageshow', () => { void refresh(); });
  window.addEventListener('focus', () => { void refresh(); });
  // Capacitor may finish registering plugins after the first DOMContentLoaded.
  window.addEventListener('load', () => { void refresh(); });
  setTimeout(() => { void refresh(); }, 450);
  setTimeout(() => { void refresh(); }, 1600);
})();
