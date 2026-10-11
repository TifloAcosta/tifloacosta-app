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
        const lang = currentLanguage();
        const player = document.createElement('section');
        player.className = 'panel podcast-player';
        player.setAttribute('aria-label', (lang === 'es' ? 'Reproductor de Podcast: ' : 'Podcast player: ') + localizedContent(item).title);
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.src = item.mediaUrl;
        audio.setAttribute('aria-label', localizedContent(item).title);
        const controls = document.createElement('div');
        controls.className = 'resource-actions';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', lang === 'es' ? 'Controles accesibles del Podcast' : 'Accessible podcast controls');
        const rewind = document.createElement('button');
        rewind.type = 'button';
        rewind.textContent = lang === 'es' ? 'Retroceder 30 segundos' : 'Rewind 30 seconds';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        const forward = document.createElement('button');
        forward.type = 'button';
        forward.textContent = lang === 'es' ? 'Avanzar 30 segundos' : 'Forward 30 seconds';
        const progress = document.createElement('input');
        progress.type = 'range';
        progress.min = '0';
        progress.max = '0';
        progress.step = '1';
        progress.value = '0';
        progress.disabled = true;
        progress.style.width = '100%';
        progress.setAttribute('aria-label', lang === 'es' ? 'Posición del episodio' : 'Episode position');
        progress.setAttribute('aria-valuetext', '0:00 / 0:00');
        const time = document.createElement('p');
        time.className = 'muted';
        time.setAttribute('aria-live', 'polite');
        const labelTime = seconds => {
          const total = Math.max(0, Math.floor(Number(seconds) || 0));
          const hours = Math.floor(total / 3600);
          const minutes = Math.floor(total % 3600 / 60);
          const rest = total % 60;
          return hours
            ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0')
            : minutes + ':' + String(rest).padStart(2, '0');
        };
        const updateTime = (announce = false) => {
          const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
          const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
          progress.disabled = duration <= 0;
          progress.max = String(Math.floor(Math.max(duration, 0)));
          progress.value = String(Math.floor(Math.max(position, 0)));
          const value = labelTime(position) + ' / ' + labelTime(duration);
          progress.setAttribute('aria-valuetext', value);
          if (announce || !time.textContent) {
            time.textContent = labelTime(position) + (lang === 'es' ? ' de ' : ' of ') + labelTime(duration);
          }
        };
        const updateToggle = () => {
          toggle.textContent = audio.paused
            ? (lang === 'es' ? 'Reproducir' : 'Play')
            : (lang === 'es' ? 'Pausar' : 'Pause');
        };
        const seek = delta => {
          if (!Number.isFinite(audio.currentTime)) return;
          const upper = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + Math.max(delta, 0);
          audio.currentTime = Math.max(0, Math.min(upper, audio.currentTime + delta));
          updateTime(true);
        };
        rewind.addEventListener('click', () => seek(-30));
        forward.addEventListener('click', () => seek(30));
        toggle.addEventListener('click', () => {
          if (!audio.paused) { audio.pause(); return; }
          card.closest('#media-browser')?.querySelectorAll('audio').forEach(other => {
            if (other !== audio) other.pause();
          });
          audio.play().catch(() => {
            time.textContent = lang === 'es'
              ? 'No se pudo reproducir aquí. Utiliza Abrir en la fuente.'
              : 'Playback is unavailable here. Use Open at source.';
            time.setAttribute('role', 'alert');
            updateToggle();
          });
        });
        progress.addEventListener('input', () => {
          audio.currentTime = Math.max(0, Number(progress.value) || 0);
          updateTime(true);
        });
        audio.addEventListener('loadedmetadata', () => updateTime(true));
        audio.addEventListener('timeupdate', () => updateTime());
        audio.addEventListener('play', () => { time.removeAttribute('role'); updateToggle(); });
        audio.addEventListener('pause', updateToggle);
        audio.addEventListener('ended', () => { updateToggle(); updateTime(true); });
        audio.addEventListener('error', () => {
          time.textContent = lang === 'es'
            ? 'No se pudo cargar el audio. Puedes abrirlo en la fuente original.'
            : 'Audio could not be loaded. You can open it at its original source.';
          time.setAttribute('role', 'alert');
        });
        controls.append(rewind, toggle, forward);
        player.append(audio, controls, progress, time);
        card.append(player);
        updateToggle();
        updateTime();
        return;
      }

      if (item.type === 'video' && item.embedUrl && button) {
        const container = document.createElement('div');
        container.hidden = true;
        const notice = document.createElement('p');
        notice.className = 'muted';
        notice.textContent = currentLanguage() === 'es' ? 'Si YouTube no permite reproducir aquí, usa Abrir en la fuente.' : 'If YouTube cannot play here, use Open at source.';
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
            container.replaceChildren(notice, frame);
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
        mediaOriginal.textContent = item.type === 'audio' && !item.mediaUrl
          ? (currentLanguage() === 'es' ? 'Escuchar en la fuente original' : 'Listen at original source')
          : c.open;
        // Prioritize the accessible audio player in reading order.
        if (item.type === 'audio' && item.mediaUrl) addPlayer(card, item, null);
        actions.append(mediaOriginal);
        card.append(actions);
        if (item.type !== 'audio' && playerButton) addPlayer(card, item, playerButton);
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

    // Move VoiceOver focus only after an explicit section navigation action.
    // Never steal focus when media loads or the preferred language changes.
    for (const [link, target] of [
      [topMediaLink, heading],
      [accessibilityLink, accessibilityHeading],
      [technologyLink, technologyHeading]
    ]) {
      if (!link || !target) continue;
      target.setAttribute('tabindex', '-1');
      link.addEventListener('click', () => {
        requestAnimationFrame(() => {
          if (document.activeElement === link || document.activeElement === document.body) {
            target.focus({ preventScroll: true });
          }
        });
      });
    }
    window.addEventListener('hashchange', ensureMediaForRoute);
    applyCopy();
    ensureMediaForRoute();
  }, { once: true });
})();