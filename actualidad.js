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
      categoryLabel: $('#news-category-label'),
      category: $('#news-category'),
      status: $('#news-status'),
      list: $('#news-list'),
      browser: $('#news-browser'),
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
        categoryLabel: 'Filtrar por categoría',
        allCategories: 'Todas las categorías',
        home: 'Volver al inicio',
        back: 'Volver a Actualidad',
        original: 'Abrir fuente original',
        empty: 'No hay noticias disponibles en este momento.',
        error: 'No se pudo cargar Actualidad. Inténtalo de nuevo más tarde.',
        count: n => `${n} noticia${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}.`,
        footer: 'TifloAcosta · Actualidad.',
        source: 'Fuente',
        categories: 'Categorías'
      },
      en: {
        documentTitle: 'TifloAcosta News',
        skip: 'Skip to main content',
        brand: 'TifloAcosta, home',
        heading: 'TifloAcosta News',
        intro: 'Accessibility and technology news selected to help you reach what matters without having to clear away the noise first.',
        categoryLabel: 'Filter by category',
        allCategories: 'All categories',
        home: 'Back to home',
        back: 'Back to News',
        original: 'Open original source',
        empty: 'There are no news items available right now.',
        error: 'News could not be loaded. Please try again later.',
        count: n => `${n} news item${n === 1 ? '' : 's'} available.`,
        footer: 'TifloAcosta · News.',
        source: 'Source',
        categories: 'Categories'
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

    function applyCopy() {
      const c = copy[lang];
      document.documentElement.lang = lang;
      document.title = c.documentTitle;
      els.skip.textContent = c.skip;
      els.brand.setAttribute('aria-label', c.brand);
      els.heading.textContent = c.heading;
      els.intro.textContent = c.intro;
      els.categoryLabel.textContent = c.categoryLabel;
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

    function closeReader({ restoreFocus = true } = {}) {
      els.reader.hidden = true;
      els.browser.hidden = false;
      if (restoreFocus && readerOpener && readerOpener.isConnected) readerOpener.focus();
      readerOpener = null;
    }

    function openReader(story, opener) {
      if (story.editorialState !== 'adapted' || !String(story.body || '').trim()) return;
      readerOpener = opener;
      els.browser.hidden = true;
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
      const selected = els.category.value;
      const publicItems = core.publicStories(stories, lang);
      const visible = selected ? publicItems.filter(story => story.categories.includes(selected)) : publicItems;
      els.list.replaceChildren();

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

        const title = document.createElement('h2');
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

    function render() {
      applyCopy();
      if (!els.reader.hidden) closeReader({ restoreFocus: false });
      rebuildCategories();
      renderList();
    }

    function setLanguage(value) {
      if (value !== 'es' && value !== 'en') return;
      lang = value;
      storeLanguage(value);
      render();
    }

    els.langEs.addEventListener('click', () => setLanguage('es'));
    els.langEn.addEventListener('click', () => setLanguage('en'));
    els.category.addEventListener('change', renderList);
    els.readerBackTop.addEventListener('click', () => closeReader());
    els.readerBackBottom.addEventListener('click', () => closeReader());

    applyCopy();
    fetch('actualidad.json', { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        stories = Array.isArray(data) ? data : [];
        rebuildCategories();
        renderList();
      })
      .catch(() => {
        stories = [];
        rebuildCategories();
        els.list.replaceChildren();
        const error = document.createElement('p');
        error.className = 'no-results';
        error.textContent = copy[lang].error;
        els.list.append(error);
        els.status.textContent = '';
      });
  }, { once: true });
}
