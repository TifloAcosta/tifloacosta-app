(() => {
  'use strict';

  const config = window.TifloYouTubeActionsConfig || {};
  const endpoint = String(config.endpoint || '').replace(/\/$/, '');
  const $ = selector => document.querySelector(selector);
  const els = {
    section: $('#youtube-accessible-section'),
    heading: $('#youtube-accessible-heading'),
    intro: $('#youtube-accessible-intro'),
    form: $('#youtube-accessible-form'),
    label: $('#youtube-accessible-label'),
    search: $('#youtube-accessible-search'),
    submit: $('#youtube-accessible-search-button'),
    status: $('#youtube-accessible-status'),
    results: $('#youtube-accessible-results'),
    more: $('#youtube-accessible-more'),
    langEs: $('#lang-es'),
    langEn: $('#lang-en')
  };
  if (!els.section || !els.form || !els.results) return;

  const copy = {
    es: {
      heading: 'YouTube accesible',
      intro: 'Busca vídeos públicos de YouTube desde una pantalla sencilla, pensada para lector de pantalla. No necesitas iniciar sesión en Google para buscar o reproducir.',
      label: '¿Qué quieres buscar en YouTube?',
      placeholder: 'Por ejemplo: VoiceOver iPhone, TalkBack, tecnología accesible…',
      search: 'Buscar en YouTube',
      more: 'Mostrar 10 resultados más',
      searching: 'Buscando en YouTube…',
      enterQuery: 'Escribe al menos dos caracteres para buscar.',
      noResults: 'No se encontraron vídeos con esos criterios.',
      found: n => `Se encontraron ${n} resultado${n === 1 ? '' : 's'} en esta página.`,
      moreAdded: n => `Se añadieron ${n} resultado${n === 1 ? '' : 's'} más.`,
      error: 'No se pudo realizar la búsqueda en YouTube. Inténtalo de nuevo dentro de unos momentos.',
      quota: 'La búsqueda de YouTube ha alcanzado temporalmente su límite de uso. Inténtalo más tarde.',
      unavailable: 'La búsqueda de YouTube todavía no está disponible.',
      channel: name => `Canal: ${name}`,
      published: value => `Publicado: ${value}`,
      duration: value => `Duración: ${value}`,
      play: 'Reproducir',
      playLabel: title => `Reproducir: ${title}`,
      youtube: 'Abrir en YouTube'
    },
    en: {
      heading: 'Accessible YouTube',
      intro: 'Search public YouTube videos from a simple screen designed for screen readers. You do not need to sign in to Google to search or play videos.',
      label: 'What do you want to search for on YouTube?',
      placeholder: 'For example: VoiceOver iPhone, TalkBack, accessible technology…',
      search: 'Search YouTube',
      more: 'Show 10 more results',
      searching: 'Searching YouTube…',
      enterQuery: 'Enter at least two characters to search.',
      noResults: 'No videos were found for that search.',
      found: n => `${n} result${n === 1 ? '' : 's'} found on this page.`,
      moreAdded: n => `${n} more result${n === 1 ? '' : 's'} added.`,
      error: 'The YouTube search could not be completed. Please try again in a moment.',
      quota: 'YouTube search has temporarily reached its usage limit. Please try again later.',
      unavailable: 'YouTube search is not available yet.',
      channel: name => `Channel: ${name}`,
      published: value => `Published: ${value}`,
      duration: value => `Duration: ${value}`,
      play: 'Play',
      playLabel: title => `Play: ${title}`,
      youtube: 'Open on YouTube'
    }
  };

  let nextPageToken = '';
  let currentQuery = '';
  let loading = false;

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(language() === 'es' ? 'es-ES' : 'en', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!total) return '';
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }

  function applyLanguage() {
    const c = copy[language()];
    els.heading.textContent = c.heading;
    els.intro.textContent = c.intro;
    els.label.textContent = c.label;
    els.search.placeholder = c.placeholder;
    els.submit.textContent = c.search;
    els.more.textContent = c.more;
  }

  function setLoading(value) {
    loading = value;
    els.submit.disabled = value;
    els.more.disabled = value;
  }

  function createCard(video) {
    const c = copy[language()];
    const article = document.createElement('article');
    article.className = 'youtube-search-card';

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

    if (video.channelTitle) {
      const channel = document.createElement('p');
      channel.className = 'video-meta';
      channel.textContent = c.channel(video.channelTitle);
      article.append(channel);
    }

    const date = formatDate(video.publishedAt);
    if (date) {
      const published = document.createElement('p');
      published.className = 'video-meta';
      published.textContent = c.published(date);
      article.append(published);
    }

    const duration = formatDuration(video.durationSeconds);
    if (duration) {
      const durationP = document.createElement('p');
      durationP.className = 'video-meta';
      durationP.textContent = c.duration(duration);
      article.append(durationP);
    }

    const descriptionText = String(video.description || '').trim();
    if (descriptionText) {
      const description = document.createElement('p');
      description.className = 'video-description';
      description.textContent = descriptionText.length > 350
        ? `${descriptionText.slice(0, 347).trim()}…`
        : descriptionText;
      article.append(description);
    }

    const actions = document.createElement('div');
    actions.className = 'youtube-search-actions';

    const play = document.createElement('button');
    play.type = 'button';
    play.className = 'video-play-button';
    play.textContent = c.play;
    play.setAttribute('aria-label', c.playLabel(video.title || ''));
    play.dataset.videoId = video.id || '';
    play.addEventListener('click', () => {
      if (!window.TifloVideoPlayer || typeof window.TifloVideoPlayer.open !== 'function') return;
      window.TifloVideoPlayer.open({
        id: video.id,
        title: video.title,
        description: video.description,
        fullDescription: video.description,
        publishedAt: video.publishedAt,
        thumbnail: video.thumbnail,
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id || '')}`
      });
    });
    actions.append(play);

    const external = document.createElement('a');
    external.className = 'button-link';
    external.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id || '')}`;
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    external.textContent = c.youtube;
    actions.append(external);

    article.append(actions);
    return article;
  }

  async function search({ append = false } = {}) {
    if (loading) return;
    const c = copy[language()];
    const query = append ? currentQuery : els.search.value.trim();

    if (!append && query.length < 2) {
      els.status.textContent = c.enterQuery;
      els.status.focus();
      return;
    }
    if (!endpoint) {
      els.status.textContent = c.unavailable;
      els.status.focus();
      return;
    }

    if (!append) {
      currentQuery = query;
      nextPageToken = '';
      els.results.replaceChildren();
      els.more.hidden = true;
    }

    setLoading(true);
    els.status.textContent = c.searching;

    try {
      const url = new URL(`${endpoint}/search`);
      url.searchParams.set('q', currentQuery);
      if (append && nextPageToken) url.searchParams.set('pageToken', nextPageToken);
      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = String(data.error || '');
        if (error === 'QUOTA_EXCEEDED') throw Object.assign(new Error(error), { code: error });
        if (error === 'SEARCH_UNAVAILABLE') throw Object.assign(new Error(error), { code: error });
        throw new Error(error || 'SEARCH_ERROR');
      }

      const items = Array.isArray(data.items) ? data.items : [];
      items.forEach(video => els.results.append(createCard(video)));
      nextPageToken = String(data.nextPageToken || '');
      els.more.hidden = !nextPageToken;
      els.status.textContent = items.length
        ? (append ? c.moreAdded(items.length) : c.found(items.length))
        : c.noResults;
      els.status.focus();
    } catch (error) {
      if (error?.code === 'QUOTA_EXCEEDED') els.status.textContent = c.quota;
      else if (error?.code === 'SEARCH_UNAVAILABLE') els.status.textContent = c.unavailable;
      else els.status.textContent = c.error;
      els.status.focus();
    } finally {
      setLoading(false);
    }
  }

  els.form.addEventListener('submit', event => {
    event.preventDefault();
    void search();
  });
  els.more.addEventListener('click', () => void search({ append: true }));
  els.langEs?.addEventListener('click', () => setTimeout(applyLanguage, 0));
  els.langEn?.addEventListener('click', () => setTimeout(applyLanguage, 0));
  applyLanguage();
})();
