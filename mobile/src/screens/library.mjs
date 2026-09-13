function favoriteButton({ item, favorites, t }) {
  const ref = { kind: 'resource', id: String(item.id) };
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
  const url = item.openUrl || item.url;
  if (!url) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('share');
  button.addEventListener('click', () => {
    share.shareLink({ title: item.title || 'TifloAcosta', url }).catch(() => {});
  });
  return button;
}

function safeFileName(title = 'TifloAcosta') {
  return `${title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'TifloAcosta'}.html`;
}

function saveButton({ item, saveFile, t }) {
  const url = item.downloadUrl || item.url;
  if (!url || typeof saveFile !== 'function') return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t('saveFile');
  button.addEventListener('click', () => {
    saveFile({ url, suggestedName: safeFileName(item.title) }).catch(() => {});
  });
  return button;
}

export function renderLibrary({ root, router, content, preferences, favorites, share, saveFile, t }) {
  root.replaceChildren();
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('back');
  back.addEventListener('click', () => router.back());
  root.append(back);

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('screen.library.title');
  root.append(heading);

  const resources = (content?.resources || []).filter(item => item.lang === preferences.lang);
  if (!resources.length) {
    const empty = document.createElement('p');
    empty.textContent = t('screen.library.empty');
    root.append(empty);
    return;
  }

  const list = document.createElement('ul');
  for (const item of resources) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = item.openUrl || item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = item.title || '';
    li.append(link, favoriteButton({ item, favorites, t }));
    const shareControl = shareButton({ item, share, t });
    if (shareControl) li.append(shareControl);
    const saveControl = saveButton({ item, saveFile, t });
    if (saveControl) li.append(saveControl);
    list.append(li);
  }
  root.append(list);
}
