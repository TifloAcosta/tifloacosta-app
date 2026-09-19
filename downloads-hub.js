(() => {
  'use strict';

  const copy = {
    es: {
      launcher: 'Descargas',
      heading: 'Descargas',
      intro: 'Elige qué quieres hacer.',
      link: 'Descargar desde un enlace',
      sounds: 'Buscar sonidos',
      back: 'Volver al inicio'
    },
    en: {
      launcher: 'Downloads',
      heading: 'Downloads',
      intro: 'Choose what you want to do.',
      link: 'Download from a link',
      sounds: 'Search sounds',
      back: 'Back to home'
    }
  };

  let launcher;
  let section;

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function text() {
    return copy[language()];
  }

  function routeName() {
    return window.location.hash.replace(/^#/, '');
  }

  function isDownloadsRoute(route) {
    return route === 'downloads' || route === 'downloads-link' || route === 'downloads-sounds';
  }

  function setGlobalChromeHidden(hidden) {
    ['home-hero', 'home-blocks', 'global-search-section', 'resources-view', 'news-view', 'book-section', 'contact-section', 'privacy-section', 'config-section']
      .forEach(id => {
        const node = document.getElementById(id);
        if (node && hidden) node.hidden = true;
      });
    document.querySelectorAll('.site-header,.site-footer,.skip-link').forEach(node => {
      node.hidden = hidden;
    });
  }

  function localize() {
    if (!launcher || !section) return;
    const t = text();
    launcher.textContent = t.launcher;
    section.querySelector('#downloads-hub-heading').textContent = t.heading;
    section.querySelector('#downloads-hub-intro').textContent = t.intro;
    section.querySelector('#downloads-open-link').textContent = t.link;
    section.querySelector('#downloads-open-sounds').textContent = t.sounds;
    section.querySelectorAll('[data-downloads-home]').forEach(button => {
      button.textContent = t.back;
    });
  }

  function applyVisibility() {
    if (!section) return;
    const route = routeName();
    const active = route === 'downloads';
    const inDownloads = isDownloadsRoute(route);

    section.hidden = !active;
    if (inDownloads) setGlobalChromeHidden(true);
    else if (!route || route === 'home' || ['resources', 'news', 'book', 'contact', 'privacy', 'config'].includes(route)) setGlobalChromeHidden(false);

    if (!active) return;
    const linkSection = document.getElementById('downloads-section');
    const soundsSection = document.getElementById('sound-search-section');
    if (linkSection) linkSection.hidden = true;
    if (soundsSection) soundsSection.hidden = true;
    section.hidden = false;
    section.focus();
  }

  function makeHomeButton() {
    const wrapper = document.createElement('p');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button-link back-link';
    button.dataset.downloadsHome = 'true';
    button.addEventListener('click', () => { window.location.hash = '#home'; });
    wrapper.append(button);
    return wrapper;
  }

  function build() {
    const nav = document.querySelector('#home-blocks .resource-actions');
    const main = document.getElementById('main');
    if (!nav || !main || document.getElementById('downloads-hub')) return false;

    launcher = document.createElement('button');
    launcher.id = 'home-open-downloads';
    launcher.type = 'button';
    launcher.className = 'button-link';
    launcher.addEventListener('click', () => { window.location.hash = '#downloads'; });
    const videosLauncher = document.getElementById('home-open-videos');
    if (videosLauncher && videosLauncher.parentElement === nav) nav.insertBefore(launcher, videosLauncher);
    else nav.append(launcher);

    section = document.createElement('section');
    section.id = 'downloads-hub';
    section.hidden = true;
    section.tabIndex = -1;
    section.setAttribute('aria-labelledby', 'downloads-hub-heading');
    section.append(makeHomeButton());

    const heading = document.createElement('h2');
    heading.id = 'downloads-hub-heading';
    section.append(heading);

    const intro = document.createElement('p');
    intro.id = 'downloads-hub-intro';
    intro.className = 'download-tool-intro';
    section.append(intro);

    const actions = document.createElement('div');
    actions.className = 'resource-actions downloads-hub-actions';
    const openLink = document.createElement('button');
    openLink.id = 'downloads-open-link';
    openLink.type = 'button';
    openLink.className = 'button-link';
    openLink.addEventListener('click', () => { window.location.hash = '#downloads-link'; });
    const openSounds = document.createElement('button');
    openSounds.id = 'downloads-open-sounds';
    openSounds.type = 'button';
    openSounds.className = 'button-link';
    openSounds.addEventListener('click', () => { window.location.hash = '#downloads-sounds'; });
    actions.append(openLink, openSounds);
    section.append(actions);
    section.append(makeHomeButton());
    main.append(section);

    localize();
    applyVisibility();
    return true;
  }

  if (!build()) return;
  window.addEventListener('hashchange', applyVisibility);
  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(localize, 0));
})();
