import { createContentStore } from './core/content-store.mjs';
import { createFavoritesStore } from './core/favorites.mjs';
import { focusScreenHeading, restoreOriginFocus } from './core/focus.mjs';
import { formatText } from './core/i18n.mjs';
import { applyPreferences, createPreferencesStore } from './core/preferences.mjs';
import { createRouter } from './core/router.mjs';
import { renderActualidad } from './screens/actualidad.mjs';
import { renderBook } from './screens/book.mjs';
import { renderContact } from './screens/contact.mjs';
import { renderFavorites } from './screens/favorites.mjs';
import { renderHome } from './screens/home.mjs';
import { renderLibrary } from './screens/library.mjs';
import { renderPodcast } from './screens/podcast.mjs';
import { renderSearch } from './screens/search.mjs';
import { renderSettings } from './screens/settings.mjs';
import { renderVideos } from './screens/videos.mjs';

const root = document.querySelector('#app');
const preferencesStore = createPreferencesStore();
const favoritesStore = createFavoritesStore();
const contentStore = createContentStore();
const emptyContent = { schemaVersion: 1, generatedAt: '', resources: [], videos: [], news: [] };
let content = contentStore.getCurrent() || emptyContent;
let router;

applyPreferences(document.documentElement, preferencesStore.get());

const renderers = new Map([
  ['home', renderHome],
  ['actualidad', renderActualidad],
  ['search', renderSearch],
  ['library', renderLibrary],
  ['favorites', renderFavorites],
  ['videos', renderVideos],
  ['book', renderBook],
  ['podcast', renderPodcast],
  ['contact', renderContact],
  ['settings', renderSettings]
]);

function renderRoute(route) {
  const preferences = preferencesStore.get();
  const t = (key, ...args) => formatText(preferences.lang, key, ...args);
  const render = renderers.get(route.name);
  if (!render) return;

  render({
    root,
    router,
    content,
    preferences,
    favorites: favoritesStore,
    t,
    onPreferencesChange(patch) {
      const next = preferencesStore.update(patch);
      applyPreferences(document.documentElement, next);
      if (Object.hasOwn(patch, 'lang')) renderRoute(router.current());
    }
  });
}

router = createRouter({
  render: renderRoute,
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

router.start('home');

contentStore.load().then(result => {
  if (!result.content) return;
  content = result.content;
  const active = document.activeElement;
  if (!active || active === document.body || active === root) renderRoute(router.current());
});
