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

    const title = makeButton(item.title || t('readingLibrary.untitled'), () => {
      const expanded = title.getAttribute('aria-expanded') === 'true';
      title.setAttribute('aria-expanded', String(!expanded));
      details.hidden = expanded;
      if (!expanded) {
        queueMicrotask(() => detailsHeading.focus());
        if (!timeLoaded) void loadEstimatedTimes();
      }
    }, 'reading-library-title');
    title.setAttribute('aria-expanded', 'false');
    article.append(title);

    const details = document.createElement('section');
    details.className = 'reading-library-item-details';
    details.hidden = true;
    const detailsHeading = document.createElement('h3');
    detailsHeading.tabIndex = -1;
    detailsHeading.textContent = item.title || t('readingLibrary.untitled');

    const detail = document.createElement('p');
    detail.className = 'muted';
    const author = item.author ? `${item.author}. ` : '';
    detail.textContent = `${author}${formatLabel(item.format)}. ${stateLabel(item, t)}. ${progressLabel(item, t)}`;

    const progressLabelElement = document.createElement('label');
    progressLabelElement.textContent = fallback(t, 'readingLibrary.progressLabel', 'Progreso de lectura', 'Reading progress');
    const progress = document.createElement('progress');
    progress.id = `reading-library-progress-${item.id}`;
    progress.max = 100;
    progress.value = Math.max(0, Math.min(100, Number(item.percent) || 0));
    progressLabelElement.htmlFor = progress.id;

    const timeStatus = document.createElement('p');
    timeStatus.className = 'muted';
    timeStatus.textContent = fallback(
      t,
      'readingLibrary.timeCalculating',
      'Tiempo realizado y tiempo faltante: calculando…',
      'Elapsed and remaining time: calculating…'
    );
    let timeLoaded = false;

    function readableDuration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
    }

    function countWords(value) {
      if (typeof value === 'string') return value.trim().split(/\s+/u).filter(Boolean).length;
      if (Array.isArray(value)) return value.reduce((sum, entry) => sum + countWords(entry), 0);
      if (value && typeof value === 'object') return Object.values(value).reduce((sum, entry) => sum + countWords(entry), 0);
      return 0;
    }

    async function loadEstimatedTimes() {
      timeLoaded = true;
      try {
        const opened = await client.openBook(item.id);
        const words = countWords(opened?.content) + countWords(opened?.pdf);
        if (!words) throw new Error('no-words');
        const settings = await client.getReadingSettings(item.id);
        const rate = Number(settings?.book?.['speech.rate'] || settings?.global?.['speech.rate'] || 1) || 1;
        const totalSeconds = Math.round((words / Math.max(60, 180 * rate)) * 60);
        const percent = Math.max(0, Math.min(100, Number(item.percent) || 0));
        const elapsed = Math.round(totalSeconds * percent / 100);
        const remaining = Math.max(0, totalSeconds - elapsed);
        timeStatus.textContent = document.documentElement.lang === 'en'
          ? `Elapsed: about ${readableDuration(elapsed)}. Remaining: about ${readableDuration(remaining)}.`
          : `Tiempo realizado: aproximadamente ${readableDuration(elapsed)}. Tiempo faltante: aproximadamente ${readableDuration(remaining)}.`;
      } catch {
        timeStatus.textContent = document.documentElement.lang === 'en'
          ? 'Elapsed and remaining time could not be estimated for this document.'
          : 'No se pudo estimar el tiempo realizado y el tiempo faltante de este documento.';
      }
    }

    const jumpLabel = document.createElement('label');
    jumpLabel.textContent = document.documentElement.lang === 'en' ? 'Open at position' : 'Abrir en posición';
    const jumpSelect = document.createElement('select');
    jumpSelect.id = `reading-library-jump-${item.id}`;
    jumpLabel.htmlFor = jumpSelect.id;
    for (let value = 0; value <= 100; value += 10) {
      jumpSelect.append(makeOption(value, `${value} %`));
    }
    jumpSelect.value = String(Math.max(0, Math.min(100, Math.round((Number(item.percent) || 0) / 10) * 10)));
    jumpSelect.addEventListener('change', () => onOpenBook?.(item.id, Number(jumpSelect.value) || 0));

    const groupButtons = document.createElement('div');
    groupButtons.className = 'reading-library-item-groups';

    const audioButton = makeButton(
      document.documentElement.lang === 'en' ? 'Audio and voice' : 'Audio y voz',
      () => { void openAudioPanel(); }
    );
    const visualButton = makeButton(
      document.documentElement.lang === 'en' ? 'Visual presentation' : 'Presentación visual',
      () => { void openVisualPanel(); }
    );
    const moreButton = makeButton(
      document.documentElement.lang === 'en' ? 'More actions' : 'Más acciones',
      () => openPanel(morePanel, moreHeading, moreButton)
    );
    for (const button of [audioButton, visualButton, moreButton]) button.setAttribute('aria-expanded', 'false');
    groupButtons.append(audioButton, visualButton, moreButton);

    const audioPanel = document.createElement('section');
    audioPanel.hidden = true;
    const audioHeading = document.createElement('h4');
    audioHeading.tabIndex = -1;
    audioHeading.textContent = audioButton.textContent;
    const voiceLabel = document.createElement('label');
    voiceLabel.textContent = document.documentElement.lang === 'en' ? 'Voice for this document' : 'Voz para este documento';
    const voiceSelect = document.createElement('select');
    voiceSelect.id = `reading-library-voice-${item.id}`;
    voiceLabel.htmlFor = voiceSelect.id;
    const rateLabel = document.createElement('label');
    rateLabel.textContent = document.documentElement.lang === 'en' ? 'Speed for this document' : 'Velocidad para este documento';
    const rateSelect = document.createElement('select');
    rateSelect.id = `reading-library-rate-${item.id}`;
    rateLabel.htmlFor = rateSelect.id;
    for (const value of [0.5,0.75,1,1.25,1.5,1.75,2]) rateSelect.append(makeOption(value, `${value}×`));
    const audioStatus = document.createElement('p');
    audioStatus.className = 'muted';
    const closeAudio = makeButton(
      document.documentElement.lang === 'en' ? 'Back to book details' : 'Volver a los datos del libro',
      () => closePanel(audioPanel, audioButton)
    );
    audioPanel.append(audioHeading, voiceLabel, voiceSelect, rateLabel, rateSelect, audioStatus, closeAudio);

    const visualPanel = document.createElement('section');
    visualPanel.hidden = true;
    const visualHeading = document.createElement('h4');
    visualHeading.tabIndex = -1;
    visualHeading.textContent = visualButton.textContent;
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = document.documentElement.lang === 'en' ? 'Text size' : 'Tamaño del texto';
    const sizeSelect = document.createElement('select');
    sizeSelect.id = `reading-library-size-${item.id}`;
    sizeLabel.htmlFor = sizeSelect.id;
    for (const [value,label] of [['0.9','90 %'],['1','100 %'],['1.25','125 %'],['1.5','150 %'],['2','200 %']]) sizeSelect.append(makeOption(value,label));
    const themeLabel = document.createElement('label');
    themeLabel.textContent = document.documentElement.lang === 'en' ? 'Theme' : 'Tema';
    const themeSelect = document.createElement('select');
    themeSelect.id = `reading-library-theme-${item.id}`;
    themeLabel.htmlFor = themeSelect.id;
    for (const [value,es,en] of [['system','Sistema','System'],['light','Claro','Light'],['dark','Oscuro','Dark']]) {
      themeSelect.append(makeOption(value, document.documentElement.lang === 'en' ? en : es));
    }
    const contrast = document.createElement('input');
    contrast.type = 'checkbox';
    contrast.id = `reading-library-contrast-${item.id}`;
    const contrastLabel = document.createElement('label');
    contrastLabel.htmlFor = contrast.id;
    contrastLabel.textContent = document.documentElement.lang === 'en' ? 'High contrast' : 'Alto contraste';
    const visualStatus = document.createElement('p');
    visualStatus.className = 'muted';
    const closeVisual = makeButton(
      document.documentElement.lang === 'en' ? 'Back to book details' : 'Volver a los datos del libro',
      () => closePanel(visualPanel, visualButton)
    );
    visualPanel.append(visualHeading, sizeLabel, sizeSelect, themeLabel, themeSelect, contrast, contrastLabel, visualStatus, closeVisual);

    const morePanel = document.createElement('section');
    morePanel.hidden = true;
    const moreHeading = document.createElement('h4');
    moreHeading.tabIndex = -1;
    moreHeading.textContent = moreButton.textContent;

    const openBook = makeButton(
      fallback(t, 'readingLibrary.open', 'Abrir para leer', 'Open for reading'),
      () => onOpenBook?.(item.id)
    );

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

    const closeMore = makeButton(
      document.documentElement.lang === 'en' ? 'Back to book details' : 'Volver a los datos del libro',
      () => closePanel(morePanel, moreButton)
    );
    morePanel.append(moreHeading, openBook, queueButton, stateField, info, rename, deleteButton, confirmHost, closeMore);

    function openPanel(panel, heading, opener) {
      for (const other of [audioPanel, visualPanel, morePanel]) other.hidden = other !== panel;
      panel.hidden = false;
      for (const button of [audioButton, visualButton, moreButton]) button.setAttribute('aria-expanded', String(button === opener));
      queueMicrotask(() => heading.focus());
    }
    function closePanel(panel, opener) {
      panel.hidden = true;
      opener.setAttribute('aria-expanded', 'false');
      opener.focus();
    }

    async function openAudioPanel() {
      const [settings, voices] = await Promise.all([
        client.getReadingSettings(item.id),
        client.listTtsVoices()
      ]);
      voiceSelect.replaceChildren();
      voiceSelect.append(makeOption('', document.documentElement.lang === 'en' ? 'Use general voice' : 'Usar voz general'));
      for (const voice of voices) voiceSelect.append(makeOption(voice.id, voice.name || voice.locale || voice.id));
      voiceSelect.value = settings?.book?.['speech.voice'] || '';
      rateSelect.value = String(settings?.book?.['speech.rate'] || settings?.global?.['speech.rate'] || 1);
      openPanel(audioPanel, audioHeading, audioButton);
    }

    async function openVisualPanel() {
      const settings = await client.getReadingSettings(item.id);
      sizeSelect.value = String(settings?.book?.['visual.textSize'] || settings?.global?.['visual.textSize'] || 1);
      themeSelect.value = settings?.book?.['visual.theme'] || settings?.global?.['visual.theme'] || 'system';
      contrast.checked = String(settings?.book?.['visual.highContrast'] ?? settings?.global?.['visual.highContrast'] ?? 'false') === 'true';
      openPanel(visualPanel, visualHeading, visualButton);
    }

    voiceSelect.addEventListener('change', async () => {
      const saved = await client.setReadingSetting({ scope:'book', bookId:item.id, key:'speech.voice', value:voiceSelect.value });
      audioStatus.textContent = saved ? (document.documentElement.lang === 'en' ? 'Voice saved.' : 'Voz guardada.') : (document.documentElement.lang === 'en' ? 'Voice could not be saved.' : 'No se pudo guardar la voz.');
    });
    rateSelect.addEventListener('change', async () => {
      const saved = await client.setReadingSetting({ scope:'book', bookId:item.id, key:'speech.rate', value:rateSelect.value });
      audioStatus.textContent = saved ? (document.documentElement.lang === 'en' ? 'Speed saved.' : 'Velocidad guardada.') : (document.documentElement.lang === 'en' ? 'Speed could not be saved.' : 'No se pudo guardar la velocidad.');
    });
    sizeSelect.addEventListener('change', async () => {
      const saved = await client.setReadingSetting({ scope:'book', bookId:item.id, key:'visual.textSize', value:sizeSelect.value });
      visualStatus.textContent = saved ? (document.documentElement.lang === 'en' ? 'Visual setting saved.' : 'Ajuste visual guardado.') : (document.documentElement.lang === 'en' ? 'Setting could not be saved.' : 'No se pudo guardar el ajuste.');
    });
    themeSelect.addEventListener('change', async () => {
      const saved = await client.setReadingSetting({ scope:'book', bookId:item.id, key:'visual.theme', value:themeSelect.value });
      visualStatus.textContent = saved ? (document.documentElement.lang === 'en' ? 'Visual setting saved.' : 'Ajuste visual guardado.') : (document.documentElement.lang === 'en' ? 'Setting could not be saved.' : 'No se pudo guardar el ajuste.');
    });
    contrast.addEventListener('change', async () => {
      const saved = await client.setReadingSetting({ scope:'book', bookId:item.id, key:'visual.highContrast', value:String(contrast.checked) });
      visualStatus.textContent = saved ? (document.documentElement.lang === 'en' ? 'Visual setting saved.' : 'Ajuste visual guardado.') : (document.documentElement.lang === 'en' ? 'Setting could not be saved.' : 'No se pudo guardar el ajuste.');
    });

    const close = makeButton(
      fallback(t, 'readingLibrary.backToTitles', 'Volver a los títulos de la biblioteca', 'Back to library titles'),
      () => {
        details.hidden = true;
        title.setAttribute('aria-expanded', 'false');
        title.focus();
      }
    );

    details.append(
      detailsHeading,
      detail,
      progressLabelElement,
      progress,
      timeStatus,
      jumpLabel,
      jumpSelect,
      groupButtons,
      audioPanel,
      visualPanel,
      morePanel,
      close
    );
    article.append(details);
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
