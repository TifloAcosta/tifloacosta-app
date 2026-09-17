(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_ACTUALIDAD_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const editorialStates = new Set(['source-only', 'selected', 'adapted', 'withheld']);
  const contentTypes = new Set(['news', 'app', 'audio', 'video']);
  const DAY_MS = 24 * 60 * 60 * 1000;

  function cleanString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch (error) {
      return false;
    }
  }

  function normalizedLocale(value) {
    if (!value || typeof value !== 'object') return null;
    const title = cleanString(value.title);
    if (!title) return null;
    return {
      title,
      summary: cleanString(value.summary),
      body: cleanString(value.body)
    };
  }

  function legacyToLogical(raw) {
    const lang = cleanString(raw?.lang).toLowerCase();
    if (!['es', 'en'].includes(lang)) return null;
    return {
      ...raw,
      type: 'news',
      originalLanguage: lang,
      locales: {
        [lang]: {
          title: cleanString(raw.title),
          summary: cleanString(raw.summary),
          body: cleanString(raw.body)
        }
      },
      media: null
    };
  }

  function normalizeContent(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const isLegacy = !raw.locales && !raw.originalLanguage;
    const candidate = isLegacy ? legacyToLogical(raw) : raw;
    if (!candidate) return null;

    const id = cleanString(candidate.id);
    const type = cleanString(candidate.type || 'news').toLowerCase();
    const sourceId = cleanString(candidate.sourceId);
    const sourceName = cleanString(candidate.sourceName);
    const sourceUrl = cleanString(candidate.sourceUrl);
    const originalUrl = cleanString(candidate.originalUrl);
    const originalLanguage = cleanString(candidate.originalLanguage).toLowerCase();
    const editorialState = cleanString(candidate.editorialState);
    const categories = Array.isArray(candidate.categories)
      ? [...new Set(candidate.categories.map(cleanString).filter(Boolean))]
      : [];
    const date = new Date(candidate.publishedAt);

    if (!id || !contentTypes.has(type) || !sourceId || !sourceName) return null;
    if (!validHttpUrl(sourceUrl) || !validHttpUrl(originalUrl)) return null;
    if (!['es', 'en'].includes(originalLanguage)) return null;
    if (Number.isNaN(date.getTime()) || categories.length === 0 || !editorialStates.has(editorialState)) return null;

    const locales = {};
    for (const lang of ['es', 'en']) {
      const locale = normalizedLocale(candidate.locales?.[lang]);
      if (locale) locales[lang] = locale;
    }

    if (!locales[originalLanguage]) return null;
    if (!isLegacy && editorialState === 'adapted' && (!locales.es || !locales.en)) return null;

    const featuredRank = Number.isFinite(Number(candidate.featuredRank)) && candidate.featuredRank !== null && candidate.featuredRank !== ''
      ? Number(candidate.featuredRank)
      : null;

    return {
      id,
      type,
      sourceId,
      sourceName,
      sourceUrl,
      originalUrl,
      originalLanguage,
      publishedAt: date.toISOString(),
      categories,
      editorialState,
      featuredRank,
      locales,
      media: candidate.media && typeof candidate.media === 'object' ? { ...candidate.media } : null
    };
  }

  function localizedStory(raw, lang) {
    const requestedLanguage = cleanString(lang).toLowerCase();
    if (!['es', 'en'].includes(requestedLanguage)) return null;

    const item = normalizeContent(raw);
    const locale = item?.locales?.[requestedLanguage];
    if (!item || !locale) return null;

    return {
      id: item.id,
      lang: requestedLanguage,
      title: locale.title,
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      originalUrl: item.originalUrl,
      publishedAt: item.publishedAt,
      categories: item.categories,
      editorialState: item.editorialState,
      summary: locale.summary,
      body: locale.body,
      featuredRank: item.featuredRank,
      type: item.type,
      originalLanguage: item.originalLanguage,
      media: item.media
    };
  }

  function normalizeStory(raw) {
    const lang = cleanString(raw?.lang || raw?.originalLanguage).toLowerCase();
    return localizedStory(raw, lang);
  }

  function sortStories(items) {
    return [...items].sort((a, b) => {
      const aRank = a.featuredRank === null ? Number.POSITIVE_INFINITY : a.featuredRank;
      const bRank = b.featuredRank === null ? Number.POSITIVE_INFINITY : b.featuredRank;
      if (aRank !== bRank) return aRank - bRank;

      const dateDelta = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      if (dateDelta) return dateDelta;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function publicStories(items, lang) {
    const selected = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const item = localizedStory(raw, lang);
      if (!item || item.editorialState === 'withheld') continue;
      selected.push(item);
    }
    return sortStories(selected);
  }

  function isFeaturedEligible(item, now = new Date(), maxAgeDays = 5) {
    const published = new Date(item?.publishedAt).getTime();
    const reference = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const safeDays = Number(maxAgeDays);
    if (Number.isNaN(published) || Number.isNaN(reference) || !Number.isFinite(safeDays) || safeDays < 0) return false;
    const age = reference - published;
    return age >= 0 && age <= safeDays * DAY_MS;
  }

  function homePreview(items, lang, limit = 5, now = new Date()) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
    const ordered = publicStories(items, lang).filter(item => isFeaturedEligible(item, now));
    const selected = [];
    const deferred = [];
    const sourceCounts = new Map();
    const maxPerSource = 2;

    for (const item of ordered) {
      const count = sourceCounts.get(item.sourceId) || 0;
      if (count < maxPerSource && selected.length < safeLimit) {
        selected.push(item);
        sourceCounts.set(item.sourceId, count + 1);
      } else {
        deferred.push(item);
      }
    }

    for (const item of deferred) {
      if (selected.length >= safeLimit) break;
      selected.push(item);
    }

    return selected.slice(0, safeLimit);
  }

  function resolveIsolatedView(page, hash = '') {
    const route = cleanString(hash).replace(/^#/, '');

    if (page === 'home') {
      const routes = {
        resources: 'resources-view',
        news: 'news-view',
        book: 'book-section',
        contact: 'contact-section',
        privacy: 'privacy-section',
        config: 'config-section'
      };
      const view = routes[route];
      return view
        ? { view, parent: 'home', chromeVisible: false }
        : { view: 'home', parent: null, chromeVisible: true };
    }

    if (page === 'actualidad') {
      if (route === 'news-reader') {
        return { view: 'news-browser', parent: 'actualidad-home', chromeVisible: false };
      }
      const parents = {
        'news-browser': 'actualidad-home',
        'apps-browser': 'actualidad-home',
        'media-browser': 'actualidad-home',
        'media-accessibility': 'media-browser',
        'media-technology': 'media-browser'
      };
      return parents[route]
        ? { view: route, parent: parents[route], chromeVisible: false }
        : { view: 'actualidad-home', parent: null, chromeVisible: false };
    }

    return { view: page || 'home', parent: null, chromeVisible: page === 'home' };
  }

  function catalogForActualidadRoute(hash = '') {
    const view = resolveIsolatedView('actualidad', hash).view;
    if (view === 'news-browser') return 'news';
    if (view === 'apps-browser') return 'apps';
    if (view === 'media-browser' || view === 'media-accessibility' || view === 'media-technology') return 'media';
    return null;
  }

  function setElementHidden(element, hidden) {
    if (!element) return false;
    const next = Boolean(hidden);
    if (element.hidden === next) return false;
    element.hidden = next;
    return true;
  }

  return { catalogForActualidadRoute, homePreview, isFeaturedEligible, localizedStory, normalizeContent, normalizeStory, publicStories, resolveIsolatedView, setElementHidden, sortStories };
}));

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const selectors = [
    '#home-blocks a.button-link',
    'a[data-home-back]',
    '#actualidad-home-open',
    '#videos-home-open',
    '#actualidad-sections a.button-link',
    '#media-sections a.button-link',
    '#home-link-top',
    '#home-link-bottom'
  ];

  function activateInternalHref(href) {
    if (!href) return;
    if (href.startsWith('#')) {
      if (window.location.hash === href) {
        const target = document.getElementById(href.slice(1));
        if (target) target.scrollIntoView();
      } else {
        window.location.hash = href;
      }
      return;
    }
    window.location.assign(href);
  }

  function upgradeInternalLink(link) {
    if (!link || link.tagName !== 'A') return;
    const href = link.getAttribute('href');
    if (!href) return;

    const button = document.createElement('button');
    for (const attribute of Array.from(link.attributes)) {
      if (['href', 'target', 'rel', 'role'].includes(attribute.name)) continue;
      button.setAttribute(attribute.name, attribute.value);
    }
    button.type = 'button';
    button.innerHTML = link.innerHTML;
    button.addEventListener('click', () => activateInternalHref(href));
    link.replaceWith(button);
  }

  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(upgradeInternalLink);
  });

  const navigationCore = globalThis.TIFLO_ACTUALIDAD_CORE;

  function setPageChromeVisible(visible) {
    document.querySelectorAll('.site-header, .site-footer, .skip-link').forEach(element => {
      element.hidden = !visible;
    });
  }

  function setHidden(element, hidden) {
    if (!element) return;
    if (navigationCore?.setElementHidden) {
      navigationCore.setElementHidden(element, hidden);
      return;
    }
    const next = Boolean(hidden);
    if (element.hidden !== next) element.hidden = next;
  }

  function focusElement(element) {
    if (!element || typeof element.focus !== 'function') return;
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus();
  }

  function currentLanguage() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  const backCopy = {
    es: { actualidad: 'Volver a Actualidad', media: 'Volver a Escuchar y ver' },
    en: { actualidad: 'Back to News', media: 'Back to Listen and watch' }
  };

  let pendingFocusSelector = '';

  function navigateToHash(hash, focusSelector = '') {
    pendingFocusSelector = focusSelector;
    if (window.location.hash === hash) {
      applyActualidadIsolation(true);
      return;
    }
    window.location.hash = hash;
  }

  function ensureBackControls(section, kind, targetHash, focusSelector) {
    if (!section) return;
    const language = currentLanguage();
    const label = backCopy[language][kind];
    ['top', 'bottom'].forEach(position => {
      let wrapper = section.querySelector(`[data-isolated-back="${position}"]`);
      if (!wrapper) {
        wrapper = document.createElement('p');
        wrapper.dataset.isolatedBack = position;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button-link back-link';
        button.addEventListener('click', () => navigateToHash(targetHash, focusSelector));
        wrapper.append(button);
        if (position === 'top') section.prepend(wrapper);
        else section.append(wrapper);
      }
      const button = wrapper.querySelector('button');
      if (button) button.textContent = label;
    });
  }

  function applyHomeIsolation(focusChangedView = false) {
    if (!navigationCore || !document.getElementById('home-blocks')) return;
    const state = navigationCore.resolveIsolatedView('home', window.location.hash);
    const hero = document.getElementById('home-hero');
    const homeBlocks = document.getElementById('home-blocks');
    const home = state.view === 'home';
    const viewIds = ['resources-view', 'news-view', 'book-section', 'contact-section', 'privacy-section', 'config-section'];

    setPageChromeVisible(state.chromeVisible);
    setHidden(hero, !home);
    setHidden(homeBlocks, !home);
    viewIds.forEach(id => setHidden(document.getElementById(id), state.view !== id));

    if (!focusChangedView) return;
    const target = home ? hero : document.getElementById(state.view);
    const heading = target?.querySelector('h1, h2, h3') || target;
    focusElement(heading);
  }

  function applyActualidadIsolation(focusChangedView = false) {
    if (!navigationCore || !document.getElementById('actualidad-sections')) return;

    const hero = document.querySelector('main > .hero');
    const sectionsNav = document.getElementById('actualidad-sections');
    const news = document.getElementById('news-browser');
    const apps = document.getElementById('apps-browser');
    const media = document.getElementById('media-browser');
    const reader = document.getElementById('news-reader');
    const homeBottom = document.getElementById('home-link-bottom')?.parentElement;
    const mediaHeading = document.getElementById('media-heading');
    const mediaIntro = document.getElementById('media-intro');
    const mediaNav = document.getElementById('media-sections');
    const mediaStatus = document.getElementById('media-status');
    const mediaAccessibility = document.getElementById('media-accessibility');
    const mediaTechnology = document.getElementById('media-technology');

    setPageChromeVisible(false);

    if (reader && !reader.hidden) {
      setHidden(hero, true);
      setHidden(sectionsNav, true);
      setHidden(news, true);
      setHidden(apps, true);
      setHidden(media, true);
      setHidden(homeBottom, true);
      return;
    }

    const state = navigationCore.resolveIsolatedView('actualidad', window.location.hash);
    const home = state.view === 'actualidad-home';
    const mediaRoot = state.view === 'media-browser';
    const mediaAccessibilityView = state.view === 'media-accessibility';
    const mediaTechnologyView = state.view === 'media-technology';

    setHidden(hero, !home);
    setHidden(sectionsNav, !home);
    setHidden(news, state.view !== 'news-browser');
    setHidden(apps, state.view !== 'apps-browser');
    setHidden(media, !(mediaRoot || mediaAccessibilityView || mediaTechnologyView));
    setHidden(reader, true);
    setHidden(homeBottom, true);

    if (media) {
      setHidden(mediaHeading, !mediaRoot);
      setHidden(mediaIntro, !mediaRoot);
      setHidden(mediaNav, !mediaRoot);
      setHidden(mediaStatus, true);
      setHidden(mediaAccessibility, !mediaAccessibilityView);
      setHidden(mediaTechnology, !mediaTechnologyView);
    }

    ensureBackControls(news, 'actualidad', '#actualidad-home', '#section-news-link');
    ensureBackControls(apps, 'actualidad', '#actualidad-home', '#section-apps-link');
    ensureBackControls(media, 'actualidad', '#actualidad-home', '#section-media-link');
    ensureBackControls(mediaAccessibility, 'media', '#media-browser', '#media-accessibility-link');
    ensureBackControls(mediaTechnology, 'media', '#media-browser', '#media-technology-link');

    const mediaRootBackControls = media
      ? Array.from(media.children).filter(child => child.dataset?.isolatedBack)
      : [];
    mediaRootBackControls.forEach(wrapper => {
      wrapper.hidden = !mediaRoot;
    });

    if (!focusChangedView) return;
    if (pendingFocusSelector) {
      const target = document.querySelector(pendingFocusSelector);
      pendingFocusSelector = '';
      if (target) {
        focusElement(target);
        return;
      }
    }

    const focusTargets = {
      'actualidad-home': '#actualidad-heading',
      'news-browser': '#news-heading',
      'apps-browser': '#apps-heading',
      'media-browser': '#media-heading',
      'media-accessibility': '#media-accessibility-heading',
      'media-technology': '#media-technology-heading'
    };
    focusElement(document.querySelector(focusTargets[state.view] || '#main'));
  }

  function applyIsolation(focusChangedView = false) {
    applyHomeIsolation(focusChangedView);
    applyActualidadIsolation(focusChangedView);
  }

  window.addEventListener('hashchange', () => applyIsolation(true));
  applyIsolation(false);

  const reader = document.getElementById('news-reader');
  if (reader) {
    const observer = new MutationObserver(() => {
      queueMicrotask(() => applyActualidadIsolation(false));
    });
    observer.observe(reader, { attributes: true, attributeFilter: ['hidden'] });
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.setTimeout(() => applyIsolation(false), 0);
  }, { once: true });
}