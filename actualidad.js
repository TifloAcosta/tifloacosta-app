(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_ACTUALIDAD_VIEW = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const labels = {
    es: {
      read: 'Leer en TifloAcosta',
      original: 'Abrir fuente original'
    },
    en: {
      read: 'Read on TifloAcosta',
      original: 'Open original source'
    }
  };

  function availableActions(story, lang = 'es') {
    const copy = labels[lang] || labels.es;
    const actions = [];
    if (story?.editorialState === 'adapted' && String(story?.body || '').trim()) {
      actions.push({ kind: 'read', label: copy.read });
    }
    if (story?.originalUrl) actions.push({ kind: 'original', label: copy.original, url: story.originalUrl });
    return actions;
  }

  return { availableActions };
}));

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const core = window.TIFLO_ACTUALIDAD_CORE;
    const view = window.TIFLO_ACTUALIDAD_VIEW;
    if (!core || !view) return;

    const $ = selector => document.querySelector(selector);
    const els = {
      langEs: $('#lang-es'),
      langEn: $('#lang-en'),
      skip: $('.skip-link'),
      brand: $('.brand'),
      heading: $('#actualidad-heading'),
      intro: $('#actualidad-intro'),
      sectionsNav: $('#actualidad-sections'),
      sectionNewsLink: $('#section-news-link'),
      sectionAppsLink: $('#section-apps-link'),
      newsHeading: $('#news-heading'),
      categoryLabel: $('#news-category-label'),
      category: $('#news-category'),
      status: $('#news-status'),
      list: $('#news-list'),
      browser: $('#news-browser'),
      appsBrowser: $('#apps-browser'),
      appsHeading: $('#apps-heading'),
      appsIntro: $('#apps-intro'),
      appsPlatformLabel: $('#apps-platform-label'),
      appsPlatform: $('#apps-platform'),
      appsStatus: $('#apps-status'),
      appsList: $('#apps-list'),
      reader: $('#news-reader'),
      readerBackTop: $('#reader-back-top'),
      readerBackBottom: $('#reader-back-bottom'),
      readerTitle: $('#reader-title'),
      readerMeta: $('#reader-meta'),
      readerBody: $('#reader-body'),
      readerOriginal: $('#reader-original'),
      homeTop: $('#home-link-top'),
      homeBottom: $('#home-link-bottom'),
      footer: $('#footer-text')
    };

    const copy = {
      es: {
        documentTitle: 'Actualidad TifloAcosta',
        skip: 'Saltar al contenido principal',
        brand: 'TifloAcosta, inicio',
        heading: 'Actualidad TifloAcosta',
        intro: 'Noticias y novedades de accesibilidad y tecnología seleccionadas para llegar a lo importante sin tener que apartar ruido por el camino.',
        sections: 'Secciones de Actualidad',
        news: 'Noticias',
        apps: 'Apps accesibles',
        appsIntro: 'Aplicaciones accesibles descubiertas en fuentes especializadas. Cuando una fuente no publica una fecha fiable, TifloAcosta no inventa una.',
        categoryLabel: 'Filtrar por categoría',
        allCategories: 'Todas las categorías',
        platformLabel: 'Filtrar por plataforma',
        allPlatforms: 'Todas las plataformas',
        home: 'Volver al inicio',
        back: 'Volver a Actualidad',
        original: 'Abrir fuente original',
        appOriginal: 'Abrir ficha en la fuente',
        empty: 'No hay noticias disponibles en este momento.',
        appsEmpty: 'No hay aplicaciones disponibles en este momento.',
        error: 'No se pudo cargar Actualidad. Inténtalo de nuevo más tarde.',
        appsError: 'No se pudo cargar la sección de Apps accesibles. Inténtalo de nuevo más tarde.',
        count: n => `${n} noticia${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}.`,
        appsCount: n => `${n} aplicación${n === 1 ? '' : 'es'} disponible${n === 1 ? '' : 's'}.`,
        footer: 'TifloAcosta · Actualidad.',
        source: 'Fuente',
        categories: 'Categorías',
        platform: 'Plataforma'
      },
      en: {
        documentTitle: 'TifloAcosta News',
        skip: 'Skip to main content',
        brand: 'TifloAcosta, home',
        heading: 'TifloAcosta News',
        intro: 'Accessibility and technology news selected to help you reach what matters without having to clear away the noise first.',
        sections: 'News sections',
        news: 'News',
        apps: 'Accessible apps',
        appsIntro: 'Accessible apps discovered through specialist sources. When a source does not provide a reliable publication date, TifloAcosta does not invent one.',
        categoryLabel: 'Filter by category',
        allCategories: 'All categories',
        platformLabel: 'Filter by platform',
        allPlatforms: 'All platforms',
        home: 'Back to home',
        back: 'Back to News',
        original: 'Open original source',
        appOriginal: 'Open app at source',
        empty: 'There are no news items available right now.',
        appsEmpty: 'There are no accessible apps available right now.',
        error: 'News could not be loaded. Please try again later.',
        appsError: 'The Accessible apps section could not be loaded. Please try again later.',
        count: n => `${n} news item${n === 1 ? '' : 's'} available.`,
        appsCount: n => `${n} app${n === 1 ? '' : 's'} available.`,
        footer: 'TifloAcosta · News.',
        source: 'Source',
        categories: 'Categories',
        platform: 'Platform'
      }
    };

    const categoryCopy = {
      es: {
        apple: 'Apple', android: 'Android', windows: 'Windows', jaws: 'JAWS', nvda: 'NVDA',
        'apps-accesibles': 'Apps accesibles', 'programas-accesibles': 'Programas accesibles',
        'gafas-inteligentes': 'Gafas inteligentes', 'productos-disponibles': 'Productos disponibles',
        'proyectos-prototipos': 'Proyectos y prototipos', 'tecnologia-accesibilidad': 'Tecnología y accesibilidad',
        'ia-accesibilidad': 'Inteligencia artificial y accesibilidad', braille: 'Braille y comunicación accesible',
        movilidad: 'Movilidad, orientación y autonomía', sordoceguera: 'Tecnología para personas sordociegas'
      },
      en: {
        apple: 'Apple', android: 'Android', windows: 'Windows', jaws: 'JAWS', nvda: 'NVDA',
        'apps-accesibles': 'Accessible apps', 'programas-accesibles': 'Accessible programs',
        'gafas-inteligentes': 'Smart glasses', 'productos-disponibles': 'Available products',
        'proyectos-prototipos': 'Projects and prototypes', 'tecnologia-accesibilidad': 'Technology and accessibility',
        'ia-accesibilidad': 'Artificial intelligence and accessibility', braille: 'Braille and accessible communication',
        movilidad: 'Mobility, orientation and independence', sordoceguera: 'Technology for deafblind people'
      }
    };

    let stories = [];
    let apps = [];
    let appsLoadFailed = false;
    let newsLoadFailed = false;
    let newsLoaded = false;
    let newsLoading = false;
    let appsLoaded = false;
    let appsLoading = false;
    let readerOpener = null;
    let lang = readStoredLanguage();

    function readStoredLanguage() {
      try {
        const stored = window.localStorage.getItem('tifloLang');
        if (stored === 'es' || stored === 'en') return stored;
      } catch (error) { /* storage can be unavailable */ }
      return navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es';
    }

    function storeLanguage(value) {
      try { window.localStorage.setItem('tifloLang', value); } catch (error) { /* optional preference */ }
    }

    function categoryLabel(category) {
      const known = categoryCopy[lang]?.[category];
      if (known) return known;
      return String(category || '').replace(/[-_]+/g, ' ').replace(/^./, char => char.toUpperCase());
    }

    function formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en', { dateStyle: 'long' }).format(date);
    }

    function metaText(story) {
      const c = copy[lang];
      const date = formatDate(story.publishedAt);
      const bits = [`${c.source}: ${story.sourceName}`];
      if (date) bits.push(date);
      if (story.categories?.length) bits.push(`${c.categories}: ${story.categories.map(categoryLabel).join(', ')}`);
      return bits.join(' · ');
    }

    function appMetaText(app) {
      const c = copy[lang];
      const bits = [`${c.source}: ${app.sourceName}`];
      if (app.platform) bits.push(`${c.platform}: ${app.platform}`);
      if (app.publishedAt) {
        const date = formatDate(app.publishedAt);
        if (date) bits.push(date);
      }
      return bits.join(' · ');
    }

    function applyCopy() {
      const c = copy[lang];
      document.documentElement.lang = lang;
      document.title = c.documentTitle;
      els.skip.textContent = c.skip;
      els.brand.setAttribute('aria-label', c.brand);
      els.heading.textContent = c.heading;
      els.intro.textContent = c.intro;
      els.sectionsNav.setAttribute('aria-label', c.sections);
      els.sectionNewsLink.textContent = c.news;
      els.sectionAppsLink.textContent = c.apps;
      els.newsHeading.textContent = c.news;
      els.categoryLabel.textContent = c.categoryLabel;
      els.appsHeading.textContent = c.apps;
      els.appsIntro.textContent = c.appsIntro;
      els.appsPlatformLabel.textContent = c.platformLabel;
      els.homeTop.textContent = c.home;
      els.homeBottom.textContent = c.home;
      els.readerBackTop.textContent = c.back;
      els.readerBackBottom.textContent = c.back;
      els.readerOriginal.textContent = c.original;
      els.footer.textContent = c.footer;
      els.langEs.setAttribute('aria-pressed', String(lang === 'es'));
      els.langEn.setAttribute('aria-pressed', String(lang === 'en'));
    }

    function rebuildCategories() {
      const selected = els.category.value;
      const categories = [...new Set(core.publicStories(stories, lang).flatMap(story => story.categories || []))]
        .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), lang === 'es' ? 'es' : 'en'));
      els.category.replaceChildren();
      const all = document.createElement('option');
      all.value = '';
      all.textContent = copy[lang].allCategories;
      els.category.append(all);
      for (const category of categories) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = categoryLabel(category);
        els.category.append(option);
      }
      els.category.value = categories.includes(selected) ? selected : '';
    }

    function rebuildPlatforms() {
      const selected = els.appsPlatform.value;
      const platforms = [...new Set(apps.map(app => String(app.platform || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, lang === 'es' ? 'es' : 'en'));
      els.appsPlatform.replaceChildren();
      const all = document.createElement('option');
      all.value = '';
      all.textContent = copy[lang].allPlatforms;
      els.appsPlatform.append(all);
      for (const platform of platforms) {
        const option = document.createElement('option');
        option.value = platform;
        option.textContent = platform;
        els.appsPlatform.append(option);
      }
      els.appsPlatform.value = platforms.includes(selected) ? selected : '';
    }

    function closeReader({ restoreFocus = true } = {}) {
      els.reader.hidden = true;
      els.sectionsNav.hidden = false;
      els.browser.hidden = false;
      els.appsBrowser.hidden = false;
      if (restoreFocus && readerOpener && readerOpener.isConnected) readerOpener.focus();
      readerOpener = null;
    }

    function openReader(story, opener) {
      if (story.editorialState !== 'adapted' || !String(story.body || '').trim()) return;
      readerOpener = opener;
      els.sectionsNav.hidden = true;
      els.browser.hidden = true;
      els.appsBrowser.hidden = true;
      els.reader.hidden = false;
      els.readerTitle.textContent = story.title;
      els.readerMeta.textContent = metaText(story);
      els.readerOriginal.href = story.originalUrl;
      els.readerBody.replaceChildren();
      const paragraphs = String(story.body).split(/\n\s*\n/).map(value => value.trim()).filter(Boolean);
      for (const text of paragraphs) {
        const p = document.createElement('p');
        p.textContent = text;
        els.readerBody.append(p);
      }
      els.readerTitle.focus();
    }

    function renderList() {
      const c = copy[lang];
      els.list.replaceChildren();

      if (newsLoadFailed) {
        const error = document.createElement('p');
        error.className = 'no-results';
        error.textContent = c.error;
        els.list.append(error);
        els.status.textContent = '';
        return;
      }

      if (!newsLoaded) return;
      const selected = els.category.value;
      const publicItems = core.publicStories(stories, lang);
      const visible = selected ? publicItems.filter(story => story.categories.includes(selected)) : publicItems;

      if (!visible.length) {
        const empty = document.createElement('p');
        empty.className = 'no-results';
        empty.textContent = c.empty;
        els.list.append(empty);
        els.status.textContent = c.count(0);
        return;
      }

      for (const story of visible) {
        const card = document.createElement('div');
        card.className = 'news-item';

        const title = document.createElement('h3');
        title.textContent = story.title;
        card.append(title);

        const meta = document.createElement('p');
        meta.className = 'resource-meta';
        meta.textContent = metaText(story);
        card.append(meta);

        if (story.editorialState === 'adapted' && story.summary) {
          const summary = document.createElement('p');
          summary.textContent = story.summary;
          card.append(summary);
        }

        const actions = document.createElement('div');
        actions.className = 'resource-actions';
        for (const action of view.availableActions(story, lang)) {
          if (action.kind === 'read') {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = `read-${story.id}`;
            button.textContent = action.label;
            button.addEventListener('click', () => openReader(story, button));
            actions.append(button);
          } else {
            const link = document.createElement('a');
            link.className = 'button-link';
            link.href = story.originalUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = action.label;
            actions.append(link);
          }
        }
        card.append(actions);
        els.list.append(card);
      }
      els.status.textContent = c.count(visible.length);
    }

    function renderApps() {
      const c = copy[lang];
      els.appsList.replaceChildren();

      if (appsLoadFailed) {
        const error = document.createElement('p');
        error.className = 'no-results';
        error.textContent = c.appsError;
        els.appsList.append(error);
        els.appsStatus.textContent = '';
        return;
      }

      if (!appsLoaded) return;
      const selected = els.appsPlatform.value;
      const visible = selected ? apps.filter(app => app.platform === selected) : apps;

      if (!visible.length) {
        const empty = document.createElement('p');
        empty.className = 'no-results';
        empty.textContent = c.appsEmpty;
        els.appsList.append(empty);
        els.appsStatus.textContent = c.appsCount(0);
        return;
      }

      for (const app of visible) {
        const card = document.createElement('div');
        card.className = 'news-item';

        const title = document.createElement('h3');
        title.textContent = app.title;
        card.append(title);

        const meta = document.createElement('p');
        meta.className = 'resource-meta';
        meta.textContent = appMetaText(app);
        card.append(meta);

        if (app.summary && (!app.lang || app.lang === lang)) {
          const summary = document.createElement('p');
          summary.textContent = app.summary;
          card.append(summary);
        }

        const actions = document.createElement('div');
        actions.className = 'resource-actions';
        const link = document.createElement('a');
        link.className = 'button-link';
        link.href = app.originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = c.appOriginal;
        actions.append(link);
        card.append(actions);
        els.appsList.append(card);
      }
      els.appsStatus.textContent = c.appsCount(visible.length);
    }

    function render() {
      applyCopy();
      if (!els.reader.hidden) closeReader({ restoreFocus: false });
      if (newsLoaded || newsLoadFailed) {
        rebuildCategories();
        renderList();
      }
      if (appsLoaded || appsLoadFailed) {
        rebuildPlatforms();
        renderApps();
      }
    }

    function setLanguage(value) {
      if (value !== 'es' && value !== 'en') return;
      lang = value;
      storeLanguage(value);
      render();
    }

    function loadNews() {
      if (newsLoaded || newsLoading) return;
      newsLoading = true;
      newsLoadFailed = false;
      fetch('actualidad.json', { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          stories = Array.isArray(data) ? data : [];
          newsLoaded = true;
          newsLoading = false;
          rebuildCategories();
          renderList();
        })
        .catch(() => {
          stories = [];
          newsLoaded = false;
          newsLoading = false;
          newsLoadFailed = true;
          rebuildCategories();
          renderList();
        });
    }

    function loadApps() {
      if (appsLoaded || appsLoading) return;
      appsLoading = true;
      appsLoadFailed = false;
      fetch('actualidad-apps.json', { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          apps = Array.isArray(data) ? data : [];
          appsLoadFailed = false;
          appsLoaded = true;
          appsLoading = false;
          rebuildPlatforms();
          renderApps();
        })
        .catch(() => {
          apps = [];
          appsLoadFailed = true;
          appsLoaded = false;
          appsLoading = false;
          rebuildPlatforms();
          renderApps();
        });
    }

    function ensureCatalogForRoute() {
      const catalog = core.catalogForActualidadRoute(window.location.hash);
      if (catalog === 'news') loadNews();
      else if (catalog === 'apps') loadApps();
    }

    els.langEs.addEventListener('click', () => setLanguage('es'));
    els.langEn.addEventListener('click', () => setLanguage('en'));
    els.category.addEventListener('change', renderList);
    els.appsPlatform.addEventListener('change', renderApps);
    els.readerBackTop.addEventListener('click', () => closeReader());
    els.readerBackBottom.addEventListener('click', () => closeReader());
    window.addEventListener('hashchange', ensureCatalogForRoute);

    applyCopy();
    ensureCatalogForRoute();
  }, { once: true });
}