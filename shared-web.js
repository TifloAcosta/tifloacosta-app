(function () {
  'use strict';

  async function startTifloReader() {
    try {
      const shared = await import('./shared/web-entry.mjs?v=1.0');
      window.TIFLO_SHARED = shared;

      const script = document.createElement('script');
      script.src = 'web-reading.js?v=1.6';
      script.defer = true;
      script.dataset.tifloReader = 'true';
      document.head.append(script);
    } catch (error) {
      console.error('No se pudo iniciar TifloLector.', error);
      const status = document.getElementById('reading-status');
      if (status) {
        status.textContent = document.documentElement.lang === 'en'
          ? 'TifloReader could not be initialized.'
          : 'No se pudo inicializar TifloLector.';
      }
    }
  }

  void startTifloReader();
}());
