import { addExternalLink, addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderNewContent({ root, router, content, preferences, nativeActions, onRefreshContent, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.newContent'), backLabel: t('nav.back') });

  const lang = preferences?.lang === 'en' ? 'en' : 'es';
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.id = 'new-content-refresh';
  refreshButton.textContent = lang === 'en' ? 'Refresh what is new' : 'Actualizar novedades';
  const refreshStatus = document.createElement('p');
  refreshStatus.className = 'muted';
  refreshStatus.setAttribute('role', 'status');
  refreshStatus.setAttribute('aria-live', 'polite');
  refreshStatus.setAttribute('aria-atomic', 'true');
  const generatedAt = Date.parse(content?.generatedAt || '');
  if (Number.isFinite(generatedAt)) {
    const formatted = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(generatedAt));
    refreshStatus.textContent = lang === 'en'
      ? `Catalog last generated: ${formatted}. The date of the newest publication can be earlier.`
      : `Catálogo generado por última vez: ${formatted}. La última publicación puede tener una fecha anterior.`;
  }
  let refreshPending = false;
  refreshButton.addEventListener('click', async () => {
    if (refreshPending) return;
    refreshPending = true;
    refreshStatus.textContent = lang === 'en' ? 'Checking for updates…' : 'Buscando nuevas publicaciones…';
    try {
      const result = await onRefreshContent?.();
      // When a new feed is found, app.mjs refreshes this entire screen.
      if (!root.contains(refreshButton)) return;
      refreshStatus.textContent = result?.status === 'fresh'
        ? (lang === 'en'
            ? 'Checked successfully. There are no additional catalog publications at this time.'
            : 'Comprobación realizada. No hay publicaciones adicionales en el catálogo por ahora.')
        : (lang === 'en'
            ? 'Could not get an updated catalog. Showing the last saved content.'
            : 'No se pudo obtener un catálogo actualizado. Se mantiene el contenido guardado.');
    } catch {
      if (root.contains(refreshButton)) {
        refreshStatus.textContent = lang === 'en'
          ? 'The connection failed. Saved content remains available.'
          : 'Falló la conexión. El contenido guardado sigue disponible.';
      }
    } finally {
      refreshPending = false;
    }
  });
  root.append(refreshButton, refreshStatus);
  const resources = (Array.isArray(content?.resources) ? content.resources : [])
    .filter(item => item?.isNew === true && (!item.lang || item.lang === lang))
    .sort((a, b) => (Date.parse(b.newsDate || '') || 0) - (Date.parse(a.newsDate || '') || 0));

  if (!resources.length) {
    addParagraph(
      root,
      lang === 'en' ? 'There is no new content right now.' : 'No hay novedades disponibles en este momento.',
      'empty-state'
    );
    return;
  }

  const newestDate = resources.map(item => Date.parse(item.newsDate || '')).find(Number.isFinite);
  if (Number.isFinite(newestDate)) {
    const dateLabel = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(newestDate));
    addParagraph(root, lang === 'en' ? `Latest published item: ${dateLabel}.` : `Última novedad publicada: ${dateLabel}.`, 'muted');
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
    const publishedAt = Date.parse(item.newsDate || '');
    if (Number.isFinite(publishedAt)) {
      const publishedLabel = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(publishedAt));
      addParagraph(article, lang === 'en' ? `Published: ${publishedLabel}.` : `Publicado: ${publishedLabel}.`, 'muted');
    }

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
