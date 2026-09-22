import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';
import { createAccessibleVideoPlayer, videoId, youtubeUrl } from './video-player.mjs';

function addFavoriteButton(parent, item, favoritesStore, t) {
  const ref = { kind: 'video', id: String(item.id || '') };
  const button = document.createElement('button');
  button.type = 'button';
  function update() {
    const active = favoritesStore.has(ref);
    button.ariaPressed = String(active);
    button.textContent = active ? t('favorites.remove') : t('favorites.add');
  }
  button.addEventListener('click', () => {
    favoritesStore.toggle(ref);
    update();
  });
  update();
  parent.append(button);
}

function matchesInitialVideo(item, initialVideoId) {
  const target = String(initialVideoId || '').trim();
  if (!target) return false;
  return String(item?.id || '').trim() === target || videoId(item) === target;
}

export function renderVideos({
  root,
  router,
  content,
  favoritesStore,
  nativeActions,
  t,
  setScreenCleanup,
  initialVideoId = '',
  onBackStateChange = null
}) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.videos'), backLabel: t('nav.back') });

  const items = Array.isArray(content?.videos) ? content.videos : [];
  if (!items.length) {
    addParagraph(root, t('videos.empty'), 'empty-state');
    onBackStateChange?.(null);
    return;
  }

  let player = null;
  let initialTarget = null;
  const list = document.createElement('div');
  list.className = 'content-list';

  function setPlayerBackHandler() {
    onBackStateChange?.(() => player?.close?.() === true);
  }

  player = createAccessibleVideoPlayer({
    parent: root,
    t,
    nativeActions,
    allowYouTubeFallback: true,
    closeLabel: t('videos.closePlayer'),
    onClose: () => onBackStateChange?.(null)
  });

  async function openVideo(item, button) {
    setPlayerBackHandler();
    await player.open(item, button);
  }

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'content-card';
    const title = document.createElement('h2');
    title.textContent = item.title || '';
    article.append(title);
    if (item.excerpt || item.description) addParagraph(article, item.excerpt || item.description);

    const id = videoId(item);
    const url = youtubeUrl(item);
    if (id) {
      const playButton = document.createElement('button');
      playButton.type = 'button';
      playButton.id = `video-play-${String(item.id || id)}`;
      playButton.textContent = `${t('videos.play')}: ${item.title || ''}`;
      playButton.addEventListener('click', () => { void openVideo(item, playButton); });
      article.append(playButton);
      if (matchesInitialVideo(item, initialVideoId)) initialTarget = { item, button: playButton };
    }

    if (url) {
      addExternalLink(article, {
        href: url,
        label: t('videos.openYouTube'),
        onOpen: nativeActions?.openExternal
      });
      addShareButton(article, {
        label: t('common.share'),
        title: item.title || '',
        text: item.excerpt || item.description || '',
        url,
        onShare: nativeActions?.share
      });
    }
    if (item.id) addFavoriteButton(article, item, favoritesStore, t);
    list.append(article);
  }
  root.append(list);

  if (initialTarget) {
    queueMicrotask(() => { void openVideo(initialTarget.item, initialTarget.button); });
  } else {
    onBackStateChange?.(null);
  }

  setScreenCleanup?.(() => {
    onBackStateChange?.(null);
    player.destroy();
  });
}
