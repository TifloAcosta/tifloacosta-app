(() => {
  'use strict';

  const FEED_URL = 'https://anchor.fm/s/5b48ca28/podcast/rss';
  const SEEK_SECONDS = 30;
  const MAX_EPISODES = 30;
  const $ = selector => document.querySelector(selector);

  const els = {
    langEs: $('#lang-es'),
    langEn: $('#lang-en'),
    skip: $('.skip-link'),
    back: $('#back-home'),
    backBottom: $('#back-home-bottom'),
    heading: $('#podcast-heading'),
    intro: $('#podcast-intro'),
    status: $('#podcast-status'),
    player: $('#podcast-player'),
    playerHeading: $('#podcast-player-heading'),
    currentTitle: $('#podcast-current-title'),
    audio: $('#podcast-audio'),
    controls: $('#podcast-controls'),
    rewind: $('#podcast-rewind'),
    toggle: $('#podcast-toggle'),
    forward: $('#podcast-forward'),
    positionLabel: $('#podcast-position-label'),
    position: $('#podcast-position'),
    time: $('#podcast-time'),
    episodesHeading: $('#podcast-episodes-heading'),
    episodes: $('#podcast-episodes'),
    pagination: $('#podcast-pagination'),
    pageStatus: $('#podcast-page-status'),
    previousPage: $('#podcast-prev'),
    nextPage: $('#podcast-next'),
    servicesHeading: $('#podcast-services-heading'),
    footer: $('#footer-text')
  };

  const copy = {
    es: {
      skip: 'Saltar al contenido principal',
      back: 'Volver a la pantalla principal',
      title: 'Podcast de TifloAcosta',
      intro: 'Escucha los episodios del Canal TifloAcosta con controles accesibles de reproducción.',
      loading: 'Cargando episodios…',
      error: 'No se pudieron cargar los episodios. Puedes seguir usando los servicios externos que aparecen a continuación.',
      player: 'Reproductor de Podcast',
      controls: 'Controles accesibles del Podcast',
      rewind: 'Retroceder 30 segundos',
      play: 'Reproducir',
      pause: 'Pausar',
      forward: 'Avanzar 30 segundos',
      position: 'Posición del episodio',
      episodes: 'Episodios',
      services: 'Escuchar en otros servicios',
      listen: title => `Escuchar: ${title}`,
      time: (current, duration) => `${current} de ${duration}`,
      ready: title => `Episodio preparado: ${title}`,
      ended: 'El episodio ha terminado.',
      footer: 'TifloAcosta App · Versión 2.1.'
    },
    en: {
      skip: 'Skip to main content',
      back: 'Back to main screen',
      title: 'TifloAcosta podcast',
      intro: 'Listen to Canal TifloAcosta episodes with accessible playback controls.',
      loading: 'Loading episodes…',
      error: 'Episodes could not be loaded. You can still use the external podcast services below.',
      player: 'Podcast player',
      controls: 'Accessible podcast controls',
      rewind: 'Back 30 seconds',
      play: 'Play',
      pause: 'Pause',
      forward: 'Forward 30 seconds',
      position: 'Episode position',
      episodes: 'Episodes',
      services: 'Listen on other services',
      listen: title => `Play: ${title}`,
      time: (current, duration) => `${current} of ${duration}`,
      ready: title => `Episode ready: ${title}`,
      ended: 'The episode has ended.',
      footer: 'TifloAcosta App · Version 2.1.'
    }
  };

  let lang = readStorage('tifloLang') || (navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es');
  const EPISODES_PER_PAGE = 10;
  let currentPage = 1;
  let episodes = [];
  let activeEpisode = null;
  let activeButton = null;

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

  function secondsLabel(value) {
    const total = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function stripHtml(value) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(value || ''), 'text/html');
    return String(doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function parseEpisodes(xmlText) {
    const xml = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
    if (xml.querySelector('parsererror')) return [];
    return [...xml.querySelectorAll('channel > item')].map((item, index) => {
      const enclosure = item.querySelector('enclosure');
      return {
        id: item.querySelector('guid')?.textContent?.trim() || `episode-${index + 1}`,
        title: item.querySelector('title')?.textContent?.trim() || (lang === 'en' ? 'Episode' : 'Episodio'),
        description: stripHtml(item.querySelector('description')?.textContent || ''),
        published: item.querySelector('pubDate')?.textContent?.trim() || '',
        audioUrl: enclosure?.getAttribute('url') || ''
      };
    }).filter(item => item.audioUrl).slice(0, MAX_EPISODES);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }

  function updateToggle() {
    els.toggle.textContent = els.audio.paused ? copy[lang].play : copy[lang].pause;
  }

  function updateTime({ announce = false } = {}) {
    const duration = Number.isFinite(els.audio.duration) ? els.audio.duration : 0;
    const current = Number.isFinite(els.audio.currentTime) ? els.audio.currentTime : 0;
    els.position.max = String(Math.max(0, Math.floor(duration)));
    els.position.value = String(Math.max(0, Math.floor(current)));
    const currentLabel = secondsLabel(current);
    const durationLabel = secondsLabel(duration);
    els.position.setAttribute('aria-valuetext', `${currentLabel} / ${durationLabel}`);
    if (announce || !els.time.textContent) {
      els.time.textContent = copy[lang].time(currentLabel, durationLabel);
    }
  }

  function updateMediaSession(episode) {
    if (!('mediaSession' in navigator) || !episode) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: episode.title,
        artist: 'TifloAcosta',
        album: copy[lang].title
      });
      navigator.mediaSession.setActionHandler('play', () => { void els.audio.play(); });
      navigator.mediaSession.setActionHandler('pause', () => els.audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', details => {
        const offset = Number(details?.seekOffset) || SEEK_SECONDS;
        els.audio.currentTime = Math.max(0, els.audio.currentTime - offset);
        updateTime({ announce: true });
      });
      navigator.mediaSession.setActionHandler('seekforward', details => {
        const offset = Number(details?.seekOffset) || SEEK_SECONDS;
        const duration = Number.isFinite(els.audio.duration) ? els.audio.duration : els.audio.currentTime + offset;
        els.audio.currentTime = Math.min(duration, els.audio.currentTime + offset);
        updateTime({ announce: true });
      });
      navigator.mediaSession.setActionHandler('seekto', details => {
        if (!Number.isFinite(details?.seekTime)) return;
        els.audio.currentTime = Math.max(0, Math.min(Number(els.audio.duration) || details.seekTime, details.seekTime));
        updateTime({ announce: true });
      });
    } catch {}
  }

  function clearCurrentEpisodeMarker() {
    els.episodes.querySelectorAll('button[aria-current="true"]').forEach(button => {
      button.removeAttribute('aria-current');
    });
  }

  function loadEpisode(episode, button) {
    els.audio.pause();
    activeEpisode = episode;
    activeButton = button || null;
    clearCurrentEpisodeMarker();
    if (button) button.setAttribute('aria-current', 'true');

    els.audio.src = episode.audioUrl;
    els.currentTitle.textContent = episode.title;
    els.player.hidden = false;
    els.position.value = '0';
    els.position.max = '0';
    els.position.setAttribute('aria-valuetext', '0:00 / 0:00');
    els.time.textContent = copy[lang].ready(episode.title);
    updateToggle();
    updateMediaSession(episode);

    queueMicrotask(() => els.currentTitle.focus());
  }

  function renderEpisodes() {
    els.episodes.replaceChildren();
    const totalPages = Math.max(1, Math.ceil(episodes.length / EPISODES_PER_PAGE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * EPISODES_PER_PAGE;
    for (const episode of episodes.slice(start, start + EPISODES_PER_PAGE)) {
      const article = document.createElement('article');
      article.className = 'podcast-episode-card';

      const heading = document.createElement('h3');
      heading.textContent = episode.title;
      article.append(heading);

      const published = formatDate(episode.published);
      if (published) {
        const meta = document.createElement('p');
        meta.className = 'resource-meta';
        meta.textContent = published;
        article.append(meta);
      }

      if (episode.description) {
        const description = document.createElement('p');
        description.textContent = episode.description;
        article.append(description);
      }

      const listen = document.createElement('button');
      listen.type = 'button';
      listen.textContent = copy[lang].listen(episode.title);
      if (activeEpisode?.id === episode.id) listen.setAttribute('aria-current', 'true');
      listen.addEventListener('click', () => loadEpisode(episode, listen));
      article.append(listen);
      els.episodes.append(article);
    }
    els.pagination.hidden = episodes.length === 0;
    els.previousPage.hidden = currentPage <= 1;
    els.nextPage.hidden = currentPage >= totalPages;
    els.previousPage.textContent = lang === 'en' ? 'Previous 10 episodes' : '10 episodios anteriores en la lista';
    els.nextPage.textContent = lang === 'en' ? 'Next 10 episodes' : 'Siguientes 10 episodios';
    els.pagination.setAttribute('aria-label', lang === 'en' ? 'Episode pages' : 'Páginas de episodios');
    els.pageStatus.textContent = lang === 'en'
      ? `Showing episodes ${start + 1}–${Math.min(start + EPISODES_PER_PAGE, episodes.length)} of ${episodes.length}. Page ${currentPage} of ${totalPages}.`
      : `Mostrando episodios ${start + 1} a ${Math.min(start + EPISODES_PER_PAGE, episodes.length)} de ${episodes.length}. Página ${currentPage} de ${totalPages}.`;
  }

  function applyLanguage() {
    const c = copy[lang];
    document.documentElement.lang = lang;
    document.title = c.title;
    writeStorage('tifloLang', lang);

    els.langEs.setAttribute('aria-pressed', String(lang === 'es'));
    els.langEn.setAttribute('aria-pressed', String(lang === 'en'));
    els.skip.textContent = c.skip;
    els.back.textContent = c.back;
    els.backBottom.textContent = c.back;
    els.heading.textContent = c.title;
    els.intro.textContent = c.intro;
    els.playerHeading.textContent = c.player;
    els.controls.setAttribute('aria-label', c.controls);
    els.rewind.textContent = c.rewind;
    els.forward.textContent = c.forward;
    els.positionLabel.textContent = c.position;
    els.episodesHeading.textContent = c.episodes;
    els.servicesHeading.textContent = c.services;
    els.footer.textContent = c.footer;
    updateToggle();
    updateTime();
    renderEpisodes();
    updateMediaSession(activeEpisode);
  }

  async function loadFeed() {
    els.status.textContent = copy[lang].loading;
    try {
      const response = await fetch(FEED_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
      episodes = parseEpisodes(await response.text());
      episodes.sort((a, b) => Date.parse(b.published || 0) - Date.parse(a.published || 0));
      currentPage = 1;
      if (!episodes.length) throw new Error('empty');
      els.status.textContent = '';
      renderEpisodes();
    } catch {
      els.status.textContent = copy[lang].error;
    }
  }

  els.previousPage.addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage--;
    renderEpisodes();
    els.episodesHeading.setAttribute('tabindex', '-1');
    els.episodesHeading.focus();
  });
  els.nextPage.addEventListener('click', () => {
    if (currentPage * EPISODES_PER_PAGE >= episodes.length) return;
    currentPage++;
    renderEpisodes();
    els.episodesHeading.setAttribute('tabindex', '-1');
    els.episodesHeading.focus();
  });

  els.langEs.addEventListener('click', () => { lang = 'es'; applyLanguage(); });
  els.langEn.addEventListener('click', () => { lang = 'en'; applyLanguage(); });

  els.rewind.addEventListener('click', () => {
    els.audio.currentTime = Math.max(0, els.audio.currentTime - SEEK_SECONDS);
    updateTime({ announce: true });
  });

  els.forward.addEventListener('click', () => {
    const duration = Number.isFinite(els.audio.duration) ? els.audio.duration : els.audio.currentTime + SEEK_SECONDS;
    els.audio.currentTime = Math.min(duration, els.audio.currentTime + SEEK_SECONDS);
    updateTime({ announce: true });
  });

  els.toggle.addEventListener('click', () => {
    if (!activeEpisode) return;
    if (els.audio.paused) void els.audio.play();
    else els.audio.pause();
  });

  els.position.addEventListener('input', () => {
    els.audio.currentTime = Math.max(0, Number(els.position.value) || 0);
    updateTime({ announce: true });
  });

  els.position.addEventListener('change', () => updateTime({ announce: true }));
  els.audio.addEventListener('loadedmetadata', () => updateTime({ announce: true }));
  els.audio.addEventListener('timeupdate', () => updateTime());
  els.audio.addEventListener('play', updateToggle);
  els.audio.addEventListener('pause', updateToggle);
  els.audio.addEventListener('ended', () => {
    updateToggle();
    updateTime({ announce: true });
    els.time.textContent = copy[lang].ended;
    if (activeButton?.isConnected) activeButton.focus();
  });

  window.addEventListener('pagehide', () => els.audio.pause());

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => reg.update()).catch(() => {}));
  }

  applyDisplayPreferences();
  applyLanguage();
  loadFeed();
})();
