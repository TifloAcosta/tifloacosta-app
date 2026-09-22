import { classifySharedUrl } from '../core/share-classifier.mjs';
import { loadReadableTarget } from '../core/readable-loader.mjs';
import { renderReadableContent } from './reader.mjs';

const ACTIONS = Object.freeze({
  play: { id: 'play', labelKey: 'share.play' },
  read: { id: 'read', labelKey: 'share.read' },
  downloads: { id: 'downloads', labelKey: 'share.downloads' },
  search: { id: 'search', labelKey: 'share.search' },
  retry: { id: 'retry', labelKey: 'share.retry' },
  cancel: { id: 'cancel', labelKey: 'share.cancel' }
});

export function actionsForClassification(classification = {}) {
  if (classification.kind === 'youtube') return [ACTIONS.play];
  if (classification.kind === 'download') return [ACTIONS.downloads];
  if (classification.kind === 'web') return [ACTIONS.read];
  if (classification.kind === 'text') return [ACTIONS.search];
  return [];
}

export function errorActions(code = '') {
  if (code === 'unreliable' || code === 'unsupported_type') return [ACTIONS.downloads, ACTIONS.cancel];
  if (['timeout', 'unreachable', 'too_large', 'too_many_redirects', 'http_error', 'invalid_url'].includes(code)) {
    return [ACTIONS.retry, ACTIONS.cancel];
  }
  return [ACTIONS.cancel];
}

export function destinationReturnView(state = {}) {
  if (state.view === 'error') {
    const target = String(state.error?.returnView || '');
    if (['readable', 'multi-url', 'received'].includes(target)) return target;
  }
  if (state.view === 'readable') return 'readable';
  if (state.view === 'multi-url') return 'multi-url';
  return 'received';
}

export function backTargetForState(state = {}) {
  if (state.view === 'readable') {
    if ((state.readableHistory?.length || 0) > 1) return 'readable-previous';
    if ((state.urls?.length || 0) > 1 && state.selectedUrl) return 'multi-url';
    return 'finish';
  }
  if (state.view === 'error') {
    const returnView = String(state.error?.returnView || '');
    if (returnView === 'readable' && (state.readableHistory?.length || 0) > 0) return 'readable';
    if (returnView === 'multi-url') return 'multi-url';
  }
  if ((state.urls?.length || 0) > 1 && state.selectedUrl) return 'multi-url';
  return 'finish';
}

export function destinationOriginId({ returnView = 'received', kind = '', triggerId = '' } = {}) {
  if (returnView === 'received') {
    if (kind === 'youtube') return 'share-action-play';
    if (kind === 'download') return 'share-action-downloads';
  }
  return String(triggerId || '').trim() || (kind === 'youtube' ? 'share-action-play' : 'share-action-downloads');
}

