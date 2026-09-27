import { createReadingSearchIndex } from '../core/reading-search.mjs';

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

export function createReadingSearchPanel({ root, documentModel, t, onPreview, onContinue }) {
  const section = document.createElement('section');
  section.className = 'reading-panel reading-search-panel';
  section.hidden = true;

  const heading = document.createElement('h2');
  heading.textContent = t('readingBook.search');

  const form = document.createElement('form');
  form.className = 'reading-search-form';
  const label = document.createElement('label');
  label.textContent = t('readingBook.searchLabel');
  const input = document.createElement('input');
  input.type = 'search';
  input.autocomplete = 'off';
  input.id = 'reading-document-search';
  label.htmlFor = input.id;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('readingBook.search');
  form.append(label, input, submit);

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const results = document.createElement('ul');
  results.className = 'reading-search-results';

  section.append(heading, form, status, results);
  root.append(section);

  const index = createReadingSearchIndex(documentModel, { yieldEvery: 100 });
  let destroyed = false;
  const ready = index.build().catch(() => null);

  function clearResults() {
    results.replaceChildren();
  }

  function resultLabel(result) {
    const parts = [];
    if (result.heading) parts.push(result.heading);
    if (result.excerpt) parts.push(result.excerpt);
    return parts.join('. ');
  }

  async function runSearch() {
    await ready;
    if (destroyed) return;
    const query = input.value.trim();
    clearResults();
    if (!query) {
      status.textContent = t('readingBook.searchEmpty');
      return;
    }
    const found = index.search(query, { limit: 100 });
    status.textContent = format(t('readingBook.searchResults'), { count: found.total });
    for (const result of found.results) {
      const item = document.createElement('li');
      const text = document.createElement('p');
      text.textContent = resultLabel(result);

      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.textContent = t('readingBook.previewResult');
      previewButton.addEventListener('click', () => {
        onPreview?.({ blockIndex: result.blockIndex, unitIndex: result.unitIndex, result });
      });

      const continueButton = document.createElement('button');
      continueButton.type = 'button';
      continueButton.textContent = t('readingBook.continueFromResult');
      continueButton.addEventListener('click', () => {
        onContinue?.({ blockIndex: result.blockIndex, unitIndex: result.unitIndex, result });
      });

      item.append(text, previewButton, continueButton);
      results.append(item);
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    void runSearch();
  });

  function open() {
    section.hidden = false;
    queueMicrotask(() => input.focus());
  }

  function close() {
    section.hidden = true;
  }

  function destroy() {
    destroyed = true;
    section.remove();
  }

  return { open, close, destroy, element: section };
}
