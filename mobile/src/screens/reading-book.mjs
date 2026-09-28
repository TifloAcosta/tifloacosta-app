import { parseHtmlDocument } from '../core/reading-html-adapter.mjs';
import { pageForPosition, parsePdfDocument, positionForPage } from '../core/reading-pdf-adapter.mjs';
import { normalizeSemanticPosition, parseTextDocument } from '../core/reading-semantic-model.mjs';
import { createReadingSpeechController } from '../core/reading-speech.mjs';
import { createReadingAudioView } from './reading-audio.mjs';
import { createReadingMarksPanel } from './reading-marks.mjs';
import { createReadingSearchPanel } from './reading-search.mjs';
import { createReadingSettingsPanel } from './reading-settings.mjs';
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
  const current = normalizeSemanticPosition(position, documentModel);
  if (current.unitIndex > 0) {
    return { blockIndex: current.blockIndex, unitIndex: current.unitIndex - 1 };
  }
  for (let blockIndex = current.blockIndex - 1; blockIndex >= 0; blockIndex -= 1) {
    const units = unitsFor(documentModel.blocks[blockIndex]);
    if (units.length) return { blockIndex, unitIndex: units.length - 1 };
  }
  return current;
}

function nextUnit(documentModel, position) {
  const current = normalizeSemanticPosition(position, documentModel);
  const units = unitsFor(documentModel.blocks[current.blockIndex]);
  if (current.unitIndex + 1 < units.length) {
    return { blockIndex: current.blockIndex, unitIndex: current.unitIndex + 1 };
  }
  for (let blockIndex = current.blockIndex + 1; blockIndex < documentModel.blocks.length; blockIndex += 1) {
    if (unitsFor(documentModel.blocks[blockIndex]).length) return { blockIndex, unitIndex: 0 };
  }
  return current;
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

export function renderReadingBook({
  root,
  router,
  client,
  bookId,
  t,
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

  const navigationButton = document.createElement('button');
  navigationButton.type = 'button';
  navigationButton.textContent = t('readingBook.navigation');

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

  controls.append(
    playButton,
    previous,
    next,
    navigationButton,
    searchButton,
    marksButton,
    readingStateLabel,
    readingState,
    voiceButton,
    visualButton
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

  root.append(
    back,
    heading,
    status,
    orderWarning,
    pdfPasswordForm,
    controls,
    pdfPageNavigation,
    readerContainer,
    panels,
    endOfDocument
  );

  let activeBook = null;
  let documentModel = null;
  let speech = null;
  let audioView = null;
  let currentPosition = { blockIndex: 0, unitIndex: 0 };
  let searchPanel = null;
  let marksPanel = null;
  let settingsPanel = null;
  let destroyed = false;
  let nextSuggestedBookId = '';
  let completionGeneration = 0;

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

  function showPdfNoTextState(opened) {
    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    pdfPasswordForm.hidden = true;
    clearInteractiveReading();
    status.textContent = t('readingBook.pdfNoText');
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
    if (commit) currentPosition = normalized;

    const blockUnits = Math.max(1, unitsFor(block).length);
    previous.disabled = normalized.blockIndex === 0 && normalized.unitIndex === 0;
    next.disabled = normalized.blockIndex === documentModel.blocks.length - 1
      && normalized.unitIndex >= blockUnits - 1;
    renderPdfPageStatus(normalized);
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

  async function moveToPosition(position, { focus = true } = {}) {
    if (!speech || !documentModel) return;
    const normalized = normalizeSemanticPosition(position, documentModel);
    await speech.moveTo(normalized);
    currentPosition = normalized;
    renderSemanticPosition(normalized, { focus });
    playButton.textContent = t('readingBook.play');
  }

  async function navigateSemantic(direction) {
    if (!documentModel) return;
    const target = direction === 'previous'
      ? previousUnit(documentModel, currentPosition)
      : nextUnit(documentModel, currentPosition);
    if (target.blockIndex === currentPosition.blockIndex && target.unitIndex === currentPosition.unitIndex) return;
    await moveToPosition(target);
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

  previous.addEventListener('click', () => { void navigateSemantic('previous'); });
  next.addEventListener('click', () => { void navigateSemantic('next'); });
  previousPage.addEventListener('click', () => { void navigatePdfPage(-1); });
  nextPage.addEventListener('click', () => { void navigatePdfPage(1); });
  navigationButton.addEventListener('click', () => { focusCurrentSemanticUnit(); });
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
        playButton.textContent = t('readingBook.play');
      } else {
        const started = await startSpeechFromUserAction();
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
    searchPanel?.destroy();
    marksPanel?.destroy();
    settingsPanel?.destroy();
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
    hideEndOfDocument();

    documentModel = activeBook.format === 'pdf'
      ? parsePdfDocument(opened.pdf)
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

    currentPosition = normalizeSemanticPosition({
      blockIndex: activeBook.blockIndex,
      unitIndex: activeBook.unitIndex
    }, documentModel);
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
        renderSemanticPosition(currentPosition, { announce: true });
        playButton.textContent = nextPosition?.state === 'read'
          ? t('readingBook.play')
          : speech?.snapshot().playing ? t('readingBook.pause') : t('readingBook.play');
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
        if (activeBook.format !== 'pdf') return '';
        const page = pageForPosition(documentModel, position);
        return page ? format(t('readingBook.pdfPageReference'), { page }) : '';
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

    if (opened.book.format === 'audio') {
      await initializeOpenedAudioBook(opened);
      return;
    }
    if (opened.book.format === 'pdf' && opened.passwordRequired) {
      showPdfPasswordState(opened);
      return;
    }
    if (opened.book.format === 'pdf' && opened.pdfNoText) {
      showPdfNoTextState(opened);
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
