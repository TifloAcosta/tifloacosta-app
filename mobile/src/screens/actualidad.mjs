function favoriteButton({ item, favorites, t }) {
  const ref = { kind: 'news', id: String(item.id) };
  const button = document.createElement('button');
  button.type = 'button';
  const syncLabel = () => { button.textContent = t(favorites.has(ref) ? 'favorites.remove' : 'favorites.add'); };
  syncLabel();
  button.addEventListener('click', () => {
    favorites.toggle(ref);
    syncLabel();
  });
  return button;
}

export function renderActualidad({ root, router, content, preferences, favorites, t }) {
  const snapshot = Array.isArray(content?.news)
    ? content.news.filter(item => !item.lang || item.lang === preferences.lang).map(item => ({ ...item }))
    : [];
  root.replaceChildren();

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.actualidad.title');
  root.append(heading);

  if (!snapshot.length) {
    const empty = document.createElement('p');
    empty.textContent = t('screen.actualidad.empty');
    root.append(empty);
    return;
  }

  const list = document.createElement('div');
  for (const item of snapshot) {
    const article = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = item.title || '';
    article.append(title);
    if (item.summary) {
      const summary = document.createElement('p');
      summary.textContent = item.summary;
      article.append(summary);
    }
    if (item.sourceName) {
      const source = document.createElement('p');
      source.textContent = item.sourceName;
      article.append(source);
    }
    article.append(favoriteButton({ item, favorites, t }));
    list.append(article);
  }
  root.append(list);
}
