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

export function renderHome({ root, router, content, preferences = { lang: 'es' }, t }) {
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

  for (const key of HOME_ITEMS) {
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
    button.addEventListener('click', () => router.navigate(key, { originId: button.id }));
    nav.append(button);
  }

  root.append(nav);
}