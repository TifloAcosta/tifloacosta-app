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
import { renderHome } from './screens/home.mjs';
import { renderActualidad } from './screens/actualidad.mjs';
import { renderSearch } from './screens/search.mjs';
import { renderLibrary } from './screens/library.mjs';
import { renderFavorites } from './screens/favorites.mjs';
import { renderVideos } from './screens/videos.mjs';
import { renderBook } from './screens/book.mjs';
import { renderPodcast } from './screens/podcast.mjs';
import { renderContact } from './screens/contact.mjs';
import { renderSettings } from './screens/settings.mjs';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing mobile app root');

const EMPTY_CONTENT = Object.freeze({ resources: [], videos: [], news: [] });
let currentContent = EMPTY_CONTENT;

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
const nativeActions = createNativeActions({ appPlugin: App, sharePlugin: Share, browserPlugin: Browser });
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

function render(route) {
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
    t,
    onPreferencesChange
  };

  switch (route.name) {
    case 'home': renderHome(context); break;
    case 'actualidad': renderActualidad(context); break;
    case 'search': renderSearch(context); break;
    case 'library': renderLibrary(context); break;
    case 'favorites': renderFavorites(context); break;
    case 'videos': renderVideos(context); break;
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

void nativeActions.installBackHandler(router);

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