function currentUrl(state = {}) {
  return String(state.selectedUrl || state.classification?.url || state.urls?.[0] || '').trim();
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

function createButton(parent, { label, onClick, id = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  if (id) button.id = id;
  button.textContent = label;
  button.addEventListener('click', onClick);
  parent.append(button);
  return button;
}

export function renderShare({
  root,
  session,
  resolveDownload = () => ({ provider: 'web' }),
  webFetch,
  t,
  onOpenVideo = () => {},
  onOpenDownload = () => {},
  onOpenSearch = () => {},
  onFinish = () => {}
} = {}) {
  if (!root?.replaceChildren || !session?.snapshot || typeof t !== 'function') {
    throw new TypeError('Share root, session and translator are required');
  }

  function focusStateHeading() {
    root.querySelector?.('[data-share-state-heading]')?.focus?.();
  }

  function finish() {
    onFinish();
  }

  function toMultiLinkList() {
    session.selectUrl('');
    session.setClassification(null);
    session.setView('multi-url');
    render({ focusState: true });
  }

  function back() {
    const state = session.snapshot();
    const target = backTargetForState(state);
    if (target === 'readable-previous') {
      session.popReadable();
      render({ focusState: true });
      return true;
    }
    if (target === 'readable') {
      session.setView('readable');
      render({ focusState: true });
      return true;
    }
    if (target === 'multi-url') {
      toMultiLinkList();
      return true;
    }
    finish();
    return true;
  }

  async function readUrl(url, trigger = null, { returnView = destinationReturnView(session.snapshot()) } = {}) {
    const request = session.beginRequest();
    if (trigger) trigger.disabled = true;
    session.setView('loading');
    render();

    try {
      const result = await loadReadableTarget({ url, resolveDownload, webFetch });
      if (!session.isCurrentRequest(request)) return;

      if (result.kind === 'youtube') {
        session.selectUrl(result.classification?.url || url);
        session.setClassification(result.classification);
        session.setView(returnView);
        onOpenVideo(result.classification, destinationOriginId({ returnView, kind: 'youtube', triggerId: trigger?.id }));
        return;
      }
      if (result.kind === 'download') {
        session.selectUrl(result.classification?.url || url);
        session.setClassification(result.classification);
        session.setView(returnView);
        onOpenDownload(result.classification?.url || url, destinationOriginId({ returnView, kind: 'download', triggerId: trigger?.id }));
        return;
      }
      if (result.kind === 'readable') {
        session.selectUrl(result.classification?.url || url);
        session.setClassification(result.classification);
        session.pushReadable(result.page);
        render({ focusState: true });
        return;
      }

      session.setClassification(result.classification);
      session.setView('error', { code: 'unreliable', url: result.classification?.url || url, returnView });
      render({ focusState: true });
    } catch (error) {
      if (!session.isCurrentRequest(request)) return;
      session.setView('error', { code: error?.code || 'unreachable', url, returnView });
      render({ focusState: true });
    } finally {
      if (trigger?.isConnected) trigger.disabled = false;
    }
  }

  function activateUrl(url, trigger = null) {
    const returnView = destinationReturnView(session.snapshot());
    const classification = classifySharedUrl(url, { resolveDownload });
    session.selectUrl(classification.url || url);
    session.setClassification(classification);

    if (classification.kind === 'youtube') {
      session.setView(returnView);
      onOpenVideo(classification, destinationOriginId({ returnView, kind: 'youtube', triggerId: trigger?.id }));
      return;
    }
    if (classification.kind === 'download') {
      session.setView(returnView);
      onOpenDownload(classification.url, destinationOriginId({ returnView, kind: 'download', triggerId: trigger?.id }));
      return;
    }
    if (classification.kind === 'web') {
      void readUrl(classification.url, trigger, { returnView });
      return;
    }
    session.setView('error', { code: 'invalid_url', url, returnView });
    render({ focusState: true });
  }

  function renderReadable(container, state) {
    const page = state.readableHistory.at(-1);
    if (!page) {
      session.setView('error', { code: 'unreliable', url: currentUrl(state), returnView: 'received' });
      render({ focusState: true });
      return;
    }

    const readable = document.createElement('div');
    container.append(readable);
    const { heading } = renderReadableContent({
      parent: readable,
      page,
      t,
      linkIdPrefix: `share-readable-${state.readableHistory.length}`,
      onActivateLink: (href, originId) => activateUrl(href, document.getElementById(originId))
    });
    heading.dataset.shareStateHeading = '';

    createButton(container, {
      label: state.readableHistory.length > 1
        ? t('share.backPage')
        : (state.urls.length > 1 ? t('share.backLinks') : t('share.returnToApp')),
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
        createButton(container, {
          id: 'share-error-retry',
          label: t(action.labelKey),
          onClick: event => void readUrl(state.error?.url || currentUrl(state), event.currentTarget, {
            returnView: state.error?.returnView || 'received'
          })
        });
      } else if (action.id === 'downloads') {
        createButton(container, {
          id: 'share-error-downloads',
          label: t(action.labelKey),
          onClick: event => onOpenDownload(state.error?.url || currentUrl(state), event.currentTarget.id)
        });
      } else {
        createButton(container, { id: 'share-error-cancel', label: t(action.labelKey), onClick: finish });
      }
    }
  }

  function renderReceived(container, state) {
    const classification = state.classification || (state.urls.length === 0 ? { kind: 'text' } : null);
    const message = document.createElement('p');
    message.textContent = classification?.kind === 'youtube' ? t('share.receivedYoutube')
      : classification?.kind === 'download' ? t('share.receivedDownload')
        : classification?.kind === 'web' ? t('share.receivedWeb')
          : t('share.receivedText');
    container.append(message);

    for (const action of actionsForClassification(classification || { kind: 'text' })) {
      let button = null;
      button = createButton(container, {
        id: `share-action-${action.id}`,
        label: t(action.labelKey),
        onClick: () => {
          if (action.id === 'play') onOpenVideo(classification, button.id);
          else if (action.id === 'downloads') onOpenDownload(classification?.url || currentUrl(state), button.id);
          else if (action.id === 'search') onOpenSearch(state.text, button.id);
          else if (action.id === 'read') void readUrl(classification?.url || currentUrl(state), button, { returnView: 'received' });
        }
      });
    }
    createButton(container, { label: t('share.cancel'), onClick: finish });
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
        id: `share-link-choice-${index}`,
        label: `${index + 1}: ${url}`,
        onClick: event => activateUrl(url, event.currentTarget)
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
      renderReceived(container, state);
    }

    if (focusState) queueMicrotask(focusStateHeading);
  }

  render();
  return { back, rerender: render };
}
