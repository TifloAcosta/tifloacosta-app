(() => {
  'use strict';

  const APP_VERSION = '2.1';
  const PAGE_SIZE = 10;
  const SEEK_SECONDS = 60;
  const YOUTUBE_API_TIMEOUT_MS = 10000;
  const core = window.TifloVideoCore;
  if (!core) return;

  const $ = selector => document.querySelector(selector);
  const els = {
    langEs: $('#lang-es'),
    langEn: $('#lang-en'),
    skip: $('.skip-link'),
    back: $('#back-home'),
    backBottom: $('#back-home-bottom'),
    heading: $('#videos-heading'),
    intro: $('#videos-intro'),
    channel: $('#youtube-channel'),
    controlsSection: $('#video-controls-section'),
    controlsHeading: $('#video-controls-heading'),
    form: $('#video-search-form'),
    search: $('#video-search'),
    searchLabel: $('#video-search-label'),
    searchButton: $('#video-search-button'),
    clearButton: $('#video-clear'),
    sortLabel: $('#video-sort-label'),
    sort: $('#video-sort'),
    playerSection: $('#video-player-section'),
    playerHeading: $('#video-player-heading'),
    playerTitle: $('#video-player-title'),
    playerFrame: $('#video-player'),
    playerControls: $('#video-player-controls'),
    playerRewind: $('#video-player-rewind'),
    playerToggle: $('#video-player-toggle'),
    playerForward: $('#video-player-forward'),
    playerNote: $('#video-player-note'),
    playerClose: $('#video-player-close'),
    playerYouTube: $('#video-player-youtube'),
    resultsSection: $('#video-results-section'),
    resultsHeading: $('#video-results-heading'),
    status: $('#video-status'),
    list: $('#video-list'),
    pagination: $('#video-pagination'),
    prev: $('#video-prev'),
    page: $('#video-page'),
    next: $('#video-next'),
    footer: $('#footer-text')
  };

  const copy = {
    es: {
      skip: 'Saltar al contenido principal',
      back: 'Volver a la pantalla principal',
      heading: 'Vídeos de TifloAcosta',
      intro: 'Catálogo de los vídeos públicos del Canal TifloAcosta, actualizado automáticamente. Los títulos y las descripciones se muestran tal como fueron publicados en YouTube.',
      channel: 'Abrir Canal TifloAcosta en YouTube',
      controlsHeading: 'Buscar y ordenar',
      searchLabel: 'Título o palabras de la descripción',
      placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…',
      searchButton: 'Buscar',
      clearButton: 'Limpiar búsqueda',
      sortLabel: 'Orden',
      newest: 'Más recientes primero',
      oldest: 'Más antiguos primero',
      resultsHeading: 'Resultados',
      loading: 'Cargando catálogo de vídeos…',
      empty: 'El catálogo de vídeos está vacío en este momento.',
      status: (start, end, n, page, pages) => `Mostrando ${start} a ${end} de ${n} vídeo${n === 1 ? '' : 's'}. Página ${page} de ${pages}.`,
      noResults: 'No hay vídeos que coincidan con la búsqueda.',
      published: date => `Publicado el ${date}`,
      play: 'Abrir reproductor',
      playLabel: title => `Abrir reproductor para: ${title}`,
      playerHeading: 'Reproductor de vídeo',
      playerControlsLabel: 'Controles accesibles del vídeo',
      rewindOneMinute: 'Retroceder 1 minuto',
      playControl: 'Reproducir',
      pauseControl: 'Pausar',
      forwardOneMinute: 'Avanzar 1 minuto',
      playerPreparing: 'Preparando los controles accesibles del reproductor…',
      playerReady: 'Controles accesibles listos. Cada pulsación permite avanzar o retroceder 1 minuto.',
      playerUnavailable: 'No se pudieron activar los controles accesibles adicionales. Puedes utilizar el reproductor de YouTube o abrir el vídeo en YouTube.',
      closePlayer: 'Cerrar reproductor y volver a los vídeos',
      openYouTube: 'Abrir este vídeo en YouTube',
      iframeTitle: title => `Reproductor de YouTube: ${title}`,
      previous: 'Anterior',
      next: 'Siguiente',
      page: (page, pages) => `Página ${page} de ${pages}`,
      error: 'No se pudo cargar el catálogo de vídeos. Comprueba la conexión e inténtalo de nuevo.',
      footer: `TifloAcosta App · Versión ${APP_VERSION}.`
    },
    en: {
      skip: 'Skip to main content',
      back: 'Back to main screen',
      heading: 'TifloAcosta videos',
      intro: 'Catalog of public videos from Canal TifloAcosta, updated automatically. Titles and descriptions are shown exactly as they were published on YouTube.',
      channel: 'Open Canal TifloAcosta on YouTube',
      controlsHeading: 'Search and sort',
      searchLabel: 'Title or words from the description',
      placeholder: 'For example: VoiceOver, Android, WhatsApp…',
      searchButton: 'Search',
      clearButton: 'Clear search',
      sortLabel: 'Order',
      newest: 'Newest first',
      oldest: 'Oldest first',
      resultsHeading: 'Results',
      loading: 'Loading video catalog…',
      empty: 'The video catalog is currently empty.',
      status: (start, end, n, page, pages) => `Showing ${start} to ${end} of ${n} video${n === 1 ? '' : 's'}. Page ${page} of ${pages}.`,
      noResults: 'No videos match your search.',
      published: date => `Published ${date}`,
      play: 'Open player',
      playLabel: title => `Open player for: ${title}`,
      playerHeading: 'Video player',
      playerControlsLabel: 'Accessible video controls',
      rewindOneMinute: 'Rewind 1 minute',
      playControl: 'Play',
      pauseControl: 'Pause',
      forwardOneMinute: 'Forward 1 minute',
      playerPreparing: 'Preparing the accessible player controls…',
      playerReady: 'Accessible controls are ready. Each press moves forward or back 1 minute.',
      playerUnavailable: 'The additional accessible controls could not be activated. You can use the YouTube player or open the video on YouTube.',
      closePlayer: 'Close player and return to videos',
      openYouTube: 'Open this video on YouTube',
      iframeTitle: title => `YouTube player: ${title}`,
      previous: 'Previous',
      next: 'Next',
      page: (page, pages) => `Page ${page} of ${pages}`,
      error: 'The video catalog could not be loaded. Check your connection and try again.',
      footer: `TifloAcosta App · Version ${APP_VERSION}.`
    }
  };

  let catalog = [];
  let lang = readStorage('tifloLang') || (navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es');
  let query = '';
  let sortOrder = 'newest';
  let currentPage = 1;
  let loadError = false;
  let catalogLoaded = false;
  let activeVideo = null;
  let lastPlayerVideoId = '';
  let requestedVideoId = '';
  let youtubeApiPromise = null;
  let youtubePlayer = null;
  let playerReady = false;
  let playerIsPlaying = false;
  let playerControlStatus = 'preparing';

  function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function applyDisplayPreferences() {
    let prefs = {};
    try { prefs = JSON.parse(readStorage('tifloDisplayPrefs') || '{}'); } catch {}
    const root = document.documentElement;
    root.dataset.textSize = prefs.textSize || 'normal';
    root.dataset.theme = prefs.theme || 'auto';
    root.dataset.lineSpacing = prefs.lineSpacing || 'normal';
    root.dataset.bold = String(Boolean(prefs.bold));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }

  function setSortOptions() {
    const c = copy[lang];
    els.sort.innerHTML = '';
    [['newest', c.newest], ['oldest', c.oldest]].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.sort.append(option);
    });
    els.sort.value = sortOrder;
  }

  function currentPlayerFrame() {
    if (youtubePlayer && typeof youtubePlayer.getIframe === 'function') {
      try { return youtubePlayer.getIframe(); } catch {}
    }
    return els.playerFrame;
  }

  function setPlayerControlsEnabled(enabled) {
    [els.playerRewind, els.playerToggle, els.playerForward].forEach(button => {
      button.disabled = !enabled;
    });
  }

  function updateToggleLabel() {
    const label = playerIsPlaying ? copy[lang].pauseControl : copy[lang].playControl;
    els.playerToggle.textContent = label;
    els.playerToggle.setAttribute('aria-label', label);
  }

  function updatePlayerControlStatus(status = playerControlStatus) {
    playerControlStatus = status;
    const c = copy[lang];
    const messages = {
      preparing: c.playerPreparing,
      ready: c.playerReady,
      unavailable: c.playerUnavailable
    };
    els.playerNote.textContent = messages[status] || c.playerPreparing;
  }

  function applyLanguage() {
    const c = copy[lang];
    document.documentElement.lang = lang;
    document.title = lang === 'es' ? 'Vídeos de TifloAcosta' : 'TifloAcosta videos';
    writeStorage('tifloLang', lang);
    els.langEs.setAttribute('aria-pressed', String(lang === 'es'));
    els.langEn.setAttribute('aria-pressed', String(lang === 'en'));
    els.skip.textContent = c.skip;
    els.back.textContent = c.back;
    els.backBottom.textContent = c.back;
    els.back.setAttribute('aria-label', lang === 'es' ? 'Volver a la pantalla principal de TifloAcosta App' : 'Back to the TifloAcosta App main screen');
    els.backBottom.setAttribute('aria-label', lang === 'es' ? 'Volver a la pantalla principal de TifloAcosta App' : 'Back to the TifloAcosta App main screen');
    els.heading.textContent = c.heading;
    els.intro.textContent = c.intro;
    els.channel.textContent = c.channel;
    els.controlsHeading.textContent = c.controlsHeading;
    els.searchLabel.textContent = c.searchLabel;
    els.search.placeholder = c.placeholder;
    els.searchButton.textContent = c.searchButton;
    els.clearButton.textContent = c.clearButton;
    els.sortLabel.textContent = c.sortLabel;
    els.playerHeading.textContent = c.playerHeading;
    els.playerControls.setAttribute('aria-label', c.playerControlsLabel);
    els.playerRewind.textContent = c.rewindOneMinute;
    els.playerRewind.setAttribute('aria-label', c.rewindOneMinute);
    els.playerForward.textContent = c.forwardOneMinute;
    els.playerForward.setAttribute('aria-label', c.forwardOneMinute);
    updateToggleLabel();
    updatePlayerControlStatus();
    els.playerClose.textContent = c.closePlayer;
    els.playerYouTube.textContent = c.openYouTube;
    if (activeVideo) {
      currentPlayerFrame().title = c.iframeTitle(activeVideo.title || '');
    }
    els.resultsHeading.textContent = c.resultsHeading;
    els.prev.textContent = c.previous;
    els.next.textContent = c.next;
    els.footer.textContent = c.footer;
    setSortOptions();
    render();
  }

  function getVisibleVideos() {
    return core.sortVideos(core.filterVideos(catalog, query), sortOrder);
  }

  function shortDescription(video) {
    const text = String(video.excerpt || video.description || '').trim();
    if (text.length <= 350) return text;
    const slice = text.slice(0, 350);
    const cut = slice.lastIndexOf(' ');
    return `${(cut > 0 ? slice.slice(0, cut) : slice).trim()}…`;
  }

  function videoId(video) {
    const id = String(video && video.id || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    try {
      const url = new URL(String(video && video.url || ''));
      if (url.hostname === 'youtu.be') {
        const shortId = url.pathname.replace(/^\//, '').split('/')[0];
        if (/^[A-Za-z0-9_-]{11}$/.test(shortId)) return shortId;
      }
      const queryId = url.searchParams.get('v') || '';
      if (/^[A-Za-z0-9_-]{11}$/.test(queryId)) return queryId;
    } catch {}
    return '';
  }

  function youtubeUrl(video) {
    return video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(videoId(video))}`;
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

      let script = document.querySelector('script[data-youtube-iframe-api]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.youtubeIframeApi = 'true';
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

  function handlePlayerStateChange(event) {
    const YT = window.YT;
    playerIsPlaying = Boolean(YT && YT.PlayerState && event.data === YT.PlayerState.PLAYING);
    updateToggleLabel();
  }

  function handlePlayerReady(event) {
    youtubePlayer = event.target;
    playerReady = true;
    playerIsPlaying = false;

    if (activeVideo && requestedVideoId) {
      try {
        const loadedId = youtubePlayer.getVideoData?.().video_id || '';
        if (loadedId && loadedId !== requestedVideoId) youtubePlayer.cueVideoById(requestedVideoId);
      } catch {}
      setPlayerControlsEnabled(true);
      updatePlayerControlStatus('ready');
      currentPlayerFrame().title = copy[lang].iframeTitle(activeVideo.title || '');
    } else {
      setPlayerControlsEnabled(false);
    }
    updateToggleLabel();
  }

  async function ensureYouTubePlayer(videoIdToLoad) {
    requestedVideoId = videoIdToLoad;
    if (youtubePlayer && playerReady) {
      try { youtubePlayer.cueVideoById(videoIdToLoad); } catch {}
      playerIsPlaying = false;
      setPlayerControlsEnabled(true);
      updateToggleLabel();
      updatePlayerControlStatus('ready');
      return;
    }

    const requestId = videoIdToLoad;
    try {
      const YT = await loadYouTubeApi();
      if (!activeVideo || requestedVideoId !== requestId) return;
      if (!youtubePlayer) {
        youtubePlayer = new YT.Player(els.playerFrame, {
          events: {
            onReady: handlePlayerReady,
            onStateChange: handlePlayerStateChange
          }
        });
      }
    } catch {
      if (!activeVideo || requestedVideoId !== requestId) return;
      playerReady = false;
      setPlayerControlsEnabled(false);
      updatePlayerControlStatus('unavailable');
    }
  }

  function seekBy(seconds) {
    if (!youtubePlayer || !playerReady) return;
    try {
      const current = Number(youtubePlayer.getCurrentTime()) || 0;
      const duration = Number(youtubePlayer.getDuration()) || 0;
      let target = Math.max(0, current + seconds);
      if (duration > 0) target = Math.min(target, duration);
      youtubePlayer.seekTo(target, true);
    } catch {}
  }

  function togglePlayback() {
    if (!youtubePlayer || !playerReady) return;
    const YT = window.YT;
    if (!YT || !YT.PlayerState) return;
    try {
      const state = youtubePlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
      else youtubePlayer.playVideo();
    } catch {}
  }

  function openPlayer(video) {
    const id = videoId(video);
    if (!id) {
      window.open(youtubeUrl(video), '_blank', 'noopener,noreferrer');
      return;
    }

    activeVideo = video;
    lastPlayerVideoId = id;
    requestedVideoId = id;
    playerIsPlaying = false;
    els.playerTitle.textContent = video.title || '';
    currentPlayerFrame().title = copy[lang].iframeTitle(video.title || '');
    els.playerYouTube.href = youtubeUrl(video);
    els.controlsSection.hidden = true;
    els.resultsSection.hidden = true;
    els.playerSection.hidden = false;
    updateToggleLabel();

    if (youtubePlayer && playerReady) {
      try { youtubePlayer.cueVideoById(id); } catch {}
      setPlayerControlsEnabled(true);
      updatePlayerControlStatus('ready');
    } else {
      const origin = location.origin && location.origin !== 'null'
        ? `&origin=${encodeURIComponent(location.origin)}`
        : '';
      els.playerFrame.src = `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1&rel=0&enablejsapi=1${origin}`;
      setPlayerControlsEnabled(false);
      updatePlayerControlStatus('preparing');
      void ensureYouTubePlayer(id);
    }

    els.playerTitle.focus();
  }

  function closePlayer() {
    const returnId = lastPlayerVideoId;
    if (youtubePlayer) {
      if (playerReady) {
        try { youtubePlayer.pauseVideo(); } catch {}
      }
    } else {
      els.playerFrame.removeAttribute('src');
    }
    els.playerSection.hidden = true;
    els.controlsSection.hidden = false;
    els.resultsSection.hidden = false;
    activeVideo = null;
    lastPlayerVideoId = '';
    requestedVideoId = '';
    playerIsPlaying = false;
    setPlayerControlsEnabled(false);
    updateToggleLabel();
    updatePlayerControlStatus('preparing');
    const trigger = returnId ? els.list.querySelector(`button[data-video-id="${returnId}"]`) : null;
    if (trigger) trigger.focus();
    else els.resultsHeading.focus?.();
  }

  function createVideoCard(video) {
    const c = copy[lang];
    const article = document.createElement('div');
    article.className = 'video-card';

    if (video.thumbnail) {
      const img = document.createElement('img');
      img.className = 'video-thumbnail';
      img.src = video.thumbnail;
      img.alt = '';
      img.loading = 'lazy';
      img.width = 320;
      img.height = 180;
      article.append(img);
    }

    const title = document.createElement('h3');
    title.textContent = video.title || '';
    article.append(title);

    const formattedDate = formatDate(video.publishedAt);
    if (formattedDate) {
      const meta = document.createElement('p');
      meta.className = 'video-meta';
      const time = document.createElement('time');
      time.dateTime = video.publishedAt || '';
      time.textContent = c.published(formattedDate);
      meta.append(time);
      article.append(meta);
    }

    const description = shortDescription(video);
    if (description) {
      const p = document.createElement('p');
      p.className = 'video-description';
      p.textContent = description;
      article.append(p);
    }

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'video-play-button';
    playButton.textContent = c.play;
    playButton.setAttribute('aria-label', c.playLabel(video.title || ''));
    const id = videoId(video);
    if (id) playButton.dataset.videoId = id;
    playButton.addEventListener('click', () => openPlayer(video));
    article.append(playButton);

    return article;
  }

  function render() {
    const c = copy[lang];
    els.list.innerHTML = '';

    if (loadError) {
      els.status.textContent = c.error;
      els.pagination.hidden = true;
      return;
    }

    if (!catalogLoaded) {
      els.status.textContent = c.loading;
      els.pagination.hidden = true;
      return;
    }

    if (!catalog.length) {
      els.status.textContent = c.empty;
      els.pagination.hidden = true;
      return;
    }

    const filtered = getVisibleVideos();
    const pageData = core.paginate(filtered, currentPage, PAGE_SIZE);
    currentPage = pageData.page;
    els.status.textContent = pageData.totalItems
      ? c.status(pageData.start, pageData.end, pageData.totalItems, pageData.page, pageData.totalPages)
      : c.noResults;

    pageData.items.forEach(video => els.list.append(createVideoCard(video)));
    els.pagination.hidden = pageData.totalItems === 0;
    els.prev.hidden = pageData.page <= 1;
    els.next.hidden = pageData.page >= pageData.totalPages;
    els.page.textContent = c.page(pageData.page, pageData.totalPages);
  }

  async function loadCatalog() {
    loadError = false;
    catalogLoaded = false;
    els.status.textContent = copy[lang].loading;
    try {
      const response = await fetch('./videos.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
      const data = await response.json();
      catalog = Array.isArray(data.videos) ? data.videos : [];
      catalogLoaded = true;
      render();
    } catch (error) {
      loadError = true;
      render();
    }
  }

  els.langEs.addEventListener('click', () => { lang = 'es'; applyLanguage(); });
  els.langEn.addEventListener('click', () => { lang = 'en'; applyLanguage(); });
  els.form.addEventListener('submit', event => {
    event.preventDefault();
    query = els.search.value.trim();
    currentPage = 1;
    render();
  });
  els.clearButton.addEventListener('click', () => {
    els.search.value = '';
    query = '';
    currentPage = 1;
    render();
    els.search.focus();
  });
  els.sort.addEventListener('change', () => {
    sortOrder = els.sort.value;
    currentPage = 1;
    render();
  });
  els.playerRewind.addEventListener('click', () => seekBy(-SEEK_SECONDS));
  els.playerToggle.addEventListener('click', togglePlayback);
  els.playerForward.addEventListener('click', () => seekBy(SEEK_SECONDS));
  els.playerClose.addEventListener('click', closePlayer);
  els.prev.addEventListener('click', () => {
    currentPage -= 1;
    render();
  });
  els.next.addEventListener('click', () => {
    currentPage += 1;
    render();
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}));
  }

  applyDisplayPreferences();
  applyLanguage();
  loadCatalog();
})();