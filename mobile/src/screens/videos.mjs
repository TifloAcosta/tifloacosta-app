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

function shareButton({ item, share, t }) {
  if (!item.url) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('share');
  button.addEventListener('click', () => {
    share.shareLink({ title: item.title || 'TifloAcosta', url: item.url }).catch(() => {});
  });
  return button;
}

export function renderVideos({ root, router, content, favorites, share, external, t }) {
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
    link.addEventListener('click', event => {
      event.preventDefault();
      external.open(item.url).catch(() => {});
    });
    li.append(link, favoriteButton({ item, favorites, t }));
    const shareControl = shareButton({ item, share, t });
    if (shareControl) li.append(shareControl);
    list.append(li);
  }
  root.append(list);
}