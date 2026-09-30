import { PRIVACY_LABELS } from './privacy.mjs';

const NEW_CONTENT_LABELS = Object.freeze({
  es: 'Novedades',
  en: 'New content'
});

export const HOME_ITEMS = [
  'search',
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
    } else {
      button.textContent = t(`home.${key === 'reading-library' ? 'readingLibrary' : key}`);
    }
    button.addEventListener('click', () => router.navigate(key, { originId: button.id }));
    nav.append(button);
  }

  root.append(nav);

  const newResources = Array.isArray(content?.resources)
    ? content.resources.filter(item => item?.isNew === true && item?.lang === preferences.lang)
    : [];
  if (!newResources.length) return;

  const section = document.createElement('section');
  section.className = 'section-stack';
  section.lang = preferences.lang;
  const sectionHeading = document.createElement('h2');
  const newContentKey = 'home.newContent';
  const translatedHeading = t(newContentKey);
  sectionHeading.textContent = translatedHeading === newContentKey
    ? (NEW_CONTENT_LABELS[preferences.lang] || NEW_CONTENT_LABELS.es)
    : translatedHeading;
  section.append(sectionHeading);
  for (const item of newResources) {
    const paragraph = document.createElement('p');
    paragraph.textContent = item.title || '';
    section.append(paragraph);
  }
  root.append(section);
}
