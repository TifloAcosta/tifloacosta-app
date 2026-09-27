const MARK_TYPES = ['bookmark', 'important', 'review', 'quote'];

function mediaPosition(value = {}) {
  return {
    mediaTrackIndex: Math.max(0, Math.trunc(Number(value?.mediaTrackIndex) || 0)),
    mediaPositionMs: Math.max(0, Math.trunc(Number(value?.mediaPositionMs) || 0))
  };
}

export function createReadingMarksPanel({ root, client, bookId, t, getPosition, getExcerpt, getReference, onJump }) {
  const section = document.createElement('section');
  section.className = 'reading-panel reading-marks-panel';
  section.hidden = true;

  const heading = document.createElement('h2');
  heading.textContent = t('readingBook.marks');

  const typeLabel = document.createElement('label');
  typeLabel.textContent = t('readingBook.markType');
  const typeSelect = document.createElement('select');
  typeSelect.id = 'reading-mark-type';
  typeLabel.htmlFor = typeSelect.id;
  for (const type of MARK_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = t(`readingBook.markType_${type}`);
    typeSelect.append(option);
  }

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.textContent = t('readingBook.addMark');

  const filterLabel = document.createElement('label');
  filterLabel.textContent = t('readingBook.markFilter');
  const filter = document.createElement('select');
  filter.id = 'reading-mark-filter';
  filterLabel.htmlFor = filter.id;
  const all = document.createElement('option');
  all.value = '';
  all.textContent = t('readingBook.markFilterAll');
  filter.append(all);
  for (const type of MARK_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = t(`readingBook.markType_${type}`);
    filter.append(option);
  }

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = document.createElement('ul');
  list.className = 'reading-marks-list';

  section.append(heading, typeLabel, typeSelect, addButton, filterLabel, filter, status, list);
  root.append(section);

  let destroyed = false;

  async function loadMarks() {
    if (destroyed) return;
    const type = filter.value || null;
    const marks = await client.listMarks(bookId, type);
    if (destroyed) return;
    list.replaceChildren();
    if (!marks.length) {
      status.textContent = t('readingBook.noMarks');
      return;
    }
    status.textContent = '';
    for (const mark of marks) {
      const item = document.createElement('li');
      const description = document.createElement('p');
      description.textContent = `${t(`readingBook.markType_${mark.type}`)}. ${mark.excerpt || mark.reference || ''}`.trim();

      const jump = document.createElement('button');
      jump.type = 'button';
      jump.textContent = t('readingBook.jumpToMark');
      jump.addEventListener('click', () => onJump?.({
        blockIndex: mark.blockIndex,
        unitIndex: mark.unitIndex,
        mediaTrackIndex: mark.mediaTrackIndex,
        mediaPositionMs: mark.mediaPositionMs
      }));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('readingBook.deleteMark');
      remove.addEventListener('click', () => {
        void (async () => {
          const deleted = await client.deleteMark(mark.id);
          if (deleted) await loadMarks();
        })();
      });
      item.append(description, jump, remove);
      list.append(item);
    }
  }

  addButton.addEventListener('click', () => {
    void (async () => {
      const position = getPosition() || {};
      const media = mediaPosition(position);
      const mark = await client.addMark({
        bookId,
        type: typeSelect.value,
        blockIndex: Math.max(0, Math.trunc(Number(position.blockIndex) || 0)),
        unitIndex: Math.max(0, Math.trunc(Number(position.unitIndex) || 0)),
        mediaTrackIndex: media.mediaTrackIndex,
        mediaPositionMs: media.mediaPositionMs,
        excerpt: getExcerpt?.(position) || '',
        reference: getReference?.(position) || `${Math.max(0, Math.trunc(Number(position.blockIndex) || 0)) + 1}:${Math.max(0, Math.trunc(Number(position.unitIndex) || 0)) + 1}`
      });
      status.textContent = mark ? t('readingBook.markAdded') : t('readingBook.markFailed');
      if (mark) await loadMarks();
    })();
  });

  filter.addEventListener('change', () => { void loadMarks(); });

  function open() {
    section.hidden = false;
    void loadMarks();
    queueMicrotask(() => typeSelect.focus());
  }

  function close() { section.hidden = true; }
  function destroy() { destroyed = true; section.remove(); }
  return { open, close, destroy, element: section };
}
