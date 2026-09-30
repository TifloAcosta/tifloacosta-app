import { createReadingTranslationJob } from '../core/reading-translation.mjs';

function text(t, key, es, en) {
  const translated = typeof t === 'function' ? t(key) : '';
  if (translated && translated !== key) return translated;
  return document.documentElement.lang === 'en' ? en : es;
}

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    String(template ?? '')
  );
}

function cleanLanguage(value) {
  return String(value ?? '').trim().toLowerCase();
}

function languageLabel(code) {
  const normalized = cleanLanguage(code);
  if (!normalized) return '';
  try {
    const locale = document.documentElement.lang === 'en' ? 'en' : 'es';
    const display = new Intl.DisplayNames([locale], { type: 'language' });
    return display.of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

function sampleText(documentModel) {
  return (Array.isArray(documentModel?.blocks) ? documentModel.blocks : [])
    .map(block => String(block?.text ?? '').trim())
    .filter(Boolean)
    .slice(0, 8)
    .join('\n')
    .slice(0, 4000);
}

export function createReadingTranslationPanel({
  root,
  client,
  translationClient,
  book,
  documentModel,
  sourceSha256 = '',
  t,
  onTranslationReady,
  returnFocus
}) {
  const section = document.createElement('section');
  section.className = 'reading-panel reading-translation-panel';
  section.hidden = true;
  section.setAttribute('aria-labelledby', 'reading-translation-heading');

  const heading = document.createElement('h2');
  heading.id = 'reading-translation-heading';
  heading.tabIndex = -1;
  heading.textContent = text(t, 'readingBook.translationHeading', 'Traducir documento', 'Translate document');

  const explanation = document.createElement('p');
  explanation.textContent = text(
    t,
    'readingBook.translationExplanation',
    'La traducción se realiza en el dispositivo. El original se conserva y podrás cambiar entre ambas versiones sin perder tu posición de lectura.',
    'Translation runs on the device. The original is preserved and you can switch between both versions without losing your reading position.'
  );

  const sourceLabel = document.createElement('label');
  sourceLabel.textContent = text(t, 'readingBook.translationSource', 'Idioma original', 'Source language');
  const sourceSelect = document.createElement('select');
  sourceSelect.id = 'reading-translation-source';
  sourceLabel.htmlFor = sourceSelect.id;

  const targetLabel = document.createElement('label');
  targetLabel.textContent = text(t, 'readingBook.translationTarget', 'Traducir a', 'Translate to');
  const targetSelect = document.createElement('select');
  targetSelect.id = 'reading-translation-target';
  targetLabel.htmlFor = targetSelect.id;

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.textContent = text(t, 'readingBook.translationDownloadModels', 'Descargar idiomas', 'Download languages');

  const translateButton = document.createElement('button');
  translateButton.type = 'button';
  translateButton.textContent = text(t, 'readingBook.translationStart', 'Traducir', 'Translate');
  translateButton.disabled = true;

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = text(t, 'readingBook.translationResume', 'Continuar traducción', 'Resume translation');
  resumeButton.hidden = true;

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = text(t, 'readingBook.translationCancel', 'Detener después de este lote', 'Stop after this batch');
  cancelButton.hidden = true;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = text(t, 'readingBook.translationClose', 'Cerrar', 'Close');

  const progress = document.createElement('p');
  progress.className = 'reading-translation-progress';
  progress.setAttribute('role', 'status');
  progress.setAttribute('aria-live', 'polite');
  progress.setAttribute('aria-atomic', 'true');

  section.append(
    heading,
    explanation,
    sourceLabel,
    sourceSelect,
    targetLabel,
    targetSelect,
    downloadButton,
    translateButton,
    resumeButton,
    cancelButton,
    closeButton,
    progress
  );
  root.append(section);

  let destroyed = false;
  let languages = [];
  let detectedLanguage = cleanLanguage(documentModel?.language || book?.language);
  let job = null;
  let modelsReady = false;
  let running = false;
  let cancelRequested = false;

  function combinedClient() {
    return {
      getDerivedContent: options => client?.getDerivedContent?.(options),
      saveDerivedContent: options => client?.saveDerivedContent?.(options),
      translateBatch: options => translationClient?.translateBatch?.(options)
    };
  }

  function fillLanguages() {
    const currentSource = cleanLanguage(sourceSelect.value || detectedLanguage);
    const currentTarget = cleanLanguage(targetSelect.value);
    sourceSelect.replaceChildren();
    targetSelect.replaceChildren();

    for (const code of languages) {
      const sourceOption = document.createElement('option');
      sourceOption.value = code;
      sourceOption.textContent = `${languageLabel(code)} (${code})`;
      sourceSelect.append(sourceOption);

      const targetOption = document.createElement('option');
      targetOption.value = code;
      targetOption.textContent = `${languageLabel(code)} (${code})`;
      targetSelect.append(targetOption);
    }

    if (languages.includes(currentSource)) sourceSelect.value = currentSource;
    else if (languages.includes(detectedLanguage)) sourceSelect.value = detectedLanguage;

    if (languages.includes(currentTarget)) targetSelect.value = currentTarget;
    else {
      const interfaceLanguage = document.documentElement.lang === 'en' ? 'en' : 'es';
      const preferred = languages.find(code => code === interfaceLanguage && code !== sourceSelect.value)
        || languages.find(code => code !== sourceSelect.value)
        || '';
      targetSelect.value = preferred;
    }
  }

  function statusText(state) {
    const completed = Number(state?.completedUnits) || 0;
    const total = Number(state?.totalUnits) || 0;
    if (state?.status === 'complete') {
      return format(
        text(t, 'readingBook.translationComplete', 'Traducción completa: {completed} de {total} bloques.', 'Translation complete: {completed} of {total} blocks.'),
        { completed, total }
      );
    }
    if (state?.status === 'model-unavailable') {
      return text(
        t,
        'readingBook.translationModelUnavailable',
        'Falta un modelo de idioma. Descarga los idiomas y vuelve a continuar.',
        'A language model is missing. Download the languages and resume.'
      );
    }
    if (state?.status === 'error') {
      return text(t, 'readingBook.translationError', 'No se pudo continuar la traducción.', 'Translation could not continue.');
    }
    if (state?.status === 'translating') {
      return format(
        text(t, 'readingBook.translationWorking', 'Traduciendo: {completed} de {total} bloques guardados.', 'Translating: {completed} of {total} blocks saved.'),
        { completed, total }
      );
    }
    return format(
      text(t, 'readingBook.translationProgress', 'Traducción: {completed} de {total} bloques guardados.', 'Translation: {completed} of {total} blocks saved.'),
      { completed, total }
    );
  }

  function renderState(state = job?.getState?.()) {
    if (!state) return;
    progress.textContent = statusText(state);
    const complete = state.status === 'complete';
    resumeButton.hidden = complete || state.completedUnits === 0 || running;
    translateButton.hidden = complete || state.completedUnits > 0;
    cancelButton.hidden = !running;
    if (state.completedUnits > 0) onTranslationReady?.(state.document, state);
  }

  function resetJob() {
    const sourceLanguage = cleanLanguage(sourceSelect.value);
    const targetLanguage = cleanLanguage(targetSelect.value);
    job = createReadingTranslationJob({
      client: combinedClient(),
      bookId: book?.id,
      document: documentModel,
      sourceLanguage,
      targetLanguage,
      sourceSha256: String(sourceSha256 || book?.sha256 || book?.sourceSha256 || book?.updatedAt || book?.id || ''),
      batchSize: 20,
      onProgress: state => {
        if (!destroyed) renderState(state);
      }
    });
  }

  async function loadJob() {
    resetJob();
    const state = await job.load();
    if (destroyed) return state;
    renderState(state);
    return state;
  }

  async function load() {
    progress.textContent = text(t, 'readingBook.translationLoading', 'Preparando idiomas…', 'Preparing languages…');
    languages = await translationClient?.listTranslationLanguages?.() || [];
    if (destroyed) return;
    if (!detectedLanguage) {
      detectedLanguage = cleanLanguage(await translationClient?.identifyLanguage?.(sampleText(documentModel)));
      if (detectedLanguage === 'und') detectedLanguage = '';
    }
    languages = [...new Set(languages.map(cleanLanguage).filter(Boolean))].sort();
    fillLanguages();
    modelsReady = false;
    translateButton.disabled = true;
    downloadButton.disabled = !sourceSelect.value || !targetSelect.value || sourceSelect.value === targetSelect.value;
    await loadJob();
  }

  async function downloadModels() {
    const sourceLanguage = cleanLanguage(sourceSelect.value);
    const targetLanguage = cleanLanguage(targetSelect.value);
    if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) {
      progress.textContent = text(
        t,
        'readingBook.translationChooseLanguages',
        'Selecciona dos idiomas distintos.',
        'Select two different languages.'
      );
      return false;
    }
    downloadButton.disabled = true;
    translateButton.disabled = true;
    progress.textContent = text(t, 'readingBook.translationDownloading', 'Descargando idiomas…', 'Downloading languages…');
    const [sourceReady, targetReady] = await Promise.all([
      translationClient?.downloadTranslationModel?.(sourceLanguage),
      translationClient?.downloadTranslationModel?.(targetLanguage)
    ]);
    if (destroyed) return false;
    modelsReady = Boolean(sourceReady && targetReady);
    downloadButton.disabled = false;
    translateButton.disabled = !modelsReady;
    progress.textContent = modelsReady
      ? text(t, 'readingBook.translationModelsReady', 'Idiomas preparados. Ya puedes traducir.', 'Languages are ready. You can translate now.')
      : text(t, 'readingBook.translationDownloadError', 'No se pudieron preparar los idiomas.', 'The language models could not be prepared.');
    return modelsReady;
  }

  async function runTranslation() {
    if (running) return;
    if (!modelsReady) {
      progress.textContent = text(
        t,
        'readingBook.translationDownloadFirst',
        'Descarga primero los idiomas necesarios.',
        'Download the required languages first.'
      );
      downloadButton.focus();
      return;
    }
    if (!job) await loadJob();
    running = true;
    cancelRequested = false;
    translateButton.disabled = true;
    resumeButton.hidden = true;
    cancelButton.hidden = false;
    try {
      let state = job.getState();
      while (!destroyed && !cancelRequested && state.status !== 'complete') {
        state = await job.resumeNext();
        if (state.status === 'error' || state.status === 'model-unavailable') break;
      }
      if (!destroyed) {
        renderState(state);
        if (cancelRequested && state.status !== 'complete') {
          progress.textContent = `${statusText(state)} ${text(
            t,
            'readingBook.translationStopped',
            'Traducción detenida. Puedes continuar más tarde.',
            'Translation stopped. You can resume later.'
          )}`;
        }
      }
    } finally {
      running = false;
      if (!destroyed) {
        cancelButton.hidden = true;
        const state = job?.getState?.();
        resumeButton.hidden = !state || state.status === 'complete' || state.completedUnits === 0;
      }
    }
  }

  function close() {
    section.hidden = true;
    returnFocus?.();
  }

  function open() {
    section.hidden = false;
    queueMicrotask(() => heading.focus());
    void load();
  }

  sourceSelect.addEventListener('change', () => {
    modelsReady = false;
    translateButton.disabled = true;
    downloadButton.disabled = !sourceSelect.value || !targetSelect.value || sourceSelect.value === targetSelect.value;
    void loadJob();
  });
  targetSelect.addEventListener('change', () => {
    modelsReady = false;
    translateButton.disabled = true;
    downloadButton.disabled = !sourceSelect.value || !targetSelect.value || sourceSelect.value === targetSelect.value;
    void loadJob();
  });
  downloadButton.addEventListener('click', () => { void downloadModels(); });
  translateButton.addEventListener('click', () => { void runTranslation(); });
  resumeButton.addEventListener('click', () => { void runTranslation(); });
  cancelButton.addEventListener('click', () => {
    cancelRequested = true;
    cancelButton.disabled = true;
    progress.textContent = text(
      t,
      'readingBook.translationStopping',
      'Se detendrá al terminar el lote actual…',
      'Translation will stop after the current batch…'
    );
  });
  closeButton.addEventListener('click', close);

  function destroy() {
    destroyed = true;
    cancelRequested = true;
    section.remove();
  }

  return { open, close, load, destroy, focus: () => heading.focus?.() };
}
