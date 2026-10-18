import { PRIVACY_LABELS } from './privacy.mjs';

const HOME_INTRO = Object.freeze({
  es: 'Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.',
  en: 'Accessibility and technology resources, organized so you can reach them without getting lost along the way.'
});

export const HOME_ITEMS = [
  'search',
  'new-content',
  'actualidad',
  'library',
  'reading-library',
  'downloads',
  'favorites',
  'videos',
  'book',
  'podcast',
  'contact',
  'privacy',
  'settings'
];

export function renderHome({ root, router, content, preferences = { lang: 'es' }, iosInboxAvailable = false, t, onOpenVideos = null }) {
  root.replaceChildren();

  const brandHeader = document.createElement('header');
  brandHeader.className = 'app-brand-header';

  const brandMark = document.createElement('img');
  brandMark.className = 'app-brand-mark';
  brandMark.src = './tifloacosta-simbolo-blanco.svg';
  brandMark.alt = '';
  brandMark.setAttribute('aria-hidden', 'true');

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.className = 'app-brand';
  heading.textContent = t('app.title');

  brandHeader.append(brandMark, heading);
  root.append(brandHeader);

  const intro = document.createElement('p');
  intro.className = 'home-intro';
  intro.textContent = HOME_INTRO[preferences.lang] || HOME_INTRO.es;
  root.append(intro);

  const nav = document.createElement('nav');
  nav.className = 'home-menu section-stack';
  nav.setAttribute('aria-label', t('app.title'));

  // Keep the Android/general home order unchanged. Received exists only in
  // the iPhone App Group navigation and does not duplicate any Web page.
  const entries = iosInboxAvailable
    ? HOME_ITEMS.flatMap(key => key === 'reading-library' ? [key, 'received'] : [key])
    : HOME_ITEMS;
  for (const key of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `home-${key}`;
    button.className = 'home-entry';
    if (key === 'privacy') {
      button.textContent = PRIVACY_LABELS[preferences.lang] || PRIVACY_LABELS.es;
    } else if (key === 'reading-library') {
      button.textContent = 'TifloLector';
    } else {
      button.textContent = t(`home.${key}`);
    }
    button.addEventListener('click', () => {
      if (key === 'videos' && typeof onOpenVideos === 'function') {
        // iOS UIKit owns the Videos screen. The web view stays on the home
        // screen underneath, so there is no duplicate accessibility tree.
        void Promise.resolve().then(() => onOpenVideos()).then(opened => {
          if (!opened) router.navigate(key, { originId: button.id });
        }).catch(() => router.navigate(key, { originId: button.id }));
        return;
      }
      router.navigate(key, { originId: button.id });
    });
    nav.append(button);
  }

  root.append(nav);
}