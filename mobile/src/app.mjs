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
import { classifySharedText } from './core/share-classifier.mjs';
import { createShareSession } from './core/share-session.mjs';
import { TifloSave } from './core/save-plugin.mjs';
import { createNotificationService } from './native/notifications.mjs';
import { TifloShare } from './native/share-plugin.mjs';
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
import { renderShare } from './screens/share.mjs';
import { createAccessibleVideoPlayer, createSharedVideoItem } from './screens/video-player.mjs';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing mobile app root');

const EMPTY_CONTENT = Object.freeze({ resources: [], videos: [], news: [] });
let currentContent = EMPTY_CONTENT;
let activeScreenCleanup = null;
let shareMode = false;
let normalRouterSnapshot = null;
let shareController = null;

function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

const storage = safeStorage();
const preferencesStore = createPreferencesStore({ storage });
const favoritesStore = createFavoritesStore(storage);
const notificationService = createNotificationService(null);
const shareSession = createShareSession();
const nativeActions = createNativeActions({
  appPlugin: App,
  sharePlugin: Share,
  browserPlugin: Browser,
  savePlugin: TifloSave,
  tifloSharePlugin: TifloShare
});
preferencesStore.load();
applyPreferences(document.documentElement, preferencesStore.getCurrent());

function t(key) { return text(preferencesStore.getCurrent().lang, key); }

function textInputIsActive() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable) return true;
  return typeof active.matches === 'function' && active.matches('input, textarea, select');
}

function addShareScreenHeading(title = t('screen.share')) {
  root.replaceChildren();
  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = title;
  root.append(heading);
  return heading;
}

function openSharedVideo(classification, originId = 'share-action-play') {
  shareSession.setClassification(classification);
  router.navigate('share-video', { originId: originId || null });
}

function openSharedDownload(url, originId = 'share-action-downloads') {
  if (url) shareSession.selectUrl(url);
  router.navigate('share-download', { originId: originId || null });
}

function openSharedSearch(_text = '', originId = 'share-action-search') {
  router.navigate('share-search', { originId: originId || null });
}

async function finishSharedFlow() {
  if (!shareMode) return false;
  activeScreenCleanup?.();
  activeScreenCleanup = null;
  shareSession.clear();
  if (Array.isArray(normalRouterSnapshot) && normalRouterSnapshot.length) {
    router.restore(normalRouterSnapshot, { renderCurrent: true, focus: false });
  } else {
    router.start('home');
  }
  normalRouterSnapshot = null;
  shareController = null;
  shareMode = false;
  await nativeActions.finishSharedFlow();
  return true;
}

function handleShareBack() {
  if (!shareMode) return false;
  const route = router.current()?.name || '';
  if (route !== 'share' && router.back()) return true;
  if (shareController?.back) return shareController.back();
  void finishSharedFlow();
  return true;
}

function renderSharedVideo(context) {
  addShareScreenHeading();
  const state = shareSession.snapshot();
  const classification = state.classification || {};
  const item = createSharedVideoItem({
    videoId: classification.videoId,
    url: classification.url,
    title: t('share.receivedYoutube')
  });
  const player = createAccessibleVideoPlayer({
    parent: root,
    item,
    t,
    nativeActions,
    onClose: () => router.back(),
    allowYouTubeFallback: true,
    closeLabel: t('share.closePlayer')
  });
  context.setScreenCleanup(() => player.destroy());
  queueMicrotask(() => { void player.open(); });
}

function render(route) {
  activeScreenCleanup?.();
  activeScreenCleanup = null;
  shareController = null;

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
    setScreenCleanup(cleanup) { activeScreenCleanup = typeof cleanup === 'function' ? cleanup : null; }
  };

  switch (route.name) {
    case 'home': renderHome(context); break;
    case 'actualidad': renderActualidad(context); break;
    case 'search': renderSearch(context); break;
    case 'library': renderLibrary(context); break;
    case 'downloads': renderDownloads(context); break;
    case 'downloads-link': renderDownloadLink(context); break;
    case 'downloads-sounds': renderSoundSearch(context); break;
    case 'favorites': renderFavorites(context); break;
    case 'videos': renderVideos(context); break;
    case 'book': renderBook(context); break;
    case 'podcast': renderPodcast(context); break;
    case 'contact': renderContact(context); break;
    case 'settings': renderSettings(context); break;
    case 'share':
      shareController = renderShare({
        root,
        session: shareSession,
        resolveDownload: resolveLocal,
        webFetch: url => fetchSharedPage(url, TifloWebFetch),
        nativeActions,
        t,
        onOpenVideo: openSharedVideo,
        onOpenDownload: openSharedDownload,
        onOpenSearch: openSharedSearch,
        onFinish: () => { void finishSharedFlow(); }
      });
      break;
    case 'share-video': renderSharedVideo(context); break;
    case 'share-download':
      renderDownloadLink({
        ...context,
        initialUrl: shareSession.snapshot().selectedUrl || shareSession.snapshot().classification?.url || '',
        analyzeOnOpen: true
      });
      break;
    case 'share-search':
      renderSearch({ ...context, initialQuery: shareSession.snapshot().text });
      break;
    default: renderHome(context);
  }
}

export const router = createRouter({
  render,
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

void nativeActions.installBackHandler(router, { beforeBack: handleShareBack });

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

function beginSharedFlow(rawText = '') {
  const classified = classifySharedText(rawText, { resolveDownload: resolveLocal });
  if (!shareMode) normalRouterSnapshot = router.snapshot();
  activeScreenCleanup?.();
  activeScreenCleanup = null;
  shareMode = true;

  shareSession.begin({ text: classified.text, urls: classified.urls });
  if (classified.kind === 'multi-url') {
    shareSession.setView('multi-url');
  } else if (classified.kind === 'single-url') {
    shareSession.selectUrl(classified.urls[0]);
    shareSession.setClassification(classified.classification);
    shareSession.setView('received');
  } else {
    shareSession.setClassification({ kind: 'text' });
    shareSession.setView('received');
  }
  router.start('share');
}

router.start('home');

void TifloShare.addListener('shareReceived', event => {
  beginSharedFlow(String(event?.text || ''));
});
void TifloShare.getInitialShare().then(result => {
  if (result?.shared === true) beginSharedFlow(result.text);
});

const contentStore = createContentStore({ fetchFn: (...args) => window.fetch(...args), storage });
contentStore.load().then(result => {
  currentContent = result.content || EMPTY_CONTENT;
  if (!shareMode && !textInputIsActive()) render(router.current());
});
