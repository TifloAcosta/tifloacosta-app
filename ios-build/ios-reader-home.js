(() => {
  'use strict';
  // Only included in the iOS package. Do not change the public web/Android UI.
  const reader = document.getElementById('reading-section');
  if (!reader || document.getElementById('ios-reading-import')) return;
  const english = () => document.documentElement.lang === 'en';
  const tr = (es, en) => english() ? en : es;
  const file = document.getElementById('reading-file');
  const fileLabel = document.getElementById('reading-file-label');
  const importPanel = file?.closest('.panel');
  if (!file || !importPanel) return;
  const importButton = document.createElement('button');
  importButton.id = 'ios-reading-import';
  importButton.type = 'button';
  importButton.textContent = tr('Importar', 'Import');
  // The direct user gesture is needed for WKWebView's document picker.
  importButton.addEventListener('click', () => file.click());
  file.insertAdjacentElement('beforebegin', importButton);
  file.hidden = true;
  file.style.display = 'none';
  file.tabIndex = -1;
  file.setAttribute('aria-hidden', 'true');
  if (fileLabel) fileLabel.hidden = true;
  const importHeading = document.getElementById('reading-start-heading');
  if (importHeading) importHeading.hidden = true;
  const intro = document.getElementById('reading-intro');
  if (intro) intro.hidden = true;

  const library = document.getElementById('reading-library-web');
  const libraryFilter = document.getElementById('reading-library-filter');
  const queryLabel = document.getElementById('reading-library-query-label');
  if (!library || !libraryFilter || !queryLabel) return;
  const libraryIntro = document.getElementById('reading-library-intro');
  if (libraryIntro) libraryIntro.hidden = true;

  // The existing persistent library remains the source of truth. Only this
  // presentation and the sort criterion change in the iOS package.
  const sortLabel = document.createElement('label');
  sortLabel.htmlFor = 'ios-reading-library-sort';
  sortLabel.textContent = tr('Ordenar documentos por', 'Sort documents by');
  const sort = document.createElement('select');
  sort.id = 'ios-reading-library-sort';
  for (const [value, es, en] of [
    ['', 'Automático', 'Automatic'],
    ['imported', 'Fecha de importación', 'Import date'],
    ['title', 'Título', 'Title'],
    ['author', 'Autor', 'Author'],
    ['lastRead', 'Última lectura', 'Last read']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = tr(es, en);
    sort.append(option);
  }
  queryLabel.before(sortLabel, sort);
  try {
    const savedFilter = localStorage.getItem('tiflo-ios-library-filter');
    if ([...libraryFilter.options].some(option => option.value === savedFilter)) {
      libraryFilter.value = savedFilter;
    }
    const savedSort = localStorage.getItem('tiflo-ios-library-sort');
    if ([...sort.options].some(option => option.value === savedSort)) {
      sort.value = savedSort;
    }
  } catch {}
  libraryFilter.addEventListener('change', () => {
    try { localStorage.setItem('tiflo-ios-library-filter', libraryFilter.value); } catch {}
  });
  sort.addEventListener('change', () => {
    try { localStorage.setItem('tiflo-ios-library-sort', sort.value); } catch {}
    // Uses the existing library re-render and resets page position.
    libraryFilter.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Restore the filter even if the reader rendered before this iOS-only script.
  queueMicrotask(() => libraryFilter.dispatchEvent(new Event('change', { bubbles: true })));
  document.getElementById('lang-es')?.addEventListener('click', () => {
    importButton.textContent = 'Importar';
    sortLabel.textContent = 'Ordenar documentos por';
  });
  document.getElementById('lang-en')?.addEventListener('click', () => {
    importButton.textContent = 'Import';
    sortLabel.textContent = 'Sort documents by';
  });
})();
