(() => {
  'use strict';

  const copy = {
    es: { heading: 'Más herramientas', sounds: 'Buscar sonidos' },
    en: { heading: 'More tools', sounds: 'Search sounds' }
  };

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function localize() {
    const block = document.getElementById('downloads-sounds-link-block');
    if (!block) return;
    const text = copy[language()];
    block.querySelector('h3').textContent = text.heading;
    block.querySelector('a').textContent = text.sounds;
  }

  function mount() {
    const section = document.getElementById('downloads-section');
    const intro = document.getElementById('downloads-intro');
    if (!section || !intro) {
      window.setTimeout(mount, 0);
      return;
    }
    if (document.getElementById('downloads-sounds-link-block')) return;

    const block = document.createElement('section');
    block.id = 'downloads-sounds-link-block';
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.className = 'button-link';
    link.href = 'sounds.html';
    block.append(heading, link);
    intro.insertAdjacentElement('afterend', block);
    localize();
  }

  mount();
  document.getElementById('lang-es')?.addEventListener('click', () => window.setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => window.setTimeout(localize, 0));
})();
