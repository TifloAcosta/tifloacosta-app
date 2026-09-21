import { classifySharedUrl } from '../core/share-classifier.mjs';
import { extractReadablePage } from '../core/readable-page.mjs';

const ACTIONS = Object.freeze({
  play: { id: 'play', labelKey: 'share.play' },
  read: { id: 'read', labelKey: 'share.read' },
  downloads: { id: 'downloads', labelKey: 'share.downloads' },
  search: { id: 'search', labelKey: 'share.search' },
  retry: { id: 'retry', labelKey: 'share.retry' },
  cancel: { id: 'cancel', labelKey: 'share.cancel' }
});

export function actionsForClassification(classification = {}) {
  if (classification?.kind === 'youtube') return [ACTIONS.play];
  if (classification?.kind === 'download') return [ACTIONS.downloads];
  if (classification?.kind === 'web') return [ACTIONS.read];
  if (classification?.kind === 'text') return [ACTIONS.search];
  return [];
}

export function errorActions(code = '') {
  if (code === 'unreliable' || code === 'unsupported_type') return [ACTIONS.downloads, ACTIONS.cancel];
  if (['timeout', 'unreachable', 'too_large', 'too_many_redirects', 'http_error', 'invalid_url'].includes(code)) {
    return [ACTIONS.retry, ACTIONS.cancel];
  }
  return [ACTIONS.cancel];
}

function fetchPage(webFetch, url) {
  if (typeof webFetch === 'function') return webFetch(url);
  if (webFetch?.fetchPage) return webFetch.fetchPage({ url });
  throw Object.assign(new Error('Native page fetch is unavailable'), { code: 'unreachable' });
}

export async function resolveSharedUrl({ url = '', resolveDownload, webFetch } = {}) {
  const first = classifySharedUrl(url, { resolveDownload });
  if (first.kind !== 'web') return { kind: first.kind, classification: first };

  const payload = await fetchPage(webFetch, first.url);
  const finalUrl = String(payload?.finalUrl || first.url);
  const finalClassification = classifySharedUrl(finalUrl, { resolveDownload });
  if (finalClassification.kind !== 'web') {
    return { kind: finalClassification.kind, classification: finalClassification, payload };
  }

  const page = extractReadablePage({
    html: String(payload?.body || ''),
    url: finalClassification.url,
    contentType: String(payload?.contentType || '')
  });
  return {
    kind: page.reliable ? 'readable' : 'unreliable',
    classification: finalClassification,
    payload,
    page
  };
}

function currentUrl(state) {
  return String(state?.selectedUrl || state?.classification?.url || state?.urls?.[0] || '').trim();
}

function readableTitle(page, fallback = '') {
  return String(page?.title || fallback || '').trim();
}

function errorCopyKey(code = '') {
  return ({
    unreliable: 'share.unreliable',
    timeout: 'share.timeout',
    unreachable: 'share.unreachable',
    unsupported_type: 'share.unsupportedType',
    too_large: 'share.tooLarge',
    too_many_redirects: 'share.tooManyRedirects',
    http_error: 'share.httpError',
    invalid_url: 'share.invalid'
  })[code] || 'share.unreachable';
}

function setButtonLabel(button, t, action) {
  button.textContent = t(action.labelKey);
}

