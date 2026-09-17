import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderActualidad({ root, router, content, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.actualidad'), backLabel: t('nav.back') });

  const items = Array.isArray(content?.news) ? content.news : [];
  if (!items.length) {
    addParagraph(root, t('actualidad.empty'), 'empty-state');
    return;
  }

  for (const item of items) {
    const article = document.createElement('article');
    const heading = document.createElement('h2');
    heading.textContent = item.title || '';
    article.append(heading);
    if (item.summary) addParagraph(article, item.summary);
    if (item.originalUrl) addExternalLink(article, { href: item.originalUrl, label: t('actualidad.original') });
    root.append(article);
  }
}
