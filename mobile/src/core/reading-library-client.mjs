const BOOK_STATES = new Set(['not-read', 'in-reading', 'read']);
const BOOK_SORTS = new Set(['title', 'author', 'imported', 'lastRead']);
const MARK_TYPES = new Set(['bookmark', 'important', 'review', 'quote']);
const AUDIO_SLEEP_MINUTES = new Set([15, 30, 45, 60]);

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(numberOr(value, fallback)));
}

function integerOr(value, fallback = 0) {
  return Math.trunc(numberOr(value, fallback));
}

function positiveInteger(value, fallback) {
  const number = Math.trunc(numberOr(value, fallback));
  return number > 0 ? number : fallback;
}

function clampRate(value) {
  return Math.min(2, Math.max(0.5, numberOr(value, 1)));
}

function clampAudioSpeed(value) {
  return Math.min(3, Math.max(0.5, numberOr(value, 1)));
}

function booleanValue(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeBook(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  if (!id) return null;
  const percent = Math.min(100, Math.max(0, numberOr(value.percent, 0)));
  const state = BOOK_STATES.has(value.state) ? value.state : 'not-read';
  return {
    id,
    title: String(value.title ?? '').trim(),
    author: String(value.author ?? '').trim(),
    language: String(value.language ?? '').trim().toLowerCase(),
    format: String(value.format ?? '').trim().toLowerCase(),
    state,
    queued: booleanValue(value.queued),
    queueIndex: nonNegativeInteger(value.queueIndex, 0),
    percent,
    blockIndex: nonNegativeInteger(value.blockIndex, 0),
    unitIndex: nonNegativeInteger(value.unitIndex, 0),
    anchorText: String(value.anchorText ?? '').trim(),
    mediaTrackIndex: nonNegativeInteger(value.mediaTrackIndex, 0),
    mediaPositionMs: nonNegativeInteger(value.mediaPositionMs, 0),
    importedAt: Math.max(0, numberOr(value.importedAt, 0)),
    lastReadAt: Math.max(0, numberOr(value.lastReadAt, 0)),
    sizeBytes: Math.max(0, numberOr(value.sizeBytes, 0))
  };
}

function normalizePdfPage(value) {
  if (!value || typeof value !== 'object') return null;
  const number = positiveInteger(value.number, 0);
  if (number <= 0) return null;
  return { number, text: String(value.text ?? '') };
}

function normalizePdfPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    title: String(value.title ?? '').trim(),
    author: String(value.author ?? '').trim(),
    language: String(value.language ?? '').trim(),
    pageCount: nonNegativeInteger(value.pageCount, 0),
    orderReliable: value.orderReliable === true,
    pages: (Array.isArray(value.pages) ? value.pages : []).map(normalizePdfPage).filter(Boolean)
  };
}

function normalizeRejected(value) {
  if (!value || typeof value !== 'object') return null;
  return { name: String(value.name ?? '').trim(), reason: String(value.reason ?? '').trim() };
}

function normalizeBatch(value, { cancelledDefault = false } = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    cancelled: source.cancelled === true || (value == null && cancelledDefault),
    audioChoiceRequired: source.audioChoiceRequired === true,
    selectionId: String(source.selectionId ?? '').trim(),
    selectedNames: (Array.isArray(source.selectedNames) ? source.selectedNames : [])
      .map(name => String(name ?? '').trim())
      .filter(Boolean),
    imported: (Array.isArray(source.imported) ? source.imported : []).map(normalizeBook).filter(Boolean),
    duplicates: (Array.isArray(source.duplicates) ? source.duplicates : []).map(normalizeBook).filter(Boolean),
    rejected: (Array.isArray(source.rejected) ? source.rejected : []).map(normalizeRejected).filter(Boolean)
  };
}

function normalizeAudioTrack(value) {
  if (!value || typeof value !== 'object') return null;
  const bookId = String(value.bookId ?? '').trim();
  const relativePath = String(value.relativePath ?? '').trim();
  if (!bookId || !relativePath) return null;
  const embeddedTrackNumber = positiveInteger(value.embeddedTrackNumber, 0);
  return {
    bookId,
    trackIndex: nonNegativeInteger(value.trackIndex, 0),
    relativePath,
    originalName: String(value.originalName ?? '').trim(),
    title: String(value.title ?? '').trim(),
    durationMs: nonNegativeInteger(value.durationMs, 0),
    embeddedTrackNumber: embeddedTrackNumber > 0 ? embeddedTrackNumber : null,
    sizeBytes: nonNegativeInteger(value.sizeBytes, 0)
  };
}

