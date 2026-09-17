import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderLibrary({ root, router, content, preferences, t }) {
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
    if (item.openUrl || item.url) addExternalLink(article, { href: item.openUrl || item.url, label: `${t('library.open')}: ${item.title || ''}` });
    list.append(article);
  }
  root.append(list);
}
