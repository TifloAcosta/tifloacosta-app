import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { createRouter } from './core/router.mjs';
import { focusScreenHeading, restoreOriginFocus } from './core/focus.mjs';
import { createContentStore } from './core/content-store.mjs';
import { createFavoritesStore } from './core/favorites.mjs';
import { text } from './core/i18n.mjs';
import { createNativeActions } from './core/native-actions.mjs';
import { applyPreferences, createPreferencesStore } from './core/preferences.mjs';
import { resolveLocal } from './core/downloads.mjs';
import { createReaderSession } from './core/reader-session.mjs';
import { loadReadableTarget } from './core/readable-loader.mjs';
import { searchResultAction } from './core/search.mjs';
import { TifloSave } from './core/save-plugin.mjs';
import { createNotificationService } from './native/notifications.mjs';
import { TifloWebFetch, fetchSharedPage } from './native/web-fetch-plugin.mjs';
import { renderHome } from './screens/home.mjs';
import { renderActualidad } from './screens/actualidad.mjs';
import { renderSearch } from './screens/search.mjs';
import { renderLibrary } from './screens/library.mjs';
import { renderDownloads } from './screens/downloads.mjs';
import { renderDownloadLink } from './screens/download-link.mjs';
import { renderSoundSearch } from './screens/sound-search.mjs';
import { renderFavorites } from './screens/favorites.mjs';
import { renderVideos } from './screens/videos.mjs';
import { renderBook } from './screens/book.mjs';
import { renderPodcast } from './screens/podcast.mjs';
import { renderContact } from './screens/contact.mjs';
import { renderSettings } from './screens/settings.mjs';
import { renderReader } from './screens/reader.mjs';
import { createAccessibleVideoPlayer, createSharedVideoItem } from './screens/video-player.mjs';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing mobile app root');

const EMPTY_CONTENT = Object.freeze({ resources: [], videos: [], news: [] });
let currentContent = EMPTY_CONTENT;
let activeScreenCleanup = null;
let screenBackHandler = null;
let readerController = null;
let pendingVideoId = '';
let pendingDirectVideo = null;
let pendingDownloadUrl = '';

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = safeStorage();
const preferencesStore = createPreferencesStore({ storage });
const favoritesStore = createFavoritesStore(storage);
const notificationService = createNotificationService(null);
const readerSession = createReaderSession();
const nativeActions = createNativeActions({
  appPlugin: App,
  sharePlugin: Share,
  browserPlugin: Browser,
  savePlugin: TifloSave
});
preferencesStore.load();
applyPreferences(document.documentElement, preferencesStore.getCurrent());

function t(key) {
  return text(preferencesStore.getCurrent().lang, key);
}

function textInputIsActive() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable) return true;
  return typeof active.matches === 'function' && active.matches('input, textarea, select');
}

function openDirectVideo(classification, originId = '') {
  if (!classification?.videoId) return false;
  pendingDirectVideo = classification;
  router.navigate('direct-video', { originId: originId || null });
  return true;
}

function openNormalDownload(url, originId = '') {
  const clean = String(url || '').trim();
  if (!clean) return false;
  pendingDownloadUrl = clean;
  router.navigate('downloads-link', { originId: originId || null });
  return true;
}

async function loadReaderUrl(url, { originId = '' } = {}) {
  const request = readerSession.beginRequest();
  if (router.current()?.name === 'reader') render(router.current());
  try {
    const result = await loadReadableTarget({
      url,
      resolveDownload: resolveLocal,
      webFetch: target => fetchSharedPage(target, TifloWebFetch)
    });
    if (!readerSession.isCurrentRequest(request)) return false;

    if (result.kind === 'youtube') return openDirectVideo(result.classification, originId);
    if (result.kind === 'download') return openNormalDownload(result.classification?.url || url, originId);
    if (result.kind === 'readable') {
      readerSession.push(result.page);
      if (router.current()?.name === 'reader') {
        render(router.current());
        queueMicrotask(() => focusScreenHeading(root));
      }
      return true;
    }

    readerSession.setError({ code: 'unreliable', url: result.classification?.url || url });
    if (router.current()?.name === 'reader') render(router.current());
    return false;
  } catch (error) {
    if (!readerSession.isCurrentRequest(request)) return false;
    readerSession.setError({ code: error?.code || 'unreachable', url });
    if (router.current()?.name === 'reader') render(router.current());
    return false;
  }
}

