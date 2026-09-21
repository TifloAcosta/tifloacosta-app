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
  button.addEventListener('click', () => { favoritesStore.toggle(ref); update(); });
  update();
  parent.append(button);
}

export function renderVideos({ root, router, content, favoritesStore, nativeActions, t, setScreenCleanup }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.videos'), backLabel: t('nav.back') });
  const items = Array.isArray(content?.videos) ? content.videos : [];
  if (!items.length) {
    addParagraph(root, t('videos.empty'), 'empty-state');
    return;
  }

  const player = createAccessibleVideoPlayer({ parent: root, t, nativeActions, allowYouTubeFallback: true });
  const list = document.createElement('div');
  list.className = 'content-list';

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
      playButton.textContent = `${t('videos.play')}: ${item.title || ''}`;
      playButton.addEventListener('click', () => { void player.open(item, playButton); });
      article.append(playButton);
    }

    if (url) {
      addExternalLink(article, { href: url, label: t('videos.openYouTube'), onOpen: nativeActions?.openExternal });
      addShareButton(article, {
        label: t('common.share'), title: item.title || '', text: item.excerpt || item.description || '', url, onShare: nativeActions?.share
      });
    }
    if (item.id) addFavoriteButton(article, item, favoritesStore, t);
    list.append(article);
  }
  root.append(list);
  setScreenCleanup?.(() => player.destroy());
}
