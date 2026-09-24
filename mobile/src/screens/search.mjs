import { searchContent } from '../core/search.mjs';
import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

let lastQuery = '';

function groupLabel(kind, t) {
  if (kind === 'resource') return t('screen.library');
  if (kind === 'video') return t('screen.videos');
  return t('screen.actualidad');
}

function addEndBackButton(root, router, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'end-back-button';
  button.className = 'back-button';
  button.textContent = label;
  button.addEventListener('click', () => router.back());
  root.append(button);
  return button;
}

function renderResults(container, status, { content, preferences, t, query, onOpenResult, announce = true }) {
  container.replaceChildren();
  const results = searchContent(content, query, preferences.lang);

  status.textContent = results.length
    ? t('search.results').replace('{count}', String(results.length))
    : t('search.none');
  if (!announce) status.setAttribute('aria-live', 'off');
  else status.setAttribute('aria-live', 'polite');

  const grouped = new Map();
  for (const result of results) {
    if (!grouped.has(result.kind)) grouped.set(result.kind, []);
    grouped.get(result.kind).push(result);
  }

  for (const kind of ['resource', 'video', 'news']) {
    const items = grouped.get(kind) || [];
    if (!items.length) continue;

    const heading = document.createElement('h2');
    heading.textContent = groupLabel(kind, t);
    container.append(heading);

    const list = document.createElement('div');
    list.className = 'result-list';
    for (const result of items) {
      const item = document.createElement('article');
      item.className = 'result-card';

      const button = document.createElement('button');
      button.type = 'button';
      button.id = `result-${result.kind}-${result.id}`;
      button.className = 'result-title';
      button.textContent = result.title;
      button.addEventListener('click', () => {
        if (typeof onOpenResult === 'function') onOpenResult(result, button.id);
      });
      item.append(button);

      if (result.subtitle) addParagraph(item, result.subtitle, 'muted');
      list.append(item);
    }
    container.append(list);
  }
}

export function renderSearch({ root, router, content, preferences, t, onOpenResult = null, initialQuery = '' }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.search'), backLabel: t('nav.back') });

  const form = document.createElement('form');
  form.className = 'search-form';

  const label = document.createElement('label');
  const input = document.createElement('input');
  input.id = 'global-search-input';
  input.type = 'search';
  input.autocomplete = 'off';
  input.value = String(initialQuery || lastQuery || '').trim();
  input.placeholder = t('search.placeholder');
  label.htmlFor = input.id;
  label.textContent = t('search.label');

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('search.submit');

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.id = 'clear-search';
  clear.textContent = preferences?.lang === 'en' ? 'Clear search' : 'Borrar búsqueda';

  const status = document.createElement('p');
  status.className = 'muted';
  status.ariaLive = 'polite';
  status.ariaAtomic = 'true';

  const results = document.createElement('section');
  results.setAttribute('aria-label', t('search.resultsRegion'));

  form.append(label, input, submit, clear);
  root.append(form, status, results);
  addEndBackButton(root, router, t('nav.back'));

  form.addEventListener('submit', event => {
    event.preventDefault();
    lastQuery = input.value.trim();
    renderResults(results, status, { content, preferences, t, query: lastQuery, onOpenResult, announce: true });
  });

  clear.addEventListener('click', () => {
    input.value = '';
    lastQuery = '';
    status.textContent = '';
    results.replaceChildren();
    input.focus();
  });

  if (!initialQuery && lastQuery) {
    renderResults(results, status, { content, preferences, t, query: lastQuery, onOpenResult, announce: false });
  }
}

export function clearRememberedSearch() {
  lastQuery = '';
}
