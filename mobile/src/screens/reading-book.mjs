import { parsePlainText } from '../core/reading-text-model.mjs';
import { createReadingSession } from '../core/reading-session.mjs';
import { addScreenHeader, clearScreen } from './shared.mjs';

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

export function renderReadingBook({ root, router, client, bookId, t }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('screen.readingLibrary'),
    backLabel: t('nav.back')
  });

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

  const paragraph = document.createElement('p');
  paragraph.className = 'reading-book-paragraph';
  paragraph.tabIndex = -1;

  const controls = document.createElement('div');
  controls.className = 'reading-book-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', t('readingBook.navigation'));

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = t('readingBook.previousParagraph');
  previous.disabled = true;

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = t('readingBook.nextParagraph');
  next.disabled = true;

  controls.append(previous, next);
  root.append(heading, status, paragraph, controls);

  let session = null;
  let activeBook = null;
  let blockCount = 0;

  function updateControls() {
    if (!session || blockCount === 0) {
      previous.disabled = true;
      next.disabled = true;
      return;
    }
    const { blockIndex } = session.snapshot();
    previous.disabled = blockIndex <= 0;
    next.disabled = blockIndex >= blockCount - 1;
  }

  function renderCurrent({ focus = false } = {}) {
    const block = session?.current();
    if (!block) {
      paragraph.textContent = '';
      updateControls();
      return false;
    }
    paragraph.textContent = block.text;
    const snapshot = session.snapshot();
    status.textContent = format(t('readingBook.progress'), {
      current: snapshot.blockIndex + 1,
      total: blockCount
    });
    updateControls();
    if (focus) paragraph.focus();
    return true;
  }

  async function persistProgress() {
    if (!session || !activeBook?.id) return false;
    const snapshot = session.snapshot();
    return client.saveProgress({
      id: activeBook.id,
      blockIndex: snapshot.blockIndex,
      percent: snapshot.percent,
      state: 'in-reading'
    });
  }

  async function navigate(move) {
    if (!session) return;
    const before = session.snapshot().blockIndex;
    if (move === 'previous') session.previous();
    else session.next();
    const after = session.snapshot().blockIndex;
    if (after === before) {
      updateControls();
      return;
    }
    renderCurrent({ focus: true });
    await persistProgress();
  }

  previous.addEventListener('click', () => { void navigate('previous'); });
  next.addEventListener('click', () => { void navigate('next'); });

  void (async () => {
    const opened = await client.openBook(bookId);
    if (!opened?.book) {
      heading.textContent = t('readingBook.errorHeading');
      status.textContent = t('readingBook.error');
      paragraph.textContent = '';
      controls.replaceChildren();
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = t('readingBook.backToLibrary');
      back.addEventListener('click', () => router.back());
      controls.append(back);
      return;
    }

    activeBook = opened.book;
    heading.textContent = activeBook.title || t('readingLibrary.untitled');
    const model = parsePlainText(opened.content, { title: activeBook.title });
    blockCount = model.blocks.length;

    if (blockCount === 0) {
      status.textContent = t('readingBook.empty');
      paragraph.textContent = '';
      controls.replaceChildren();
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = t('readingBook.backToLibrary');
      back.addEventListener('click', () => router.back());
      controls.append(back);
      return;
    }

    const savedIndex = Number(activeBook.blockIndex) || 0;
    session = createReadingSession({ blocks: model.blocks, initialIndex: savedIndex });
    renderCurrent();
    await persistProgress();

    if (savedIndex > 0) {
      const snapshot = session.snapshot();
      status.textContent = format(t('readingBook.resume'), {
        current: snapshot.blockIndex + 1,
        total: blockCount
      });
    }
  })();
}