function createButton(parent, { label, onClick, id = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  if (id) button.id = id;
  button.textContent = label;
  button.addEventListener('click', onClick);
  parent.append(button);
  return button;
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export function renderShare({
  root,
  session,
  resolveDownload = () => ({ provider: 'web' }),
  webFetch,
  nativeActions,
  t,
  onOpenVideo = () => {},
  onOpenDownload = () => {},
  onOpenSearch = () => {},
  onFinish = () => {}
} = {}) {
  if (!root?.replaceChildren || !session?.snapshot || typeof t !== 'function') {
    throw new TypeError('Share root, session and translator are required');
  }

  let busyButton = null;

  function finish() {
    onFinish();
  }

  function focusStateHeading() {
    const target = root.querySelector?.('[data-share-state-heading]');
    if (target && typeof target.focus === 'function') target.focus();
  }

  function toMultiLinkList() {
    session.selectUrl('');
    session.setClassification(null);
    session.setView('multi-url');
    render({ focusState: true });
  }

  function back() {
    const state = session.snapshot();
    if (state.view === 'readable') {
      if (state.readableHistory.length > 1) {
        session.popReadable();
        render({ focusState: true });
        return true;
      }
      if (state.urls.length > 1 && state.selectedUrl) {
        toMultiLinkList();
        return true;
      }
      finish();
      return true;
    }
    if (state.urls.length > 1 && state.selectedUrl) {
      toMultiLinkList();
      return true;
    }
    finish();
    return true;
  }

  async function readUrl(url, triggerButton = null) {
    const generation = session.snapshot().generation;
    busyButton = triggerButton;
    if (busyButton) busyButton.disabled = true;
    session.setView('loading');
    const status = root.querySelector?.('[data-share-status]');
    if (status) status.textContent = t('share.preparing');

    try {
      const result = await resolveSharedUrl({ url, resolveDownload, webFetch });
      if (session.snapshot().generation !== generation) return;

      if (result.kind === 'youtube') {
        session.setClassification(result.classification);
        session.setView('received');
        onOpenVideo(result.classification);
        return;
      }
      if (result.kind === 'download') {
        session.setClassification(result.classification);
        session.setView('received');
        onOpenDownload(result.classification.url);
        return;
      }
      if (result.kind === 'readable') {
        session.setClassification(result.classification);
        session.pushReadable(result.page);
        render({ focusState: true });
        return;
      }

      session.setClassification(result.classification);
      session.setView('error', { code: 'unreliable', url: result.classification?.url || url });
      render({ focusState: true });
    } catch (error) {
      if (session.snapshot().generation !== generation) return;
      session.setView('error', { code: error?.code || 'unreachable', url });
      render({ focusState: true });
    } finally {
      if (busyButton && busyButton.isConnected) busyButton.disabled = false;
      busyButton = null;
    }
  }

  function activateUrl(url, triggerButton = null) {
    const classification = classifySharedUrl(url, { resolveDownload });
    session.selectUrl(classification.url || url);
    session.setClassification(classification);
    session.setView('received');

    if (classification.kind === 'youtube') return onOpenVideo(classification);
    if (classification.kind === 'download') return onOpenDownload(classification.url);
    if (classification.kind === 'web') return readUrl(classification.url, triggerButton);
    session.setView('error', { code: 'invalid_url', url });
    render({ focusState: true });
  }

  function renderReadable(container, state) {
    const page = state.readableHistory.at(-1);
    if (!page) {
      session.setView('error', { code: 'unreliable', url: currentUrl(state) });
      render({ focusState: true });
      return;
    }

    const title = document.createElement('h2');
    title.dataset.shareStateHeading = '';
    title.tabIndex = -1;
    title.textContent = readableTitle(page, t('screen.share'));
    container.append(title);

    if (page.source) {
      const source = document.createElement('p');
      source.textContent = `${t('share.source')}: ${page.source}`;
      container.append(source);
    }

    for (const block of Array.isArray(page.blocks) ? page.blocks : []) {
      if (block.type === 'heading') {
        if (String(block.text || '').trim() === String(page.title || '').trim()) continue;
        const level = Math.min(4, Math.max(2, Number(block.level) || 2));
        const heading = document.createElement(`h${level}`);
        heading.textContent = String(block.text || '');
        container.append(heading);
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
          link.href = href;
          link.textContent = String(part.text || href);
          link.addEventListener('click', event => {
            event.preventDefault();
            void activateUrl(href, link);
          });
          row.append(link);
        } else {
          row.append(document.createTextNode(String(part.text || '')));
        }
      }
      if (block.type === 'list-item') {
        let list = container.lastElementChild;
        if (!list || list.tagName !== 'UL') {
          list = document.createElement('ul');
          container.append(list);
        }
        list.append(row);
      } else {
        container.append(row);
      }
    }

    createButton(container, {
      label: state.readableHistory.length > 1 ? t('share.backPage') : (state.urls.length > 1 ? t('share.backLinks') : t('share.cancel')),
      onClick: back
    });
  }

  function renderError(container, state) {
    const heading = document.createElement('h2');
    heading.dataset.shareStateHeading = '';
    heading.tabIndex = -1;
    heading.textContent = t('share.errorHeading');
    container.append(heading);

    const message = document.createElement('p');
    message.textContent = t(errorCopyKey(state.error?.code));
    container.append(message);

    for (const action of errorActions(state.error?.code)) {
      if (action.id === 'retry') {
        createButton(container, { label: t(action.labelKey), onClick: event => void readUrl(state.error?.url || currentUrl(state), event.currentTarget) });
      } else if (action.id === 'downloads') {
        createButton(container, { label: t(action.labelKey), onClick: () => onOpenDownload(state.error?.url || currentUrl(state)) });
      } else if (action.id === 'cancel') {
        createButton(container, { label: t(action.labelKey), onClick: finish });
      }
    }
  }

  function renderReceived(container, state, status) {
    const classification = state.classification || (state.urls.length === 0 ? { kind: 'text' } : null);
    const message = document.createElement('p');
    message.textContent = classification?.kind === 'youtube' ? t('share.receivedYoutube')
      : classification?.kind === 'download' ? t('share.receivedDownload')
        : classification?.kind === 'web' ? t('share.receivedWeb')
          : t('share.receivedText');
    container.append(message);

    const actions = actionsForClassification(classification || { kind: 'text' });
    for (const action of actions) {
      let button;
      button = createButton(container, {
        label: t(action.labelKey),
        id: `share-action-${action.id}`,
        onClick: () => {
          if (action.id === 'play') onOpenVideo(classification);
          else if (action.id === 'downloads') onOpenDownload(classification?.url || currentUrl(state));
          else if (action.id === 'search') onOpenSearch(state.text);
          else if (action.id === 'read') void readUrl(classification?.url || currentUrl(state), button);
        }
      });
      setButtonLabel(button, t, action);
    }

    if (state.urls.length > 1 && state.selectedUrl) {
      createButton(container, { label: t('share.backLinks'), onClick: toMultiLinkList });
    }
    createButton(container, { label: t('share.cancel'), onClick: finish });
    status.textContent = '';
  }

  function renderMultiUrl(container, state) {
    const heading = document.createElement('h2');
    heading.dataset.shareStateHeading = '';
    heading.tabIndex = -1;
    heading.textContent = t('share.multiFound').replace('{count}', String(state.urls.length));
    container.append(heading);
    const intro = document.createElement('p');
    intro.textContent = t('share.chooseLink');
    container.append(intro);

    const list = document.createElement('ol');
    state.urls.forEach((url, index) => {
      const item = document.createElement('li');
      createButton(item, {
        label: `${t('share.linkLabel').replace('{number}', String(index + 1))}: ${url}`,
        onClick: event => void activateUrl(url, event.currentTarget)
      });
      list.append(item);
    });
    container.append(list);
    createButton(container, { label: t('share.cancel'), onClick: finish });
  }

  function renderLoading(container, status) {
    const heading = document.createElement('h2');
    heading.dataset.shareStateHeading = '';
    heading.tabIndex = -1;
    heading.textContent = t('share.loadingHeading');
    container.append(heading);
    status.textContent = t('share.preparing');
    createButton(container, { label: t('share.cancel'), onClick: finish });
  }

  function render({ focusState = false } = {}) {
    root.replaceChildren();

    const mainHeading = document.createElement('h1');
    mainHeading.dataset.screenHeading = '';
    mainHeading.tabIndex = -1;
    mainHeading.textContent = t('screen.share');
    root.append(mainHeading);

    const status = document.createElement('p');
    status.dataset.shareStatus = '';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    root.append(status);

    const container = document.createElement('section');
    root.append(container);
    const state = session.snapshot();

    if (state.view === 'multi-url' || (state.urls.length > 1 && !state.selectedUrl && state.view === 'received')) {
      renderMultiUrl(container, state);
    } else if (state.view === 'readable') {
      renderReadable(container, state);
    } else if (state.view === 'error') {
      renderError(container, state);
    } else if (state.view === 'loading') {
      renderLoading(container, status);
    } else {
      renderReceived(container, state, status);
    }

    if (focusState) queueMicrotask(focusStateHeading);
  }

  render();
  return { back, rerender: render };
}
