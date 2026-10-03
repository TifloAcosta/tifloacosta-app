import { READING_SETTING_DEFAULTS, resolveReadingSettings } from '../core/reading-settings.mjs';
import { TifloReading } from '../native/reading-library-plugin.mjs';
import { renderReadingQueue } from './reading-queue.mjs';
import { addScreenHeader, clearScreen } from './shared.mjs';

const PAGE_SIZE = 10;
const FORMATS = ['txt', 'html', 'pdf', 'epub', 'docx', 'pptx', 'xlsx', 'daisy2.02', 'daisy3', 'audio'];

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

function fallback(t, key, es, en) {
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return document.documentElement.lang === 'en' ? en : es;
}

function batchHasResults(batch) {
  return Boolean(
    batch && (
      (Array.isArray(batch.imported) && batch.imported.length) ||
      (Array.isArray(batch.duplicates) && batch.duplicates.length) ||
      (Array.isArray(batch.rejected) && batch.rejected.length)
    )
  );
}

function importSummary(batch, t) {
  if (!batchHasResults(batch)) return '';
  if (batch.rejected?.some(item => item?.reason === 'ambiguous-audio-order')) {
    return t('readingLibrary.audioOrderAmbiguous');
  }
  if (batch.rejected?.some(item => item?.reason === 'duplicate-audio-track')) {
    return t('readingLibrary.audioDuplicateTrack');
  }
  return format(t('readingLibrary.importSummary'), {
    imported: batch.imported?.length || 0,
    duplicates: batch.duplicates?.length || 0,
    rejected: batch.rejected?.length || 0
  });
}

function stateLabel(book, t) {
  if (book?.state === 'read') return t('readingLibrary.stateRead');
  if (book?.state === 'in-reading') return t('readingLibrary.stateInReading');
  return t('readingLibrary.stateNotRead');
}

function progressLabel(book, t) {
  return format(t('readingLibrary.progress'), {
    percent: Math.round(Math.max(0, Math.min(100, Number(book?.percent) || 0)))
  });
}

