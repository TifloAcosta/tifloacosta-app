import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';

function addFavoriteButton(parent, item, favoritesStore, t) {
  const ref = { kind: 'news', id: String(item.id || '') };
  const button = document.createElement('button');
  button.type = 'button';

  function update() {
    const active = favoritesStore.has(ref);
    button.ariaPressed = String(active);
    button.textContent = active ? t('favorites.remove') : t('favorites.add');
  }

  button.addEventListener('click', () => {
    favoritesStore.toggle(ref);
    update();
  });
  update();
  parent.append(button);
}

function formatPublishedAt(value, lang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const locale = lang === 'en' ? 'en' : 'es';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function renderActualidad({
  root,
  router,
  content,
  preferences = { lang: 'es' },
  favoritesStore,
  nativeActions,
  t,
  newIds = new Set(),
  onOpenNews = null,
  onVisited = null
}) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.actualidad'), backLabel: t('nav.back') });

  const allItems = Array.isArray(content?.news) ? content.news : [];
  const items = allItems
    .filter(item => item.lang === preferences.lang)
    .sort((a, b) => {
      const dateDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (dateDelta) return dateDelta;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  if (!items.length) {
    addParagraph(root, t('actualidad.empty'), 'empty-state');
    onVisited?.(items);
    return;
  }

  const newCount = items.reduce((count, item) => count + (newIds.has(String(item.id || '')) ? 1 : 0), 0);
  if (newCount > 0) {
    addParagraph(root, t('actualidad.newCount').replace('{count}', String(newCount)), 'muted');
  }

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'content-card';
    const heading = document.createElement('h2');
    if (item.originalUrl) {
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.id = `news-open-${item.id}`;
      openButton.textContent = item.title || '';
      openButton.addEventListener('click', () => {
        onOpenNews?.(item, openButton.id);
      });
      heading.append(openButton);
    } else {
      heading.textContent = item.title || '';
    }
    article.append(heading);

    if (item.sourceName) addParagraph(article, `${t('actualidad.source')}: ${item.sourceName}`, 'muted');
    const published = formatPublishedAt(item.publishedAt, preferences.lang);
    if (published) addParagraph(article, `${t('actualidad.published')}: ${published}`, 'muted');
    if (newIds.has(String(item.id || ''))) addParagraph(article, t('actualidad.newLabel'), 'muted');
    if (item.summary) addParagraph(article, item.summary);

    if (item.originalUrl) {
      addExternalLink(article, {
        href: item.originalUrl,
        label: t('actualidad.original'),
        onOpen: nativeActions?.openExternal
      });
      addShareButton(article, {
        label: t('common.share'),
        title: item.title || '',
        text: item.summary || '',
        url: item.originalUrl,
        onShare: nativeActions?.share
      });
    }
    if (item.id) addFavoriteButton(article, item, favoritesStore, t);
    root.append(article);
  }

  onVisited?.(items);
}
