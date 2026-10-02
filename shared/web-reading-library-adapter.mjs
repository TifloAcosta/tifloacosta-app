import { listWebTtsVoices } from './web-reading-speech-adapter.mjs';

const DB_NAME = 'tifloacosta-reading-web';
const DB_VERSION = 1;
const BOOK_STATES = new Set(['not-read', 'in-reading', 'read']);
const MARK_TYPES = new Set(['bookmark', 'important', 'review', 'quote']);

function clean(value) {
  return String(value ?? '').trim();
}

function number(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(number(value, fallback)));
}

function createId(prefix='item') {
  if (typeof globalThis.crypto?.randomUUID === 'function') return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function openDatabase(indexedDB) {
  if (!indexedDB?.open) return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('marks')) db.createObjectStore('marks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('derived')) db.createObjectStore('derived', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

function normalizeBook(value={}) {
  const id = clean(value.id);
  if (!id) return null;
  return {
    id,
    title: clean(value.title),
    author: clean(value.author),
    language: clean(value.language).toLowerCase(),
    format: clean(value.format).toLowerCase(),
    state: BOOK_STATES.has(value.state) ? value.state : 'not-read',
    queued: value.queued === true,
    queueIndex: nonNegativeInteger(value.queueIndex),
    percent: Math.min(100, Math.max(0, number(value.percent))),
    blockIndex: nonNegativeInteger(value.blockIndex),
    unitIndex: nonNegativeInteger(value.unitIndex),
    anchorText: clean(value.anchorText),
    mediaTrackIndex: nonNegativeInteger(value.mediaTrackIndex),
    mediaPositionMs: nonNegativeInteger(value.mediaPositionMs),
    importedAt: Math.max(0, number(value.importedAt)),
    lastReadAt: Math.max(0, number(value.lastReadAt)),
    sizeBytes: Math.max(0, number(value.sizeBytes)),
    content: String(value.content ?? '')
  };
}

export function createWebReadingLibraryAdapter({
  indexedDB = globalThis.indexedDB,
  now = () => Date.now()
} = {}) {
  let activeBookId = '';
  let databasePromise = null;

  function database() {
    if (!databasePromise) databasePromise = openDatabase(indexedDB);
    return databasePromise;
  }

  async function all(storeName) {
    const db = await database();
    const tx = db.transaction(storeName, 'readonly');
    const done = transactionDone(tx);
    const values = await requestResult(tx.objectStore(storeName).getAll());
    await done;
    return Array.isArray(values) ? values : [];
  }

  async function get(storeName, key) {
    const db = await database();
    const tx = db.transaction(storeName, 'readonly');
    const done = transactionDone(tx);
    const value = await requestResult(tx.objectStore(storeName).get(key));
    await done;
    return value ?? null;
  }

  async function put(storeName, value) {
    const db = await database();
    const tx = db.transaction(storeName, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(storeName).put(value);
    await done;
    return value;
  }

  async function remove(storeName, key) {
    const db = await database();
    const tx = db.transaction(storeName, 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore(storeName).delete(key);
    await done;
  }

  async function importDocument({
    title = '',
    author = '',
    language = '',
    format = 'txt',
    content = '',
    sizeBytes = 0
  } = {}) {
    const source = String(content ?? '');
    const cleanFormat = clean(format).toLowerCase();
    if (!source || !['txt', 'html', 'htm', 'pdf'].includes(cleanFormat)) return null;
    const timestamp = now();
    const book = normalizeBook({
      id: createId('web-book'),
      title: clean(title) || 'Documento',
      author,
      language,
      format: cleanFormat === 'htm' ? 'html' : cleanFormat,
      state: 'not-read',
      queued: false,
      queueIndex: 0,
      percent: 0,
      blockIndex: 0,
      unitIndex: 0,
      importedAt: timestamp,
      lastReadAt: 0,
      sizeBytes: Math.max(0, number(sizeBytes, new Blob([source]).size)),
      content: source
    });
    await put('books', book);
    return { ...book, content: undefined };
  }

  async function listBooks(options={}) {
    const query = clean(options.query).toLocaleLowerCase();
    const status = clean(options.status) || 'all';
    const format = clean(options.format).toLowerCase();
    const sort = clean(options.sort) || 'lastRead';
    const page = Math.max(1, nonNegativeInteger(options.page, 1));
    const pageSize = Math.max(1, nonNegativeInteger(options.pageSize, 10));

    let books = (await all('books')).map(normalizeBook).filter(Boolean);
    if (query) books = books.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(query));
    if (status !== 'all') books = books.filter(book => book.state === status);
    if (format) books = books.filter(book => book.format === format);

    books.sort((a,b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'author') return a.author.localeCompare(b.author);
      if (sort === 'imported') return b.importedAt - a.importedAt;
      return b.lastReadAt - a.lastReadAt || b.importedAt - a.importedAt;
    });

    const total = books.length;
    const pages = total ? Math.ceil(total / pageSize) : 0;
    const start = (page - 1) * pageSize;
    return {
      items: books.slice(start, start + pageSize).map(({ content, ...book }) => book),
      total,
      page,
      pageSize,
      pages
    };
  }

  async function openBook(id) {
    const book = normalizeBook(await get('books', clean(id)));
    if (!book) return null;
    activeBookId = book.id;
    const { content, ...metadata } = book;
    return { book: metadata, content };
  }

  async function saveProgress(progress={}) {
    const id = clean(progress.id);
    const book = normalizeBook(await get('books', id));
    if (!book) return { saved: false };
    const updated = normalizeBook({
      ...book,
      blockIndex: nonNegativeInteger(progress.blockIndex),
      unitIndex: nonNegativeInteger(progress.unitIndex),
      anchorText: clean(progress.anchorText),
      mediaTrackIndex: nonNegativeInteger(progress.mediaTrackIndex),
      mediaPositionMs: nonNegativeInteger(progress.mediaPositionMs),
      percent: Math.min(100, Math.max(0, number(progress.percent))),
      state: BOOK_STATES.has(progress.state) ? progress.state : 'in-reading',
      lastReadAt: now()
    });
    await put('books', updated);
    return { saved: true };
  }

  async function deleteBook(id) {
    const bookId = clean(id);
    if (!bookId) return { deleted: false };
    await remove('books', bookId);
    for (const mark of await all('marks')) if (mark.bookId === bookId) await remove('marks', mark.id);
    for (const item of await all('derived')) if (item.bookId === bookId) await remove('derived', item.key);
    if (activeBookId === bookId) activeBookId = '';
    return { deleted: true };
  }

  async function getLatestInProgress() {
    const items = (await all('books'))
      .map(normalizeBook)
      .filter(book => book && book.state === 'in-reading')
      .sort((a,b) => b.lastReadAt - a.lastReadAt);
    if (!items.length) return null;
    const { content, ...book } = items[0];
    return { book };
  }

  async function listQueue() {
    return (await all('books'))
      .map(normalizeBook)
      .filter(book => book?.queued)
      .sort((a,b) => a.queueIndex - b.queueIndex)
      .map(({ content, ...book }) => book);
  }

  async function rewriteQueue(books) {
    for (let index=0; index<books.length; index += 1) {
      await put('books', normalizeBook({ ...books[index], queued: true, queueIndex: index }));
    }
  }

  async function addToQueue({ bookId }={}) {
    const book = normalizeBook(await get('books', clean(bookId)));
    if (!book) return { queued: false };
    const queue = await listQueue();
    if (!queue.some(item => item.id === book.id)) {
      await put('books', normalizeBook({ ...book, queued: true, queueIndex: queue.length }));
    }
    return { queued: true };
  }

  async function removeFromQueue({ bookId }={}) {
    const id = clean(bookId);
    const book = normalizeBook(await get('books', id));
    if (!book) return { removed: false };
    await put('books', normalizeBook({ ...book, queued: false, queueIndex: 0 }));
    const remaining = (await all('books')).map(normalizeBook).filter(item => item?.queued && item.id !== id)
      .sort((a,b) => a.queueIndex - b.queueIndex);
    await rewriteQueue(remaining);
    return { removed: true };
  }

  async function moveQueueItem({ bookId, targetIndex }={}) {
    const id = clean(bookId);
    const queue = (await all('books')).map(normalizeBook).filter(book => book?.queued)
      .sort((a,b) => a.queueIndex - b.queueIndex);
    const from = queue.findIndex(book => book.id === id);
    if (from < 0) return { moved: false };
    const [item] = queue.splice(from, 1);
    const target = Math.min(queue.length, nonNegativeInteger(targetIndex));
    queue.splice(target, 0, item);
    await rewriteQueue(queue);
    return { moved: true };
  }

  async function updateBookMetadata(value={}) {
    const book = normalizeBook(await get('books', clean(value.id)));
    if (!book) return { updated: false };
    await put('books', normalizeBook({
      ...book,
      title: clean(value.title) || book.title,
      author: clean(value.author),
      language: clean(value.language).toLowerCase(),
      state: BOOK_STATES.has(value.state) ? value.state : book.state
    }));
    return { updated: true };
  }

  async function listMarks({ bookId, type=null }={}) {
    return (await all('marks'))
      .filter(mark => mark.bookId === clean(bookId) && (!type || mark.type === type))
      .sort((a,b) => a.createdAt - b.createdAt);
  }

  async function addMark(value={}) {
    const type = clean(value.type);
    const bookId = clean(value.bookId);
    if (!bookId || !MARK_TYPES.has(type)) return { added: false };
    const mark = {
      id: createId('web-mark'),
      bookId,
      type,
      blockIndex: nonNegativeInteger(value.blockIndex),
      unitIndex: nonNegativeInteger(value.unitIndex),
      mediaTrackIndex: nonNegativeInteger(value.mediaTrackIndex),
      mediaPositionMs: nonNegativeInteger(value.mediaPositionMs),
      excerpt: clean(value.excerpt),
      reference: clean(value.reference),
      createdAt: now()
    };
    await put('marks', mark);
    return { added: true, mark };
  }

  async function deleteMark({ id }={}) {
    const key = clean(id);
    if (!key) return { deleted: false };
    await remove('marks', key);
    return { deleted: true };
  }

  async function getReadingSettings({ bookId='' }={}) {
    const globalRecord = await get('settings', 'global');
    const bookRecord = bookId ? await get('settings', `book:${clean(bookId)}`) : null;
    return {
      global: globalRecord?.values && typeof globalRecord.values === 'object' ? globalRecord.values : {},
      book: bookRecord?.values && typeof bookRecord.values === 'object' ? bookRecord.values : {}
    };
  }

  async function setReadingSetting({ scope, bookId='', key, value }={}) {
    const recordKey = scope === 'global' ? 'global' : scope === 'book' && clean(bookId) ? `book:${clean(bookId)}` : '';
    const settingKey = clean(key);
    if (!recordKey || !settingKey) return { saved: false };
    const current = await get('settings', recordKey);
    await put('settings', {
      key: recordKey,
      values: { ...(current?.values || {}), [settingKey]: String(value ?? '') }
    });
    return { saved: true };
  }

  async function resetBookReadingSettings({ bookId }={}) {
    const id = clean(bookId);
    if (!id) return { reset: false };
    await remove('settings', `book:${id}`);
    return { reset: true };
  }

  function derivedKey({ bookId, kind, variantKey }) {
    return `${clean(bookId)}:${clean(kind)}:${clean(variantKey)}`;
  }

  async function saveDerivedContent(value={}) {
    const key = derivedKey(value);
    if (key.startsWith('::')) return { saved: false };
    await put('derived', { ...value, key, updatedAt: now() });
    return { saved: true };
  }

  async function getDerivedContent(value={}) {
    const item = await get('derived', derivedKey(value));
    return item ? { ...item, found: true, stale: false } : { found: false };
  }

  async function listDerivedContent({ bookId }={}) {
    return (await all('derived')).filter(item => item.bookId === clean(bookId));
  }

  async function deleteDerivedContent(value={}) {
    await remove('derived', derivedKey(value));
    return { deleted: true };
  }

  function getActiveBookId() {
    return activeBookId;
  }

  async function listTtsVoices() {
    return { voices: listWebTtsVoices() };
  }

  async function openTtsVoiceInstaller() {
    return { opened: false, destination: 'none' };
  }

  async function addListener() {
    return { remove: async () => {} };
  }

  return {
    importDocument,
    listBooks,
    openBook,
    saveProgress,
    deleteBook,
    getLatestInProgress,
    listQueue,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    updateBookMetadata,
    listMarks,
    addMark,
    deleteMark,
    getReadingSettings,
    setReadingSetting,
    resetBookReadingSettings,
    saveDerivedContent,
    getDerivedContent,
    listDerivedContent,
    deleteDerivedContent,
    getActiveBookId,
    listTtsVoices,
    openTtsVoiceInstaller,
    addListener
  };
}
