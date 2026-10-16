(() => {
  'use strict';
  // Real iOS Share Extension inbox. No auto-play, no foreign DOM additions
  // outside the iPhone package, and no deleting an unimported attachment.
  const section = document.getElementById('reading-section');
  const input = document.getElementById('reading-file');
  if (!section || !input) return;
  const native = () => window.Capacitor?.Plugins?.TifloReadingAccessibility;
  const tr = (es, en) => document.documentElement.lang === 'en' ? en : es;
  const panel = document.createElement('section');
  panel.id = 'ios-shared-inbox';
  panel.className = 'ios-share-inbox';
  panel.hidden = true;
  const heading = document.createElement('h3');
  heading.textContent = tr('Recibido al compartir', 'Received from Share');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = document.createElement('div');
  list.className = 'ios-share-inbox-items';
  panel.append(heading, list, status);
  const importPanel = input.closest('.panel');
  if (importPanel) importPanel.before(panel);
  else section.prepend(panel);
  let loading = false;

  function button(label, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = label;
    control.addEventListener('click', action);
    return control;
  }
  async function importItem(item) {
    const plugin = native();
    if (!plugin) return;
    try {
      let file;
      if (item.kind === 'file') {
        const uri = window.Capacitor?.convertFileSrc?.(item.uri);
        if (!uri) throw new Error('Invalid shared URI');
        const response = await fetch(uri);
        if (!response.ok) throw new Error('File unavailable');
        const blob = await response.blob();
        const extension = item.filename?.split('.').at(-1) || '';
        const fileName = item.name.includes('.') ? item.name : item.name + '.' + extension;
        file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      } else if (item.kind === 'text' || item.kind === 'url') {
        file = new File([item.text || ''], item.kind === 'url' ? 'Enlace compartido.txt' :
          'Texto compartido.txt', { type: 'text/plain' });
      } else return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.value = '';
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      // Import can be asynchronous. Keep the item pending until the user
      // explicitly discards it; a failed import must never lose the source.
      status.textContent = tr('Importación solicitada. El contenido sigue disponible aquí hasta que lo descartes.',
        'Import requested. This item remains available here until you discard it.');
    } catch {
      status.textContent = tr('No se pudo leer el contenido. Se conserva para volver a intentarlo.',
        'Could not read the content. It remains available to retry.');
    }
  }
  async function discard(item) {
    if (!globalThis.confirm?.(tr('¿Quitar este contenido de Compartir? No se borrará de tu biblioteca.',
      'Remove this shared item? It will not delete anything from your library.'))) return;
    try {
      await native()?.acknowledgeSharedItem?.({ id: item.id });
      await refresh();
    } catch {
      status.textContent = tr('No se pudo quitar el contenido.', 'Could not remove the item.');
    }
  }
  async function refresh() {
    if (loading || !native()?.listSharedItems) return;
    loading = true;
    try {
      const received = await native().listSharedItems();
      const items = Array.isArray(received?.items) ? received.items : [];
      panel.hidden = items.length === 0;
      list.replaceChildren();
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'ios-share-inbox-item';
        const title = document.createElement('span');
        title.textContent = item.name || tr('Contenido compartido', 'Shared item');
        const actions = document.createElement('div');
        actions.className = 'resource-actions';
        actions.append(button(tr('Importar', 'Import'), () => { void importItem(item); }),
          button(tr('Descartar', 'Discard'), () => { void discard(item); }));
        row.append(title, actions);
        list.append(row);
      }
    } catch {
      // No group membership is a release-blocking configuration error;
      // do not display empty misleading controls to the user.
      status.textContent = tr('La recepción de Compartir no está disponible en esta instalación.',
        'Receiving shared content is unavailable in this installation.');
    } finally { loading = false; }
  }
  const update = () => { void refresh(); };
  window.addEventListener('pageshow', update);
  window.addEventListener('focus', update);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') update();
  });
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', update, { once: true });
  else update();
})();
