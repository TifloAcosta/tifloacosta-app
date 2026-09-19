import { formatBytes } from '../core/downloads.mjs';
import {
  SOUND_CATEGORIES,
  buildProviderQuery,
  createSoundSearchClient,
  formatDuration,
  validateSearch
} from '../core/sound-search.mjs';
import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

const EXTERNAL_BANKS = Object.freeze([
  { name: 'Mixkit', url: 'https://mixkit.co/free-sound-effects/' },
  { name: 'Pixabay', url: 'https://pixabay.com/sound-effects/' }
]);

export function createPreviewController() {
  let active = null;
  return {
    activate(audio) {
      if (active && active !== audio) active.pause();
      active = audio;
    },
    stop() {
      if (active) active.pause();
      active = null;
    }
  };
}

export function renderSoundSearch({ root, router, t, nativeActions, setScreenCleanup }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('downloads.sounds'),
    backLabel: t('nav.back')
  });
  addParagraph(root, t('soundSearch.intro'));

  const previews = createPreviewController();
  setScreenCleanup(() => previews.stop());

  const form = document.createElement('form');
  const queryLabel = document.createElement('label');
  const queryInput = document.createElement('input');
  queryInput.id = 'sound-search-query';
  queryInput.type = 'search';
  queryInput.autocomplete = 'off';
  queryInput.placeholder = t('soundSearch.queryPlaceholder');
  queryLabel.htmlFor = queryInput.id;
  queryLabel.textContent = t('soundSearch.query');

  const categoryLabel = document.createElement('label');
  const categorySelect = document.createElement('select');
  categorySelect.id = 'sound-search-category';
  categoryLabel.htmlFor = categorySelect.id;
  categoryLabel.textContent = t('soundSearch.category');
  const all = document.createElement('option');
  all.value = '';
  all.textContent = t('soundSearch.allCategories');
  categorySelect.append(all);
  const language = document.documentElement.lang === 'en' ? 'en' : 'es';
  for (const [id, category] of Object.entries(SOUND_CATEGORIES)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = category[language] || category.es || id;
    categorySelect.append(option);
  }

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = t('soundSearch.search');
  form.append(queryLabel, queryInput, categoryLabel, categorySelect, submit);
  root.append(form);

  const status = document.createElement('p');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  root.append(status);

  const resultsSection = document.createElement('section');
  resultsSection.hidden = true;
  const resultsHeading = document.createElement('h2');
  resultsHeading.textContent = t('soundSearch.results');
  const results = document.createElement('div');
  resultsSection.append(resultsHeading, results);
  root.append(resultsSection);

  const externalSection = document.createElement('section');
  const externalHeading = document.createElement('h2');
  externalHeading.textContent = t('soundSearch.externalHeading');
  const externalIntro = document.createElement('p');
  externalIntro.textContent = t('soundSearch.externalIntro');
  externalSection.append(externalHeading, externalIntro);
  for (const bank of EXTERNAL_BANKS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${t('soundSearch.openBank')} ${bank.name}`;
    button.addEventListener('click', async () => {
      const opened = await nativeActions.openExternal(bank.url);
      if (!opened) status.textContent = t('soundSearch.unavailable');
    });
    externalSection.append(button);
  }
  root.append(externalSection);

  const client = createSoundSearchClient({ fetchFn: (...args) => window.fetch(...args) });

  function appendMeta(article, label, value) {
    if (value === null || value === undefined || value === '') return;
    const paragraph = document.createElement('p');
    paragraph.textContent = `${label}: ${value}`;
    article.append(paragraph);
  }

  function renderSound(item) {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = item.name;
    article.append(heading);

    if (item.duration !== null) appendMeta(article, t('soundSearch.duration'), formatDuration(item.duration));
    if (item.format) appendMeta(article, t('soundSearch.format'), String(item.format).toUpperCase());
    if (item.size !== null) appendMeta(article, t('soundSearch.size'), formatBytes(item.size));
    if (item.license) appendMeta(article, t('soundSearch.license'), item.license);
    if (item.author) appendMeta(article, t('soundSearch.author'), item.author);
    if (item.provider) appendMeta(article, t('soundSearch.source'), item.provider === 'freesound' ? 'Freesound' : item.provider);

    if (item.previewUrl) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = item.previewUrl;
      audio.setAttribute('aria-label', `${t('soundSearch.listen')}: ${item.name}`);
      audio.addEventListener('play', () => previews.activate(audio));
      audio.addEventListener('ended', () => previews.stop());
      article.append(audio);
    }

    if (item.pageUrl) {
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = `${t('soundSearch.openOriginal')}: ${item.name}`;
      open.addEventListener('click', async () => {
        const opened = await nativeActions.openExternal(item.pageUrl);
        if (!opened) status.textContent = t('soundSearch.unavailable');
      });
      article.append(open);
    }
    return article;
  }

  function renderResults(items) {
    previews.stop();
    results.replaceChildren();
    const safeItems = Array.isArray(items) ? items : [];
    resultsSection.hidden = false;
    if (!safeItems.length) {
      status.textContent = t('soundSearch.noResults');
      return;
    }
    safeItems.forEach(item => results.append(renderSound(item)));
    status.textContent = '';
  }

  async function search() {
    const valid = validateSearch(queryInput.value, categorySelect.value);
    if (!valid.ok) {
      resultsSection.hidden = true;
      status.textContent = t('soundSearch.needCriteria');
      return;
    }
    previews.stop();
    resultsSection.hidden = true;
    status.textContent = t('soundSearch.searching');
    const query = buildProviderQuery(valid.term, valid.category);
    try {
      const response = await client.search({
        term: valid.term,
        category: valid.category,
        query,
        page: 1
      });
      if (response.status === 'unavailable' || response.code === 'provider_unavailable') {
        status.textContent = t('soundSearch.unavailable');
        return;
      }
      if (response.status !== 'ok') {
        status.textContent = t('soundSearch.unavailable');
        return;
      }
      renderResults(response.items);
    } catch {
      status.textContent = t('soundSearch.unavailable');
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    void search();
  });
}
