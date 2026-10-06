import { parseHtmlDocument } from '../core/reading-html-adapter.mjs';
import { pageForPosition, parsePdfDocument, positionForPage } from '../core/reading-pdf-adapter.mjs';
import { adjacentSemanticBlockOfKind, adjacentSemanticUnit, normalizeSemanticPosition, parseTextDocument } from '../core/reading-semantic-model.mjs';
import { createReadingSpeechController } from '../core/reading-speech.mjs';
import { parseStructuredDocument } from '../core/reading-structured-adapter.mjs';
import { createReadingAudioView } from './reading-audio.mjs';
import { createReadingMarksPanel } from './reading-marks.mjs';
import { createReadingOcrPanel } from './reading-ocr-panel.mjs';
import { createReadingSearchPanel } from './reading-search.mjs';
import { createReadingSettingsPanel } from './reading-settings.mjs';
import { createReadingTranslationControls } from './reading-translation-controls.mjs';
import { clearScreen } from './shared.mjs';

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

function semanticNavigationLabel(t, kind, direction) {
  const previous = Number(direction) < 0;
  switch (kind) {
    case 'sentence':
      return t(previous ? 'readingBook.previousSentence' : 'readingBook.nextSentence');
    case 'heading':
      return fallback(
        t,
        previous ? 'readingBook.previousHeading' : 'readingBook.nextHeading',
        previous ? 'Encabezado anterior' : 'Encabezado siguiente',
        previous ? 'Previous heading' : 'Next heading'
      );
    case 'listItem':
      return fallback(
        t,
        previous ? 'readingBook.previousListItem' : 'readingBook.nextListItem',
        previous ? 'Elemento de lista anterior' : 'Elemento de lista siguiente',
        previous ? 'Previous list item' : 'Next list item'
      );
    case 'quote':
      return fallback(
        t,
        previous ? 'readingBook.previousQuote' : 'readingBook.nextQuote',
        previous ? 'Cita anterior' : 'Cita siguiente',
        previous ? 'Previous quote' : 'Next quote'
      );
    case 'tableCell':
      return fallback(
        t,
        previous ? 'readingBook.previousTableCell' : 'readingBook.nextTableCell',
        previous ? 'Celda de tabla anterior' : 'Celda de tabla siguiente',
        previous ? 'Previous table cell' : 'Next table cell'
      );
    case 'page':
      return t(previous ? 'readingLibrary.previousPage' : 'readingLibrary.nextPage');
    case 'paragraph':
    default:
      return t(previous ? 'readingBook.previousParagraph' : 'readingBook.nextParagraph');
  }
}

