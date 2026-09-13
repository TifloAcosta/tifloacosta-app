function favoriteButton({ item, favorites, t }) {
  const ref = { kind: 'video', id: String(item.id) };
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

export function renderVideos({ root, router, content, favorites, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.videos.title');
  root.append(heading);

  const videos = content?.videos || [];
  if (!videos.length) {
    const empty = document.createElement('p');
    empty.textContent = t('screen.videos.empty');
    root.append(empty);
    return;
  }

  const list = document.createElement('ul');
  for (const item of videos) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.title || '';
    li.append(link, favoriteButton({ item, favorites, t }));
    list.append(li);
  }
  root.append(list);
}
