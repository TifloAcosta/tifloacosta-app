import { youtubeVideoId } from '../core/share-classifier.mjs';

const SEEK_SECONDS = 60;
const POSITION_REFRESH_MS = 1000;
const YOUTUBE_API_TIMEOUT_MS = 10_000;
let youtubeApiPromise = null;
let playerSequence = 0;

export function videoId(item) {
  const direct = String(item?.id || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(direct)) return direct;
  return youtubeVideoId(String(item?.url || ''));
}

export function youtubeUrl(item) {
  const url = String(item?.url || '').trim();
  if (/^https?:\/\//i.test(url)) return url;
  const id = videoId(item);
  return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '';
}

export function videoItemFromShared({ videoId: id = '', url = '', title = '' } = {}) {
  const cleanId = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(cleanId)) return null;
  const cleanUrl = String(url || '').trim() || `https://www.youtube.com/watch?v=${encodeURIComponent(cleanId)}`;
  return { id: cleanId, url: cleanUrl, title: String(title || '').trim() };
}

export const createSharedVideoItem = videoItemFromShared;

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

function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function appendLinkedDescription(parent, value, nativeActions) {
  parent.replaceChildren();
  const text = String(value || '').trim();
  if (!text) return false;
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  let cursor = 0;
  for (const match of text.matchAll(urlPattern)) {
    const index = Number(match.index || 0);
    if (index > cursor) parent.append(document.createTextNode(text.slice(cursor, index)));
    let href = match[0];
    let suffix = '';
    while (/[),.;!?]$/.test(href)) {
      suffix = href.slice(-1) + suffix;
      href = href.slice(0, -1);
    }
    const link = document.createElement('a');
    link.href = href;
    link.textContent = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', event => {
      if (!nativeActions?.openExternal) return;
      event.preventDefault();
      void openExternal(href, nativeActions);
    });
    parent.append(link);
    if (suffix) parent.append(document.createTextNode(suffix));
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
  return true;
}

