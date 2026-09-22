(() => {
  'use strict';

  const APP_VERSION = '2.1';
  const PAGE_SIZE = 10;
  const SEEK_SECONDS = 60;
  const API_TIMEOUT_MS = 10000;
  const $ = selector => document.querySelector(selector);

  const els = {
    langEs: $('#lang-es'), langEn: $('#lang-en'), skip: $('.skip-link'),
    back: $('#back-home'), backBottom: $('#back-home-bottom'), heading: $('#videos-heading'),
    intro: $('#videos-intro'), channel: $('#youtube-channel'), controlsSection: $('#video-controls-section'),
    controlsHeading: $('#video-controls-heading'), sortLabel: $('#video-sort-label'), sort: $('#video-sort'),
    playerSection: $('#video-player-section'), playerHeading: $('#video-player-heading'), playerTitle: $('#video-player-title'),
    playerFrame: $('#video-player'), playerControls: $('#video-player-controls'), playerRewind: $('#video-player-rewind'),
    playerToggle: $('#video-player-toggle'), playerForward: $('#video-player-forward'), playerNote: $('#video-player-note'),
    playerClose: $('#video-player-close'), playerYouTube: $('#video-player-youtube'), resultsSection: $('#video-results-section'),
    resultsHeading: $('#video-results-heading'), status: $('#video-status'), list: $('#video-list'), pagination: $('#video-pagination'),
    prev: $('#video-prev'), page: $('#video-page'), next: $('#video-next'), footer: $('#footer-text')
  };

  const copy = {
    es: {
      skip: 'Saltar al contenido principal', back: 'Volver a la pantalla principal', heading: 'Vídeos de TifloAcosta',
      intro: 'Catálogo de los vídeos públicos del Canal TifloAcosta, actualizado automáticamente. Los títulos y las descripciones se muestran tal como fueron publicados en YouTube.',
      channel: 'Abrir Canal TifloAcosta en YouTube', controlsHeading: 'Ordenar vídeos', sortLabel: 'Orden',
      newest: 'Más recientes primero', oldest: 'Más antiguos primero', resultsHeading: 'Vídeos',
      loading: 'Cargando catálogo de vídeos…', empty: 'El catálogo de vídeos está vacío en este momento.',
      status: (start, end, total, page, pages) => `Mostrando ${start} a ${end} de ${total} vídeo${total === 1 ? '' : 's'}. Página ${page} de ${pages}.`,
      published: date => `Publicado el ${date}`, play: 'Abrir reproductor', playLabel: title => `Abrir reproductor para: ${title}`,
      playerHeading: 'Reproductor de vídeo', controlsLabel: 'Controles accesibles del vídeo', rewind: 'Retroceder 1 minuto',
      playControl: 'Reproducir', pauseControl: 'Pausar', forward: 'Avanzar 1 minuto',
      preparing: 'Preparando los controles accesibles del reproductor…',
      ready: 'Controles accesibles listos. Cada pulsación permite avanzar o retroceder 1 minuto.',
      unavailable: 'No se pudieron activar los controles accesibles adicionales. Puedes abrir el vídeo en YouTube.',
      close: 'Cerrar vídeo y volver a la lista de vídeos', openYouTube: 'Abrir este vídeo en YouTube',
      iframeTitle: title => `Reproductor de YouTube: ${title}`, previous: 'Anterior', next: 'Siguiente',
      page: (page, pages) => `Página ${page} de ${pages}`,
      error: 'No se pudo cargar el catálogo de vídeos. Comprueba la conexión e inténtalo de nuevo.',
      footer: `TifloAcosta App · Versión ${APP_VERSION}.`
    },
    en: {
      skip: 'Skip to main content', back: 'Back to main screen', heading: 'TifloAcosta videos',
      intro: 'Catalog of public videos from Canal TifloAcosta, updated automatically. Titles and descriptions are shown exactly as they were published on YouTube.',
      channel: 'Open Canal TifloAcosta on YouTube', controlsHeading: 'Sort videos', sortLabel: 'Order',
      newest: 'Newest first', oldest: 'Oldest first', resultsHeading: 'Videos',
      loading: 'Loading video catalog…', empty: 'The video catalog is currently empty.',
      status: (start, end, total, page, pages) => `Showing ${start} to ${end} of ${total} video${total === 1 ? '' : 's'}. Page ${page} of ${pages}.`,
      published: date => `Published ${date}`, play: 'Open player', playLabel: title => `Open player for: ${title}`,
      playerHeading: 'Video player', controlsLabel: 'Accessible video controls', rewind: 'Rewind 1 minute',
      playControl: 'Play', pauseControl: 'Pause', forward: 'Forward 1 minute',
      preparing: 'Preparing the accessible player controls…',
      ready: 'Accessible controls are ready. Each press moves forward or back 1 minute.',
      unavailable: 'The additional accessible controls could not be activated. You can open the video on YouTube.',
      close: 'Close video and return to the video list', openYouTube: 'Open this video on YouTube',
      iframeTitle: title => `YouTube player: ${title}`, previous: 'Previous', next: 'Next',
      page: (page, pages) => `Page ${page} of ${pages}`,
      error: 'The video catalog could not be loaded. Check your connection and try again.',
      footer: `TifloAcosta App · Version ${APP_VERSION}.`
    }
  };

  let catalog = [];
  let lang = readStorage('tifloLang') || (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es');
  let sortOrder = 'newest';
  let currentPage = 1;
  let loaded = false;
  let loadError = false;
  let activeVideo = null;
  let activeVideoId = '';
  let youtubePlayer = null;
  let playerReady = false;
  let playerIsPlaying = false;
  let youtubeApiPromise = null;

  function readStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch {} }

  function applyDisplayPreferences() {
    let prefs = {};
    try { prefs = JSON.parse(readStorage('tifloDisplayPrefs') || '{}'); } catch {}
    const root = document.documentElement;
    root.dataset.textSize = prefs.textSize || 'normal';
    root.dataset.theme = prefs.theme || 'auto';
    root.dataset.lineSpacing = prefs.lineSpacing || 'normal';
    root.dataset.bold = String(Boolean(prefs.bold));
  }

  function videoId(video) {
    const direct = String(video?.id || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(direct)) return direct;
    try {
      const url = new URL(String(video?.url || ''));
      if (url.hostname === 'youtu.be') {
        const id = url.pathname.replace(/^\//, '').split('/')[0];
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
      }
      const id = url.searchParams.get('v') || '';
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    } catch {}
    return '';
  }

  function youtubeUrl(video) {
    const url = String(video?.url || '').trim();
    const id = videoId(video);
    return url || (id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  }

  function sortedVideos() {
    return [...catalog].sort((a, b) => {
      const left = Date.parse(a?.publishedAt || '') || 0;
      const right = Date.parse(b?.publishedAt || '') || 0;
      return sortOrder === 'oldest' ? left - right : right - left;
    });
  }

  function setSortOptions() {
    const c = copy[lang];
    els.sort.replaceChildren();
    for (const [value, label] of [['newest', c.newest], ['oldest', c.oldest]]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.sort.append(option);
    }
    els.sort.value = sortOrder;
  }

  function setPlayerControls(enabled) {
    for (const button of [els.playerRewind, els.playerToggle, els.playerForward]) button.disabled = !enabled;
  }

  function updateToggle() {
    els.playerToggle.textContent = playerIsPlaying ? copy[lang].pauseControl : copy[lang].playControl;
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      let settled = false;
      const previous = window.onYouTubeIframeAPIReady;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };
      window.onYouTubeIframeAPIReady = () => {
        try { previous?.(); } catch {}
        if (window.YT?.Player) finish(resolve, window.YT);
        else finish(reject, new Error('YouTube API unavailable'));
      };
      let script = document.querySelector('script[data-youtube-iframe-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.youtubeIframeApi = 'true';
        document.head.append(script);
      }
      script.addEventListener('error', () => finish(reject, new Error('YouTube API failed')), { once: true });
      const timer = setTimeout(() => finish(reject, new Error('YouTube API timeout')), API_TIMEOUT_MS);
    }).catch(error => { youtubeApiPromise = null; throw error; });
    return youtubeApiPromise;
  }

  async function ensurePlayer(id) {
    const c = copy[lang];
    try {
      const YT = await loadYouTubeApi();
      if (!activeVideo || activeVideoId !== id) return;
      if (youtubePlayer && playerReady) {
        youtubePlayer.cueVideoById(id);
        playerIsPlaying = false;
        updateToggle();
        els.playerNote.textContent = c.ready;
        return;
      }
      youtubePlayer = new YT.Player(els.playerFrame, {
        videoId: id,
        playerVars: { playsinline: 1, rel: 0, autoplay: 0 },
        events: {
          onReady(event) {
            youtubePlayer = event.target;
            playerReady = true;
            playerIsPlaying = false;
            setPlayerControls(true);
            updateToggle();
            els.playerNote.textContent = copy[lang].ready;
          },
          onStateChange(event) {
            playerIsPlaying = event.data === window.YT?.PlayerState?.PLAYING;
            updateToggle();
          },
          onError() {
            playerReady = false;
            setPlayerControls(false);
            els.playerNote.textContent = copy[lang].unavailable;
          }
        }
      });
    } catch {
      playerReady = false;
      setPlayerControls(false);
      els.playerNote.textContent = c.unavailable;
    }
  }

  function openPlayer(video) {
    const id = videoId(video);
    if (!id) {
      const url = youtubeUrl(video);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    activeVideo = video;
    activeVideoId = id;
    playerIsPlaying = false;
    els.playerTitle.textContent = video.title || '';
    els.playerYouTube.href = youtubeUrl(video);
    els.playerSection.hidden = false;
    els.controlsSection.hidden = true;
    els.resultsSection.hidden = true;
    els.playerNote.textContent = copy[lang].preparing;
    setPlayerControls(false);
    updateToggle();
    els.playerTitle.focus();
    void ensurePlayer(id);
  }

  function closePlayer() {
    if (!activeVideo) return;
    const returnId = activeVideoId;
    try { youtubePlayer?.pauseVideo?.(); } catch {}
    activeVideo = null;
    activeVideoId = '';
    playerIsPlaying = false;
    els.playerSection.hidden = true;
    els.controlsSection.hidden = false;
    els.resultsSection.hidden = false;
    setPlayerControls(false);
    updateToggle();
    const trigger = returnId ? els.list.querySelector(`button[data-video-id="${returnId}"]`) : null;
    if (trigger) trigger.focus();
    else els.resultsHeading.focus();
  }

  function seekBy(seconds) {
    if (!youtubePlayer || !playerReady) return;
    try {
      const current = Number(youtubePlayer.getCurrentTime?.() || 0);
      const duration = Number(youtubePlayer.getDuration?.() || 0);
      let target = Math.max(0, current + seconds);
      if (duration > 0) target = Math.min(target, duration);
      youtubePlayer.seekTo(target, true);
    } catch {}
  }

  function togglePlayback() {
    if (!youtubePlayer || !playerReady) return;
    try {
      if (youtubePlayer.getPlayerState?.() === window.YT?.PlayerState?.PLAYING) youtubePlayer.pauseVideo();
      else youtubePlayer.playVideo();
    } catch {}
  }

  function createCard(video) {
    const c = copy[lang];
    const article = document.createElement('article');
    article.className = 'video-card';
    const title = document.createElement('h3');
    title.textContent = video.title || '';
    article.append(title);
    const date = formatDate(video.publishedAt);
    if (date) {
      const meta = document.createElement('p');
      meta.className = 'video-meta';
      meta.textContent = c.published(date);
      article.append(meta);
    }
    const description = String(video.excerpt || video.description || '').trim();
    if (description) {
      const p = document.createElement('p');
      p.className = 'video-description';
      p.textContent = description.length > 350 ? `${description.slice(0, 347).trim()}…` : description;
      article.append(p);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'video-play-button';
    button.textContent = c.play;
    button.setAttribute('aria-label', c.playLabel(video.title || ''));
    const id = videoId(video);
    if (id) button.dataset.videoId = id;
    button.addEventListener('click', () => openPlayer(video));
    article.append(button);
    return article;
  }

  function render() {
    const c = copy[lang];
    els.list.replaceChildren();
    if (loadError) {
      els.status.textContent = c.error;
      els.pagination.hidden = true;
      return;
    }
    if (!loaded) {
      els.status.textContent = c.loading;
      els.pagination.hidden = true;
      return;
    }
    if (!catalog.length) {
      els.status.textContent = c.empty;
      els.pagination.hidden = true;
      return;
    }
    const videos = sortedVideos();
    const pages = Math.max(1, Math.ceil(videos.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), pages);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const items = videos.slice(startIndex, startIndex + PAGE_SIZE);
    items.forEach(video => els.list.append(createCard(video)));
    els.status.textContent = c.status(startIndex + 1, startIndex + items.length, videos.length, currentPage, pages);
    els.pagination.hidden = pages <= 1;
    els.prev.hidden = currentPage <= 1;
    els.next.hidden = currentPage >= pages;
    els.page.textContent = c.page(currentPage, pages);
  }

  function applyLanguage() {
    const c = copy[lang];
    document.documentElement.lang = lang;
    writeStorage('tifloLang', lang);
    els.langEs.setAttribute('aria-pressed', String(lang === 'es'));
    els.langEn.setAttribute('aria-pressed', String(lang === 'en'));
    els.skip.textContent = c.skip;
    els.back.textContent = c.back;
    els.backBottom.textContent = c.back;
    els.heading.textContent = c.heading;
    els.intro.textContent = c.intro;
    els.channel.textContent = c.channel;
    els.controlsHeading.textContent = c.controlsHeading;
    els.sortLabel.textContent = c.sortLabel;
    els.playerHeading.textContent = c.playerHeading;
    els.playerControls.setAttribute('aria-label', c.controlsLabel);
    els.playerRewind.textContent = c.rewind;
    els.playerForward.textContent = c.forward;
    els.playerClose.textContent = c.close;
    els.playerYouTube.textContent = c.openYouTube;
    els.resultsHeading.textContent = c.resultsHeading;
    els.prev.textContent = c.previous;
    els.next.textContent = c.next;
    els.footer.textContent = c.footer;
    setSortOptions();
    updateToggle();
    render();
  }

  async function loadCatalog() {
    loaded = false;
    loadError = false;
    render();
    try {
      const response = await fetch('./videos.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      catalog = Array.isArray(data?.videos) ? data.videos : [];
      loaded = true;
    } catch {
      loadError = true;
    }
    render();
  }

  els.langEs.addEventListener('click', () => { lang = 'es'; applyLanguage(); });
  els.langEn.addEventListener('click', () => { lang = 'en'; applyLanguage(); });
  els.sort.addEventListener('change', () => { sortOrder = els.sort.value; currentPage = 1; render(); });
  els.playerRewind.addEventListener('click', () => seekBy(-SEEK_SECONDS));
  els.playerToggle.addEventListener('click', togglePlayback);
  els.playerForward.addEventListener('click', () => seekBy(SEEK_SECONDS));
  els.playerClose.addEventListener('click', closePlayer);
  els.prev.addEventListener('click', () => { currentPage -= 1; render(); });
  els.next.addEventListener('click', () => { currentPage += 1; render(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}));
  }

  applyDisplayPreferences();
  applyLanguage();
  void loadCatalog();
})();
