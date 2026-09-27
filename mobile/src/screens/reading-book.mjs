import { parseHtmlDocument } from '../core/reading-html-adapter.mjs';
import { normalizeSemanticPosition, parseTextDocument } from '../core/reading-semantic-model.mjs';
import { createReadingSpeechController } from '../core/reading-speech.mjs';
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

export function renderReadingBook({ root, router, client, bookId, t, setScreenCleanup }) {
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

  const readerContainer = document.createElement('article');
  readerContainer.className = 'reading-reader';
  readerContainer.tabIndex = -1;

  const controls = document.createElement('div');
  controls.className = 'reading-book-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', t('readingBook.navigation'));

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.textContent = t('readingBook.play');

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = t('readingBook.previousUnit');

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = t('readingBook.nextUnit');

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

  const panels = document.createElement('div');
  panels.className = 'reading-book-panels';
  root.append(back, heading, status, controls, readerContainer, panels);

  let activeBook = null;
  let documentModel = null;
  let speech = null;
  let currentPosition = { blockIndex: 0, unitIndex: 0 };
  let searchPanel = null;
  let marksPanel = null;
  let settingsPanel = null;
  let destroyed = false;

  function showOpenError() {
    heading.textContent = t('readingBook.errorHeading');
    status.textContent = t('readingBook.error');
    controls.hidden = true;
    readerContainer.replaceChildren();
  }

  function renderSemanticPosition(position, { focus = false, announce = true } = {}) {
    if (!documentModel?.blocks?.length) return false;
    const normalized = normalizeSemanticPosition(position, documentModel);
    const block = documentModel.blocks[normalized.blockIndex];
    const element = semanticElement(block);
    const unitText = getCurrentUnitText(documentModel, normalized);
    element.textContent = unitText || block.text || '';
    element.tabIndex = -1;
    element.dataset.blockIndex = String(normalized.blockIndex);
    element.dataset.unitIndex = String(normalized.unitIndex);
    readerContainer.replaceChildren(element);
    currentPosition = normalized;

    const blockUnits = Math.max(1, unitsFor(block).length);
    previous.disabled = normalized.blockIndex === 0 && normalized.unitIndex === 0;
    next.disabled = normalized.blockIndex === documentModel.blocks.length - 1
      && normalized.unitIndex >= blockUnits - 1;
    if (announce) {
      status.textContent = format(t('readingBook.position'), {
        block: normalized.blockIndex + 1,
        blocks: documentModel.blocks.length,
        unit: normalized.unitIndex + 1,
        units: blockUnits
      });
    }
    if (focus) element.focus();
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

  async function startSpeechFromUserAction() {
    if (!speech) return false;
    return speech.play();
  }

  previous.addEventListener('click', () => { void navigateSemantic('previous'); });
  next.addEventListener('click', () => { void navigateSemantic('next'); });
  navigationButton.addEventListener('click', () => readerContainer.focus());

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
    void persistPosition(currentPosition, readingState.value);
  });

  searchButton.addEventListener('click', () => searchPanel?.open());
  marksButton.addEventListener('click', () => marksPanel?.open());
  voiceButton.addEventListener('click', () => settingsPanel?.openVoice());
  visualButton.addEventListener('click', () => settingsPanel?.openVisual());

  setScreenCleanup?.(() => {
    destroyed = true;
    searchPanel?.destroy();
    marksPanel?.destroy();
    settingsPanel?.destroy();
    if (speech) void speech.destroy();
  });

  void (async () => {
    let opened;
    try {
      opened = await client.openBook(bookId);
    } catch {
      showOpenError();
      return;
    }
    if (destroyed) return;
    if (!opened?.book) {
      showOpenError();
      return;
    }

    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    documentModel = activeBook.format === 'html'
      ? parseHtmlDocument(opened.content, { title: activeBook.title })
      : parseTextDocument(opened.content, { title: activeBook.title });

    if (!documentModel.blocks.length) {
      status.textContent = t('readingBook.empty');
      controls.hidden = true;
      readerContainer.replaceChildren();
      return;
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
        void persistPosition(currentPosition, nextPosition?.state || 'in-reading');
      }
    });

    searchPanel = createReadingSearchPanel({
      root: panels,
      documentModel,
      t,
      onPreview(position) {
        renderSemanticPosition(position, { focus: true });
      },
      onContinue(position) {
        void moveToPosition(position);
      }
    });

    marksPanel = createReadingMarksPanel({
      root: panels,
      client,
      bookId: activeBook.id,
      t,
      getPosition: () => ({ ...currentPosition }),
      getExcerpt: position => getCurrentUnitText(documentModel, position),
      onJump: position => { void moveToPosition(position); }
    });

    settingsPanel = createReadingSettingsPanel({
      root: panels,
      readerContainer,
      client,
      bookId: activeBook.id,
      speech,
      t
    });

    renderSemanticPosition(currentPosition, { announce: false });
    status.textContent = format(t('readingBook.resume'), {
      current: currentPosition.blockIndex + 1,
      total: documentModel.blocks.length
    });
    await persistPosition(currentPosition, readingState.value);
    if (!destroyed) queueMicrotask(() => playButton.focus());
  })();
}