function makeButton(label, onClick, className = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function formatLabel(value) {
  const clean = String(value || '').trim().toUpperCase();
  if (clean === 'AUDIO') return 'Audio';
  if (clean === 'DAISY2.02') return 'DAISY 2.02';
  if (clean === 'DAISY3') return 'DAISY 3';
  return clean;
}

export function renderReadingLibrary({
  root,
  router,
  client,
  t,
  onOpenBook,
  initialImportBatch = null
}) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('screen.readingLibrary'),
    backLabel: t('nav.back')
  });

  let page = 1;
  let query = '';
  let statusFilter = 'all';
  let formatFilter = '';
  let sortSelect = 'lastRead';
  let listGeneration = 0;
  let currentImportBatch = initialImportBatch;
  let queueController = null;

  const liveStatus = document.createElement('p');
  liveStatus.className = 'reading-library-status';
  liveStatus.setAttribute('role', 'status');
  liveStatus.setAttribute('aria-live', 'polite');
  liveStatus.setAttribute('aria-atomic', 'true');
  if (batchHasResults(currentImportBatch)) liveStatus.textContent = importSummary(currentImportBatch, t);

  // Search is deliberately first in the reading-library flow.
  const searchForm = document.createElement('form');
  searchForm.className = 'reading-library-search';
  const searchLabel = document.createElement('label');
  searchLabel.htmlFor = 'reading-library-query';
  searchLabel.textContent = t('readingLibrary.searchLabel');
  const searchInput = document.createElement('input');
  searchInput.id = 'reading-library-query';
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchInput.placeholder = t('readingLibrary.searchPlaceholder');
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.textContent = t('readingLibrary.searchSubmit');
  searchForm.append(searchLabel, searchInput, searchButton);
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    query = searchInput.value.trim();
    page = 1;
    void refreshList();
  });
  root.append(searchForm);

  // Continue reading follows search.
  const continueSection = document.createElement('section');
  continueSection.className = 'reading-library-continue';
  const continueHeading = document.createElement('h2');
  continueHeading.textContent = t('readingLibrary.continueReading');
  const continueContent = document.createElement('div');
  continueSection.append(continueHeading, continueContent);
  root.append(continueSection);

  // Queue follows Continue and is always explicit; it never auto-opens a book.
  const queueSection = document.createElement('section');
  queueSection.className = 'reading-library-queue';
  const queueLabel = t('readingLibrary.queue');
  queueSection.setAttribute('aria-label', queueLabel === 'readingLibrary.queue'
    ? fallback(t, 'readingLibrary.queue', 'Cola de lectura', 'Reading queue')
    : queueLabel);
  root.append(queueSection);
  queueController = renderReadingQueue({ root: queueSection, client, t, onOpenBook });

  // Import follows the queue.
  const importSection = document.createElement('section');
  importSection.className = 'reading-library-import-section';
  const importButton = makeButton(t('readingLibrary.import'), async () => {
    importButton.disabled = true;
    const batch = await client.pickDocuments();
    importButton.disabled = false;
    if (batch?.cancelled) return;
    if (batch?.audioChoiceRequired) {
      renderAudioChoice(batch);
      return;
    }
    await applyImportBatch(batch);
  });
  importButton.id = 'reading-library-import';
  const importFormats = document.createElement('p');
  importFormats.className = 'muted';
  importFormats.textContent = document.documentElement.lang === 'en'
    ? 'Supports Word (DOCX), PowerPoint (PPTX), Excel (XLSX), EPUB, PDF, TXT, HTML, DAISY and audio.'
    : 'Admite Word (DOCX), PowerPoint (PPTX), Excel (XLSX), EPUB, PDF, TXT, HTML, DAISY y audio.';
  importSection.append(importButton, importFormats, liveStatus);

  const audioChoiceHost = document.createElement('section');
  audioChoiceHost.className = 'reading-library-audio-choice';
  audioChoiceHost.hidden = true;
  importSection.append(audioChoiceHost);

  const openNowHost = document.createElement('div');
  openNowHost.className = 'reading-library-open-now';
  importSection.append(openNowHost);
  root.append(importSection);

  function renderOpenNow() {
    openNowHost.replaceChildren();
    const imported = Array.isArray(currentImportBatch?.imported) ? currentImportBatch.imported : [];
    if (imported.length === 1) {
      const book = imported[0];
      openNowHost.append(makeButton(t('readingLibrary.openNow'), () => onOpenBook?.(book.id)));
    }
  }

  async function applyImportBatch(batch) {
    audioChoiceHost.hidden = true;
    audioChoiceHost.replaceChildren();
    if (batch?.cancelled) return;
    currentImportBatch = batch;
    liveStatus.textContent = importSummary(batch, t);
    page = 1;
    await refresh();
  }

  function renderAudioChoice(batch) {
    audioChoiceHost.replaceChildren();
    audioChoiceHost.hidden = false;
    const heading = document.createElement('h2');
    heading.textContent = t('readingLibrary.audioGroupHeading');
    const explanation = document.createElement('p');
    explanation.textContent = t('readingLibrary.audioGroupQuestion');
    audioChoiceHost.append(heading, explanation);

    const names = Array.isArray(batch?.selectedNames) ? batch.selectedNames : [];
    if (names.length) {
      const list = document.createElement('ul');
      for (const name of names) {
        const item = document.createElement('li');
        item.textContent = name;
        list.append(item);
      }
      audioChoiceHost.append(list);
    }

    const selectionId = String(batch?.selectionId ?? '');
    const runChoice = async mode => {
      for (const button of audioChoiceHost.querySelectorAll('button')) button.disabled = true;
      liveStatus.textContent = t('readingLibrary.audioGroupProcessing');
      const result = await client.resolveAudioSelection({ selectionId, mode });
      liveStatus.textContent = '';
      await applyImportBatch(result);
      importButton.focus();
    };

    const grouped = makeButton(t('readingLibrary.audioGroupOneBook'), () => { void runChoice('grouped'); });
    const independent = makeButton(t('readingLibrary.audioGroupIndependent'), () => { void runChoice('independent'); });
    const cancel = makeButton(t('readingLibrary.audioGroupCancel'), () => { void runChoice('cancel'); });
    audioChoiceHost.append(grouped, independent, cancel);
    queueMicrotask(() => grouped.focus());
  }

  renderOpenNow();

  // Filters follow import.
  const filtersSection = document.createElement('section');
  const filtersHeading = document.createElement('h2');
  filtersHeading.textContent = t('readingLibrary.filtersHeading') === 'readingLibrary.filtersHeading'
    ? fallback(t, 'readingLibrary.filtersHeading', 'Filtros y orden', 'Filters and sorting')
    : t('readingLibrary.filtersHeading');
  filtersSection.append(filtersHeading);

  const filterForm = document.createElement('form');
  filterForm.className = 'reading-library-filters';

  const statusLabel = document.createElement('label');
  statusLabel.htmlFor = 'reading-library-status-filter';
  statusLabel.textContent = fallback(t, 'readingLibrary.statusFilter', 'Estado', 'Status');
  const statusSelect = document.createElement('select');
  statusSelect.id = 'reading-library-status-filter';
  statusSelect.append(
    makeOption('all', fallback(t, 'readingLibrary.filterAll', 'Todos', 'All')),
    makeOption('in-reading', fallback(t, 'readingLibrary.filterInReading', 'En lectura', 'Reading')),
    makeOption('not-read', fallback(t, 'readingLibrary.filterNotRead', 'Sin leer', 'Not read')),
    makeOption('read', fallback(t, 'readingLibrary.filterRead', 'Leídos', 'Read'))
  );

  const formatFilterLabel = document.createElement('label');
  formatFilterLabel.htmlFor = 'reading-library-format-filter';
  formatFilterLabel.textContent = fallback(t, 'readingLibrary.formatFilter', 'Formato', 'Format');
  const formatSelect = document.createElement('select');
  formatSelect.id = 'reading-library-format-filter';
  formatSelect.append(makeOption('', fallback(t, 'readingLibrary.formatAll', 'Todos los formatos', 'All formats')));
  for (const value of FORMATS) formatSelect.append(makeOption(value, formatLabel(value)));

  const sortLabel = document.createElement('label');
  sortLabel.htmlFor = 'reading-library-sort';
  sortLabel.textContent = fallback(t, 'readingLibrary.sortLabel', 'Ordenar por', 'Sort by');
  const sortControl = document.createElement('select');
  sortControl.id = 'reading-library-sort';
  sortControl.append(
    makeOption('title', fallback(t, 'readingLibrary.sortTitle', 'Título', 'Title')),
    makeOption('author', fallback(t, 'readingLibrary.sortAuthor', 'Autor', 'Author')),
    makeOption('imported', fallback(t, 'readingLibrary.sortImported', 'Importación reciente', 'Recent import')),
    makeOption('lastRead', fallback(t, 'readingLibrary.sortLastRead', 'Lectura reciente', 'Recent reading'))
  );
  sortControl.value = sortSelect;

  const applyFilters = makeButton(fallback(t, 'readingLibrary.applyFilters', 'Aplicar', 'Apply'), () => {
    statusFilter = statusSelect.value;
    formatFilter = formatSelect.value;
    sortSelect = sortControl.value;
    page = 1;
    void refreshList();
  });
  filterForm.append(statusLabel, statusSelect, formatFilterLabel, formatSelect, sortLabel, sortControl, applyFilters);
  filtersSection.append(filterForm);
  root.append(filtersSection);

  // Global reading settings follow filters and are persisted immediately.
  const settingsSection = document.createElement('section');
  const settingsHeading = document.createElement('h2');
  settingsHeading.textContent = t('readingLibrary.settings') === 'readingLibrary.settings'
    ? fallback(t, 'readingLibrary.settings', 'Ajustes de lectura', 'Reading settings')
    : t('readingLibrary.settings');
  const settingsToggle = makeButton(
    fallback(t, 'readingLibrary.openSettings', 'Configurar ajustes de lectura', 'Configure reading settings'),
    () => {
      settingsPanel.hidden = !settingsPanel.hidden;
      settingsToggle.setAttribute('aria-expanded', String(!settingsPanel.hidden));
      if (!settingsPanel.hidden) void loadGlobalSettings();
    }
  );
  settingsToggle.setAttribute('aria-expanded', 'false');
  const settingsPanel = document.createElement('div');
  settingsPanel.hidden = true;

  function settingSelect(id, labelText, values) {
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const control = document.createElement('select');
    control.id = id;
    for (const [value, optionLabel] of values) control.append(makeOption(String(value), optionLabel));
    return { label, control };
  }

  const voiceLabel = document.createElement('label');
  voiceLabel.htmlFor = 'reading-library-global-voice';
  voiceLabel.textContent = t('readingBook.voice');
  const voiceSelect = document.createElement('select');
  voiceSelect.id = 'reading-library-global-voice';

  const { label: rateLabel, control: rateSelect } = settingSelect(
    'reading-library-global-rate', t('readingBook.speed'),
    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(value => [value, `${value}×`])
  );
  const { label: audioSpeedLabel, control: audioSpeedSelect } = settingSelect(
    'reading-library-global-audio-speed',
    document.documentElement.lang === 'en' ? 'Audiobook speed' : 'Velocidad de audiolibros',
    [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map(value => [value, `${value}×`])
  );
  const { label: skipLabel, control: skipSelect } = settingSelect(
    'reading-library-global-audio-skip',
    document.documentElement.lang === 'en' ? 'Audio skip interval' : 'Intervalo de salto de audio',
    [10, 30, 60].map(value => [value, `${value} s`])
  );
  const { label: textSizeLabel, control: textSizeSelect } = settingSelect(
    'reading-library-global-text-size',
    t('readingBook.textSize'),
    [[0.75, '75 %'], [0.9, '90 %'], [1, '100 %'], [1.25, '125 %'], [1.5, '150 %'], [2, '200 %']]
  );
  const { label: fontFamilyLabel, control: fontFamilySelect } = settingSelect(
    'reading-library-global-font-family',
    t('readingBook.fontFamily'),
    [['system', t('readingBook.fontSystem')], ['serif', t('readingBook.fontSerif')], ['sans-serif', t('readingBook.fontSans')], ['monospace', t('readingBook.fontMono')]]
  );
  const { label: fontWeightLabel, control: fontWeightSelect } = settingSelect(
    'reading-library-global-font-weight',
    t('readingBook.fontWeight'),
    [['normal', t('readingBook.weightNormal')], ['medium', t('readingBook.weightMedium')], ['bold', t('readingBook.weightBold')]]
  );
  const { label: lineSpacingLabel, control: lineSpacingSelect } = settingSelect(
    'reading-library-global-line-spacing', t('readingBook.lineSpacing'),
    [1, 1.5, 2, 2.5].map(value => [value, String(value)])
  );
  const { label: paragraphSpacingLabel, control: paragraphSpacingSelect } = settingSelect(
    'reading-library-global-paragraph-spacing', t('readingBook.paragraphSpacing'),
    [0, 1, 2, 3].map(value => [value, String(value)])
  );
  const { label: readingWidthLabel, control: readingWidthSelect } = settingSelect(
    'reading-library-global-reading-width', t('readingBook.readingWidth'),
    [[45, t('readingBook.widthNarrow')], [72, t('readingBook.widthNormal')], [100, t('readingBook.widthWide')]]
  );
  const { label: foregroundLabel, control: foregroundSelect } = settingSelect(
    'reading-library-global-foreground',
    document.documentElement.lang === 'en' ? 'Text colour' : 'Color del texto',
    [['', document.documentElement.lang === 'en' ? 'System text colour' : 'Color de texto del sistema'], ['#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro'], ['#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco'], ['#1f2937', document.documentElement.lang === 'en' ? 'Dark grey' : 'Gris oscuro'], ['#ffff00', document.documentElement.lang === 'en' ? 'Yellow' : 'Amarillo']]
  );
  const { label: backgroundLabel, control: backgroundSelect } = settingSelect(
    'reading-library-global-background',
    document.documentElement.lang === 'en' ? 'Background colour' : 'Color del fondo',
    [['', document.documentElement.lang === 'en' ? 'System background' : 'Fondo del sistema'], ['#ffffff', document.documentElement.lang === 'en' ? 'White' : 'Blanco'], ['#000000', document.documentElement.lang === 'en' ? 'Black' : 'Negro'], ['#fff7cc', document.documentElement.lang === 'en' ? 'Cream' : 'Crema'], ['#111827', document.documentElement.lang === 'en' ? 'Dark' : 'Oscuro']]
  );
  const { label: themeLabel, control: themeSelect } = settingSelect(
    'reading-library-global-theme', t('readingBook.theme'),
    [['system', t('readingBook.themeSystem')], ['light', t('readingBook.themeLight')], ['dark', t('readingBook.themeDark')]]
  );
  const highContrast = document.createElement('input');
  highContrast.type = 'checkbox';
  highContrast.id = 'reading-library-global-high-contrast';
  const highContrastLabel = document.createElement('label');
  highContrastLabel.htmlFor = highContrast.id;
  highContrastLabel.textContent = t('readingBook.highContrast');

  const settingsStatus = document.createElement('p');
  settingsStatus.setAttribute('role', 'status');
  settingsStatus.setAttribute('aria-live', 'polite');
  settingsStatus.setAttribute('aria-atomic', 'true');
  const resetSettings = makeButton(
    document.documentElement.lang === 'en' ? 'Reset global reading settings' : 'Restablecer ajustes generales de lectura',
    () => { void resetReadingDefaults(); }
  );

  settingsPanel.append(
    voiceLabel, voiceSelect, rateLabel, rateSelect, audioSpeedLabel, audioSpeedSelect, skipLabel, skipSelect,
    textSizeLabel, textSizeSelect, fontFamilyLabel, fontFamilySelect, fontWeightLabel, fontWeightSelect,
    lineSpacingLabel, lineSpacingSelect, paragraphSpacingLabel, paragraphSpacingSelect, readingWidthLabel, readingWidthSelect,
    foregroundLabel, foregroundSelect, backgroundLabel, backgroundSelect, themeLabel, themeSelect,
    highContrast, highContrastLabel, resetSettings, settingsStatus
  );
  settingsSection.append(settingsHeading, settingsToggle, settingsPanel);
  root.append(settingsSection);

  const globalSettingControls = new Map([
    ['speech.voice', voiceSelect],
    ['speech.rate', rateSelect],
    ['audio.speed', audioSpeedSelect],
    ['audio.skipSeconds', skipSelect],
    ['visual.textSize', textSizeSelect],
    ['visual.fontFamily', fontFamilySelect],
    ['visual.fontWeight', fontWeightSelect],
    ['visual.lineSpacing', lineSpacingSelect],
    ['visual.paragraphSpacing', paragraphSpacingSelect],
    ['visual.readingWidth', readingWidthSelect],
    ['visual.foreground', foregroundSelect],
    ['visual.background', backgroundSelect],
    ['visual.highContrast', highContrast],
    ['visual.theme', themeSelect]
  ]);

  for (const [key, control] of globalSettingControls) {
    control.addEventListener('change', () => { void persistGlobalSetting(key, control); });
  }

  async function persistGlobalSetting(key, control) {
    const value = control.type === 'checkbox' ? control.checked : control.value;
    const saved = await client.setReadingSetting({ scope: 'global', key, value: String(value) });
    settingsStatus.textContent = saved
      ? t('readingBook.settingsSaved')
      : fallback(t, 'readingLibrary.settingsFailed', 'No se pudieron guardar los ajustes.', 'The settings could not be saved.');
    return saved;
  }

  async function resetReadingDefaults() {
    resetSettings.disabled = true;
    const results = await Promise.all(Object.entries(READING_SETTING_DEFAULTS).map(([key, value]) =>
      client.setReadingSetting({ scope: 'global', key, value: String(value) })
    ));
    resetSettings.disabled = false;
    await loadGlobalSettings();
    settingsStatus.textContent = results.every(Boolean)
      ? (document.documentElement.lang === 'en' ? 'Global reading settings reset.' : 'Ajustes generales de lectura restablecidos.')
      : fallback(t, 'readingLibrary.settingsFailed', 'No se pudieron guardar los ajustes.', 'The settings could not be saved.');
  }

  async function loadGlobalSettings() {
    const [settings, voices] = await Promise.all([
      client.getReadingSettings(''),
      client.listTtsVoices()
    ]);
    voiceSelect.replaceChildren();
    voiceSelect.append(makeOption('', t('readingBook.voiceDefault')));
    for (const voice of voices) {
      const label = voice.name || voice.locale || voice.id;
      voiceSelect.append(makeOption(voice.id, label));
    }
    const effective = resolveReadingSettings(settings?.global || {}, {}, { availableVoices: voices }).effective;
    for (const [key, control] of globalSettingControls) {
      if (control.type === 'checkbox') control.checked = Boolean(effective[key]);
      else control.value = String(effective[key] ?? '');
    }
  }

  // My library is deliberately last.
  const librarySection = document.createElement('section');
  const libraryHeading = document.createElement('h2');
  libraryHeading.textContent = t('readingLibrary.myLibrary');
  librarySection.append(libraryHeading);

  const list = document.createElement('div');
  list.className = 'content-list reading-library-list';
  librarySection.append(list);

  const pagination = document.createElement('nav');
  pagination.className = 'reading-library-pagination';
  pagination.setAttribute('aria-label', t('readingLibrary.pagination'));
  librarySection.append(pagination);
  root.append(librarySection);

  async function refreshLatest() {
    const book = await client.getLatestInProgress();
    continueContent.replaceChildren();
    if (!book) {
      continueSection.hidden = true;
      return;
    }
    continueSection.hidden = false;
    const button = makeButton(book.title || t('readingLibrary.untitled'), () => onOpenBook?.(book.id));
    const detail = document.createElement('p');
    detail.className = 'muted';
    detail.textContent = `${stateLabel(book, t)}. ${progressLabel(book, t)}`;
    continueContent.append(button, detail);
  }

  async function updateMetadata(options) {
    if (typeof client.updateBookMetadata === 'function') return client.updateBookMetadata(options);
    return TifloReading.updateBookMetadata(options);
  }

  function renderBook(item) {
    const article = document.createElement('article');
    article.className = 'content-card reading-library-item';

    const title = makeButton(item.title || t('readingLibrary.untitled'), () => onOpenBook?.(item.id), 'reading-library-title');
    article.append(title);

    const detail = document.createElement('p');
    detail.className = 'muted';
    const author = item.author ? `${item.author}. ` : '';
    detail.textContent = `${author}${formatLabel(item.format)}. ${stateLabel(item, t)}. ${progressLabel(item, t)}`;
    article.append(detail);

    const options = makeButton(
      format(t('readingLibrary.options'), { title: item.title || t('readingLibrary.untitled') }),
      () => {
        const expanded = options.getAttribute('aria-expanded') === 'true';
        options.setAttribute('aria-expanded', String(!expanded));
        actions.hidden = expanded;
        if (expanded) confirmHost.replaceChildren();
      }
    );
    options.setAttribute('aria-expanded', 'false');
    article.append(options);

    const actions = document.createElement('div');
    actions.className = 'reading-library-item-actions';
    actions.hidden = true;
    const confirmHost = document.createElement('div');

    const queueButton = makeButton(
      item.queued
        ? fallback(t, 'readingLibrary.removeFromQueue', 'Quitar de la cola', 'Remove from queue')
        : fallback(t, 'readingLibrary.addToQueue', 'Añadir a la cola', 'Add to queue'),
      async () => {
        queueButton.disabled = true;
        const changed = item.queued
          ? await client.removeFromQueue(item.id)
          : await client.addToQueue(item.id);
        liveStatus.textContent = changed
          ? fallback(t, 'readingLibrary.queueUpdated', 'Cola actualizada.', 'Queue updated.')
          : fallback(t, 'readingLibrary.queueFailed', 'No se pudo actualizar la cola.', 'The queue could not be updated.');
        await refresh();
      }
    );

    const stateField = document.createElement('div');
    const stateSelectLabel = document.createElement('label');
    stateSelectLabel.htmlFor = `reading-state-${item.id}`;
    stateSelectLabel.textContent = fallback(t, 'readingLibrary.changeState', 'Cambiar estado', 'Change status');
    const stateSelect = document.createElement('select');
    stateSelect.id = `reading-state-${item.id}`;
    stateSelect.append(
      makeOption('not-read', t('readingLibrary.stateNotRead')),
      makeOption('in-reading', t('readingLibrary.stateInReading')),
      makeOption('read', t('readingLibrary.stateRead'))
    );
    stateSelect.value = item.state;
    const saveState = makeButton(fallback(t, 'readingLibrary.saveState', 'Guardar estado', 'Save status'), async () => {
      saveState.disabled = true;
      const saved = await updateMetadata({ ...item, state: stateSelect.value });
      liveStatus.textContent = saved
        ? fallback(t, 'readingLibrary.metadataSaved', 'Cambios guardados.', 'Changes saved.')
        : fallback(t, 'readingLibrary.metadataFailed', 'No se pudieron guardar los cambios.', 'The changes could not be saved.');
      await refresh();
    });
    stateField.append(stateSelectLabel, stateSelect, saveState);

    const info = document.createElement('details');
    const infoSummary = document.createElement('summary');
    infoSummary.textContent = fallback(t, 'readingLibrary.information', 'Información', 'Information');
    const infoText = document.createElement('p');
    infoText.textContent = [
      item.author ? `${fallback(t, 'readingLibrary.author', 'Autor', 'Author')}: ${item.author}` : '',
      `${fallback(t, 'readingLibrary.format', 'Formato', 'Format')}: ${formatLabel(item.format)}`,
      item.language ? `${fallback(t, 'readingLibrary.language', 'Idioma', 'Language')}: ${item.language}` : ''
    ].filter(Boolean).join('. ');
    info.append(infoSummary, infoText);

    const rename = document.createElement('details');
    const renameSummary = document.createElement('summary');
    renameSummary.textContent = fallback(t, 'readingLibrary.rename', 'Cambiar título', 'Rename');
    const renameForm = document.createElement('form');
    const renameLabel = document.createElement('label');
    renameLabel.htmlFor = `reading-rename-${item.id}`;
    renameLabel.textContent = fallback(t, 'readingLibrary.newTitle', 'Nuevo título', 'New title');
    const renameInput = document.createElement('input');
    renameInput.id = `reading-rename-${item.id}`;
    renameInput.value = item.title || '';
    const renameSave = document.createElement('button');
    renameSave.type = 'submit';
    renameSave.textContent = fallback(t, 'readingLibrary.saveRename', 'Guardar título', 'Save title');
    renameForm.append(renameLabel, renameInput, renameSave);
    renameForm.addEventListener('submit', event => {
      event.preventDefault();
      void (async () => {
        const nextTitle = renameInput.value.trim();
        if (!nextTitle) {
          renameInput.focus();
          return;
        }
        renameSave.disabled = true;
        const saved = await updateMetadata({ ...item, title: nextTitle });
        liveStatus.textContent = saved
          ? fallback(t, 'readingLibrary.metadataSaved', 'Cambios guardados.', 'Changes saved.')
          : fallback(t, 'readingLibrary.metadataFailed', 'No se pudieron guardar los cambios.', 'The changes could not be saved.');
        await refresh();
      })();
    });
    rename.append(renameSummary, renameForm);

    const deleteButton = makeButton(t('readingLibrary.delete'), () => {
      confirmHost.replaceChildren();
      const confirm = makeButton(
        format(t('readingLibrary.confirmDelete'), { title: item.title || t('readingLibrary.untitled') }),
        async () => {
          confirm.disabled = true;
          const deleted = await client.deleteBook(item.id);
          if (!deleted) {
            confirm.disabled = false;
            liveStatus.textContent = t('readingLibrary.deleteFailed');
            return;
          }
          liveStatus.textContent = t('readingLibrary.deleted');
          await refresh();
        }
      );
      const cancel = makeButton(t('readingLibrary.cancelDelete'), () => confirmHost.replaceChildren());
      confirmHost.append(confirm, cancel);
    });

    actions.append(queueButton, stateField, info, rename, deleteButton, confirmHost);
    article.append(actions);
    return article;
  }

  function renderPagination(result) {
    pagination.replaceChildren();
    const pages = Math.max(1, Number(result?.pages) || 1);
    const currentPage = Math.min(pages, Math.max(1, Number(result?.page) || page));
    page = currentPage;

    const previous = makeButton(t('readingLibrary.previousPage'), () => {
      if (page <= 1) return;
      page -= 1;
      void refreshList();
    });
    previous.disabled = page <= 1;

    const pageStatus = document.createElement('span');
    pageStatus.className = 'reading-library-page-status';
    pageStatus.textContent = format(t('readingLibrary.pageStatus'), { page, pages });

    const next = makeButton(t('readingLibrary.nextPage'), () => {
      if (page >= pages) return;
      page += 1;
      void refreshList();
    });
    next.disabled = page >= pages;

    pagination.append(previous, pageStatus, next);
  }

  async function refreshList() {
    const generation = ++listGeneration;
    const result = await client.listBooks({
      page,
      pageSize: PAGE_SIZE,
      query,
      status: statusFilter,
      format: formatFilter,
      sort: sortSelect
    });
    if (generation !== listGeneration) return;

    list.replaceChildren();
    if (!result.items?.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = t('readingLibrary.empty');
      list.append(empty);
    } else {
      for (const item of result.items) list.append(renderBook(item));
    }
    renderPagination(result);
  }

  async function refresh() {
    renderOpenNow();
    await Promise.all([refreshLatest(), refreshList(), queueController?.refresh?.()]);
  }

  void refresh();
}
