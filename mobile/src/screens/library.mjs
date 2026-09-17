import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';

function addFavoriteButton(parent, item, favoritesStore, t) {
  const ref = { kind: 'resource', id: String(item.id || '') };
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

export function renderLibrary({ root, router, content, preferences, favoritesStore, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.library'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const items = (Array.isArray(content?.resources) ? content.resources : []).filter(item => !item.lang || item.lang === lang);
  if (!items.length) {
    addParagraph(root, t('library.empty'), 'empty-state');
    return;
  }

  const list = document.createElement('div');
  list.className = 'content-list';
  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'content-card';
    const title = document.createElement('h2');
    title.textContent = item.title || '';
    article.append(title);
    if (item.category) addParagraph(article, item.category, 'muted');

    const url = item.openUrl || item.url || '';
    if (url) {
      addExternalLink(article, {
        href: url,
        label: `${t('library.open')}: ${item.title || ''}`,
        onOpen: nativeActions?.openExternal
      });
      addShareButton(article, {
        label: t('common.share'),
        title: item.title || '',
        text: item.category || '',
        url,
        onShare: nativeActions?.share
      });
    }
    if (item.id) addFavoriteButton(article, item, favoritesStore, t);
    list.append(article);
  }
  root.append(list);
}
