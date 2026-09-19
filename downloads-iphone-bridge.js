(() => {
  'use strict';

  const labels = {
    es: {
      received: 'Enlace recibido. Pulsa Analizar enlace.',
      activated: 'Botón Analizar activado. Validando enlace…',
      missing: 'Diagnóstico: el formulario de Descargas no está disponible.'
    },
    en: {
      received: 'Link received. Press Analyze link.',
      activated: 'Analyze button activated. Validating link…',
      missing: 'Diagnostic: the Downloads form is not available.'
    }
  };

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function announce(message) {
    const status = document.getElementById('download-status');
    if (!status) return;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'assertive');
    status.setAttribute('aria-atomic', 'true');
    status.textContent = '';
    window.setTimeout(() => { status.textContent = message; }, 20);
  }

  function connect() {
    const form = document.getElementById('download-form');
    const input = document.getElementById('download-url');
    const button = document.getElementById('download-analyze');
    if (!form || !input || !button) {
      announce(labels[language()].missing);
      return false;
    }
    if (button.dataset.iphoneBridge === 'true') return true;
    button.dataset.iphoneBridge = 'true';

    input.addEventListener('input', () => {
      if (String(input.value || '').trim()) announce(labels[language()].received);
    });

    button.addEventListener('click', event => {
      event.preventDefault();
      announce(labels[language()].activated);
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    return true;
  }

  if (!connect()) {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (connect() || attempts >= 40) window.clearInterval(timer);
    }, 100);
  }
})();
