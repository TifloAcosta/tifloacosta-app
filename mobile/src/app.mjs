import { createRouter } from './core/router.mjs';
import { focusScreenHeading, restoreOriginFocus } from './core/focus.mjs';
import { createContentStore } from './core/content-store.mjs';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing mobile app root');

let currentContent = null;

function render(route) {
  root.replaceChildren();
  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = route.name === 'home' ? 'TifloAcosta' : route.name;
  root.append(heading);
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function textInputIsActive() {
  const active = document.activeElement;
  if (!active) return false;
  if (active.isContentEditable) return true;
  return typeof active.matches === 'function' && active.matches('input, textarea, select');
}

export const router = createRouter({
  render,
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

router.start('home');

const contentStore = createContentStore({
  fetchFn: (...args) => window.fetch(...args),
  storage: safeStorage()
});

contentStore.load().then(result => {
  currentContent = result.content;
  if (!textInputIsActive()) render(router.current());
});

export function getContent() {
  return currentContent;
}
