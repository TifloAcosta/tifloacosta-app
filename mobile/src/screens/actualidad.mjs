import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

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

export function renderActualidad({ root, router, content, favoritesStore, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.actualidad'), backLabel: t('nav.back') });

  const items = Array.isArray(content?.news) ? content.news : [];
  if (!items.length) {
    addParagraph(root, t('actualidad.empty'), 'empty-state');
    return;
  }

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'content-card';
    const heading = document.createElement('h2');
    heading.textContent = item.title || '';
    article.append(heading);
    if (item.summary) addParagraph(article, item.summary);
    if (item.originalUrl) addExternalLink(article, { href: item.originalUrl, label: t('actualidad.original') });
    if (item.id) addFavoriteButton(article, item, favoritesStore, t);
    root.append(article);
  }
}
