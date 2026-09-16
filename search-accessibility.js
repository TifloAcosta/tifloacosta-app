(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_GLOBAL_SEARCH = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function queryMatches(text, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return false;
    const normalizedText = normalizeText(text);
    const words = normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean);
    return words.length > 0 && words.every(word => normalizedText.includes(word));
  }

  function supplementalVideoText(videoIndex, id) {
    const extra = videoIndex?.videos?.[id] || {};
    return [
      ...(Array.isArray(extra.keywords) ? extra.keywords : []),
      extra.searchText || '',
      extra.adaptedText || ''
    ].join(' ');
  }

  function searchAcrossSources(sources = {}, query = '', lang = 'es') {
    const term = normalizeText(query);
    if (!term) return [];
    const language = lang === 'en' ? 'en' : 'es';
    const results = [];

    for (const item of Array.isArray(sources.resources) ? sources.resources : []) {
      if (item?.lang && item.lang !== language) continue;
      const text = `${item?.title || ''} ${item?.category || ''}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'resource',
        id: String(item.id || item.title || ''),
        title: String(item.title || ''),
        meta: String(item.category || ''),
        href: String(item.openUrl || item.url || '#')
      });
    }

    for (const item of Array.isArray(sources.videos) ? sources.videos : []) {
      const id = String(item?.id || '').trim();
      const text = `${item?.title || ''} ${item?.description || ''} ${item?.excerpt || ''} ${supplementalVideoText(sources.videoIndex, id)}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'video',
        id,
        title: String(item.title || ''),
        meta: '',
        href: id ? `videos.html?video=${encodeURIComponent(id)}` : String(item.url || 'videos.html'),
        publishedAt: item.publishedAt || ''
      });
    }

    for (const item of Array.isArray(sources.podcasts) ? sources.podcasts : []) {
      if (item?.lang && item.lang !== language) continue;
      const text = `${item?.title || ''} ${item?.summary || ''}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'podcast',
        id: String(item.id || item.url || item.title || ''),
        title: String(item.title || ''),
        meta: 'Canal TifloAcosta',
        href: String(item.url || item.originalUrl || '#'),
        publishedAt: item.publishedAt || ''
      });
    }

    for (const item of Array.isArray(sources.stories) ? sources.stories : []) {
      if (item?.lang && item.lang !== language) continue;
      const categories = Array.isArray(item?.categories) ? item.categories.join(' ') : '';
      const text = `${item?.title || ''} ${item?.summary || ''} ${item?.body || ''} ${item?.sourceName || ''} ${categories}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'news',
        id: String(item.id || item.title || ''),
        title: String(item.title || ''),
        meta: String(item.sourceName || ''),
        href: String(item.originalUrl || 'actualidad.html#news-browser'),
        publishedAt: item.publishedAt || ''
      });
    }

    for (const item of Array.isArray(sources.apps) ? sources.apps : []) {
      if (item?.lang && item.lang !== language) continue;
      const text = `${item?.title || ''} ${item?.summary || ''} ${item?.platform || ''} ${item?.sourceName || ''}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'app',
        id: String(item.id || item.title || ''),
        title: String(item.title || ''),
        meta: [item.platform, item.sourceName].filter(Boolean).join(' · '),
        href: String(item.originalUrl || 'actualidad.html#apps-browser'),
        publishedAt: item.publishedAt || ''
      });
    }

    for (const item of Array.isArray(sources.media) ? sources.media : []) {
      if (item?.originalLanguage && item.originalLanguage !== language) continue;
      const categories = Array.isArray(item?.categories) ? item.categories.join(' ') : '';
      const text = `${item?.title || ''} ${item?.summary || ''} ${item?.sourceName || ''} ${item?.platform || ''} ${categories}`;
      if (!queryMatches(text, term)) continue;
      results.push({
        kind: 'media',
        id: String(item.id || item.title || ''),
        title: String(item.title || ''),
        meta: String(item.sourceName || ''),
        href: String(item.originalUrl || 'actualidad.html#media-browser'),
        publishedAt: item.publishedAt || ''
      });
    }

    const kindOrder = { resource: 0, video: 1, podcast: 2, news: 3, app: 4, media: 5 };
    return results.sort((a, b) => {
      const kindDelta = (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99);
      if (kindDelta) return kindDelta;
      const dateDelta = new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
      if (dateDelta) return dateDelta;
      return normalizeText(a.title).localeCompare(normalizeText(b.title));
    });
  }

  return { normalizeText, queryMatches, searchAcrossSources };
}));

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (() => {
    'use strict';

    const api = window.TIFLO_GLOBAL_SEARCH;
    if (!api) return;

    const copyByLanguage = {
      es: {
        heading: 'Buscar en TifloAcosta',
        label: 'Título, descripción o tema',
        placeholder: 'Por ejemplo: VoiceOver, Android, WhatsApp…',
        button: 'Buscar',
        clear: 'Borrar búsqueda',
        loading: 'Buscando en TifloAcosta…',
        empty: 'No se encontraron resultados.',
        count: n => `${n} resultado${n === 1 ? '' : 's'} encontrado${n === 1 ? '' : 's'}.`,
        groups: {
          resource: 'Recursos',
          video: 'Vídeos de TifloAcosta',
          podcast: 'Podcast de TifloAcosta',
          news: 'Noticias',
          app: 'Apps accesibles',
          media: 'Escuchar y ver'
        },
        open: {
          resource: 'Abrir recurso',
          video: 'Abrir vídeo',
          podcast: 'Abrir episodio',
          news: 'Abrir noticia',
          app: 'Abrir ficha',
          media: 'Abrir contenido'
        },
        controlsHeading: 'Ordenar vídeos',
        videosIntro: 'Accede al catálogo completo de vídeos de TifloAcosta para ordenarlo y recorrerlo con comodidad. Para buscar un vídeo, utiliza el buscador general del inicio.'
      },
      en: {
        heading: 'Search TifloAcosta',
        label: 'Title, description, or topic',
        placeholder: 'For example: VoiceOver, Android, WhatsApp…',
        button: 'Search',
        clear: 'Clear search',
        loading: 'Searching TifloAcosta…',
        empty: 'No results were found.',
        count: n => `${n} result${n === 1 ? '' : 's'} found.`,
        groups: {
          resource: 'Resources',
          video: 'TifloAcosta videos',
          podcast: 'TifloAcosta podcast',
          news: 'News',
          app: 'Accessible apps',
          media: 'Listen and watch'
        },
        open: {
          resource: 'Open resource',
          video: 'Open video',
          podcast: 'Open episode',
          news: 'Open news item',
          app: 'Open app page',
          media: 'Open content'
        },
        controlsHeading: 'Sort videos',
        videosIntro: 'Open the complete TifloAcosta video catalog to sort and browse it comfortably. To find a video, use the global search on the home screen.'
      }
    };

    function currentLanguage() {
      return document.documentElement.lang === 'en' ? 'en' : 'es';
    }

    function loadScriptOnce(src) {
      return new Promise(resolve => {
        if (window.TIFLO_VIDEO_SEARCH_INDEX) return resolve();
        const existing = document.querySelector('script[data-global-video-index]');
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => resolve(), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.dataset.globalVideoIndex = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => resolve(), { once: true });
        document.head.append(script);
      });
    }

    async function fetchJson(url, fallback) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        return fallback;
      }
    }

    function enhanceGlobalSearch() {
      const form = document.querySelector('#search-form');
      const search = document.querySelector('#search');
      const heading = document.querySelector('#search-heading');
      const label = document.querySelector('label[for="search"]');
      const button = document.querySelector('#search-button');
      const homeHero = document.querySelector('#home-hero');
      const videosHomeIntro = document.querySelector('#videos-home-intro');
      const langEs = document.querySelector('#lang-es');
      const langEn = document.querySelector('#lang-en');
      if (!form || !search || !heading || !label || !button || !homeHero) return;
      if (form.dataset.globalSearch === 'true') return;
      form.dataset.globalSearch = 'true';

      const searchSection = form.closest('section');
      if (!searchSection) return;
      searchSection.id = 'global-search-section';
      searchSection.classList.add('global-search-section');
      homeHero.insertAdjacentElement('afterend', searchSection);

      const status = document.createElement('p');
      status.id = 'global-search-status';
      status.className = 'muted global-search-status';
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      const clearRow = document.createElement('div');
      clearRow.className = 'inline-actions global-search-clear-row';
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.id = 'global-search-clear';
      clearButton.hidden = true;
      clearRow.append(clearButton);

      const results = document.createElement('div');
      results.id = 'global-search-results';
      results.className = 'global-search-results';
      results.hidden = true;
      form.insertAdjacentElement('afterend', status);
      status.insertAdjacentElement('afterend', clearRow);
      clearRow.insertAdjacentElement('afterend', results);

      let rawStories = [];
      let sourcesPromise = null;

      function localize() {
        const lang = currentLanguage();
        const copy = copyByLanguage[lang];
        heading.textContent = copy.heading;
        label.textContent = copy.label;
        search.placeholder = copy.placeholder;
        button.textContent = copy.button;
        clearButton.textContent = copy.clear;
        if (videosHomeIntro) videosHomeIntro.textContent = copy.videosIntro;
      }

      async function loadSources() {
        if (sourcesPromise) return sourcesPromise;
        sourcesPromise = Promise.all([
          fetchJson('videos.json', { videos: [] }),
          fetchJson('podcast.json', []),
          fetchJson('actualidad.json', []),
          fetchJson('actualidad-apps.json', []),
          fetchJson('actualidad-media.json', []),
          loadScriptOnce('video-search-index.js?v=1.0')
        ]).then(([videoCatalog, podcasts, stories, apps, media]) => {
          rawStories = Array.isArray(stories) ? stories : [];
          return {
            videos: Array.isArray(videoCatalog?.videos) ? videoCatalog.videos : [],
            podcasts: Array.isArray(podcasts) ? podcasts : [],
            apps: Array.isArray(apps) ? apps : [],
            media: Array.isArray(media) ? media : []
          };
        });
        return sourcesPromise;
      }

      function localizedStories(lang) {
        const core = window.TIFLO_ACTUALIDAD_CORE;
        if (core && typeof core.publicStories === 'function') return core.publicStories(rawStories, lang);
        return rawStories.filter(item => !item.lang || item.lang === lang);
      }

      function resultCard(item, copy) {
        const card = document.createElement('div');
        card.className = 'global-search-card';
        const title = document.createElement('h4');
        title.textContent = item.title;
        card.append(title);
        if (item.meta) {
          const meta = document.createElement('p');
          meta.className = 'muted global-search-meta';
          meta.textContent = item.meta;
          card.append(meta);
        }
        const link = document.createElement('a');
        link.className = 'button-link';
        link.href = item.href;
        link.textContent = `${copy.open[item.kind]}: ${item.title}`;
        if (/^https?:\/\//.test(item.href) && !item.href.startsWith(location.origin)) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        card.append(link);
        return card;
      }

      function render(items) {
        const lang = currentLanguage();
        const copy = copyByLanguage[lang];
        results.replaceChildren();
        results.hidden = false;
        clearButton.hidden = false;
        status.textContent = items.length ? copy.count(items.length) : copy.empty;

        const kinds = ['resource', 'video', 'podcast', 'news', 'app', 'media'];
        for (const kind of kinds) {
          const matches = items.filter(item => item.kind === kind);
          if (!matches.length) continue;
          const group = document.createElement('section');
          group.className = 'global-search-group';
          const groupHeading = document.createElement('h3');
          groupHeading.textContent = `${copy.groups[kind]} (${matches.length})`;
          group.append(groupHeading);
          const list = document.createElement('div');
          list.className = 'global-search-list';
          matches.slice(0, 10).forEach(item => list.append(resultCard(item, copy)));
          group.append(list);
          results.append(group);
        }
      }

      async function runSearch(event) {
        if (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        const term = search.value.trim();
        if (!term) {
          results.replaceChildren();
          results.hidden = true;
          clearButton.hidden = true;
          status.textContent = '';
          return;
        }
        const lang = currentLanguage();
        const copy = copyByLanguage[lang];
        status.textContent = copy.loading;
        const loaded = await loadSources();
        const found = api.searchAcrossSources({
          resources: Array.isArray(window.TIFLO_RESOURCES) ? window.TIFLO_RESOURCES : [],
          videos: loaded.videos,
          podcasts: loaded.podcasts,
          stories: localizedStories(lang),
          apps: loaded.apps,
          media: loaded.media,
          videoIndex: window.TIFLO_VIDEO_SEARCH_INDEX || { videos: {} }
        }, term, lang);
        render(found);
      }

      function clearSearch() {
        search.value = '';
        results.replaceChildren();
        results.hidden = true;
        clearButton.hidden = true;
        status.textContent = '';
        search.focus();
      }

      function updateHomeVisibility() {
        const key = location.hash.replace(/^#/, '');
        searchSection.hidden = Boolean(key && key !== 'home');
      }

      form.addEventListener('submit', runSearch, true);
      clearButton.addEventListener('click', clearSearch);
      window.addEventListener('hashchange', updateHomeVisibility);
      if (langEs) langEs.addEventListener('click', () => window.setTimeout(() => { localize(); if (search.value.trim()) runSearch(); }, 0));
      if (langEn) langEn.addEventListener('click', () => window.setTimeout(() => { localize(); if (search.value.trim()) runSearch(); }, 0));
      localize();
      updateHomeVisibility();
      loadSources();
    }

    function enhanceResourceCategories() {
      const select = document.querySelector('#category');
      const label = document.querySelector('label[for="category"]');
      if (!select || !label || select.dataset.accessibleCategories === 'true') return;
      select.dataset.accessibleCategories = 'true';

      label.id = label.id || 'category-label';
      label.removeAttribute('for');

      const categoryToggle = document.createElement('button');
      categoryToggle.type = 'button';
      categoryToggle.id = 'category-toggle';
      categoryToggle.setAttribute('aria-expanded', 'false');
      categoryToggle.setAttribute('aria-controls', 'category-options');
      categoryToggle.setAttribute('aria-labelledby', `${label.id} category-toggle`);

      const categoryOptions = document.createElement('div');
      categoryOptions.id = 'category-options';
      categoryOptions.className = 'inline-actions category-options';
      categoryOptions.hidden = true;
      categoryOptions.setAttribute('role', 'group');
      categoryOptions.setAttribute('aria-labelledby', label.id);

      select.hidden = true;
      select.insertAdjacentElement('afterend', categoryToggle);
      categoryToggle.insertAdjacentElement('afterend', categoryOptions);

      function placeholder() {
        return select.options[0]?.textContent || (currentLanguage() === 'en' ? 'Select a category' : 'Seleccionar una categoría');
      }

      function syncToggle() {
        const selected = [...select.options].find(option => option.value === select.value);
        categoryToggle.textContent = select.value && selected ? selected.textContent : placeholder();
      }

      function setOpen(open) {
        categoryToggle.setAttribute('aria-expanded', String(open));
        categoryOptions.hidden = !open;
      }

      function rebuildOptions() {
        categoryOptions.replaceChildren();
        [...select.options].filter(option => option.value).forEach(option => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'category-option';
          button.textContent = option.textContent;
          button.dataset.categoryValue = option.value;
          button.addEventListener('click', () => {
            select.value = option.value;
            syncToggle();
            setOpen(false);
            select.dispatchEvent(new Event('change', { bubbles: true }));
            categoryToggle.focus();
          });
          categoryOptions.append(button);
        });
      }

      categoryToggle.addEventListener('click', () => {
        rebuildOptions();
        syncToggle();
        setOpen(categoryToggle.getAttribute('aria-expanded') !== 'true');
      });
      categoryOptions.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        setOpen(false);
        categoryToggle.focus();
      });
      select.addEventListener('change', syncToggle);
      document.querySelector('#favorites-button')?.addEventListener('click', () => window.setTimeout(syncToggle, 0));
      document.querySelector('#clear-results')?.addEventListener('click', () => window.setTimeout(syncToggle, 0));

      const observer = new MutationObserver(() => {
        rebuildOptions();
        syncToggle();
      });
      observer.observe(select, { childList: true });

      rebuildOptions();
      syncToggle();
    }

    function submitHiddenVideoSearch(form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    async function openRequestedVideo() {
      const requestedId = new URLSearchParams(location.search).get('video');
      if (!requestedId) return;
      const videoSearchForm = document.querySelector('#video-search-form');
      const videoSearch = document.querySelector('#video-search');
      if (!videoSearchForm || !videoSearch) return;

      const catalog = await fetchJson('videos.json', { videos: [] });
      const target = Array.isArray(catalog?.videos) ? catalog.videos.find(video => video.id === requestedId) : null;
      if (!target) return;

      videoSearch.value = target.title || requestedId;
      submitHiddenVideoSearch(videoSearchForm);

      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;
        const button = [...document.querySelectorAll('button[data-video-id]')].find(candidate => candidate.dataset.videoId === requestedId);
        if (button) {
          window.clearInterval(timer);
          button.click();
          const url = new URL(location.href);
          url.searchParams.delete('video');
          if (history.replaceState) history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
        } else if (attempts >= 80) {
          window.clearInterval(timer);
        }
      }, 100);
    }

    function simplifyVideoControls() {
      const controls = document.querySelector('#video-controls-section');
      const videoSearchForm = document.querySelector('#video-search-form');
      const videoSearch = document.querySelector('#video-search');
      const controlsHeading = document.querySelector('#video-controls-heading');
      const sort = document.querySelector('.video-sort-control');
      const closePlayer = document.querySelector('#video-player-close');
      const langEs = document.querySelector('#lang-es');
      const langEn = document.querySelector('#lang-en');
      if (!controls || !videoSearchForm || !controlsHeading || !sort) return;

      videoSearchForm.hidden = true;
      controls.classList.add('video-controls-clean');
      controls.insertBefore(sort, videoSearchForm);

      function localize() {
        const copy = copyByLanguage[currentLanguage()];
        controlsHeading.textContent = copy.controlsHeading;
      }

      if (closePlayer && videoSearch) {
        closePlayer.addEventListener('click', () => window.setTimeout(() => {
          if (!videoSearch.value) return;
          videoSearch.value = '';
          submitHiddenVideoSearch(videoSearchForm);
        }, 0));
      }
      if (langEs) langEs.addEventListener('click', () => window.setTimeout(localize, 0));
      if (langEn) langEn.addEventListener('click', () => window.setTimeout(localize, 0));
      localize();
      openRequestedVideo();
    }

    function init() {
      enhanceGlobalSearch();
      enhanceResourceCategories();
      simplifyVideoControls();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  })();
}