export function createAccessibleVideoPlayer({
  parent,
  item = null,
  t,
  nativeActions,
  onClose = null,
  focusTarget = null,
  allowYouTubeFallback = true,
  closeLabel = ''
} = {}) {
  if (!parent?.append || typeof t !== 'function') throw new TypeError('Player parent and translator are required');

  const hostId = `mobile-youtube-player-${++playerSequence}`;
  let activeItem = item;
  let activeFocusTarget = focusTarget;
  let youtubePlayer = null;
  let playerReady = false;
  let playerIsPlaying = false;
  let disposed = false;
  let opened = false;
  let detailsOpen = false;
  let positionTimer = null;

  const section = document.createElement('section');
  section.className = 'video-player-section';
  section.hidden = true;
  const heading = document.createElement('h2');
  heading.tabIndex = -1;
  heading.textContent = t('videos.playerHeading');
  const title = document.createElement('h3');
  title.className = 'video-player-title';
  const frameWrap = document.createElement('div');
  frameWrap.className = 'video-player-frame';
  const playerHost = document.createElement('div');
  playerHost.id = hostId;
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

  const positionWrap = document.createElement('div');
  positionWrap.className = 'video-player-position';
  const positionLabel = document.createElement('label');
  const positionId = `${hostId}-position`;
  positionLabel.htmlFor = positionId;
  positionLabel.textContent = t('videos.position');
  const position = document.createElement('input');
  position.id = positionId;
  position.type = 'range';
  position.min = '0';
  position.max = '0';
  position.step = '1';
  position.value = '0';
  position.disabled = true;
  position.setAttribute('aria-valuetext', `${formatTime(0)} / ${formatTime(0)}`);
  positionWrap.append(positionLabel, position);

  const status = document.createElement('p');
  status.className = 'video-player-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const detailsButton = document.createElement('button');
  detailsButton.type = 'button';
  detailsButton.textContent = t('videos.details');
  detailsButton.setAttribute('aria-expanded', 'false');
  const detailsPanel = document.createElement('div');
  detailsPanel.className = 'video-player-details';
  detailsPanel.hidden = true;
  const detailsId = `${hostId}-details`;
  detailsPanel.id = detailsId;
  detailsButton.setAttribute('aria-controls', detailsId);

  const fallback = document.createElement('button');
  fallback.type = 'button';
  fallback.textContent = t('videos.openYouTube');
  fallback.hidden = true;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = String(closeLabel || '').trim() || t('videos.closePlayer');
  section.append(heading, title, frameWrap, controls, positionWrap, status, detailsButton, detailsPanel, fallback, closeButton);
  parent.append(section);

  function setControlsEnabled(enabled) {
    rewind.disabled = !enabled;
    toggle.disabled = !enabled;
    forward.disabled = !enabled;
    position.disabled = !enabled;
  }
  function updateToggleLabel() {
    toggle.textContent = playerIsPlaying ? t('videos.pauseControl') : t('videos.playControl');
  }
  function updatePosition({ fromPlayer = true } = {}) {
    if (!youtubePlayer || !playerReady) return;
    try {
      const duration = Math.max(0, Number(youtubePlayer.getDuration?.() || 0));
      const current = fromPlayer
        ? Math.max(0, Number(youtubePlayer.getCurrentTime?.() || 0))
        : Math.max(0, Number(position.value || 0));
      const bounded = duration > 0 ? Math.min(current, duration) : current;
      position.max = String(Math.max(0, Math.round(duration)));
      position.value = String(Math.round(bounded));
      position.setAttribute('aria-valuetext', `${formatTime(bounded)} / ${formatTime(duration)}`);
    } catch {}
  }
  function stopPositionTimer() {
    if (positionTimer) clearInterval(positionTimer);
    positionTimer = null;
  }
  function startPositionTimer() {
    stopPositionTimer();
    positionTimer = setInterval(() => {
      if (opened && playerReady) updatePosition();
    }, POSITION_REFRESH_MS);
  }
  function renderDetails() {
    detailsButton.textContent = detailsOpen ? t('videos.hideDetails') : t('videos.details');
    detailsButton.setAttribute('aria-expanded', String(detailsOpen));
    detailsPanel.hidden = !detailsOpen;
    if (!detailsOpen) {
      detailsPanel.replaceChildren();
      return;
    }
    const description = String(activeItem?.fullDescription || activeItem?.description || '').trim();
    if (!appendLinkedDescription(detailsPanel, description, nativeActions)) {
      detailsPanel.textContent = t('videos.detailsEmpty');
    }
  }
  function markUnavailable() {
    playerReady = false;
    playerIsPlaying = false;
    stopPositionTimer();
    setControlsEnabled(false);
    updateToggleLabel();
    status.textContent = t('videos.unavailable');
    fallback.hidden = !allowYouTubeFallback || !youtubeUrl(activeItem);
  }
  function markReady() {
    playerReady = true;
    setControlsEnabled(true);
    status.textContent = t('videos.ready');
    fallback.hidden = true;
    updateToggleLabel();
    updatePosition();
    startPositionTimer();
  }
  function handlePlayerStateChange(event) {
    const playingState = window.YT?.PlayerState?.PLAYING;
    playerIsPlaying = playingState !== undefined && event?.data === playingState;
    updateToggleLabel();
    updatePosition();
  }
  function handlePlayerReady(event) {
    if (disposed) return;
    youtubePlayer = event.target;
    markReady();
  }
  async function ensurePlayer(id) {
    try {
      const YT = await loadYouTubeApi();
      if (disposed || !activeItem) return;
      if (youtubePlayer && playerReady) {
        youtubePlayer.cueVideoById(id);
        playerIsPlaying = false;
        markReady();
        return;
      }
      youtubePlayer = new YT.Player(hostId, {
        videoId: id,
        playerVars: { playsinline: 1, rel: 0, autoplay: 0 },
        events: { onReady: handlePlayerReady, onStateChange: handlePlayerStateChange, onError: markUnavailable }
      });
    } catch {
      markUnavailable();
    }
  }
  async function open(nextItem = activeItem, nextFocusTarget = activeFocusTarget) {
    if (disposed) return false;
    activeItem = nextItem;
    activeFocusTarget = nextFocusTarget;
    const id = videoId(activeItem);
    opened = true;
    detailsOpen = false;
    section.hidden = false;
    title.textContent = activeItem?.title || t('videos.playerHeading');
    status.textContent = t('videos.preparing');
    fallback.hidden = true;
    playerIsPlaying = false;
    position.value = '0';
    position.max = '0';
    position.setAttribute('aria-valuetext', `${formatTime(0)} / ${formatTime(0)}`);
    renderDetails();
    setControlsEnabled(false);
    updateToggleLabel();
    heading.focus();
    if (!id) {
      markUnavailable();
      return false;
    }
    await ensurePlayer(id);
    return true;
  }
  function seekBy(seconds) {
    if (!youtubePlayer || !playerReady) return;
    try {
      const current = Number(youtubePlayer.getCurrentTime?.() || 0);
      const duration = Number(youtubePlayer.getDuration?.() || 0);
      let target = Math.max(0, current + seconds);
      if (Number.isFinite(duration) && duration > 0) target = Math.min(target, duration);
      youtubePlayer.seekTo(target, true);
      updatePosition();
    } catch {}
  }
  function seekToPosition() {
    if (!youtubePlayer || !playerReady) return;
    try {
      const target = Math.max(0, Number(position.value || 0));
      youtubePlayer.seekTo(target, true);
      updatePosition({ fromPlayer: false });
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
  function close() {
    if (!opened) return false;
    try { youtubePlayer?.pauseVideo?.(); } catch {}
    opened = false;
    detailsOpen = false;
    stopPositionTimer();
    section.hidden = true;
    playerIsPlaying = false;
    setControlsEnabled(false);
    renderDetails();
    updateToggleLabel();
    const target = activeFocusTarget;
    activeFocusTarget = null;
    if (typeof onClose === 'function') onClose();
    if (target?.isConnected !== false && typeof target?.focus === 'function') target.focus();
    return true;
  }
  function isOpen() { return opened; }
  function destroy() {
    disposed = true;
    opened = false;
    stopPositionTimer();
    try { youtubePlayer?.destroy?.(); } catch {}
    youtubePlayer = null;
    activeItem = null;
    activeFocusTarget = null;
    section.remove?.();
  }

  rewind.addEventListener('click', () => seekBy(-SEEK_SECONDS));
  toggle.addEventListener('click', togglePlayback);
  forward.addEventListener('click', () => seekBy(SEEK_SECONDS));
  position.addEventListener('input', seekToPosition);
  position.addEventListener('change', seekToPosition);
  detailsButton.addEventListener('click', () => {
    detailsOpen = !detailsOpen;
    renderDetails();
  });
  closeButton.addEventListener('click', close);
  fallback.addEventListener('click', () => { void openExternal(youtubeUrl(activeItem), nativeActions); });
  setControlsEnabled(false);

  return { open, close, isOpen, destroy };
}