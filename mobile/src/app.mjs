import { focusScreenHeading, restoreOriginFocus } from './core/focus.mjs';
import { createRouter } from './core/router.mjs';

const root = document.querySelector('#app');

const router = createRouter({
  render: route => {
    root.innerHTML = `<h1 data-screen-heading tabindex="-1">${route.name === 'home' ? 'TifloAcosta' : route.name}</h1>`;
  },
  focusScreenHeading: () => focusScreenHeading(root),
  restoreOriginFocus: originId => restoreOriginFocus(root, originId)
});

router.start('home');