function openReadableFromApp({ url = '', title = '', originId = '', allowOriginalFallback = true } = {}) {
  const clean = String(url || '').trim();
  if (!/^https?:\/\//i.test(clean)) return false;
  readerSession.begin({ url: clean, title, allowOriginalFallback });
  const request = readerSession.beginRequest();
  router.navigate('reader', { originId: originId || null });

  void (async () => {
    try {
      const result = await loadReadableTarget({
        url: clean,
        resolveDownload: resolveLocal,
        webFetch: target => fetchSharedPage(target, TifloWebFetch)
      });
      if (!readerSession.isCurrentRequest(request)) return;
      if (result.kind === 'youtube') {
        if (router.current()?.name === 'reader') router.back();
        openDirectVideo(result.classification, originId);
        return;
      }
      if (result.kind === 'download') {
        if (router.current()?.name === 'reader') router.back();
        openNormalDownload(result.classification?.url || clean, originId);
        return;
      }
      if (result.kind === 'readable') {
        readerSession.push(result.page);
        if (router.current()?.name === 'reader') {
          render(router.current());
          queueMicrotask(() => focusScreenHeading(root));
        }
        return;
      }
      readerSession.setError({ code: 'unreliable', url: result.classification?.url || clean });
      if (router.current()?.name === 'reader') render(router.current());
    } catch (error) {
      if (!readerSession.isCurrentRequest(request)) return;
      readerSession.setError({ code: error?.code || 'unreachable', url: clean });
      if (router.current()?.name === 'reader') render(router.current());
    }
  })();
  return true;
}

function openReaderLink(url, originId = '') {
  return loadReaderUrl(url, { originId });
}

function openActualidadNews(item, originId = '') {
  return openReadableFromApp({
    url: item?.originalUrl || item?.url || '',
    title: item?.title || '',
    originId,
    allowOriginalFallback: true
  });
}

function openSearchResult(result, originId) {
  const action = searchResultAction(result);
  if (!action) return false;

  if (action.type === 'video') {
    pendingVideoId = action.id;
    router.navigate('videos', { originId });
    return true;
  }

  if (action.type === 'external') {
    void nativeActions.openExternal(action.url);
    return true;
  }

  return false;
}

function renderDirectVideo(context) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-button';
  back.textContent = t('nav.back');
  back.addEventListener('click', () => router.back());
  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.videos');
  root.append(back, heading);

  const classification = pendingDirectVideo || {};
  const item = createSharedVideoItem({
    videoId: classification.videoId,
    url: classification.url,
    title: classification.title || t('videos.playerHeading')
  });
  const player = createAccessibleVideoPlayer({
    parent: root,
    item,
    t,
    nativeActions,
    allowYouTubeFallback: true,
    closeLabel: t('videos.closePlayer'),
    onClose: () => router.back()
  });
  screenBackHandler = () => player.close() === true;
  context.setScreenCleanup(() => {
    screenBackHandler = null;
    player.destroy();
  });
  queueMicrotask(() => { void player.open(); });
}

function render(route) {
  activeScreenCleanup?.();
  activeScreenCleanup = null;
  screenBackHandler = null;
  readerController = null;

  const preferences = preferencesStore.getCurrent();
  document.title = t('app.title');
  const context = {
    root,
    router,
    route: route.name,
    content: currentContent,
    preferences,
    favoritesStore,
    nativeActions,
    notificationService,
    t,
    onPreferencesChange,
    setScreenCleanup(cleanup) {
      activeScreenCleanup = typeof cleanup === 'function' ? cleanup : null;
    }
  };

  switch (route.name) {
    case 'home': renderHome(context); break;
    case 'actualidad': renderActualidad({ ...context, onOpenNews: openActualidadNews }); break;
    case 'search': renderSearch({ ...context, onOpenResult: openSearchResult }); break;
    case 'library': renderLibrary(context); break;
    case 'downloads': renderDownloads(context); break;
    case 'downloads-link': {
      const initialUrl = pendingDownloadUrl;
      pendingDownloadUrl = '';
      renderDownloadLink({ ...context, initialUrl, analyzeOnOpen: Boolean(initialUrl) });
      break;
    }
    case 'downloads-sounds': renderSoundSearch(context); break;
    case 'favorites': renderFavorites(context); break;
    case 'videos': {
      const initialVideoId = pendingVideoId;
      pendingVideoId = '';
      renderVideos({
        ...context,
        initialVideoId,
        onBackStateChange: handler => { screenBackHandler = typeof handler === 'function' ? handler : null; }
      });
      break;
    }
    case 'direct-video': renderDirectVideo(context); break;
    case 'reader': {
      readerController = renderReader({
        ...context,
        session: readerSession,
        onActivateLink: openReaderLink,
        onRetry: () => { void loadReaderUrl(readerSession.snapshot().url); },
        onOpenOriginal: url => { void nativeActions.openExternal(url); }
      });
      break;
    }
    case 'book': renderBook(context); break;
    case 'podcast': renderPodcast(context); break;
    case 'contact': renderContact(context); break;
    case 'settings': renderSettings(context); break;
    default: renderHome(context);
  }
}

export const router = createRouter({
  render,
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

function handleScreenBack() {
  if (typeof screenBackHandler === 'function' && screenBackHandler()) return true;
  if (router.current()?.name === 'reader' && readerController?.back) return readerController.back();
  return false;
}

void nativeActions.installBackHandler(router, { beforeBack: handleScreenBack });

function onPreferencesChange(changes, { reset = false } = {}) {
  const activeId = document.activeElement?.id || '';
  const before = preferencesStore.getCurrent();
  const after = reset ? preferencesStore.reset() : preferencesStore.save(changes || {});
  applyPreferences(document.documentElement, after);

  if (before.lang !== after.lang || reset) {
    render(router.current());
    if (activeId) restoreOriginFocus(root, activeId);
  }
}

router.start('home');

const contentStore = createContentStore({
  fetchFn: (...args) => window.fetch(...args),
  storage
});

contentStore.load().then(result => {
  currentContent = result.content || EMPTY_CONTENT;
  if (!textInputIsActive()) render(router.current());
});

export function getContent() {
  return currentContent;
}
