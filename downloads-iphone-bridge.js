(() => {
  'use strict';

  const labels = {
    es: {
      linkReceived: 'Enlace recibido. Pulsa Analizar enlace.',
      soundReceived: 'Consulta de sonidos recibida. Pulsa Buscar sonidos.',
      downloadResults: 'Archivos encontrados'
    },
    en: {
      linkReceived: 'Link received. Press Analyze link.',
      soundReceived: 'Sound search received. Press Search sounds.',
      downloadResults: 'Files found'
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
    status.textContent = message;
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
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    return true;
  }

  function connectDownloadResults() {
    const section = document.getElementById('download-results-section');
    const count = document.getElementById('download-result-count');
    const heading = document.getElementById('download-results-heading');
    if (!section || !count || !heading) return false;
    if (section.dataset.iphoneResultBridge === 'true') return true;
    section.dataset.iphoneResultBridge = 'true';

    const announceResults = () => {
      if (section.hidden) return;
      const countText = String(count.textContent || '').trim();
      if (!countText) return;
      heading.textContent = `${labels[language()].downloadResults}. ${countText}`;
      heading.focus();
    };

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.type === 'attributes' && mutation.attributeName === 'hidden')) {
        queueMicrotask(announceResults);
      }
    });
    observer.observe(section, { attributes: true, attributeFilter: ['hidden'] });
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
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    return true;
  }

  function connectAll() {
    return connectDownload() && connectDownloadResults() && connectSounds();
  }

  if (!connectAll()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (connectAll() || attempts >= 40) window.clearInterval(timer);
    }, 100);
  }
})();
