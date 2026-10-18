import { classifyIosReceived } from '../core/ios-share-intent.mjs';
import { addScreenHeader, clearScreen } from './shared.mjs';

const bilingual = (es, en) => document.documentElement.lang === 'en' ? en : es;

function makeAction(parent, label, operation, handler, { primary = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.voAction = operation;
  if (primary) {
    const article = parent.closest('article');
    const receiptId = article?.dataset.receiptId || '';
    button.id = `vo-received-${receiptId}`;
    button.setAttribute('aria-label', `${label}: ${article?.querySelector('h2')?.textContent || receiptId}`);
    button.dataset.voTarget = 'true';
  }
  button.addEventListener('click', handler);
  parent.append(button);
  return button;
}

/**
 * Received is ONE route in the native iPhone app. Opening, reading or playing
 * never silently acknowledges or deletes its App Group source. Only a
 * verified library save or a confirmed Remove may acknowledge the receipt.
 */
export function renderIosReceived({
  root, router, inbox, onOpenBook = null, onOpenVideo = null,
  onReadWeb = null, onAnalyzeDownload = null, onSearchText = null,
  setScreenCleanup = null, t
} = {}) {
  clearScreen(root);
  addScreenHeader(root, {
    router, title: bilingual('Recibidos', 'Received'), backLabel: t('nav.back')
  });
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const list = document.createElement('div');
  list.className = 'section-stack';
  root.append(status, list);
  let refreshing = false;
  let reloadRequested = false;
  let disposed = false;
  setScreenCleanup?.(() => { disposed = true; });

  async function refresh() {
    if (disposed) return;
    if (refreshing) { reloadRequested = true; return; }
    refreshing = true;
    status.textContent = bilingual('Consultando Recibidos…', 'Checking Received…');
    try {
      const { items, available } = await inbox.pending();
      if (disposed) return;
      if (!available) {
        status.textContent = bilingual('El buzón compartido de iOS no está disponible.',
          'The iOS shared inbox is unavailable.');
        return;
      }
      list.replaceChildren();
      status.textContent = items.length
        ? bilingual(`${items.length} elementos recibidos.`, `${items.length} received items.`)
        : bilingual('No hay elementos en Recibidos.', 'No received items.');
      for (const item of items) {
        const article = document.createElement('article');
        article.className = 'content-card';
        article.dataset.receiptId = String(item.id || '');
        const heading = document.createElement('h2');
        heading.textContent = String(item.name || bilingual('Contenido recibido', 'Received item'));
        const actions = document.createElement('div');
        actions.className = 'action-group';
        const local = document.createElement('p');
        local.setAttribute('role', 'status');
        local.setAttribute('aria-live', 'polite');
        article.append(heading, actions, local);
        list.append(article);

        let itemBusy = false;
        async function saveInLibrary({ open = false } = {}) {
          if (itemBusy) return;
          itemBusy = true;
          let response;
          try { response = await inbox.saveFile(item); }
          finally { itemBusy = false; }
          if (!response.saved) {
            local.textContent = bilingual(
              'No se pudo importar. El original permanece en Recibidos.',
              'Could not import. The original remains in Received.');
            return;
          }
          if (open && typeof onOpenBook === 'function') {
            onOpenBook(response.id);
            return;
          }
          if (response.acknowledged) await refresh();
          else local.textContent = bilingual(
            'Archivo guardado. La copia de Recibidos se conserva porque no se pudo retirar.',
            'File saved. The Received copy is retained because it could not be cleared.');
        }

        const source = item.kind === 'file'
          ? item
          : await inbox.details(item).catch(() => null) || item;
        if (disposed) return;
        const intent = classifyIosReceived(source, source.value || '');
        if (intent.type === 'document' && intent.canImport) {
          makeAction(actions, bilingual('Guardar y leer en TifloLector', 'Save and read in TifloLector'),
            'read', async () => { await saveInLibrary({ open: true }); }, { primary: true });
        } else if (intent.type === 'audio' && intent.canImport) {
          makeAction(actions, bilingual('Guardar audio en TifloLector', 'Save audio in TifloLector'),
            'download', async () => { await saveInLibrary(); }, { primary: true });
        } else if (source.kind === 'file') {
          // Do not misleadingly offer playback for binary formats not yet ported.
          local.textContent = bilingual(
            'Archivo conservado en Recibidos. Su importación en el nuevo lector iOS está pendiente.',
            'File kept in Received. Its new iOS reader import is not yet available.');
        } else if (intent.type === 'youtube') {
          if (typeof inbox.resolveYouTubeTitle === 'function') {
            void inbox.resolveYouTubeTitle({ ...source, preview: source.value || source.preview })
              .then(title => {
                if (disposed || !title || !heading.isConnected) return;
                heading.textContent = title;
                const primary = actions.querySelector('[data-vo-target="true"]');
                if (primary) primary.setAttribute('aria-label', `${primary.textContent}: ${title}`);
              })
              .catch(() => {});
          }
          makeAction(actions,
            bilingual('Reproducir en YouTube accesible', 'Play in accessible YouTube'),
            'play', () => onOpenVideo?.({
              videoId: intent.videoId, url: intent.url, title: heading.textContent
            }), { primary: true });
          makeAction(actions, bilingual('Abrir en YouTube', 'Open on YouTube'),
            'youtube', async () => { await inbox.openLink(item); });
        } else if (intent.type === 'web') {
          makeAction(actions, bilingual('Leer página de forma accesible', 'Read accessible page'),
            'read', () => onReadWeb?.(intent.url, heading.textContent), { primary: true });
          makeAction(actions, bilingual('Analizar descarga', 'Analyze download'),
            'download', () => onAnalyzeDownload?.(intent.url));
          makeAction(actions, bilingual('Abrir enlace original', 'Open original link'),
            'original', async () => { await inbox.openLink(item); });
        } else {
          if (intent.text) {
            const preview = document.createElement('p');
            preview.textContent = intent.text.slice(0, 2000);
            article.insertBefore(preview, actions);
          }
          makeAction(actions, bilingual('Buscar texto compartido', 'Search shared text'),
            'read', () => onSearchText?.(intent.text), { primary: true });
        }
        makeAction(actions, bilingual('Eliminar de Recibidos', 'Remove from Received'),
          'delete', async () => {
            if (itemBusy) return;
            if (!window.confirm(bilingual(
              '¿Eliminar este elemento de Recibidos? No se borrará ninguna copia ya guardada.',
              'Remove this Received item? Any saved library copy will remain.'))) return;
            const removed = await inbox.deleteConfirmed(item);
            if (removed) await refresh();
            else local.textContent = bilingual(
              'No se pudo eliminar. El original sigue en Recibidos.',
              'Could not remove. The original remains in Received.');
          });
      }
    } catch {
      if (!disposed) status.textContent = bilingual(
        'No se pudo consultar Recibidos. Los elementos se conservan.',
        'Unable to list Received. Items were retained.');
    } finally {
      refreshing = false;
      if (reloadRequested && !disposed) {
        reloadRequested = false;
        void refresh();
      }
    }
  }

  void refresh();
  return { refresh };
}
