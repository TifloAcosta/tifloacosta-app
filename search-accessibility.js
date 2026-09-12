(() => {
  'use strict';

  function enhanceResourceSearch() {
    const form = document.querySelector('#search-form');
    const results = document.querySelector('#resource-results');
    const status = document.querySelector('#result-status');
    const category = document.querySelector('#category');
    const favorites = document.querySelector('#favorites-button');
    const clear = document.querySelector('#clear-results');
    const langEs = document.querySelector('#lang-es');
    const langEn = document.querySelector('#lang-en');

    if (!form || !results || !status || !category || !favorites || !clear) return;
    if (form.dataset.accessibleSearchFlow === 'true') return;
    form.dataset.accessibleSearchFlow = 'true';

    const exploreSection = category.closest('section');
    const exploreActions = clear.parentElement;
    if (!exploreSection || !exploreActions) return;

    const searchSlot = document.createElement('div');
    searchSlot.id = 'search-results-accessible';
    searchSlot.hidden = true;
    form.insertAdjacentElement('afterend', searchSlot);

    function moveToSearch() {
      searchSlot.hidden = false;
      searchSlot.append(results, status, clear);
    }

    function moveToExplore() {
      searchSlot.hidden = true;
      exploreActions.append(clear);
      exploreSection.append(status, results);
    }

    form.addEventListener('submit', () => {
      moveToSearch();
    });

    category.addEventListener('change', moveToExplore);
    favorites.addEventListener('click', moveToExplore);
    clear.addEventListener('click', moveToExplore);
    if (langEs) langEs.addEventListener('click', moveToExplore);
    if (langEn) langEn.addEventListener('click', moveToExplore);
  }

  function enhanceVideoSearch() {
    const controls = document.querySelector('#video-controls-section');
    const form = document.querySelector('#video-search-form');
    const search = document.querySelector('#video-search');
    const clear = document.querySelector('#video-clear');
    const sort = document.querySelector('.video-sort-control');
    const results = document.querySelector('#video-results-section');

    if (!controls || !form || !search || !clear || !sort || !results) return;
    if (form.dataset.accessibleSearchFlow === 'true') return;
    form.dataset.accessibleSearchFlow = 'true';

    controls.insertBefore(sort, form);

    const clearRow = document.createElement('div');
    clearRow.className = 'inline-actions video-clear-row';
    clearRow.append(clear);
    controls.insertBefore(clearRow, form);
    clear.hidden = !search.value.trim();

    form.addEventListener('submit', () => {
      clear.hidden = !search.value.trim();
    });

    clear.addEventListener('click', () => {
      clear.hidden = true;
    });
  }

  function init() {
    enhanceResourceSearch();
    enhanceVideoSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