function normalizeListOptions(options = {}) {
  const status = BOOK_STATES.has(options.status) ? options.status : 'all';
  const sort = BOOK_SORTS.has(options.sort) ? options.sort : 'lastRead';
  const format = String(options.format ?? '').trim().toLowerCase();
  const normalized = {
    page: positiveInteger(options.page, 1),
    pageSize: positiveInteger(options.pageSize, 10),
    query: String(options.query ?? '').trim(),
    status,
    sort
  };
  if (format) normalized.format = format;
  return normalized;
}

function normalizeList(value, requested) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    items: (Array.isArray(source.items) ? source.items : []).map(normalizeBook).filter(Boolean),
    total: nonNegativeInteger(source.total, 0),
    page: positiveInteger(source.page, requested.page),
    pageSize: positiveInteger(source.pageSize, requested.pageSize),
    pages: nonNegativeInteger(source.pages, 0)
  };
}

function mutationSucceeded(value, key) {
  if (value === true) return true;
  return Boolean(value && typeof value === 'object' && value[key] === true);
}

function normalizeVoice(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    name: String(value.name ?? '').trim(),
    language: String(value.language ?? '').trim().toLowerCase(),
    locale: String(value.locale ?? '').trim(),
    networkRequired: value.networkRequired === true
  };
}

function normalizeMark(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id ?? '').trim();
  const bookId = String(value.bookId ?? '').trim();
  const type = String(value.type ?? '').trim();
  if (!id || !bookId || !MARK_TYPES.has(type)) return null;
  return {
    id,
    bookId,
    type,
    blockIndex: nonNegativeInteger(value.blockIndex, 0),
    unitIndex: nonNegativeInteger(value.unitIndex, 0),
    mediaTrackIndex: nonNegativeInteger(value.mediaTrackIndex, 0),
    mediaPositionMs: nonNegativeInteger(value.mediaPositionMs, 0),
    excerpt: String(value.excerpt ?? '').trim(),
    reference: String(value.reference ?? '').trim(),
    createdAt: Math.max(0, numberOr(value.createdAt, 0))
  };
}

function normalizeAudioState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    bookId: String(value.bookId ?? '').trim(),
    trackIndex: nonNegativeInteger(value.trackIndex, 0),
    trackCount: nonNegativeInteger(value.trackCount, 0),
    positionMs: nonNegativeInteger(value.positionMs, 0),
    durationMs: nonNegativeInteger(value.durationMs, 0),
    playing: booleanValue(value.playing),
    speed: clampAudioSpeed(value.speed),
    prepared: booleanValue(value.prepared)
  };
}

function normalizeAudioEvent(value) {
  const state = normalizeAudioState(value);
  if (!state) return null;
  const reason = String(value?.reason ?? '').trim();
  return reason ? { ...state, reason } : state;
}

function plainSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value };
}

