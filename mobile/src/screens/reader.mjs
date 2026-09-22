import { clearScreen } from './shared.mjs';

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function renderReadableContent({ parent, page, t, linkIdPrefix = 'reader-link', onActivateLink = null } = {}) {
  if (!parent?.append || !page) throw new TypeError('Readable parent and page are required');
  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = String(page.title || t?.('reader.title') || 'Lectura');
  parent.append(heading);

  if (page.source) {
    const source = document.createElement('p');
    source.textContent = `${t?.('reader.source') || 'Fuente'}: ${page.source}`;
    parent.append(source);
  }

  let linkIndex = 0;
  for (const block of Array.isArray(page.blocks) ? page.blocks : []) {
    if (block.type === 'heading') {
      if (String(block.text || '').trim() === String(page.title || '').trim()) continue;
      const level = Math.min(4, Math.max(2, Number(block.level) || 2));
      const blockHeading = document.createElement(`h${level}`);
      blockHeading.textContent = String(block.text || '');
      parent.append(blockHeading);
      continue;
    }
    if (!['paragraph', 'list-item'].includes(block.type)) continue;
    const row = document.createElement(block.type === 'list-item' ? 'li' : 'p');
    for (const part of Array.isArray(block.parts) ? block.parts : []) {
      if (part.type === 'link') {
        const href = validHttpUrl(part.url);
        if (!href) {
          row.append(document.createTextNode(String(part.text || '')));
          continue;
        }
        const link = document.createElement('a');
        link.id = `${linkIdPrefix}-${linkIndex++}`;
        link.href = href;
        link.textContent = String(part.text || href);
        link.addEventListener('click', event => {
          event.preventDefault();
          if (typeof onActivateLink === 'function') onActivateLink(href, link.id);
        });
        row.append(link);
      } else {
        row.append(document.createTextNode(String(part.text || '')));
      }
    }
    if (block.type === 'list-item') {
      let list = parent.lastElementChild;
      if (!list || list.tagName !== 'UL') {
        list = document.createElement('ul');
        parent.append(list);
      }
      list.append(row);
    } else {
      parent.append(row);
    }
  }
  return { heading };
}

export function renderReader({ root, router, session, t, onActivateLink = null, onRetry = null, onOpenOriginal = null } = {}) {
  clearScreen(root);
  const state = session.snapshot();
  const page = state.pages.at(-1) || null;

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-button';
  back.textContent = state.pages.length > 1 ? t('reader.backPage') : t('nav.back');
  root.append(back);

  function goBack() {
    const current = session.snapshot();
    if (current.pages.length > 1) {
      session.pop();
      renderReader({ root, router, session, t, onActivateLink, onRetry, onOpenOriginal });
      queueMicrotask(() => root.querySelector?.('[data-screen-heading]')?.focus?.());
      return true;
    }
    return router.back();
  }
  back.addEventListener('click', goBack);

  if (state.loading && !page) {
    const heading = document.createElement('h1');
    heading.dataset.screenHeading = '';
    heading.tabIndex = -1;
    heading.textContent = t('reader.preparing');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = t('reader.loading');
    root.append(heading, status);
    return { back: goBack };
  }

  if (state.error && !page) {
    const heading = document.createElement('h1');
    heading.dataset.screenHeading = '';
    heading.tabIndex = -1;
    heading.textContent = t('reader.errorHeading');
    const message = document.createElement('p');
    message.textContent = t('reader.error');
    root.append(heading, message);
    if (typeof onRetry === 'function') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = t('reader.retry');
      retry.addEventListener('click', () => onRetry(state.error?.url || state.url));
      root.append(retry);
    }
    if (state.allowOriginalFallback && state.url && typeof onOpenOriginal === 'function') {
      const original = document.createElement('button');
      original.type = 'button';
      original.textContent = t('actualidad.original');
      original.addEventListener('click', () => onOpenOriginal(state.url));
      root.append(original);
    }
    return { back: goBack };
  }

  if (state.error && page) {
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = t('reader.error');
    root.append(status);
    if (typeof onRetry === 'function') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = t('reader.retry');
      retry.addEventListener('click', () => onRetry(state.error?.url || state.url));
      root.append(retry);
    }
  }

  if (page) {
    renderReadableContent({ parent: root, page, t, linkIdPrefix: `reader-${state.pages.length}`, onActivateLink });
    if (state.allowOriginalFallback && state.url && typeof onOpenOriginal === 'function') {
      const original = document.createElement('button');
      original.type = 'button';
      original.textContent = t('actualidad.original');
      original.addEventListener('click', () => onOpenOriginal(state.url));
      root.append(original);
    }
  }
  return { back: goBack };
}
