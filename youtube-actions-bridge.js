(() => {
  'use strict';

  const actions = window.TifloYouTubeActions;
  if (!actions) return;

  let catalogPromise = null;

  function currentLanguage() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  async function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('./videos.json', { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error('VIDEO_CATALOG_UNAVAILABLE');
          return response.json();
        })
        .then(data => Array.isArray(data.videos) ? data.videos : [])
        .catch(() => []);
    }
    return catalogPromise;
  }

  function videoId(video) {
    const id = String(video?.id || '').trim();
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  }

  async function showById(id) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(String(id || ''))) return;
    const videos = await catalog();
    const video = videos.find(item => videoId(item) === id);
    if (video) actions.showVideo(video, currentLanguage());
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const play = target.closest('.video-play-button[data-video-id]');
    if (play) {
      void showById(play.dataset.videoId || '');
      return;
    }

    if (target.closest('#video-player-close')) {
      try { actions.hide(); } catch {}
      return;
    }

    if (target.closest('#lang-es')) {
      try { actions.setLanguage('es'); } catch {}
      return;
    }

    if (target.closest('#lang-en')) {
      try { actions.setLanguage('en'); } catch {}
    }
  }, true);

  async function restorePendingVideo() {
    let pendingId = '';
    try { pendingId = actions.takePendingVideoId() || ''; } catch {}
    if (!pendingId) return;

    const videos = await catalog();
    if (!videos.some(item => videoId(item) === pendingId)) return;

    const findAndOpen = () => {
      const button = document.querySelector(`.video-play-button[data-video-id="${pendingId}"]`);
      if (!button) return false;
      button.click();
      return true;
    };

    if (findAndOpen()) return;

    const list = document.querySelector('#video-list');
    if (!list) return;
    const observer = new MutationObserver(() => {
      if (findAndOpen()) observer.disconnect();
    });
    observer.observe(list, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restorePendingVideo, { once: true });
  } else {
    void restorePendingVideo();
  }
})();
