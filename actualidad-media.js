(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const $ = selector => document.querySelector(selector);
    const core = window.TIFLO_ACTUALIDAD_CORE;
    const mediaBrowser = $('#media-browser');
    const heading = $('#media-heading');
    const intro = $('#media-intro');
    const sectionsNav = $('#media-sections');
    const accessibilityLink = $('#media-accessibility-link');
    const technologyLink = $('#media-technology-link');
    const accessibilityHeading = $('#media-accessibility-heading');
    const accessibilityIntro = $('#media-accessibility-intro');
    const technologyHeading = $('#media-technology-heading');
    const technologyIntro = $('#media-technology-intro');
    const accessibilityList = $('#media-accessibility-list');
    const technologyList = $('#media-technology-list');
    const status = $('#media-status');
    const topMediaLink = $('#section-media-link');
    if (!mediaBrowser || !accessibilityList || !technologyList) return;

    const copy = {
      es: {
        topLink: 'Escuchar y ver',
        heading: 'Escuchar y ver',
        intro: 'Vídeos y podcasts seleccionados para mantenerse al día sin mezclar fuentes especializadas en accesibilidad con tecnología general.',
        nav: 'Secciones de Escuchar y ver',
        accessibility: 'Accesibilidad y tiflotecnología',
        accessibilityIntro: 'Contenido de fuentes especializadas en accesibilidad, lectores de pantalla, tiflotecnología y productos de apoyo.',
        technology: 'Actualidad tecnológica',
        technologyIntro: 'Estos canales no están especializados en accesibilidad. Se incluyen porque ofrecen información tecnológica de interés general que puede ayudar a mantenerse al día.',
        source: 'Fuente',
        originalLanguage: 'Idioma original',
        published: 'Publicado',
        open: 'Abrir en la fuente',
        play: 'Reproducir',
        close: 'Cerrar reproductor',
        empty: 'No hay contenidos disponibles en este apartado en este momento.',
        error: 'No se pudo cargar Escuchar y ver. Inténtalo de nuevo más tarde.',
        count: n => `${n} contenido${n === 1 ? '' : 's'} multimedia disponible${n === 1 ? '' : 's'}.`,
        languageName: code => ({ es: 'Español', en: 'Inglés' }[code] || code || 'No indicado')
      },
      en: {
        topLink: 'Listen and watch',
        heading: 'Listen and watch',
        intro: 'Selected videos and podcasts to stay current without mixing specialist accessibility sources with general technology channels.',
        nav: 'Listen and watch sections',
        accessibility: 'Accessibility and assistive technology',
        accessibilityIntro: 'Content from sources specialising in accessibility, screen readers, assistive technology and support products.',
        technology: 'Technology news',
        technologyIntro: 'These channels do not specialise in accessibility. They are included because they provide general technology information that can help people stay up to date.',
        source: 'Source',
        originalLanguage: 'Original language',
        published: 'Published',
        open: 'Open at source',
        play: 'Play',
        close: 'Close player',
        empty: 'There is no content available in this section right now.',
        error: 'Listen and watch could not be loaded. Please try again later.',
        count: n => `${n} multimedia item${n === 1 ? '' : 's'} available.`,
        languageName: code => ({ es: 'Spanish', en: 'English' }[code] || code || 'Not specified')
      }
    };

    let items = [];
    let loadFailed = false;
    let mediaLoaded = false;
    let mediaLoading = false;
    const currentLanguage = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'es';

    function mediaVisibleInLanguage(item, lang) {
      if (item.originalLanguage === lang) return true;
      return item.editorialState === 'adapted' && Boolean(item.locales?.[lang]);
    }

    function formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat(currentLanguage() === 'es' ? 'es-ES' : 'en', { dateStyle: 'long' }).format(date);
    }

    function localizedContent(item) {
      const localized = item.locales?.[currentLanguage()] || {};
      return {
        title: localized.title || item.title,
        summary: localized.summary || item.summary
      };
    }

    function mediaMeta(item) {
      const c = copy[currentLanguage()];
      const parts = [`${c.source}: ${item.sourceName}`];
      const date = formatDate(item.publishedAt);
      if (date) parts.push(`${c.published}: ${date}`);
      parts.push(`${c.originalLanguage}: ${c.languageName(item.originalLanguage)}`);
      return parts.join(' · ');
    }

    function addPlayer(card, item, button) {
      if (item.type === 'audio' && item.mediaUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = item.mediaUrl;
        card.append(audio);
        return;
      }

      if (item.type === 'video' && item.embedUrl && button) {
        const container = document.createElement('div');
        container.hidden = true;
        card.append(container);
        button.addEventListener('click', () => {
          const opening = container.hidden;
          container.hidden = !opening;
          button.setAttribute('aria-expanded', String(opening));
          button.textContent = opening ? copy[currentLanguage()].close : copy[currentLanguage()].play;

          if (opening) {
            const frame = document.createElement('iframe');
            frame.title = `${copy[currentLanguage()].play}: ${localizedContent(item).title}`;
            frame.src = item.embedUrl;
            frame.loading = 'lazy';
            frame.allowFullscreen = true;
            frame.setAttribute('allow', 'encrypted-media; picture-in-picture');
            frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            container.replaceChildren(frame);
          } else {
            container.replaceChildren();
          }
        });
      }
    }

    function renderSection(section, list) {
      const c = copy[currentLanguage()];
      const visible = items.filter(item => item.section === section && mediaVisibleInLanguage(item, currentLanguage()));
      list.replaceChildren();
      if (!visible.length) {
        const empty = document.createElement('p');
        empty.className = 'no-results';
        empty.textContent = c.empty;
        list.append(empty);
        return 0;
      }

      for (const item of visible) {
        const content = localizedContent(item);
        const card = document.createElement('article');
        card.className = 'news-item';

        const title = document.createElement('h4');
        title.textContent = content.title;
        card.append(title);

        const meta = document.createElement('p');
        meta.className = 'resource-meta';
        meta.textContent = mediaMeta(item);
        card.append(meta);

        if (content.summary) {
          const summary = document.createElement('p');
          summary.textContent = content.summary;
          card.append(summary);
        }

        const actions = document.createElement('div');
        actions.className = 'resource-actions';
        let playerButton = null;
        if (item.type === 'video' && item.embedUrl) {
          playerButton = document.createElement('button');
          playerButton.type = 'button';
          playerButton.textContent = c.play;
          playerButton.setAttribute('aria-expanded', 'false');
          actions.append(playerButton);
        }

        const mediaOriginal = document.createElement('a');
        mediaOriginal.className = 'button-link';
        mediaOriginal.href = item.originalUrl;
        mediaOriginal.target = '_blank';
        mediaOriginal.rel = 'noopener noreferrer';
        mediaOriginal.textContent = c.open;
        actions.append(mediaOriginal);
        card.append(actions);

        if (item.type === 'audio' && item.mediaUrl) addPlayer(card, item, null);
        else if (playerButton) addPlayer(card, item, playerButton);
        list.append(card);
      }
      return visible.length;
    }

    function applyCopy() {
      const c = copy[currentLanguage()];
      if (topMediaLink) topMediaLink.textContent = c.topLink;
      heading.textContent = c.heading;
      intro.textContent = c.intro;
      sectionsNav?.setAttribute('aria-label', c.nav);
      accessibilityLink.textContent = c.accessibility;
      technologyLink.textContent = c.technology;
      accessibilityHeading.textContent = c.accessibility;
      accessibilityIntro.textContent = c.accessibilityIntro;
      technologyHeading.textContent = c.technology;
      technologyIntro.textContent = c.technologyIntro;
    }

    function render() {
      applyCopy();
      if (!mediaLoaded && !loadFailed) return;
      const c = copy[currentLanguage()];
      if (loadFailed) {
        accessibilityList.replaceChildren();
        technologyList.replaceChildren();
        const error = document.createElement('p');
        error.className = 'no-results';
        error.textContent = c.error;
        accessibilityList.append(error);
        status.textContent = '';
        return;
      }
      const total = renderSection('accessibility', accessibilityList) + renderSection('technology', technologyList);
      status.textContent = c.count(total);
    }

    function loadMedia() {
      if (mediaLoaded || mediaLoading) return;
      mediaLoading = true;
      fetch('actualidad-media.json', { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then(data => {
          items = Array.isArray(data) ? data : [];
          loadFailed = false;
          mediaLoaded = true;
          mediaLoading = false;
          render();
        })
        .catch(() => {
          items = [];
          loadFailed = true;
          mediaLoaded = false;
          mediaLoading = false;
          render();
        });
    }

    function ensureMediaForRoute() {
      if (core?.catalogForActualidadRoute(window.location.hash) === 'media') loadMedia();
    }

    const languageObserver = new MutationObserver(() => {
      if (mediaLoaded || loadFailed) render();
      else applyCopy();
    });
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    window.addEventListener('hashchange', ensureMediaForRoute);
    applyCopy();
    ensureMediaForRoute();
  }, { once: true });
})();