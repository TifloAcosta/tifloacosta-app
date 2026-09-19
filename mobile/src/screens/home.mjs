export const HOME_ITEMS = [
  'actualidad',
  'search',
  'library',
  'downloads',
  'favorites',
  'videos',
  'book',
  'podcast',
  'contact',
  'settings'
];

export function renderHome({ root, router, content, t }) {
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('app.title');
  root.append(heading);

  const nav = document.createElement('nav');
  nav.className = 'home-menu';
  nav.setAttribute('aria-label', t('app.title'));

  for (const key of HOME_ITEMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `home-${key}`;
    button.className = 'home-entry';
    button.textContent = t(`home.${key}`);
    button.addEventListener('click', () => router.navigate(key, { originId: button.id }));
    nav.append(button);
  }

  root.append(nav);

  const preview = Array.isArray(content?.news) ? content.news.slice(0, 5) : [];
  if (!preview.length) return;

  const section = document.createElement('section');
  const sectionHeading = document.createElement('h2');
  sectionHeading.textContent = t('home.actualidad');
  section.append(sectionHeading);
  for (const item of preview) {
    const paragraph = document.createElement('p');
    paragraph.textContent = item.title || '';
    section.append(paragraph);
  }
  root.append(section);
}