export function createReadingLibraryClient(plugin = {}) {
  async function pickDocuments() {
    if (!plugin?.pickDocuments) return normalizeBatch(null);
    try { return normalizeBatch(await plugin.pickDocuments()); } catch { return normalizeBatch(null); }
  }

  async function resolveAudioSelection(selection = {}) {
    if (!plugin?.resolveAudioSelection) return normalizeBatch(null, { cancelledDefault: true });
    const mode = ['grouped', 'independent', 'cancel'].includes(selection?.mode) ? selection.mode : 'cancel';
    try {
      return normalizeBatch(await plugin.resolveAudioSelection({
        selectionId: String(selection?.selectionId ?? '').trim(),
        mode
      }));
    } catch {
      return normalizeBatch(null, { cancelledDefault: true });
    }
  }

  async function listAudioTracks(bookId) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.listAudioTracks) return [];
    try {
      const result = await plugin.listAudioTracks({ bookId: cleanBookId });
      const values = Array.isArray(result) ? result : Array.isArray(result?.tracks) ? result.tracks : [];
      return values.map(normalizeAudioTrack).filter(Boolean).sort((a, b) => a.trackIndex - b.trackIndex);
    } catch { return []; }
  }

  async function consumeInitialSharedDocuments() {
    if (!plugin?.consumeInitialSharedDocuments) return normalizeBatch(null);
    try { return normalizeBatch(await plugin.consumeInitialSharedDocuments()); } catch { return normalizeBatch(null); }
  }

  async function listBooks(options = {}) {
    const requested = normalizeListOptions(options);
    if (!plugin?.listBooks) return normalizeList(null, requested);
    try { return normalizeList(await plugin.listBooks(requested), requested); } catch { return normalizeList(null, requested); }
  }

  async function listQueue() {
    if (!plugin?.listQueue) return [];
    try {
      const result = await plugin.listQueue();
      const values = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
      return values.map(normalizeBook).filter(Boolean).sort((a, b) => a.queueIndex - b.queueIndex);
    } catch { return []; }
  }

  async function addToQueue(bookId) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.addToQueue) return false;
    try { return mutationSucceeded(await plugin.addToQueue({ bookId: cleanBookId }), 'queued'); } catch { return false; }
  }

  async function removeFromQueue(bookId) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.removeFromQueue) return false;
    try { return mutationSucceeded(await plugin.removeFromQueue({ bookId: cleanBookId }), 'removed'); } catch { return false; }
  }

  async function moveQueueItem(bookId, targetIndex) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.moveQueueItem) return false;
    try {
      return mutationSucceeded(await plugin.moveQueueItem({
        bookId: cleanBookId,
        targetIndex: nonNegativeInteger(targetIndex, 0)
      }), 'moved');
    } catch { return false; }
  }

  async function updateBookMetadata(book = {}) {
    if (!plugin?.updateBookMetadata) return false;
    const id = String(book?.id ?? '').trim();
    const title = String(book?.title ?? '').trim();
    if (!id || !title) return false;
    try {
      return mutationSucceeded(await plugin.updateBookMetadata({
        id,
        title,
        author: String(book?.author ?? '').trim(),
        language: String(book?.language ?? '').trim().toLowerCase(),
        state: BOOK_STATES.has(book?.state) ? book.state : 'not-read'
      }), 'updated');
    } catch { return false; }
  }

  async function openBook(id, options = {}) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.openBook) return null;
    const password = String(options?.password ?? '');
    try {
      const result = await plugin.openBook(cleanId, { password });
      if (!result || typeof result !== 'object') return null;
      const book = normalizeBook(result.book);
      if (!book) return null;
      if (book.format === 'pdf') {
        if (result.passwordRequired === true) {
          return { book, passwordRequired: true, passwordRejected: result.passwordRejected === true };
        }
        if (result.pdfNoText === true) {
          return { book, pdfNoText: true, pageCount: nonNegativeInteger(result.pageCount, 0) };
        }
        const pdf = normalizePdfPayload(result.pdf);
        return pdf ? { book, pdf } : null;
      }
      if (book.format === 'audio') {
        return { book, audioTracks: await listAudioTracks(book.id) };
      }
      return { book, content: String(result.content ?? '') };
    } catch { return null; }
  }

  async function saveProgress(progress = {}) {
    if (!plugin?.saveProgress) return false;
    const id = String(progress?.id ?? '').trim();
    if (!id) return false;
    try {
      const result = await plugin.saveProgress({
        id,
        blockIndex: nonNegativeInteger(progress.blockIndex, 0),
        unitIndex: nonNegativeInteger(progress.unitIndex, 0),
        anchorText: String(progress.anchorText ?? '').trim(),
        mediaTrackIndex: nonNegativeInteger(progress.mediaTrackIndex, 0),
        mediaPositionMs: nonNegativeInteger(progress.mediaPositionMs, 0),
        percent: Math.min(100, Math.max(0, numberOr(progress.percent, 0))),
        state: BOOK_STATES.has(progress.state) ? progress.state : 'in-reading'
      });
      return mutationSucceeded(result, 'saved');
    } catch { return false; }
  }

  async function deleteBook(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.deleteBook) return false;
    try { return mutationSucceeded(await plugin.deleteBook(cleanId), 'deleted'); } catch { return false; }
  }

  async function getLatestInProgress() {
    if (!plugin?.getLatestInProgress) return null;
    try {
      const result = await plugin.getLatestInProgress();
      return normalizeBook(result?.book ?? result);
    } catch { return null; }
  }

  async function listTtsVoices() {
    if (!plugin?.listTtsVoices) return [];
    try {
      const result = await plugin.listTtsVoices();
      const values = Array.isArray(result) ? result : Array.isArray(result?.voices) ? result.voices : [];
      return values.map(normalizeVoice).filter(Boolean);
    } catch { return []; }
  }

  async function startTts(options = {}) {
    if (!plugin?.startTts) return false;
    const sessionId = String(options?.sessionId ?? '').trim();
    const utteranceId = String(options?.utteranceId ?? '').trim();
    const text = String(options?.text ?? '').trim();
    if (!sessionId || !utteranceId || !text) return false;
    try {
      return mutationSucceeded(await plugin.startTts({
        sessionId,
        utteranceId,
        text,
        voiceId: String(options?.voiceId ?? '').trim(),
        rate: clampRate(options?.rate)
      }), 'accepted');
    } catch { return false; }
  }

  async function stopTts() {
    if (!plugin?.stopTts) return false;
    try { return mutationSucceeded(await plugin.stopTts(), 'stopped'); } catch { return false; }
  }

  async function prepareAudio(options = {}) {
    const bookId = String(options?.bookId ?? '').trim();
    const relativePath = String(options?.relativePath ?? '').trim();
    if (!bookId || !plugin?.prepareAudio) return null;
    try {
      return normalizeAudioState(await plugin.prepareAudio({
        bookId,
        relativePath,
        trackIndex: nonNegativeInteger(options.trackIndex, 0),
        positionMs: nonNegativeInteger(options.positionMs, 0)
      }));
    } catch { return null; }
  }

  async function playAudio() {
    if (!plugin?.playAudio) return null;
    try { return normalizeAudioState(await plugin.playAudio()); } catch { return null; }
  }

  async function pauseAudio() {
    if (!plugin?.pauseAudio) return null;
    try { return normalizeAudioState(await plugin.pauseAudio()); } catch { return null; }
  }

  async function seekAudio(options = {}) {
    if (!plugin?.seekAudio) return null;
    try { return normalizeAudioState(await plugin.seekAudio({ positionMs: nonNegativeInteger(options.positionMs, 0) })); } catch { return null; }
  }

  async function skipAudio(options = {}) {
    if (!plugin?.skipAudio) return null;
    try { return normalizeAudioState(await plugin.skipAudio({ deltaMs: integerOr(options.deltaMs, 0) })); } catch { return null; }
  }

  async function previousAudioTrack() {
    if (!plugin?.previousAudioTrack) return null;
    try { return normalizeAudioState(await plugin.previousAudioTrack()); } catch { return null; }
  }

  async function nextAudioTrack() {
    if (!plugin?.nextAudioTrack) return null;
    try { return normalizeAudioState(await plugin.nextAudioTrack()); } catch { return null; }
  }

  async function setAudioSpeed(options = {}) {
    if (!plugin?.setAudioSpeed) return null;
    try { return normalizeAudioState(await plugin.setAudioSpeed({ speed: clampAudioSpeed(options.speed) })); } catch { return null; }
  }

  async function setAudioSleepTimer(options = {}) {
    if (!plugin?.setAudioSleepTimer) return false;
    const atTrackEnd = options?.atTrackEnd === true;
    const minutes = nonNegativeInteger(options?.minutes, 0);
    if (!atTrackEnd && !AUDIO_SLEEP_MINUTES.has(minutes)) return false;
    try {
      return mutationSucceeded(await plugin.setAudioSleepTimer({ minutes, atTrackEnd }), 'scheduled');
    } catch { return false; }
  }

  async function cancelAudioSleepTimer() {
    if (!plugin?.cancelAudioSleepTimer) return false;
    try { return mutationSucceeded(await plugin.cancelAudioSleepTimer(), 'cancelled'); } catch { return false; }
  }

  async function getAudioState() {
    if (!plugin?.getAudioState) return null;
    try { return normalizeAudioState(await plugin.getAudioState()); } catch { return null; }
  }

  async function stopAudio() {
    if (!plugin?.stopAudio) return null;
    try { return normalizeAudioState(await plugin.stopAudio()); } catch { return null; }
  }

  async function listMarks(bookId, type = null) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.listMarks) return [];
    const cleanType = MARK_TYPES.has(type) ? type : null;
    try {
      const result = await plugin.listMarks({ bookId: cleanBookId, type: cleanType });
      const values = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : [];
      return values.map(normalizeMark).filter(Boolean);
    } catch { return []; }
  }

  async function addMark(mark = {}) {
    if (!plugin?.addMark) return null;
    const bookId = String(mark?.bookId ?? '').trim();
    const type = String(mark?.type ?? '').trim();
    if (!bookId || !MARK_TYPES.has(type)) return null;
    const request = {
      bookId,
      type,
      blockIndex: nonNegativeInteger(mark.blockIndex, 0),
      unitIndex: nonNegativeInteger(mark.unitIndex, 0),
      mediaTrackIndex: nonNegativeInteger(mark.mediaTrackIndex, 0),
      mediaPositionMs: nonNegativeInteger(mark.mediaPositionMs, 0),
      excerpt: String(mark.excerpt ?? '').trim(),
      reference: String(mark.reference ?? '').trim()
    };
    try {
      const result = await plugin.addMark(request);
      if (!mutationSucceeded(result, 'added')) return null;
      return normalizeMark(result?.mark ?? result);
    } catch { return null; }
  }

  async function deleteMark(id) {
    const cleanId = String(id ?? '').trim();
    if (!cleanId || !plugin?.deleteMark) return false;
    try { return mutationSucceeded(await plugin.deleteMark({ id: cleanId }), 'deleted'); } catch { return false; }
  }

  async function getReadingSettings(bookId = '') {
    if (!plugin?.getReadingSettings) return { global: {}, book: {} };
    try {
      const result = await plugin.getReadingSettings({ bookId: String(bookId ?? '').trim() });
      return { global: plainSettings(result?.global), book: plainSettings(result?.book) };
    } catch { return { global: {}, book: {} }; }
  }

  async function setReadingSetting(setting = {}) {
    if (!plugin?.setReadingSetting) return false;
    const scope = setting?.scope === 'book' ? 'book' : setting?.scope === 'global' ? 'global' : '';
    const key = String(setting?.key ?? '').trim();
    const bookId = scope === 'book' ? String(setting?.bookId ?? '').trim() : '';
    if (!scope || !key || (scope === 'book' && !bookId)) return false;
    try {
      return mutationSucceeded(await plugin.setReadingSetting({
        scope,
        bookId,
        key,
        value: String(setting?.value ?? '')
      }), 'saved');
    } catch { return false; }
  }

  async function resetBookReadingSettings(bookId) {
    const cleanBookId = String(bookId ?? '').trim();
    if (!cleanBookId || !plugin?.resetBookReadingSettings) return false;
    try { return mutationSucceeded(await plugin.resetBookReadingSettings({ bookId: cleanBookId }), 'reset'); } catch { return false; }
  }

  async function addListener(eventName, listener) {
    if (!plugin?.addListener || typeof listener !== 'function') return { remove: async () => {} };
    const cleanEventName = String(eventName ?? '');
    const wrappedListener = cleanEventName.startsWith('audio')
      ? value => {
          const normalized = normalizeAudioEvent(value);
          if (normalized) return listener(normalized);
        }
      : listener;
    try { return await plugin.addListener(cleanEventName, wrappedListener); } catch { return { remove: async () => {} }; }
  }

  return {
    pickDocuments,
    resolveAudioSelection,
    listAudioTracks,
    consumeInitialSharedDocuments,
    listBooks,
    listQueue,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    updateBookMetadata,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    listTtsVoices,
    startTts,
    stopTts,
    prepareAudio,
    playAudio,
    pauseAudio,
    seekAudio,
    skipAudio,
    previousAudioTrack,
    nextAudioTrack,
    setAudioSpeed,
    setAudioSleepTimer,
    cancelAudioSleepTimer,
    getAudioState,
    stopAudio,
    listMarks,
    addMark,
    deleteMark,
    getReadingSettings,
    setReadingSetting,
    resetBookReadingSettings,
    addListener
  };
}

export { normalizeBook as normalizeReadingBook };