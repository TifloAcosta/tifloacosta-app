import { addExternalLink, addParagraph, addScreenHeader, addShareButton, clearScreen } from './shared.mjs';

const SEEK_SECONDS = 60;
const YOUTUBE_API_TIMEOUT_MS = 10_000;
let youtubeApiPromise = null;

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

function videoId(item) {
  const direct = String(item?.id || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(direct)) return direct;

  try {
    const url = new URL(String(item?.url || ''));
    if (url.hostname === 'youtu.be') {
      const shortId = url.pathname.replace(/^\//, '').split('/')[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(shortId)) return shortId;
    }
    const queryId = url.searchParams.get('v') || '';
    if (/^[A-Za-z0-9_-]{11}$/.test(queryId)) return queryId;
  } catch {}
  return '';
}

function youtubeUrl(item) {
  const url = String(item?.url || '').trim();
  if (url) return url;
  const id = videoId(item);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '';
}

function loadYouTubeApi() {
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const previousReady = window.onYouTubeIframeAPIReady;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback(value);
    };

    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === 'function') {
        try { previousReady(); } catch {}
      }
      if (window.YT && typeof window.YT.Player === 'function') finish(resolve, window.YT);
      else finish(reject, new Error('YouTube IFrame API unavailable'));
    };

    let script = document.querySelector('script[data-mobile-youtube-iframe-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.mobileYoutubeIframeApi = 'true';
      document.head.append(script);
    }
    script.addEventListener('error', () => finish(reject, new Error('YouTube IFrame API failed to load')), { once: true });
    timer = setTimeout(() => finish(reject, new Error('YouTube IFrame API timed out')), YOUTUBE_API_TIMEOUT_MS);
  }).catch(error => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

async function openExternal(url, nativeActions) {
  if (!url) return false;
  try {
    const handled = await nativeActions?.openExternal?.(url);
    if (handled) return true;
  } catch {}
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function renderVideos({ root, router, content, favoritesStore, nativeActions, t, setScreenCleanup, initialVideoId = '' }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.videos'), backLabel: t('nav.back') });

  const items = Array.isArray(content?.videos) ? content.videos : [];
  if (!items.length) {
    addParagraph(root, t('videos.empty'), 'empty-state');
    return;
  }

  let activeVideo = null;
  let launchButton = null;
  let youtubePlayer = null;
  let playerReady = false;
  let playerIsPlaying = false;
  let disposed = false;

  const playerSection = document.createElement('section');
  playerSection.className = 'video-player-section';
  playerSection.hidden = true;

  const playerHeading = document.createElement('h2');
  playerHeading.tabIndex = -1;
  playerHeading.textContent = t('videos.playerHeading');

  const playerTitle = document.createElement('h3');
  playerTitle.className = 'video-player-title';

  const frameWrap = document.createElement('div');
  frameWrap.className = 'video-player-frame';
  const playerHost = document.createElement('div');
  playerHost.id = 'mobile-youtube-player';
  frameWrap.append(playerHost);

  const controls = document.createElement('div');
  controls.className = 'video-player-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', t('videos.controlsLabel'));

  const rewind = document.createElement('button');
  rewind.type = 'button';
  rewind.textContent = t('videos.rewindOneMinute');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = t('videos.playControl');

  const forward = document.createElement('button');
  forward.type = 'button';
  forward.textContent = t('videos.forwardOneMinute');

  controls.append(rewind, toggle, forward);

  const status = document.createElement('p');
  status.className = 'video-player-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = t('videos.preparing');

  const playerYouTube = document.createElement('a');
  playerYouTube.className = 'action-link';
  playerYouTube.target = '_blank';
  playerYouTube.rel = 'noopener noreferrer';
  playerYouTube.textContent = t('videos.openYouTube');

  const closePlayer = document.createElement('button');
  closePlayer.type = 'button';
  closePlayer.textContent = t('videos.closePlayer');

  playerSection.append(playerHeading, playerTitle, frameWrap, controls, status, playerYouTube, closePlayer);
  root.append(playerSection);

  function setControlsEnabled(enabled) {
    rewind.disabled = !enabled;
    toggle.disabled = !enabled;
    forward.disabled = !enabled;
  }

  function updateToggleLabel() {
    toggle.textContent = playerIsPlaying ? t('videos.pauseControl') : t('videos.playControl');
  }

  function markUnavailable() {
    playerReady = false;
    playerIsPlaying = false;
    setControlsEnabled(false);
    updateToggleLabel();
    status.textContent = t('videos.unavailable');
  }

  function markReady() {
    playerReady = true;
    setControlsEnabled(true);
    status.textContent = t('videos.ready');
    updateToggleLabel();
  }

  function handlePlayerStateChange(event) {
    const playingState = window.YT?.PlayerState?.PLAYING;
    playerIsPlaying = playingState !== undefined && event?.data === playingState;
    updateToggleLabel();
  }

  function handlePlayerReady(event) {
    if (disposed) return;
    youtubePlayer = event.target;
    markReady();
  }

  async function ensurePlayer(id) {
    try {
      const YT = await loadYouTubeApi();
      if (disposed || !activeVideo) return;

      if (youtubePlayer && playerReady) {
        youtubePlayer.cueVideoById(id);
        playerIsPlaying = false;
        markReady();
        return;
      }

      youtubePlayer = new YT.Player('mobile-youtube-player', {
        videoId: id,
        playerVars: {
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: handlePlayerReady,
          onStateChange: handlePlayerStateChange,
          onError: markUnavailable
        }
      });
    } catch {
      markUnavailable();
    }
  }

  async function openPlayer(item, originButton) {
    const id = videoId(item);
    if (!id) {
      await openExternal(youtubeUrl(item), nativeActions);
      return;
    }

    activeVideo = item;
    launchButton = originButton;
    playerTitle.textContent = item.title || t('videos.playerHeading');
    playerYouTube.href = youtubeUrl(item);
    playerSection.hidden = false;
    status.textContent = t('videos.preparing');
    playerIsPlaying = false;
    setControlsEnabled(false);
    updateToggleLabel();
    playerHeading.focus();
    await ensurePlayer(id);
  }

  function seekBy(seconds) {
    if (!youtubePlayer || !playerReady) return;
    try {
      const current = Number(youtubePlayer.getCurrentTime?.() || 0);
      const duration = Number(youtubePlayer.getDuration?.() || 0);
      let target = Math.max(0, current + seconds);
      if (Number.isFinite(duration) && duration > 0) target = Math.min(target, duration);
      youtubePlayer.seekTo(target, true);
    } catch {}
  }

  function togglePlayback() {
    if (!youtubePlayer || !playerReady) return;
    try {
      const state = youtubePlayer.getPlayerState?.();
      if (state === window.YT?.PlayerState?.PLAYING) youtubePlayer.pauseVideo();
      else youtubePlayer.playVideo();
    } catch {}
  }

  function closeActivePlayer() {
    try { youtubePlayer?.pauseVideo?.(); } catch {}
    activeVideo = null;
    playerIsPlaying = false;
    playerSection.hidden = true;
    setControlsEnabled(false);
    updateToggleLabel();
    const focusTarget = launchButton;
    launchButton = null;
    if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
  }

  rewind.addEventListener('click', () => seekBy(-SEEK_SECONDS));
  toggle.addEventListener('click', togglePlayback);
  forward.addEventListener('click', () => seekBy(SEEK_SECONDS));
  closePlayer.addEventListener('click', closeActivePlayer);
  playerYouTube.addEventListener('click', event => {
    event.preventDefault();
    void openExternal(youtubeUrl(activeVideo), nativeActions);
  });

  setControlsEnabled(false);

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
      playButton.addEventListener('click', () => {
        void openPlayer(item, playButton);
      });
      article.append(playButton);
      if (String(item.id || '') === String(initialVideoId || '')) {
        queueMicrotask(() => {
          if (!disposed) void openPlayer(item, playButton);
        });
      }
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

  setScreenCleanup?.(() => {
    disposed = true;
    try { youtubePlayer?.destroy?.(); } catch {}
    youtubePlayer = null;
    activeVideo = null;
    launchButton = null;
  });
}
