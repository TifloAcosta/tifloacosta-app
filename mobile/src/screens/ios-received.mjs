import { addScreenHeader, clearScreen } from './shared.mjs';

function language(es, en) {
  return document.documentElement.lang === 'en' ? en : es;
}

function action(parent, label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  parent.append(button);
  return button;
}

/**
 * A normal mobile route, not a second web page, overlay, or UIKit modal.
 * Native receipts remain inside the App Group until verified import or an
 * explicitly confirmed deletion.
 */
export function renderIosReceived({ root, router, inbox, onOpenBook = null, t } = {}) {
  clearScreen(root);
  addScreenHeader(root, {
    router, title: language('Recibidos', 'Received'), backLabel: t('nav.back')
  });

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const list = document.createElement('div');
  list.className = 'section-stack';
  root.append(status, list);

  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    status.textContent = language('Consultando Recibidos…', 'Checking Received…');
    try {
      const { items, available } = await inbox.pending();
      if (!available) {
        status.textContent = language('El buzón compartido de iOS no está disponible.',
          'The iOS shared inbox is unavailable.');
        return;
      }
      list.replaceChildren();
      status.textContent = items.length
        ? language(`${items.length} elementos recibidos.`, `${items.length} received items.`)
        : language('No hay elementos en Recibidos.', 'No received items.');
      for (const item of items) {
        const article = document.createElement('article');
        article.className = 'content-card';
        const heading = document.createElement('h2');
        heading.textContent = String(item.name || 'Contenido recibido');
        article.append(heading);
        const local = document.createElement('p');
        local.setAttribute('role', 'status');
        local.setAttribute('aria-live', 'polite');

        if (item.kind === 'file') {
          const save = action(article,
            language('Guardar en TifloLector', 'Save to TifloLector'), async () => {
              save.disabled = true;
              local.textContent = language('Comprobando el archivo…', 'Checking the file…');
              try {
                const outcome = await inbox.saveFile(item);
                if (!outcome.saved) {
                  local.textContent = language('No se ha guardado. El original sigue en Recibidos.',
                    'Not saved. The original is still in Received.');
                } else if (!outcome.acknowledged) {
                  local.textContent = language(
                    'Guardado, pero el original sigue en Recibidos porque no se pudo retirarlo.',
                    'Saved, but the original remains in Received because it could not be cleared.');
                } else {
                  await refresh();
                  return;
                }
              } finally { save.disabled = false; }
            });
        } else {
          const content = document.createElement('p');
          content.textContent = String(item.preview || '');
          article.append(content);
          action(article, language('Abrir enlace', 'Open link'), async () => {
            const response = await inbox.openLink(item);
            local.textContent = response.opened
              ? language('Enlace abierto. Se conserva en Recibidos.', 'Link opened. Saved in Received.')
              : language('No se pudo abrir. El elemento se conserva.', 'Could not open. Item retained.');
          });
        }

        action(article, language('Eliminar de Recibidos', 'Remove from Received'), async () => {
          if (!window.confirm(language(
            '¿Eliminar este elemento de Recibidos? Solo se elimina tras tu confirmación.',
            'Remove this item from Received? Only your confirmation deletes it.'
          ))) return;
          const deleted = await inbox.deleteConfirmed(item);
          if (deleted) await refresh();
          else local.textContent = language('No se pudo eliminar. El elemento se conserva.',
            'Could not remove. The item remains.');
        });
        article.append(local);
        list.append(article);
        if (item.kind !== 'file' && typeof inbox.resolveYouTubeTitle === 'function') {
          void inbox.resolveYouTubeTitle(item).then(title => {
            if (title && heading.isConnected) heading.textContent = title;
          }).catch(() => {});
        }
      }
    } catch {
      status.textContent = language('No se pudo consultar Recibidos. Los elementos se conservan.',
        'Unable to list Received. Items were retained.');
    } finally { refreshing = false; }
  }

  void refresh();
  return { refresh };
}
