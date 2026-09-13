export const HOME_ITEMS = ['actualidad','search','library','favorites','videos','book','podcast','contact','settings'];
export const HOME_EXTERNAL_URLS = [];

export function selectHomeNews(content, lang) {
  return (Array.isArray(content?.news) ? content.news : [])
    .filter(item => !item.lang || item.lang === lang)
    .slice(0, 5);
}

export function renderHome({ root, router, content, preferences, t }) {
  root.replaceChildren();

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('appName');
  root.append(heading);

  const news = selectHomeNews(content, preferences.lang);
  if (news.length) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = t('home.latestNews');
    section.append(title);

    const list = document.createElement('ul');
    for (const item of news) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `home-news-${item.id}`;
      button.textContent = item.title || '';
      button.addEventListener('click', () => router.navigate('actualidad', { originId: button.id }));
      li.append(button);
      list.append(li);
    }
    section.append(list);
    root.append(section);
  }

  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = t('appName');
  title.className = 'visually-hidden';
  section.append(title);

  const list = document.createElement('ul');
  list.className = 'home-menu';
  for (const route of HOME_ITEMS) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `home-${route}`;
    button.textContent = t(`home.${route}`);
    button.addEventListener('click', () => router.navigate(route, { originId: button.id }));
    li.append(button);
    list.append(li);
  }
  section.append(list);
  root.append(section);
}