function parseStructuredPayload(value) {
  try {
    const parsed = JSON.parse(String(value ?? ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function unitsFor(block) {
  const sentences = Array.isArray(block?.sentences)
    ? block.sentences.map(value => String(value ?? '').trim()).filter(Boolean)
    : [];
  if (sentences.length) return sentences;
  const text = String(block?.text ?? '').trim();
  return text ? [text] : [];
}

function getCurrentUnitText(documentModel, position) {
  const block = documentModel?.blocks?.[position?.blockIndex];
  return unitsFor(block)[position?.unitIndex] || String(block?.text ?? '').trim();
}

function previousUnit(documentModel, position) {
  return adjacentSemanticUnit(documentModel, position, -1).position;
}

function nextUnit(documentModel, position) {
  return adjacentSemanticUnit(documentModel, position, 1).position;
}

function semanticElement(block) {
  switch (block?.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(2, Number(block.level) || 2));
      return document.createElement(`h${level}`);
    }
    case 'list-item': return document.createElement('li');
    case 'quote': return document.createElement('blockquote');
    case 'table-cell': {
      const element = document.createElement('p');
      element.className = 'reading-table-cell';
      return element;
    }
    case 'paragraph':
    default: return document.createElement('p');
  }
}

function percentForPosition(documentModel, position) {
  const blocks = Array.isArray(documentModel?.blocks) ? documentModel.blocks : [];
  if (!blocks.length) return 0;
  let total = 0;
  let completed = 0;
  blocks.forEach((block, blockIndex) => {
    const count = Math.max(1, unitsFor(block).length);
    total += count;
    if (blockIndex < position.blockIndex) completed += count;
    else if (blockIndex === position.blockIndex) completed += Math.min(count, position.unitIndex + 1);
  });
  return total ? Math.min(100, (completed * 100) / total) : 0;
}


function allReadingUnits(documentModel) {
  const result = [];
  for (let blockIndex = 0; blockIndex < (documentModel?.blocks?.length || 0); blockIndex += 1) {
    const block = documentModel.blocks[blockIndex];
    const units = unitsFor(block);
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      result.push({ blockIndex, unitIndex, text: units[unitIndex] });
    }
  }
  return result;
}

function positionForPercent(documentModel, percent) {
  const units = allReadingUnits(documentModel);
  if (!units.length) return { blockIndex: 0, unitIndex: 0 };
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const index = clamped >= 100
    ? units.length - 1
    : Math.min(units.length - 1, Math.floor((clamped / 100) * units.length));
  return { blockIndex: units[index].blockIndex, unitIndex: units[index].unitIndex };
}

function estimatedReadingTimes(documentModel, position, rate=1) {
  const units = allReadingUnits(documentModel);
  const words = units.map(item => String(item.text || '').trim().split(/\s+/u).filter(Boolean).length);
  const totalWords = words.reduce((sum, count) => sum + count, 0);
  const target = units.findIndex(item => item.blockIndex === position?.blockIndex && item.unitIndex === position?.unitIndex);
  const elapsedWords = words.slice(0, Math.max(0, target) + 1).reduce((sum, count) => sum + count, 0);
  const wordsPerMinute = Math.max(60, 180 * (Number(rate) || 1));
  return {
    elapsedSeconds: Math.round((elapsedWords / wordsPerMinute) * 60),
    remainingSeconds: Math.round((Math.max(0, totalWords - elapsedWords) / wordsPerMinute) * 60)
  };
}

function readableDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function renderReadingBook({
  root,
  router,
  client,
  bookId,
  initialPercent = null,
  t,
  nativeActions,
  setScreenCleanup,
  onOpenBook,
  onOpenQueue
}) {
  clearScreen(root);

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'back-button';
  back.textContent = t('readingBook.backToLibrary');
  back.addEventListener('click', () => router.back());

  const heading = document.createElement('h1');
  heading.dataset.screenHeading = '';
  heading.tabIndex = -1;
  heading.textContent = t('readingBook.loading');

  const status = document.createElement('p');
  status.className = 'reading-book-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.textContent = t('readingBook.loading');

  const orderWarning = document.createElement('p');
  orderWarning.className = 'reading-pdf-order-warning';
  orderWarning.setAttribute('role', 'status');
  orderWarning.setAttribute('aria-live', 'polite');
  orderWarning.setAttribute('aria-atomic', 'true');
  orderWarning.hidden = true;

  const pdfPasswordForm = document.createElement('form');
  pdfPasswordForm.className = 'reading-pdf-password';
  pdfPasswordForm.hidden = true;

  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = t('readingBook.pdfPasswordLabel');

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'reading-pdf-password';
  passwordInput.autocomplete = 'off';
  passwordLabel.htmlFor = passwordInput.id;

  const passwordButton = document.createElement('button');
  passwordButton.type = 'submit';
  passwordButton.textContent = t('readingBook.pdfPasswordOpen');

  pdfPasswordForm.append(passwordLabel, passwordInput, passwordButton);

  const readerContainer = document.createElement('article');
  readerContainer.className = 'reading-reader';
  readerContainer.tabIndex = -1;

  const controls = document.createElement('div');
  controls.className = 'reading-book-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', t('readingBook.navigation'));
  controls.hidden = true;

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = t('readingBook.play');

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = t('readingBook.previousUnit');
  previous.setAttribute('aria-label', t('readingBook.previousSentence'));

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = t('readingBook.nextUnit');
  next.setAttribute('aria-label', t('readingBook.nextSentence'));

  const navigationLabel = document.createElement('label');
  navigationLabel.textContent = t('readingBook.navigation');
  const navigationSelect = document.createElement('select');
  navigationSelect.id = 'reading-navigation-unit';
  navigationLabel.htmlFor = navigationSelect.id;

  const addMarkButton = document.createElement('button');
  addMarkButton.type = 'button';
  addMarkButton.textContent = fallback(t, 'readingBook.addMark', 'Añadir marca', 'Add bookmark');

  const progressStatus = document.createElement('p');
  progressStatus.className = 'reading-book-progress';
  progressStatus.setAttribute('role', 'status');
  progressStatus.setAttribute('aria-live', 'polite');
  progressStatus.setAttribute('aria-atomic', 'true');

  const progressLabel = document.createElement('label');
  progressLabel.textContent = document.documentElement.lang === 'en' ? 'Go to position' : 'Ir a posición';
  const progressSelect = document.createElement('select');
  progressSelect.id = 'reading-progress-percent';
  progressLabel.htmlFor = progressSelect.id;
  for (let value = 0; value <= 100; value += 10) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value} %`;
    progressSelect.append(option);
  }

  const searchButton = document.createElement('button');
  searchButton.type = 'button';
  searchButton.textContent = t('readingBook.search');

  const marksButton = document.createElement('button');
  marksButton.type = 'button';
  marksButton.textContent = t('readingBook.marks');

  const readingStateLabel = document.createElement('label');
  readingStateLabel.textContent = t('readingBook.readingState');
  const readingState = document.createElement('select');
  readingState.id = 'reading-state';
  readingStateLabel.htmlFor = readingState.id;
  for (const [value, label] of [
    ['not-read', t('readingLibrary.stateNotRead')],
    ['in-reading', t('readingLibrary.stateInReading')],
    ['read', t('readingLibrary.stateRead')]
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    readingState.append(option);
  }

  const voiceButton = document.createElement('button');
  voiceButton.type = 'button';
  voiceButton.textContent = t('readingBook.voiceAndSpeed');

  const visualButton = document.createElement('button');
  visualButton.type = 'button';
  visualButton.textContent = t('readingBook.visualSettings');

  const moreActionsButton = document.createElement('button');
  moreActionsButton.type = 'button';
  moreActionsButton.textContent = document.documentElement.lang === 'en' ? 'More actions' : 'Más acciones';

  controls.append(
    playButton,
    navigationLabel,
    navigationSelect,
    previous,
    next,
    progressStatus,
    addMarkButton,
    voiceButton,
    visualButton,
    moreActionsButton
  );

  const moreActions = document.createElement('section');
  moreActions.className = 'reading-panel reading-more-actions';
  moreActions.hidden = true;
  const moreHeading = document.createElement('h2');
  moreHeading.tabIndex = -1;
  moreHeading.textContent = document.documentElement.lang === 'en' ? 'More actions' : 'Más acciones';
  const timerLabel = document.createElement('label');
  timerLabel.textContent = document.documentElement.lang === 'en' ? 'Reading timer' : 'Temporizador de lectura';
  const timerSelect = document.createElement('select');
  timerSelect.id = 'reading-sleep-timer';
  timerLabel.htmlFor = timerSelect.id;
  for (const [value, es, en] of [
    ['', 'Desactivado', 'Off'],
    ['10', '10 minutos', '10 minutes'],
    ['20', '20 minutos', '20 minutes'],
    ['30', '30 minutos', '30 minutes'],
    ['45', '45 minutos', '45 minutes'],
    ['60', '60 minutos', '60 minutes']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = document.documentElement.lang === 'en' ? en : es;
    timerSelect.append(option);
  }
  const moreReturn = document.createElement('button');
  moreReturn.type = 'button';
  moreReturn.textContent = t('readingBook.returnToReading');
  moreActions.append(
    moreHeading,
    progressLabel,
    progressSelect,
    searchButton,
    marksButton,
    readingStateLabel,
    readingState,
    timerLabel,
    timerSelect,
    moreReturn
  );

  const pdfPageNavigation = document.createElement('nav');
  pdfPageNavigation.className = 'reading-library-pagination reading-pdf-pagination';
  pdfPageNavigation.setAttribute('aria-label', t('readingBook.navigation'));
  pdfPageNavigation.hidden = true;

  const previousPage = document.createElement('button');
  previousPage.type = 'button';
  previousPage.textContent = t('readingLibrary.previousPage');

  const pageStatus = document.createElement('span');
  pageStatus.className = 'reading-library-page-status';
  pageStatus.setAttribute('aria-live', 'polite');
  pageStatus.setAttribute('aria-atomic', 'true');

  const nextPage = document.createElement('button');
  nextPage.type = 'button';
  nextPage.textContent = t('readingLibrary.nextPage');

  const pageForm = document.createElement('form');
  pageForm.className = 'reading-pdf-page-jump';
  const pageLabel = document.createElement('label');
  pageLabel.textContent = t('readingBook.pageNumber');
  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.id = 'reading-pdf-page-number';
  pageInput.min = '1';
  pageInput.step = '1';
  pageLabel.htmlFor = pageInput.id;
  const pageButton = document.createElement('button');
  pageButton.type = 'submit';
  pageButton.textContent = t('readingBook.goToPage');
  pageForm.append(pageLabel, pageInput, pageButton);

  pdfPageNavigation.append(previousPage, pageStatus, nextPage, pageForm);

  const panels = document.createElement('div');
  panels.className = 'reading-book-panels';

  const endOfDocument = document.createElement('section');
  endOfDocument.className = 'reading-end-of-document';
  endOfDocument.hidden = true;
  const endHeading = document.createElement('h2');
  endHeading.textContent = fallback(
    t,
    'readingBook.endOfDocument',
    'Has terminado este documento',
    'You have finished this document'
  );
  const nextSuggestion = document.createElement('p');
  nextSuggestion.setAttribute('role', 'status');
  nextSuggestion.setAttribute('aria-live', 'polite');
  const openNext = document.createElement('button');
  openNext.type = 'button';
  openNext.textContent = fallback(t, 'readingBook.openNext', 'Abrir siguiente', 'Open next');
  openNext.hidden = true;
  const backToQueue = document.createElement('button');
  backToQueue.type = 'button';
  backToQueue.textContent = fallback(
    t,
    'readingBook.backToQueue',
    'Volver a la cola de lectura',
    'Back to reading queue'
  );
  endOfDocument.append(endHeading, nextSuggestion, openNext, backToQueue);

  const externalLinkDialog = document.createElement('section');
  externalLinkDialog.className = 'reading-panel reading-external-link-dialog';
  externalLinkDialog.hidden = true;
  externalLinkDialog.tabIndex = -1;
  externalLinkDialog.setAttribute('role', 'dialog');
  externalLinkDialog.setAttribute('aria-modal', 'true');
  const externalLinkHeading = document.createElement('h2');
  externalLinkHeading.id = 'reading-external-link-heading';
  externalLinkHeading.textContent = document.documentElement.lang === 'en'
    ? 'Open external link'
    : 'Abrir enlace externo';
  externalLinkDialog.setAttribute('aria-labelledby', externalLinkHeading.id);
  const externalLinkWarning = document.createElement('p');
  externalLinkWarning.textContent = document.documentElement.lang === 'en'
    ? 'This link opens content outside TifloAcosta.'
    : 'Este enlace abre contenido fuera de TifloAcosta.';
  const externalLinkOpen = document.createElement('button');
  externalLinkOpen.type = 'button';
  externalLinkOpen.textContent = document.documentElement.lang === 'en'
    ? 'Open external link'
    : 'Abrir enlace externo';
  const externalLinkCancel = document.createElement('button');
  externalLinkCancel.type = 'button';
  externalLinkCancel.textContent = document.documentElement.lang === 'en' ? 'Cancel' : 'Cancelar';
  externalLinkDialog.append(externalLinkHeading, externalLinkWarning, externalLinkOpen, externalLinkCancel);

  root.append(
    back,
    heading,
    status,
    orderWarning,
    pdfPasswordForm,
    controls,
    pdfPageNavigation,
    readerContainer,
    moreActions,
    panels,
    externalLinkDialog,
    endOfDocument
  );

  let activeBook = null;
  let documentModel = null;
  let speech = null;
  let audioView = null;
  let ocrPanel = null;
  let currentPosition = { blockIndex: 0, unitIndex: 0 };
  let noteReturnPosition = null;
  let searchPanel = null;
  let marksPanel = null;
  let settingsPanel = null;
  let translationControls = null;
  let readingTimerHandle = null;
  let destroyed = false;
  let nextSuggestedBookId = '';
  let completionGeneration = 0;
  let pendingExternalUrl = '';
  let externalLinkInvoker = null;

  function setContinuousReadingAnnouncements(playing) {
    const liveMode = playing ? 'off' : 'polite';
    status.setAttribute('aria-live', liveMode);
    progressStatus.setAttribute('aria-live', liveMode);
    pageStatus.setAttribute('aria-live', liveMode);
  }

  function closeExternalLinkWarning() {
    externalLinkDialog.hidden = true;
    pendingExternalUrl = '';
    const invoker = externalLinkInvoker;
    externalLinkInvoker = null;
    if (invoker && invoker.isConnected !== false) queueMicrotask(() => invoker.focus());
  }

  function openExternalLinkWarning(url, invoker) {
    const target = String(url ?? '').trim();
    if (!target) return false;
    pendingExternalUrl = target;
    externalLinkInvoker = invoker && typeof invoker.focus === 'function' ? invoker : null;
    externalLinkDialog.hidden = false;
    queueMicrotask(() => externalLinkOpen.focus());
    return true;
  }

  externalLinkOpen.addEventListener('click', () => {
    const target = pendingExternalUrl;
    closeExternalLinkWarning();
    if (target) void nativeActions?.openExternal?.(target);
  });
  externalLinkCancel.addEventListener('click', closeExternalLinkWarning);
  externalLinkDialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeExternalLinkWarning();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = externalLinkOpen;
    const last = externalLinkCancel;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function focusCurrentSemanticUnit() {
    const element = readerContainer.querySelector('[data-reading-unit="current"]');
    if (!element) return false;
    element.focus();
    return true;
  }

  function hideEndOfDocument() {
    completionGeneration += 1;
    nextSuggestedBookId = '';
    endOfDocument.hidden = true;
    openNext.hidden = true;
    nextSuggestion.textContent = '';
  }

  async function showEndOfDocument() {
    const generation = ++completionGeneration;
    endOfDocument.hidden = false;
    nextSuggestedBookId = '';
    openNext.hidden = true;
    nextSuggestion.textContent = fallback(
      t,
      'readingBook.nextSuggestion',
      'Buscando el siguiente título de la cola…',
      'Looking for the next title in the queue…'
    );

    const queue = typeof client?.listQueue === 'function' ? await client.listQueue() : [];
    if (destroyed || generation !== completionGeneration) return;
    const nextBook = queue.find(item => item?.id && item.id !== activeBook?.id) || null;
    if (!nextBook) {
      nextSuggestion.textContent = fallback(
        t,
        'readingBook.nextSuggestion',
        'No hay otro título pendiente en la cola.',
        'There is no other pending title in the queue.'
      );
      return;
    }

    nextSuggestedBookId = nextBook.id;
    nextSuggestion.textContent = `${fallback(
      t,
      'readingBook.nextSuggestion',
      'Siguiente sugerencia',
      'Next suggestion'
    )}: ${nextBook.title || t('readingLibrary.untitled')}`;
    openNext.hidden = false;
  }

  function clearInteractiveReading() {
    controls.hidden = true;
    pdfPageNavigation.hidden = true;
    orderWarning.hidden = true;
    orderWarning.textContent = '';
    noteReturnPosition = null;
    readerContainer.replaceChildren();
  }

  function showOpenError() {
    heading.textContent = t('readingBook.errorHeading');
    status.textContent = t('readingBook.error');
    pdfPasswordForm.hidden = true;
    clearInteractiveReading();
  }

  function showPdfPasswordState(opened) {
    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    clearInteractiveReading();
    pdfPasswordForm.hidden = false;
    status.textContent = opened.passwordRejected
      ? t('readingBook.pdfPasswordRejected')
      : t('readingBook.pdfPasswordRequired');
    queueMicrotask(() => {
      if (!destroyed) passwordInput.focus();
    });
  }

  async function showPdfNoTextState(opened, password = '') {
    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    pdfPasswordForm.hidden = true;
    clearInteractiveReading();
    hideEndOfDocument();
    status.textContent = t('readingBook.pdfNoText');
    ocrPanel?.destroy();
    ocrPanel = createReadingOcrPanel({
      root: panels,
      client,
      book: activeBook,
      pageCount: opened.pageCount,
      password,
      t,
      onOpenRecognized(pages) {
        void (async () => {
          if (!pages?.length || destroyed) return;
          searchPanel?.destroy();
          marksPanel?.destroy();
          settingsPanel?.destroy();
          if (speech) await speech.destroy();
          searchPanel = null;
          marksPanel = null;
          settingsPanel = null;
          speech = null;
          await initializeOpenedBook({
            book: activeBook,
            pdf: {
              title: activeBook.title,
              author: activeBook.author,
              language: activeBook.language,
              pageCount: opened.pageCount,
              orderReliable: true,
              pages
            }
          });
        })();
      }
    });
    await ocrPanel.load();
  }

  function navigationModeName(kind) {
    const english = document.documentElement.lang === 'en';
    const names = {
      sentence: english ? 'Sentence' : 'Frase',
      paragraph: english ? 'Paragraph' : 'Párrafo',
      heading: english ? 'Heading' : 'Encabezado',
      listItem: english ? 'List item' : 'Elemento de lista',
      quote: english ? 'Quote' : 'Cita',
      tableCell: english ? 'Table cell' : 'Celda de tabla',
      page: english ? 'Page' : 'Página'
    };
    return names[kind] || names.sentence;
  }

  function availableNavigationModes() {
    const blocks = Array.isArray(documentModel?.blocks) ? documentModel.blocks : [];
    const modes = ['sentence'];
    if (blocks.some(block => block?.type === 'paragraph')) modes.push('paragraph');
    if (blocks.some(block => block?.type === 'heading')) modes.push('heading');
    if (blocks.some(block => block?.type === 'list-item')) modes.push('listItem');
    if (blocks.some(block => block?.type === 'quote')) modes.push('quote');
    if (blocks.some(block => block?.type === 'table-cell')) modes.push('tableCell');
    if (activeBook?.format === 'pdf' && Number(documentModel?.pageCount) > 0) modes.push('page');
    return modes;
  }

  function populateNavigationModes() {
    const previousValue = navigationSelect.value;
    navigationSelect.replaceChildren();
    for (const kind of availableNavigationModes()) {
      const option = document.createElement('option');
      option.value = kind;
      option.textContent = navigationModeName(kind);
      navigationSelect.append(option);
    }
    navigationSelect.value = [...navigationSelect.options].some(option => option.value === previousValue)
      ? previousValue
      : 'sentence';
  }

  function readablePdfPageFrom(position, direction) {
    if (activeBook?.format !== 'pdf' || !documentModel) return null;
    const currentPage = pageForPosition(documentModel, position);
    const totalPages = Math.max(0, Number(documentModel.pageCount) || 0);
    if (!currentPage || !totalPages) return null;

    for (
      let page = currentPage + direction;
      page >= 1 && page <= totalPages;
      page += direction
    ) {
      const target = positionForPage(documentModel, page);
      if (target) return { page, position: target };
    }
    return null;
  }

  function renderPdfPageStatus(position = currentPosition) {
    if (activeBook?.format !== 'pdf' || !documentModel) {
      pdfPageNavigation.hidden = true;
      return;
    }

    pdfPageNavigation.hidden = false;
    const currentPage = pageForPosition(documentModel, currentPosition);
    const displayPage = pageForPosition(documentModel, position) || currentPage || 1;
    const pages = Math.max(1, Number(documentModel.pageCount) || 1);
    pageStatus.textContent = format(t('readingLibrary.pageStatus'), { page: displayPage, pages });
    pageInput.max = String(pages);
    pageInput.value = String(displayPage);
    previousPage.disabled = !readablePdfPageFrom(position, -1);
    nextPage.disabled = !readablePdfPageFrom(position, 1);
  }

  function linksForCurrentUnit(block, unitText) {
    const links = Array.isArray(block?.links) ? block.links.filter(Boolean) : [];
    const unit = String(unitText ?? '').trim();
    if (!unit) return links;
    return links.filter(link => {
      const label = String(link?.text ?? '').trim();
      return !label || unit.includes(label);
    });
  }

  function targetBlockIndexForHref(href) {
    const target = String(href ?? '').trim();
    if (!target || !documentModel?.blocks?.length) return -1;
    return documentModel.blocks.findIndex(
      candidate => String(candidate?.href ?? '').trim() === target
    );
  }

  async function returnFromInternalLink() {
    if (!noteReturnPosition) return false;
    const sourcePosition = { ...noteReturnPosition };
    noteReturnPosition = null;
    await moveToPosition(sourcePosition);
    return true;
  }

  function renderBlockLinks(block, unitText, sourcePosition) {
    const fragment = document.createDocumentFragment();
    const links = linksForCurrentUnit(block, unitText);
    if (links.length) {
      const nav = document.createElement('nav');
      nav.className = 'reading-document-links';
      nav.setAttribute(
        'aria-label',
        fallback(t, 'readingBook.documentLink', 'Enlace del documento', 'Document link')
      );

      for (const link of links) {
        const label = String(link?.text ?? '').trim()
          || fallback(t, 'readingBook.documentLink', 'Enlace del documento', 'Document link');
        if (link.external === true) {
          const externalButton = document.createElement('button');
          externalButton.type = 'button';
          externalButton.textContent = label;
          externalButton.addEventListener('click', event => {
            openExternalLinkWarning(link.href, event.currentTarget);
          });
          nav.append(externalButton);
          continue;
        }

        const targetBlockIndex = targetBlockIndexForHref(link.href);
        if (targetBlockIndex < 0) continue;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => {
          noteReturnPosition = { ...sourcePosition };
          void moveToPosition({ blockIndex: targetBlockIndex, unitIndex: 0 });
        });
        nav.append(button);
      }

      if (nav.childElementCount) fragment.append(nav);
    }

    if (noteReturnPosition) {
      const returnButton = document.createElement('button');
      returnButton.type = 'button';
      returnButton.className = 'reading-note-return';
      returnButton.textContent = fallback(
        t,
        'readingBook.returnToSource',
        'Volver al punto de origen',
        'Return to source'
      );
      returnButton.addEventListener('click', () => { void returnFromInternalLink(); });
      fragment.append(returnButton);
    }
    return fragment;
  }

  function renderReadingProgress(position = currentPosition) {
    if (!documentModel?.blocks?.length) return;
    const percent = Math.round(percentForPosition(documentModel, position));
    const rate = Number(speech?.snapshot?.().rate) || 1;
    const estimate = estimatedReadingTimes(documentModel, position, rate);
    progressStatus.textContent = document.documentElement.lang === 'en'
      ? `${percent}% read. About ${readableDuration(estimate.remainingSeconds)} remaining.`
      : `${percent} % leído. Quedan aproximadamente ${readableDuration(estimate.remainingSeconds)}.`;
    const nearest = Math.max(0, Math.min(100, Math.round(percent / 10) * 10));
    progressSelect.value = String(nearest);
  }

  function renderSemanticPosition(position, { focus = false, announce = true, commit = true } = {}) {
    if (!documentModel?.blocks?.length) return false;
    const normalized = normalizeSemanticPosition(position, documentModel);
    const block = documentModel.blocks[normalized.blockIndex];
    const element = semanticElement(block);
    const unitText = getCurrentUnitText(documentModel, normalized);
    element.textContent = unitText || block.text || '';
    element.tabIndex = -1;
    element.dataset.blockIndex = String(normalized.blockIndex);
    element.dataset.unitIndex = String(normalized.unitIndex);
    element.dataset.readingUnit = 'current';
    readerContainer.replaceChildren(element);
    readerContainer.append(renderBlockLinks(block, unitText, normalized));
    if (commit) currentPosition = normalized;

    const blockUnits = Math.max(1, unitsFor(block).length);
    const navigationKind = navigationSelect.value || 'sentence';
    const previousTarget = navigationTarget(normalized, -1);
    const nextTarget = navigationTarget(normalized, 1);
    previous.disabled = !previousTarget.moved;
    next.disabled = !nextTarget.moved;
    previous.setAttribute('aria-label', semanticNavigationLabel(t, navigationKind, -1));
    next.setAttribute('aria-label', semanticNavigationLabel(t, navigationKind, 1));
    renderPdfPageStatus(normalized);
    renderReadingProgress(normalized);
    if (announce) {
      const page = pageForPosition(documentModel, normalized);
      status.textContent = activeBook?.format === 'pdf' && page
        ? format(t('readingBook.pdfPosition'), {
            page,
            pages: Math.max(1, Number(documentModel.pageCount) || 1),
            block: normalized.blockIndex + 1,
            blocks: documentModel.blocks.length,
            unit: normalized.unitIndex + 1,
            units: blockUnits
          })
        : format(t('readingBook.position'), {
            block: normalized.blockIndex + 1,
            blocks: documentModel.blocks.length,
            unit: normalized.unitIndex + 1,
            units: blockUnits
          });
    }
    if (focus) focusCurrentSemanticUnit();
    return true;
  }

  async function persistPosition(position = currentPosition, state = readingState.value || 'in-reading') {
    if (!activeBook?.id || !documentModel?.blocks?.length) return false;
    const normalized = normalizeSemanticPosition(position, documentModel);
    const anchorText = getCurrentUnitText(documentModel, normalized);
    return client.saveProgress({
      id: activeBook.id,
      blockIndex: normalized.blockIndex,
      unitIndex: normalized.unitIndex,
      anchorText,
      percent: state === 'read' ? 100 : percentForPosition(documentModel, normalized),
      state
    });
  }

  async function persistReadingState(position = currentPosition, state = readingState.value || 'in-reading') {
    const saved = await persistPosition(position, state);
    if (destroyed) return saved;
    if (state === 'read') await showEndOfDocument();
    else hideEndOfDocument();
    return saved;
  }

  function navigationTarget(position, direction) {
    const step = Number(direction) < 0 ? -1 : 1;
    const kind = navigationSelect.value || 'sentence';
    if (kind === 'page') {
      const pageTarget = readablePdfPageFrom(position, step);
      return pageTarget
        ? { position: pageTarget.position, kind, moved: true }
        : { position: normalizeSemanticPosition(position, documentModel), kind, moved: false };
    }
    if (kind === 'sentence') {
      return adjacentSemanticUnit(documentModel, position, step);
    }
    return adjacentSemanticBlockOfKind(documentModel, position, kind, step);
  }

  async function moveToPosition(position, { focus = false } = {}) {
    if (!speech || !documentModel) return;
    const normalized = normalizeSemanticPosition(position, documentModel);
    await speech.moveTo(normalized);
    currentPosition = normalized;
    renderSemanticPosition(normalized, { focus });
    playButton.textContent = speech.snapshot().playing ? t('readingBook.pause') : t('readingBook.play');
  }

  async function navigateSemantic(direction) {
    if (!documentModel) return;
    const target = navigationTarget(
      currentPosition,
      direction === 'previous' ? -1 : 1
    );
    if (!target.moved) return;
    await moveToPosition(target.position, { focus: false });
  }

  async function navigatePdfPage(direction) {
    const target = readablePdfPageFrom(currentPosition, direction);
    if (!target) return;
    await moveToPosition(positionForPage(documentModel, target.page) || target.position);
  }

  async function startSpeechFromUserAction() {
    if (!speech) return false;
    return speech.play();
  }

  progressSelect.addEventListener('change', () => {
    if (!documentModel) return;
    void moveToPosition(positionForPercent(documentModel, Number(progressSelect.value) || 0));
  });

  addMarkButton.addEventListener('click', () => {
    void (async () => {
      if (!activeBook?.id) return;
      const mark = await client.addMark({
        bookId: activeBook.id,
        type: 'bookmark',
        blockIndex: currentPosition.blockIndex,
        unitIndex: currentPosition.unitIndex,
        excerpt: getCurrentUnitText(documentModel, currentPosition),
        reference: activeBook.format === 'pdf'
          ? format(t('readingBook.pdfPageReference'), { page: pageForPosition(documentModel, currentPosition) || 1 })
          : ''
      });
      status.textContent = mark
        ? fallback(t, 'readingBook.markAdded', 'Marca añadida.', 'Bookmark added.')
        : fallback(t, 'readingBook.markFailed', 'No se pudo añadir la marca.', 'Bookmark could not be added.');
    })();
  });

  moreActionsButton.addEventListener('click', () => {
    moreActions.hidden = false;
    queueMicrotask(() => moreHeading.focus());
  });
  moreReturn.addEventListener('click', () => {
    moreActions.hidden = true;
    moreActionsButton.focus();
  });

  timerSelect.addEventListener('change', () => {
    if (readingTimerHandle) {
      clearTimeout(readingTimerHandle);
      readingTimerHandle = null;
    }
    const minutes = Number(timerSelect.value) || 0;
    if (!minutes) {
      status.textContent = document.documentElement.lang === 'en'
        ? 'Reading timer off.'
        : 'Temporizador de lectura desactivado.';
      return;
    }
    status.textContent = document.documentElement.lang === 'en'
      ? `Reading timer set for ${minutes} minutes.`
      : `Temporizador establecido en ${minutes} minutos.`;
    readingTimerHandle = setTimeout(() => {
      readingTimerHandle = null;
      void speech?.pause?.();
      playButton.textContent = t('readingBook.play');
      status.textContent = document.documentElement.lang === 'en'
        ? 'Reading timer ended. Playback stopped.'
        : 'Temporizador finalizado. Reproducción detenida.';
    }, minutes * 60 * 1000);
  });

  previous.addEventListener('click', () => { void navigateSemantic('previous'); });
  next.addEventListener('click', () => { void navigateSemantic('next'); });
  previousPage.addEventListener('click', () => { void navigatePdfPage(-1); });
  nextPage.addEventListener('click', () => { void navigatePdfPage(1); });
  navigationSelect.addEventListener('change', () => {
    renderSemanticPosition(currentPosition, { focus: false, announce: false, commit: false });
    status.textContent = document.documentElement.lang === 'en'
      ? `Navigation by ${navigationModeName(navigationSelect.value)}.`
      : `Navegación por ${navigationModeName(navigationSelect.value).toLowerCase()}.`;
  });
  openNext.addEventListener('click', () => {
    if (nextSuggestedBookId) onOpenBook?.(nextSuggestedBookId);
  });
  backToQueue.addEventListener('click', () => onOpenQueue?.());

  pageForm.addEventListener('submit', event => {
    event.preventDefault();
    if (activeBook?.format !== 'pdf' || !documentModel) return;
    const requestedPage = Number.parseInt(pageInput.value, 10);
    const pages = Math.max(0, Number(documentModel.pageCount) || 0);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > pages) {
      status.textContent = format(t('readingBook.pdfPageInvalid'), { pages });
      pageInput.focus();
      return;
    }
    const target = positionForPage(documentModel, requestedPage);
    if (!target) {
      status.textContent = format(t('readingBook.pdfPageNoText'), { page: requestedPage });
      pageInput.focus();
      return;
    }
    void moveToPosition(target);
  });

  playButton.addEventListener('click', () => {
    void (async () => {
      if (!speech) return;
      const snapshot = speech.snapshot();
      if (snapshot.playing) {
        await speech.pause();
        setContinuousReadingAnnouncements(false);
        playButton.textContent = t('readingBook.play');
      } else {
        setContinuousReadingAnnouncements(true);
        const started = await startSpeechFromUserAction();
        setContinuousReadingAnnouncements(started);
        playButton.textContent = started ? t('readingBook.pause') : t('readingBook.play');
      }
    })();
  });

  readingState.addEventListener('change', () => {
    void persistReadingState(currentPosition, readingState.value);
  });

  searchButton.addEventListener('click', () => searchPanel?.open());
  marksButton.addEventListener('click', () => marksPanel?.open());
  voiceButton.addEventListener('click', () => settingsPanel?.openVoice());
  visualButton.addEventListener('click', () => settingsPanel?.openVisual());

  setScreenCleanup?.(() => {
    destroyed = true;
    completionGeneration += 1;
    ocrPanel?.destroy();
    searchPanel?.destroy();
    marksPanel?.destroy();
    settingsPanel?.destroy();
    if (readingTimerHandle) clearTimeout(readingTimerHandle);
    readingTimerHandle = null;
    translationControls?.destroy?.();
    if (speech) void speech.destroy();
    if (audioView) void audioView.destroy();
  });

  async function initializeOpenedAudioBook(opened) {
    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    pdfPasswordForm.hidden = true;
    clearInteractiveReading();
    hideEndOfDocument();
    status.textContent = t('readingAudio.preparing');
    audioView = createReadingAudioView({
      root: readerContainer,
      panelsRoot: panels,
      client,
      book: activeBook,
      t
    });
    const prepared = await audioView.prepare();
    if (destroyed) return;
    status.textContent = prepared ? '' : t('readingAudio.unavailable');
  }

  async function initializeOpenedBook(opened) {
    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    pdfPasswordForm.hidden = true;
    controls.hidden = false;
    moreActions.hidden = true;
    hideEndOfDocument();

    const structuredFormat = ['epub', 'docx', 'daisy2.02', 'daisy3'].includes(activeBook.format);
    documentModel = activeBook.format === 'pdf'
      ? parsePdfDocument(opened.pdf)
      : structuredFormat
        ? parseStructuredDocument(parseStructuredPayload(opened.content), {
            title: activeBook.title,
            language: activeBook.language
          })
        : activeBook.format === 'html'
          ? parseHtmlDocument(opened.content, { title: activeBook.title })
          : parseTextDocument(opened.content, { title: activeBook.title });

    if (!documentModel.blocks.length) {
      status.textContent = t('readingBook.empty');
      clearInteractiveReading();
      return;
    }

    if (activeBook.format === 'pdf' && documentModel.orderReliable === false) {
      orderWarning.textContent = t('readingBook.pdfOrderWarning');
      orderWarning.hidden = false;
    } else {
      orderWarning.textContent = '';
      orderWarning.hidden = true;
    }

    const requestedPercent = Number.isFinite(Number(initialPercent))
      ? Math.max(0, Math.min(100, Number(initialPercent)))
      : null;
    currentPosition = requestedPercent == null
      ? normalizeSemanticPosition({
          blockIndex: activeBook.blockIndex,
          unitIndex: activeBook.unitIndex
        }, documentModel)
      : normalizeSemanticPosition(positionForPercent(documentModel, requestedPercent), documentModel);
    populateNavigationModes();
    readingState.value = activeBook.state || 'in-reading';

    speech = createReadingSpeechController({
      client,
      document: documentModel,
      initialPosition: {
        blockIndex: currentPosition.blockIndex,
        unitIndex: currentPosition.unitIndex
      },
      settings: {},
      onPositionChange(nextPosition) {
        currentPosition = normalizeSemanticPosition(nextPosition, documentModel);
        const isPlaying = nextPosition?.playing === true;
        setContinuousReadingAnnouncements(isPlaying);
        renderSemanticPosition(currentPosition, { announce: !isPlaying });
        playButton.textContent = nextPosition?.state === 'read'
          ? t('readingBook.play')
          : isPlaying ? t('readingBook.pause') : t('readingBook.play');
        void persistReadingState(currentPosition, nextPosition?.state || 'in-reading');
      }
    });

    searchPanel = createReadingSearchPanel({
      root: panels,
      documentModel,
      t,
      onPreview(position) {
        renderSemanticPosition(position, { focus: true, commit: false });
      },
      onContinue(position) {
        return moveToPosition(position);
      },
      onClose() {
        renderSemanticPosition(currentPosition, { focus: false, announce: false, commit: false });
      },
      returnFocus: focusCurrentSemanticUnit
    });

    marksPanel = createReadingMarksPanel({
      root: panels,
      client,
      bookId: activeBook.id,
      t,
      getPosition: () => ({ ...currentPosition }),
      getExcerpt: position => getCurrentUnitText(documentModel, position),
      getReference: position => {
        if (activeBook.format === 'pdf') {
          const page = pageForPosition(documentModel, position);
          return page ? format(t('readingBook.pdfPageReference'), { page }) : '';
        }
        return String(documentModel?.blocks?.[position?.blockIndex]?.href ?? '');
      },
      onJump: position => moveToPosition(position),
      returnFocus: focusCurrentSemanticUnit
    });

    settingsPanel = createReadingSettingsPanel({
      root: panels,
      readerContainer,
      client,
      bookId: activeBook.id,
      speech,
      t,
      returnFocus: focusCurrentSemanticUnit
    });

    translationControls?.destroy?.();
    translationControls = createReadingTranslationControls({
      root: moreActions,
      client,
      bookId: activeBook.id,
      speech,
      t,
      returnFocus() {
        moreActions.hidden = false;
        queueMicrotask(() => moreHeading.focus());
      }
    });

    renderSemanticPosition(currentPosition, { announce: false });
    const resumePage = activeBook.format === 'pdf' ? pageForPosition(documentModel, currentPosition) : null;
    status.textContent = resumePage
      ? format(t('readingBook.pdfResume'), {
          page: resumePage,
          pages: Math.max(1, Number(documentModel.pageCount) || 1),
          current: currentPosition.blockIndex + 1,
          total: documentModel.blocks.length
        })
      : format(t('readingBook.resume'), {
          current: currentPosition.blockIndex + 1,
          total: documentModel.blocks.length
        });
    await persistReadingState(currentPosition, readingState.value);
    if (!destroyed) queueMicrotask(() => playButton.focus());
  }

  async function loadBook(password = null) {
    let opened;
    try {
      opened = password === null
        ? await client.openBook(bookId)
        : await client.openBook(bookId, { password });
    } catch {
      showOpenError();
      return;
    }
    if (destroyed) return;
    if (!opened?.book) {
      showOpenError();
      return;
    }

    const daisyAudioOnly = ['daisy2.02', 'daisy3'].includes(opened.book.format)
      && opened.daisyHasAudio
      && !opened.daisyHasText;
    if (opened.book.format === 'audio' || daisyAudioOnly) {
      await initializeOpenedAudioBook(opened);
      return;
    }
    if (opened.book.format === 'pdf' && opened.passwordRequired) {
      showPdfPasswordState(opened);
      return;
    }
    if (opened.book.format === 'pdf' && opened.pdfNoText) {
      await showPdfNoTextState(opened, password ?? '');
      return;
    }
    if (opened.book.format === 'pdf' && !opened.pdf) {
      showOpenError();
      return;
    }

    await initializeOpenedBook(opened);
  }

  pdfPasswordForm.addEventListener('submit', event => {
    event.preventDefault();
    const password = passwordInput.value;
    passwordInput.value = '';
    if (!password) {
      status.textContent = t('readingBook.pdfPasswordRequired');
      passwordInput.focus();
      return;
    }
    passwordButton.disabled = true;
    status.textContent = t('readingBook.loading');
    void loadBook(password).finally(() => {
      if (!destroyed) passwordButton.disabled = false;
    });
  });

  void loadBook();
}