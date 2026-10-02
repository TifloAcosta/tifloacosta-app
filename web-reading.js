(() => {
  'use strict';

  const shared = window.TIFLO_SHARED;
  if (!shared) return;

  const $ = selector => document.querySelector(selector);
  const els = {
    section: $('#reading-section'),
    heading: $('#reading-heading'),
    intro: $('#reading-intro'),
    fileLabel: $('#reading-file-label'),
    file: $('#reading-file'),
    pasteLabel: $('#reading-paste-label'),
    paste: $('#reading-paste'),
    prepare: $('#reading-prepare'),
    status: $('#reading-status'),
    reader: $('#reading-reader'),
    title: $('#reading-document-title'),
    position: $('#reading-position'),
    block: $('#reading-current-block'),
    previous: $('#reading-previous'),
    next: $('#reading-next'),
    play: $('#reading-play'),
    pause: $('#reading-pause'),
    voiceLabel: $('#reading-voice-label'),
    voice: $('#reading-voice'),
    rateLabel: $('#reading-rate-label'),
    rate: $('#reading-rate'),
    rateValue: $('#reading-rate-value'),
    searchForm: $('#reading-search-form'),
    searchLabel: $('#reading-search-label'),
    search: $('#reading-search'),
    searchButton: $('#reading-search-button'),
    searchStatus: $('#reading-search-status'),
    searchResults: $('#reading-search-results'),
    save: $('#reading-save'),
    libraryHeading: $('#reading-library-heading'),
    libraryIntro: $('#reading-library-intro'),
    libraryRefresh: $('#reading-library-refresh'),
    libraryStatus: $('#reading-library-status'),
    libraryList: $('#reading-library-list'),
    bookmark: $('#reading-bookmark'),
    queueToggle: $('#reading-queue-toggle'),
    markStatus: $('#reading-mark-status'),
    queueHeading: $('#reading-queue-heading'),
    queueIntro: $('#reading-queue-intro'),
    queueStatus: $('#reading-queue-status'),
    queueList: $('#reading-queue-list'),
    marksHeading: $('#reading-marks-heading'),
    marksIntro: $('#reading-marks-intro'),
    marksStatus: $('#reading-marks-status'),
    marksList: $('#reading-marks-list')
  };
  if (!els.section) return;

  const copy = {
    es: {
      heading: 'Leer con TifloAcosta',
      intro: 'Abre un archivo TXT o HTML, o pega un texto, para leerlo con navegación accesible y las voces disponibles en tu navegador.',
      file: 'Abrir archivo TXT o HTML',
      paste: 'O pega aquí el texto',
      prepare: 'Preparar lectura',
      empty: 'Selecciona un archivo o pega algún texto antes de preparar la lectura.',
      unsupported: 'Este archivo todavía no puede abrirse en la versión web de TifloLector.',
      failed: 'No se pudo preparar este documento.',
      ready: 'Lectura preparada.',
      document: 'Documento',
      previous: 'Anterior',
      next: 'Siguiente',
      play: 'Reproducir',
      pause: 'Pausa',
      voice: 'Voz',
      defaultVoice: 'Voz predeterminada del navegador',
      rate: 'Velocidad',
      search: 'Buscar en el documento',
      searchButton: 'Buscar',
      searchEmpty: 'Escribe una palabra o frase para buscar.',
      searchNone: 'No se encontraron resultados.',
      searchCount: n => `${n} resultado${n === 1 ? '' : 's'}.`,
      result: n => `Ir al resultado ${n}`,
      position: (current,total) => `Bloque ${current} de ${total}.`,
      voicesUnavailable: 'El navegador no ha proporcionado ninguna voz adicional todavía.',
      save: 'Guardar en mi biblioteca',
      saved: 'Documento guardado en este navegador.',
      alreadySaved: 'Este documento ya está guardado en tu biblioteca.',
      saveFailed: 'No se pudo guardar el documento en este navegador.',
      libraryHeading: 'Mi biblioteca',
      libraryIntro: 'Los documentos guardados permanecen únicamente en este navegador.',
      refresh: 'Actualizar biblioteca',
      libraryEmpty: 'Todavía no hay documentos guardados.',
      libraryUnavailable: 'El navegador no permite utilizar la biblioteca local.',
      openSaved: 'Abrir',
      deleteSaved: 'Eliminar',
      deleted: 'Documento eliminado de la biblioteca.',
      deleteFailed: 'No se pudo eliminar el documento.',
      progress: percent => `${Math.round(percent)}% leído`,
      bookmark: 'Añadir marcador',
      bookmarked: 'Marcador guardado.',
      bookmarkFailed: 'No se pudo guardar el marcador.',
      queueAdd: 'Añadir a la cola',
      queueRemove: 'Quitar de la cola',
      queueHeading: 'Cola de lectura',
      queueIntro: 'Ordena los documentos que quieres leer después. Nada se abrirá automáticamente.',
      queueEmpty: 'La cola está vacía.',
      queueAdded: 'Documento añadido a la cola.',
      queueRemoved: 'Documento eliminado de la cola.',
      queueUp: 'Subir',
      queueDown: 'Bajar',
      marksHeading: 'Marcadores',
      marksIntro: 'Guarda puntos de lectura del documento abierto para volver a ellos más tarde.',
      marksEmpty: 'Este documento no tiene marcadores.',
      markOpen: 'Ir al marcador',
      markDelete: 'Eliminar marcador',
      markDeleted: 'Marcador eliminado.'
    },
    en: {
      heading: 'Read with TifloAcosta',
      intro: 'Open a TXT or HTML file, or paste text, to read it with accessible navigation and the voices available in your browser.',
      file: 'Open TXT or HTML file',
      paste: 'Or paste text here',
      prepare: 'Prepare reading',
      empty: 'Select a file or paste some text before preparing the reading.',
      unsupported: 'This file cannot yet be opened in the web version of TifloReader.',
      failed: 'This document could not be prepared.',
      ready: 'Reading prepared.',
      document: 'Document',
      previous: 'Previous',
      next: 'Next',
      play: 'Play',
      pause: 'Pause',
      voice: 'Voice',
      defaultVoice: 'Browser default voice',
      rate: 'Speed',
      search: 'Search this document',
      searchButton: 'Search',
      searchEmpty: 'Enter a word or phrase to search for.',
      searchNone: 'No results found.',
      searchCount: n => `${n} result${n === 1 ? '' : 's'}.`,
      result: n => `Go to result ${n}`,
      position: (current,total) => `Block ${current} of ${total}.`,
      voicesUnavailable: 'The browser has not provided any additional voices yet.',
      save: 'Save to my library',
      saved: 'Document saved in this browser.',
      alreadySaved: 'This document is already saved in your library.',
      saveFailed: 'The document could not be saved in this browser.',
      libraryHeading: 'My library',
      libraryIntro: 'Saved documents remain only in this browser.',
      refresh: 'Refresh library',
      libraryEmpty: 'No documents have been saved yet.',
      libraryUnavailable: 'This browser does not allow the local library to be used.',
      openSaved: 'Open',
      deleteSaved: 'Delete',
      deleted: 'Document removed from the library.',
      deleteFailed: 'The document could not be removed.',
      progress: percent => `${Math.round(percent)}% read`,
      bookmark: 'Add bookmark',
      bookmarked: 'Bookmark saved.',
      bookmarkFailed: 'The bookmark could not be saved.',
      queueAdd: 'Add to queue',
      queueRemove: 'Remove from queue',
      queueHeading: 'Reading queue',
      queueIntro: 'Arrange the documents you want to read next. Nothing opens automatically.',
      queueEmpty: 'The queue is empty.',
      queueAdded: 'Document added to the queue.',
      queueRemoved: 'Document removed from the queue.',
      queueUp: 'Move up',
      queueDown: 'Move down',
      marksHeading: 'Bookmarks',
      marksIntro: 'Save reading points in the open document so you can return to them later.',
      marksEmpty: 'This document has no bookmarks.',
      markOpen: 'Go to bookmark',
      markDelete: 'Delete bookmark',
      markDeleted: 'Bookmark deleted.'
    }
  };

  let documentModel = null;
  let readingSession = null;
  let searchIndex = null;
  let speechController = null;
  let currentSource = '';
  let currentFormat = 'txt';
  let currentBookId = '';
  let currentQueued = false;

  const speechAdapter = typeof shared.createWebReadingSpeechAdapter === 'function'
    ? shared.createWebReadingSpeechAdapter()
    : null;
  const libraryAdapter = typeof shared.createWebReadingLibraryAdapter === 'function'
    ? shared.createWebReadingLibraryAdapter()
    : null;
  const libraryClient = libraryAdapter && typeof shared.createReadingLibraryClient === 'function'
    ? shared.createReadingLibraryClient(libraryAdapter)
    : null;

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function t() {
    return copy[language()];
  }

  function localize() {
    const c = t();
    els.heading.textContent = c.heading;
    els.intro.textContent = c.intro;
    els.fileLabel.textContent = c.file;
    els.pasteLabel.textContent = c.paste;
    els.prepare.textContent = c.prepare;
    els.previous.textContent = c.previous;
    els.next.textContent = c.next;
    els.play.textContent = c.play;
    els.pause.textContent = c.pause;
    els.voiceLabel.textContent = c.voice;
    els.rateLabel.textContent = c.rate;
    els.searchLabel.textContent = c.search;
    els.searchButton.textContent = c.searchButton;
    els.save.textContent = c.save;
    els.libraryHeading.textContent = c.libraryHeading;
    els.libraryIntro.textContent = c.libraryIntro;
    els.libraryRefresh.textContent = c.refresh;
    els.bookmark.textContent = c.bookmark;
    els.queueHeading.textContent = c.queueHeading;
    els.queueIntro.textContent = c.queueIntro;
    els.marksHeading.textContent = c.marksHeading;
    els.marksIntro.textContent = c.marksIntro;
    if (!documentModel) els.title.textContent = c.document;
    populateVoices();
    renderPosition();
    void Promise.all([renderLibrary(), renderQueue(), renderMarks()]);
  }

  function populateVoices() {
    const selected = els.voice.value;
    const voices = typeof shared.listWebTtsVoices === 'function' ? shared.listWebTtsVoices() : [];
    els.voice.replaceChildren();
    const base = document.createElement('option');
    base.value = '';
    base.textContent = t().defaultVoice;
    els.voice.append(base);
    for (const voice of voices) {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = voice.locale ? `${voice.name} — ${voice.locale}` : voice.name;
      els.voice.append(option);
    }
    if ([...els.voice.options].some(option => option.value === selected)) els.voice.value = selected;
    if (!voices.length) els.status.textContent = els.status.textContent || t().voicesUnavailable;
  }

  async function persistProgress(extra = {}) {
    if (!libraryClient || !currentBookId || !readingSession || !documentModel?.blocks?.length) return false;
    const snapshot = readingSession.snapshot();
    const current = readingSession.current();
    return libraryClient.saveProgress({
      id: currentBookId,
      blockIndex: snapshot.blockIndex,
      unitIndex: Number(extra.unitIndex) || 0,
      anchorText: String(current?.text || '').slice(0, 160),
      percent: snapshot.percent,
      state: snapshot.percent >= 100 ? 'read' : 'in-reading'
    });
  }

  function renderBlock() {
    if (!documentModel || !readingSession) return;
    const current = readingSession.current();
    els.block.replaceChildren();
    const text = String(current?.text || '').trim();
    if (text) {
      const element = current?.type === 'heading'
        ? document.createElement('h4')
        : document.createElement('p');
      element.textContent = text;
      els.block.append(element);
    }
    renderPosition();
  }

  function renderPosition() {
    if (!documentModel || !readingSession) {
      els.position.textContent = '';
      return;
    }
    const snapshot = readingSession.snapshot();
    const total = Array.isArray(documentModel.blocks) ? documentModel.blocks.length : 0;
    els.position.textContent = t().position(Math.min(total, snapshot.blockIndex + 1), total);
    els.previous.disabled = snapshot.blockIndex <= 0;
    els.next.disabled = snapshot.blockIndex >= Math.max(0, total - 1);
  }

  async function rebuildSpeech(position = null) {
    if (!documentModel || !speechAdapter || typeof shared.createSharedReadingSpeechController !== 'function') return;
    if (speechController) {
      try { await speechController.destroy(); } catch {}
    }
    const snapshot = position || readingSession?.snapshot() || { blockIndex: 0, unitIndex: 0 };
    speechController = shared.createSharedReadingSpeechController({
      client: speechAdapter,
      book: { id: currentBookId || 'web-local-document', title: els.title.textContent || t().document },
      document: documentModel,
      initialPosition: { blockIndex: snapshot.blockIndex || 0, unitIndex: snapshot.unitIndex || 0 },
      settings: {
        'speech.voice': els.voice.value,
        'speech.rate': Number(els.rate.value) || 1
      },
      onPositionChange(value) {
        const blockIndex = Number(value?.blockIndex);
        if (!Number.isFinite(blockIndex) || !documentModel?.blocks?.length) return;
        readingSession = shared.createReadingSession({
          blocks: documentModel.blocks,
          initialIndex: blockIndex
        });
        renderBlock();
        void persistProgress({ unitIndex: value?.unitIndex });
      }
    });
  }

  async function useDocument(model, title, {
    source = '',
    format = 'txt',
    bookId = '',
    initialIndex = 0
  } = {}) {
    if (!model || !Array.isArray(model.blocks) || !model.blocks.length) {
      els.status.textContent = t().failed;
      return;
    }
    documentModel = model;
    currentSource = String(source ?? '');
    currentFormat = String(format || 'txt').toLowerCase();
    currentBookId = String(bookId || '');
    currentQueued = false;
    readingSession = shared.createReadingSession({
      blocks: documentModel.blocks,
      initialIndex: Number(initialIndex) || 0
    });
    searchIndex = shared.createReadingSearchIndex(documentModel);
    await searchIndex.build();
    els.title.textContent = String(title || model.title || t().document);
    els.reader.hidden = false;
    els.save.disabled = Boolean(currentBookId);
    els.bookmark.disabled = !currentBookId;
    els.queueToggle.disabled = !currentBookId;
    updateQueueToggle();
    els.status.textContent = t().ready;
    els.searchResults.replaceChildren();
    els.searchStatus.textContent = '';
    renderBlock();
    await rebuildSpeech({ blockIndex: Number(initialIndex) || 0, unitIndex: 0 });
    await refreshCurrentQueueState();
    await renderMarks();
    queueMicrotask(() => els.title.focus());
  }

  async function documentFromFile(file) {
    const name = String(file?.name || '');
    const lower = name.toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (!(lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.htm') || type === 'text/plain' || type === 'text/html')) {
      throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    }
    const source = await file.text();
    const html = lower.endsWith('.html') || lower.endsWith('.htm') || type === 'text/html';
    return {
      source,
      format: html ? 'html' : 'txt',
      model: html
        ? shared.parseHtmlDocument(source, { title: name, language: language() })
        : shared.parseTextDocument(source, { title: name, language: language() })
    };
  }

  async function prepareReading() {
    els.status.textContent = '';
    try {
      const file = els.file.files?.[0] || null;
      if (file) {
        const prepared = await documentFromFile(file);
        await useDocument(prepared.model, file.name, {
          source: prepared.source,
          format: prepared.format
        });
        return;
      }
      const text = els.paste.value.trim();
      if (!text) {
        els.status.textContent = t().empty;
        return;
      }
      await useDocument(
        shared.parseTextDocument(text, { title: t().document, language: language() }),
        t().document,
        { source: text, format: 'txt' }
      );
    } catch (error) {
      els.status.textContent = error?.code === 'unsupported' ? t().unsupported : t().failed;
    }
  }

  async function saveCurrentDocument() {
    if (!libraryAdapter || !documentModel || !currentSource) {
      els.status.textContent = t().saveFailed;
      return;
    }
    if (currentBookId) {
      els.status.textContent = t().alreadySaved;
      return;
    }
    try {
      const saved = await libraryAdapter.importDocument({
        title: els.title.textContent || t().document,
        language: language(),
        format: currentFormat,
        content: currentSource
      });
      if (!saved?.id) throw new Error('save-failed');
      currentBookId = saved.id;
      currentQueued = false;
      els.save.disabled = true;
      els.bookmark.disabled = false;
      els.queueToggle.disabled = false;
      updateQueueToggle();
      await persistProgress();
      els.status.textContent = t().saved;
      await Promise.all([renderLibrary(), renderQueue(), renderMarks()]);
    } catch {
      els.status.textContent = t().saveFailed;
    }
  }

  async function openSavedBook(id) {
    if (!libraryClient) return;
    const opened = await libraryClient.openBook(id);
    if (!opened?.book) {
      els.libraryStatus.textContent = t().failed;
      return;
    }
    const source = String(opened.content || '');
    const format = opened.book.format === 'html' ? 'html' : 'txt';
    const model = format === 'html'
      ? shared.parseHtmlDocument(source, { title: opened.book.title, language: opened.book.language || language() })
      : shared.parseTextDocument(source, { title: opened.book.title, language: opened.book.language || language() });
    await useDocument(model, opened.book.title, {
      source,
      format,
      bookId: opened.book.id,
      initialIndex: opened.book.blockIndex
    });
    currentQueued = opened.book.queued === true;
    updateQueueToggle();
  }

  async function deleteSavedBook(id) {
    if (!libraryClient) return;
    const deleted = await libraryClient.deleteBook(id);
    els.libraryStatus.textContent = deleted ? t().deleted : t().deleteFailed;
    if (deleted && currentBookId === id) {
      currentBookId = '';
      els.save.disabled = !documentModel;
    }
    await Promise.all([renderLibrary(), renderQueue(), renderMarks()]);
  }

  function updateQueueToggle() {
    els.queueToggle.textContent = currentQueued ? t().queueRemove : t().queueAdd;
    els.queueToggle.setAttribute('aria-pressed', String(currentQueued));
  }

  async function refreshCurrentQueueState() {
    if (!libraryClient || !currentBookId) {
      currentQueued = false;
      updateQueueToggle();
      return;
    }
    const queue = await libraryClient.listQueue();
    currentQueued = queue.some(book => book.id === currentBookId);
    updateQueueToggle();
  }

  async function toggleQueue() {
    if (!libraryClient || !currentBookId) return;
    const changed = currentQueued
      ? await libraryClient.removeFromQueue(currentBookId)
      : await libraryClient.addToQueue(currentBookId);
    if (!changed) return;
    currentQueued = !currentQueued;
    updateQueueToggle();
    els.markStatus.textContent = currentQueued ? t().queueAdded : t().queueRemoved;
    await renderQueue();
  }

  async function addBookmark() {
    if (!libraryClient || !currentBookId || !readingSession) {
      els.markStatus.textContent = t().bookmarkFailed;
      return;
    }
    const snapshot = readingSession.snapshot();
    const block = readingSession.current();
    const mark = await libraryClient.addMark({
      bookId: currentBookId,
      type: 'bookmark',
      blockIndex: snapshot.blockIndex,
      unitIndex: 0,
      excerpt: String(block?.text || '').slice(0, 220),
      reference: t().position(snapshot.blockIndex + 1, documentModel?.blocks?.length || 0)
    });
    els.markStatus.textContent = mark ? t().bookmarked : t().bookmarkFailed;
    if (mark) await renderMarks();
  }

  async function renderMarks() {
    els.marksList.replaceChildren();
    if (!libraryClient || !currentBookId) {
      els.marksStatus.textContent = t().marksEmpty;
      return;
    }
    const marks = await libraryClient.listMarks(currentBookId, 'bookmark');
    if (!marks.length) {
      els.marksStatus.textContent = t().marksEmpty;
      return;
    }
    els.marksStatus.textContent = '';
    for (const mark of marks) {
      const card = document.createElement('section');
      card.className = 'resource-card';
      const excerpt = document.createElement('p');
      excerpt.textContent = mark.excerpt || mark.reference || t().bookmark;
      const actions = document.createElement('div');
      actions.className = 'resource-actions';
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = t().markOpen;
      open.addEventListener('click', () => {
        readingSession = shared.createReadingSession({
          blocks: documentModel.blocks,
          initialIndex: mark.blockIndex
        });
        renderBlock();
        void persistProgress({ unitIndex: mark.unitIndex });
        void rebuildSpeech({ blockIndex: mark.blockIndex, unitIndex: mark.unitIndex });
        queueMicrotask(() => els.block.focus());
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t().markDelete;
      remove.addEventListener('click', () => {
        void (async () => {
          const deleted = await libraryClient.deleteMark(mark.id);
          if (deleted) els.marksStatus.textContent = t().markDeleted;
          await renderMarks();
        })();
      });
      actions.append(open, remove);
      card.append(excerpt, actions);
      els.marksList.append(card);
    }
  }

  async function renderQueue() {
    els.queueList.replaceChildren();
    if (!libraryClient) {
      els.queueStatus.textContent = t().libraryUnavailable;
      return;
    }
    const queue = await libraryClient.listQueue();
    if (!queue.length) {
      els.queueStatus.textContent = t().queueEmpty;
      return;
    }
    els.queueStatus.textContent = '';
    queue.forEach((book, index) => {
      const card = document.createElement('section');
      card.className = 'resource-card';
      const heading = document.createElement('h4');
      heading.textContent = book.title || t().document;
      const actions = document.createElement('div');
      actions.className = 'resource-actions';
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = t().openSaved;
      open.addEventListener('click', () => { void openSavedBook(book.id); });
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = t().queueUp;
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        void (async () => {
          await libraryClient.moveQueueItem(book.id, index - 1);
          await renderQueue();
        })();
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = t().queueDown;
      down.disabled = index === queue.length - 1;
      down.addEventListener('click', () => {
        void (async () => {
          await libraryClient.moveQueueItem(book.id, index + 1);
          await renderQueue();
        })();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t().queueRemove;
      remove.addEventListener('click', () => {
        void (async () => {
          await libraryClient.removeFromQueue(book.id);
          if (book.id === currentBookId) {
            currentQueued = false;
            updateQueueToggle();
          }
          await renderQueue();
        })();
      });
      actions.append(open, up, down, remove);
      card.append(heading, actions);
      els.queueList.append(card);
    });
  }

  async function renderLibrary() {
    els.libraryList.replaceChildren();
    if (!libraryClient) {
      els.libraryStatus.textContent = t().libraryUnavailable;
      return;
    }
    try {
      const page = await libraryClient.listBooks({ page: 1, pageSize: 100, sort: 'lastRead' });
      if (!page.items.length) {
        els.libraryStatus.textContent = t().libraryEmpty;
        return;
      }
      els.libraryStatus.textContent = '';
      for (const book of page.items) {
        const card = document.createElement('section');
        card.className = 'resource-card';

        const heading = document.createElement('h4');
        heading.textContent = book.title || t().document;

        const meta = document.createElement('p');
        meta.className = 'resource-meta';
        meta.textContent = `${String(book.format || '').toUpperCase()} · ${t().progress(book.percent || 0)}`;

        const actions = document.createElement('div');
        actions.className = 'resource-actions';

        const open = document.createElement('button');
        open.type = 'button';
        open.textContent = t().openSaved;
        open.addEventListener('click', () => { void openSavedBook(book.id); });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = t().deleteSaved;
        remove.addEventListener('click', () => { void deleteSavedBook(book.id); });

        actions.append(open, remove);
        card.append(heading, meta, actions);
        els.libraryList.append(card);
      }
    } catch {
      els.libraryStatus.textContent = t().libraryUnavailable;
    }
  }

  function move(direction) {
    if (!readingSession) return;
    if (direction < 0) readingSession.previous();
    else readingSession.next();
    renderBlock();
    void persistProgress();
    void rebuildSpeech();
    queueMicrotask(() => els.block.focus());
  }

  async function play() {
    if (!speechController) await rebuildSpeech();
    await speechController?.play?.();
  }

  async function pause() {
    await speechController?.pause?.();
    await persistProgress();
  }

  async function runSearch(event) {
    event?.preventDefault?.();
    els.searchResults.replaceChildren();
    const query = els.search.value.trim();
    if (!query) {
      els.searchStatus.textContent = t().searchEmpty;
      return;
    }
    if (!searchIndex) {
      els.searchStatus.textContent = t().searchNone;
      return;
    }
    const found = searchIndex.search(query, { limit: 50 });
    els.searchStatus.textContent = found.total ? t().searchCount(found.total) : t().searchNone;
    found.results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'resource-card';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${t().result(index + 1)}: ${result.excerpt}`;
      button.addEventListener('click', () => {
        readingSession = shared.createReadingSession({ blocks: documentModel.blocks, initialIndex: result.blockIndex });
        renderBlock();
        void persistProgress({ unitIndex: result.unitIndex });
        void rebuildSpeech({ blockIndex: result.blockIndex, unitIndex: result.unitIndex });
        queueMicrotask(() => els.block.focus());
      });
      item.append(button);
      els.searchResults.append(item);
    });
  }

  els.prepare.addEventListener('click', () => { void prepareReading(); });
  els.previous.addEventListener('click', () => move(-1));
  els.next.addEventListener('click', () => move(1));
  els.play.addEventListener('click', () => { void play(); });
  els.pause.addEventListener('click', () => { void pause(); });
  els.voice.addEventListener('change', () => { void rebuildSpeech(); });
  els.rate.addEventListener('input', () => {
    els.rateValue.value = els.rate.value;
    els.rateValue.textContent = els.rate.value;
  });
  els.rate.addEventListener('change', () => { void rebuildSpeech(); });
  els.searchForm.addEventListener('submit', runSearch);
  els.save.addEventListener('click', () => { void saveCurrentDocument(); });
  els.libraryRefresh.addEventListener('click', () => { void Promise.all([renderLibrary(), renderQueue(), renderMarks()]); });
  els.bookmark.addEventListener('click', () => { void addBookmark(); });
  els.queueToggle.addEventListener('click', () => { void toggleQueue(); });

  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(localize, 0));
  globalThis.speechSynthesis?.addEventListener?.('voiceschanged', populateVoices);

  els.save.disabled = true;
  els.bookmark.disabled = true;
  els.queueToggle.disabled = true;
  localize();
})();
