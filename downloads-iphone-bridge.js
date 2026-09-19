(() => {
  'use strict';

  const labels = {
    es: {
      linkReceived: 'Enlace recibido. Pulsa Analizar enlace.',
      linkActivated: 'Botón Analizar activado. Validando enlace…',
      soundReceived: 'Consulta de sonidos recibida. Pulsa Buscar sonidos.',
      soundActivated: 'Botón Buscar sonidos activado. Buscando sonidos…'
    },
    en: {
      linkReceived: 'Link received. Press Analyze link.',
      linkActivated: 'Analyze button activated. Validating link…',
      soundReceived: 'Sound search received. Press Search sounds.',
      soundActivated: 'Search sounds button activated. Searching sounds…'
    }
  };

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function announce(statusId, message) {
    const status = document.getElementById(statusId);
    if (!status) return;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'assertive');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = '';
    window.setTimeout(() => { status.textContent = message; }, 20);
  }

  function connectDownload() {
    const form = document.getElementById('download-form');
    const input = document.getElementById('download-url');
    const button = document.getElementById('download-analyze');
    if (!form || !input || !button) return false;
    if (button.dataset.iphoneBridge === 'true') return true;
    button.dataset.iphoneBridge = 'true';

    input.addEventListener('input', () => {
      if (String(input.value || '').trim()) announce('download-status', labels[language()].linkReceived);
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      announce('download-status', labels[language()].linkActivated);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    return true;
  }

  function connectSounds() {
    const form = document.getElementById('sound-search-form');
    const input = document.getElementById('sound-query');
    const button = document.getElementById('sound-search-submit');
    if (!form || !input || !button) return false;
    if (button.dataset.iphoneBridge === 'true') return true;
    button.dataset.iphoneBridge = 'true';

    input.addEventListener('input', () => {
      if (String(input.value || '').trim()) announce('sound-status', labels[language()].soundReceived);
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      announce('sound-status', labels[language()].soundActivated);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    return true;
  }

  function connectAll() {
    return connectDownload() && connectSounds();
  }

  if (!connectAll()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (connectAll() || attempts >= 40) window.clearInterval(timer);
    }, 100);
  }
})();
