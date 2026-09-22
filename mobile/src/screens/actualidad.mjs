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
  button.addEventListener('click', () => { favoritesStore.toggle(ref); update(); });
  update();
  parent.append(button);
}

function itemUrl(item) {
  return String(item?.originalUrl || item?.url || item?.openUrl || '').trim();
}

function renderCollection({ root, items, kind, headingText, favoritesStore, nativeActions, t, onOpenNews, onOpenItem }) {
  if (!items.length) return;
  const section = document.createElement('section');
  const sectionHeading = document.createElement('h2');
  sectionHeading.textContent = headingText;
  section.append(sectionHeading);

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'content-card';
    const heading = document.createElement('h3');
    const url = itemUrl(item);
    if (url) {
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.id = `news-open-${item.id}`;
      openButton.className = 'content-title-action';
      openButton.textContent = item.title || '';
      openButton.addEventListener('click', () => {
        if (kind === 'news' && typeof onOpenNews === 'function') onOpenNews(item, openButton.id);
        else if (typeof onOpenItem === 'function') onOpenItem(item, kind, openButton.id);
      });
      heading.append(openButton);
    } else {
      heading.textContent = item.title || '';
    }
    article.append(heading);
    if (item.summary || item.description) addParagraph(article, item.summary || item.description);
    if (item.platform) addParagraph(article, item.platform, 'muted');
    if (url) {
      addExternalLink(article, { href: url, label: t('actualidad.original'), onOpen: nativeActions?.openExternal });
      addShareButton(article, {
        label: t('common.share'), title: item.title || '', text: item.summary || item.description || '', url, onShare: nativeActions?.share
      });
    }
    if (kind === 'news' && item.id) addFavoriteButton(article, item, favoritesStore, t);
    section.append(article);
  }
  root.append(section);
}

export function renderActualidad({ root, router, content, favoritesStore, nativeActions, t, onOpenNews = null, onOpenItem = null }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.actualidad'), backLabel: t('nav.back') });

  const news = Array.isArray(content?.news) ? content.news : [];
  const apps = Array.isArray(content?.apps) ? content.apps : [];
  const media = Array.isArray(content?.media) ? content.media : [];
  if (!news.length && !apps.length && !media.length) {
    addParagraph(root, t('actualidad.empty'), 'empty-state');
    return;
  }

  renderCollection({ root, items: news, kind: 'news', headingText: t('actualidad.news'), favoritesStore, nativeActions, t, onOpenNews, onOpenItem });
  renderCollection({ root, items: apps, kind: 'app', headingText: t('actualidad.apps'), favoritesStore, nativeActions, t, onOpenNews, onOpenItem });
  renderCollection({ root, items: media, kind: 'media', headingText: t('actualidad.media'), favoritesStore, nativeActions, t, onOpenNews, onOpenItem });
}
