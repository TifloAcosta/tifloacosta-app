import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';

function itemsForKind(content, kind) {
  if (kind === 'resource') return Array.isArray(content?.resources) ? content.resources : [];
  if (kind === 'video') return Array.isArray(content?.videos) ? content.videos : [];
  return Array.isArray(content?.news) ? content.news : [];
}

function findItem(content, ref) {
  return itemsForKind(content, ref.kind).find(item => String(item?.id || '') === ref.id) || null;
}

function titleForGroup(kind, t) {
  if (kind === 'resource') return t('screen.library');
  if (kind === 'video') return t('screen.videos');
  return t('screen.actualidad');
}

function itemUrl(kind, item) {
  if (kind === 'resource') return item.openUrl || item.url || '';
  if (kind === 'video') return item.url || '';
  return item.originalUrl || '';
}

function openLabel(kind, t) {
  if (kind === 'resource') return t('library.open');
  if (kind === 'video') return t('videos.open');
  return t('actualidad.original');
}

function itemText(kind, item) {
  if (kind === 'resource') return item.category || '';
  if (kind === 'video') return item.excerpt || item.description || '';
  return item.summary || '';
}

export function renderFavorites(context) {
  const { root, router, content, favoritesStore, nativeActions, t } = context;
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.favorites'), backLabel: t('nav.back') });

  const resolved = [];
  for (const ref of favoritesStore.list()) {
    const item = findItem(content, ref);
    if (!item) {
      favoritesStore.remove(ref);
      continue;
    }
    resolved.push({ ref, item });
  }

  if (!resolved.length) {
    addParagraph(root, t('favorites.empty'), 'empty-state');
    return;
  }

  for (const kind of ['resource', 'video', 'news']) {
    const group = resolved.filter(entry => entry.ref.kind === kind);
    if (!group.length) continue;

    const heading = document.createElement('h2');
    heading.textContent = titleForGroup(kind, t);
    root.append(heading);

    const list = document.createElement('div');
    list.className = 'content-list';

    for (const { ref, item } of group) {
      const article = document.createElement('article');
      article.className = 'content-card';

      const title = document.createElement('h3');
      title.textContent = item.title || '';
      article.append(title);

      const url = itemUrl(kind, item);
      if (url) {
        addExternalLink(article, {
          href: url,
          label: `${openLabel(kind, t)}: ${item.title || ''}`,
          onOpen: nativeActions?.openExternal
        });
        addShareButton(article, {
          label: t('common.share'),
          title: item.title || '',
          text: itemText(kind, item),
          url,
          onShare: nativeActions?.share
        });
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('favorites.remove');
      remove.addEventListener('click', () => {
        favoritesStore.remove(ref);
        renderFavorites(context);
        const headingTarget = root.querySelector('[data-screen-heading]');
        if (headingTarget && typeof headingTarget.focus === 'function') headingTarget.focus();
      });
      article.append(remove);
      list.append(article);
    }

    root.append(list);
  }
}
