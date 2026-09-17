import { createRouter } from './core/router.mjs';
import { focusScreenHeading, restoreOriginFocus } from './core/focus.mjs';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing mobile app root');

function render(route) {
  root.replaceChildren();
  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = route.name === 'home' ? 'TifloAcosta' : route.name;
  root.append(heading);
}

export const router = createRouter({
  render,
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

router.start('home');
