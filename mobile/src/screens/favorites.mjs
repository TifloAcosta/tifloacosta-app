const GROUP_ORDER = ['resource', 'news', 'video'];

function collectionFor(content, kind) {
  if (kind === 'resource') return content?.resources || [];
  if (kind === 'video') return content?.videos || [];
  if (kind === 'news') return content?.news || [];
  return [];
}

export function resolveFavorites(content, favorites) {
  const resolved = [];
  for (const ref of favorites.list()) {
    const item = collectionFor(content, ref.kind).find(candidate => String(candidate.id) === ref.id);
    if (!item) {
      favorites.remove(ref);
      continue;
    }
    resolved.push({ kind: ref.kind, item });
  }
  return resolved;
}

export function renderFavorites({ root, router, content, preferences, favorites, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.favorites.title');
  root.append(heading);

  const resolved = resolveFavorites(content, favorites).filter(({ kind, item }) => {
    if ((kind === 'resource' || kind === 'news') && item.lang) return item.lang === preferences.lang;
    return true;
  });

  if (!resolved.length) {
    const empty = document.createElement('p');
    empty.textContent = t('favorites.empty');
    root.append(empty);
    return;
  }

  for (const kind of GROUP_ORDER) {
    const group = resolved.filter(item => item.kind === kind);
    if (!group.length) continue;
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = t(`favorites.group${kind[0].toUpperCase()}${kind.slice(1)}`);
    section.append(title);
    const list = document.createElement('ul');
    for (const { item } of group) {
      const li = document.createElement('li');
      const ref = { kind, id: String(item.id) };
      if (kind === 'resource' || kind === 'video') {
        const link = document.createElement('a');
        link.href = kind === 'resource' ? (item.openUrl || item.url) : item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = item.title || '';
        li.append(link);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = `favorite-news-${item.id}`;
        button.textContent = item.title || '';
        button.addEventListener('click', () => router.navigate('actualidad', { originId: button.id }));
        li.append(button);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('favorites.remove');
      remove.addEventListener('click', () => {
        favorites.remove(ref);
        renderFavorites({ root, router, content, preferences, favorites, t });
      });
      li.append(remove);
      list.append(li);
    }
    section.append(list);
    root.append(section);
  }
}
