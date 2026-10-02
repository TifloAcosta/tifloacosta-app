import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderNewContent({ root, router, content, preferences, nativeActions, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.newContent'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const resources = (Array.isArray(content?.resources) ? content.resources : [])
    .filter(item => item?.isNew === true && (!item.lang || item.lang === lang));

  if (!resources.length) {
    addParagraph(
      root,
      lang === 'en' ? 'There is no new content right now.' : 'No hay novedades disponibles en este momento.',
      'empty-state'
    );
    return;
  }

  const list = document.createElement('div');
  list.className = 'content-list';
  list.lang = lang;

  for (const item of resources) {
    const article = document.createElement('article');
    article.className = 'content-card';

    const heading = document.createElement('h2');
    heading.textContent = item.title || '';
    article.append(heading);

    if (item.category) addParagraph(article, item.category, 'muted');

    const target = item.openUrl || item.url || '';
    if (target) {
      addExternalLink(article, {
        href: target,
        label: `${t('common.open')}: ${item.title || ''}`,
        onOpen: nativeActions?.openExternal
      });
    }

    list.append(article);
  }

  root.append(list);
}
