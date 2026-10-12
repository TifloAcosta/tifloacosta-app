(() => {
  'use strict';
  const button = document.getElementById('news-refresh-button');
  const status = document.getElementById('news-refresh-status');
  if (!button || !status) return;
  function english() { return document.documentElement.lang === 'en'; }
  function labels() {
    button.textContent = english() ? 'Refresh what is new' : 'Actualizar novedades';
  }
  labels();
  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(labels, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(labels, 0));
  button.addEventListener('click', () => {
    status.textContent = english() ? 'Checking the published catalog…' : 'Comprobando el catálogo publicado…';
    window.dispatchEvent(new Event('tiflo-refresh-novedades-request'));
  });
  window.addEventListener('tiflo-refresh-novedades-result', event => {
    const { ok, newestDate, source } = event.detail || {};
    if (!ok) {
      status.textContent = english()
        ? 'Could not check for new publications. The saved catalog is still available.'
        : 'No se pudieron comprobar las nuevas publicaciones. Se conserva el catálogo guardado.';
      return;
    }
    let last = '';
    if (Number.isFinite(Date.parse(newestDate || ''))) {
      last = new Intl.DateTimeFormat(english() ? 'en' : 'es', { dateStyle: 'long' }).format(new Date(newestDate));
    }
    const fallback = source === 'mobile-feed';
    status.textContent = english()
      ? (last
        ? (fallback ? 'Publications loaded. Latest publication: ' : 'Catalog checked. Latest publication: ') + last + '.'
        : (fallback ? 'Saved publications loaded.' : 'Catalog checked. No new publications were found.'))
      : (last
        ? (fallback ? 'Novedades cargadas. Última publicación: ' : 'Catálogo comprobado. Última publicación: ') + last + '.'
        : (fallback ? 'Se han cargado las novedades guardadas.' : 'Catálogo comprobado. No hay nuevas publicaciones.'));
  });
})();
