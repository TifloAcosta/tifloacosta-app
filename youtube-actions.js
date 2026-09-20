(() => {
  'use strict';

  const core = window.TifloYouTubeActionsCore;
  const config = window.TifloYouTubeActionsConfig;
  if (!core || !config) return;

  const PENDING_VIDEO_KEY = 'tifloYouTubePendingVideoId';
  const $ = selector => document.querySelector(selector);

  let lang = 'es';
  let video = null;
  let state = core.initialState();
  let detailsOpen = false;

  const els = {};

  function copy() {
    return core.copyFor(lang);
  }

  function endpoint(path) {
    return `${config.endpoint}${path}`;
  }

  async function request(path, options = {}) {
    const response = await fetch(endpoint(path), {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(data.error || 'YOUTUBE_ERROR');
      error.code = data.error || 'YOUTUBE_ERROR';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setStatus(message = '') {
    if (els.status) els.status.textContent = message;
  }

  function renderDetails() {
    if (!els.detailsPanel || !video) return;
    const c = copy();
    els.details.textContent = detailsOpen ? c.hideDetails : c.details;
    els.details.setAttribute('aria-expanded', String(detailsOpen));
    els.detailsPanel.hidden = !detailsOpen;
    els.detailsPanel.replaceChildren();
    if (!detailsOpen) return;

    const details = core.detailsFromVideo(video);
    const title = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = details.title;
    title.append(strong);
    els.detailsPanel.append(title);

    if (details.publishedAt) {
      const published = document.createElement('p');
      let formatted = details.publishedAt;
      const date = new Date(details.publishedAt);
      if (!Number.isNaN(date.getTime())) {
        formatted = new Intl.DateTimeFormat(lang === 'en' ? 'en' : 'es-ES', {
          year: 'numeric', month: 'long', day: 'numeric'
        }).format(date);
      }
      published.textContent = `${c.published}: ${formatted}.`;
      els.detailsPanel.append(published);
    }

    if (details.description) {
      const description = document.createElement('p');
      description.textContent = `${c.description}: ${details.description}`;
      els.detailsPanel.append(description);
    }
  }

  function button(id, label, handler) {
    const control = document.createElement('button');
    control.type = 'button';
    control.id = id;
    control.textContent = label;
    control.addEventListener('click', handler);
    return control;
  }

  function beginSignIn() {
    if (video && core.isValidVideoId(video.id)) {
      try { sessionStorage.setItem(PENDING_VIDEO_KEY, video.id); } catch {}
    }
    window.location.assign(endpoint('/auth/start'));
  }

  function renderAccount() {
    if (!els.account) return;
    const c = copy();
    els.account.replaceChildren();

    if (!state.authenticated) {
      const info = document.createElement('p');
      info.textContent = c.connectInfo;
      els.account.append(info, button('youtube-sign-in', c.signIn, beginSignIn));
      return;
    }

    if (state.subscribed === false) {
      els.account.append(button('youtube-subscribe', c.subscribe, () => {}));
    } else if (state.subscribed === true) {
      const subscribed = document.createElement('p');
      subscribed.id = 'youtube-subscription-state';
      subscribed.textContent = c.subscribed;
      els.account.append(subscribed);
    }

    if (state.rating !== 'like') {
      els.account.append(button('youtube-like', c.like, () => {}));
    } else {
      const liked = document.createElement('p');
      liked.id = 'youtube-like-state';
      liked.textContent = c.liked;
      els.account.append(liked);
    }

    els.account.append(button('youtube-comment', c.comment, () => {}));
    els.account.append(button('youtube-logout', c.logout, () => {}));
  }

  function render() {
    if (!els.root) return;
    const c = copy();
    els.heading.textContent = c.heading;
    renderDetails();
    renderAccount();
  }

  async function loadSessionAndState() {
    if (!video || !core.isValidVideoId(video.id)) return;
    try {
      const session = await request('/session');
      state = core.reduce(state, { type: 'SESSION', authenticated: Boolean(session.authenticated), csrf: session.csrf || '' });
      renderAccount();
      if (!session.authenticated) return;

      const account = await request(`/state?videoId=${encodeURIComponent(video.id)}`);
      state = core.reduce(state, {
        type: 'VIDEO_STATE',
        subscribed: Boolean(account.subscribed),
        rating: account.rating || 'none'
      });
      renderAccount();
    } catch (error) {
      if (error.code === 'SESSION_EXPIRED') {
        state = core.reduce(state, { type: 'SESSION_EXPIRED' });
        renderAccount();
      } else {
        setStatus(copy().genericError);
      }
    }
  }

  function init() {
    els.root = $('#youtube-actions');
    els.heading = $('#youtube-actions-heading');
    els.details = $('#youtube-details');
    els.detailsPanel = $('#youtube-details-panel');
    els.account = $('#youtube-account-actions');
    els.status = $('#youtube-actions-status');
    if (!els.root || !els.details) return;

    els.details.addEventListener('click', () => {
      detailsOpen = !detailsOpen;
      renderDetails();
      if (detailsOpen) els.detailsPanel.setAttribute('tabindex', '-1');
    });
    render();
  }

  function showVideo(nextVideo, nextLang = lang) {
    video = core.detailsFromVideo(nextVideo || {});
    lang = nextLang === 'en' ? 'en' : 'es';
    state = core.initialState();
    detailsOpen = false;
    if (els.root) els.root.hidden = false;
    setStatus('');
    render();
    loadSessionAndState();
  }

  function hide() {
    video = null;
    state = core.initialState();
    detailsOpen = false;
    setStatus('');
    if (els.root) els.root.hidden = true;
    if (els.detailsPanel) els.detailsPanel.hidden = true;
    if (els.account) els.account.replaceChildren();
  }

  function setLanguage(nextLang) {
    lang = nextLang === 'en' ? 'en' : 'es';
    render();
  }

  function takePendingVideoId() {
    let value = '';
    try {
      value = sessionStorage.getItem(PENDING_VIDEO_KEY) || '';
      sessionStorage.removeItem(PENDING_VIDEO_KEY);
    } catch {}
    return core.isValidVideoId(value) ? value : '';
  }

  window.TifloYouTubeActions = Object.freeze({
    init,
    showVideo,
    hide,
    setLanguage,
    takePendingVideoId
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
