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
    searchResults: $('#reading-search-results')
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
      voicesUnavailable: 'El navegador no ha proporcionado ninguna voz adicional todavía.'
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
      voicesUnavailable: 'The browser has not provided any additional voices yet.'
    }
  };

  let documentModel = null;
  let readingSession = null;
  let searchIndex = null;
  let speechController = null;
  const speechAdapter = typeof shared.createWebReadingSpeechAdapter === 'function'
    ? shared.createWebReadingSpeechAdapter()
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
    if (!documentModel) els.title.textContent = c.document;
    populateVoices();
    renderPosition();
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
      book: { id: 'web-local-document', title: els.title.textContent || t().document },
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
      }
    });
  }

  async function useDocument(model, title) {
    if (!model || !Array.isArray(model.blocks) || !model.blocks.length) {
      els.status.textContent = t().failed;
      return;
    }
    documentModel = model;
    readingSession = shared.createReadingSession({ blocks: documentModel.blocks, initialIndex: 0 });
    searchIndex = shared.createReadingSearchIndex(documentModel);
    await searchIndex.build();
    els.title.textContent = String(title || model.title || t().document);
    els.reader.hidden = false;
    els.status.textContent = t().ready;
    els.searchResults.replaceChildren();
    els.searchStatus.textContent = '';
    renderBlock();
    await rebuildSpeech();
    queueMicrotask(() => els.title.focus());
  }

  async function modelFromFile(file) {
    const name = String(file?.name || '');
    const lower = name.toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (!(lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.htm') || type === 'text/plain' || type === 'text/html')) {
      throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    }
    const source = await file.text();
    if (lower.endsWith('.html') || lower.endsWith('.htm') || type === 'text/html') {
      return shared.parseHtmlDocument(source, { title: name, language: language() });
    }
    return shared.parseTextDocument(source, { title: name, language: language() });
  }

  async function prepareReading() {
    els.status.textContent = '';
    try {
      const file = els.file.files?.[0] || null;
      if (file) {
        await useDocument(await modelFromFile(file), file.name);
        return;
      }
      const text = els.paste.value.trim();
      if (!text) {
        els.status.textContent = t().empty;
        return;
      }
      await useDocument(shared.parseTextDocument(text, { title: t().document, language: language() }), t().document);
    } catch (error) {
      els.status.textContent = error?.code === 'unsupported' ? t().unsupported : t().failed;
    }
  }

  function move(direction) {
    if (!readingSession) return;
    if (direction < 0) readingSession.previous();
    else readingSession.next();
    renderBlock();
    void rebuildSpeech();
    queueMicrotask(() => els.block.focus());
  }

  async function play() {
    if (!speechController) await rebuildSpeech();
    await speechController?.play?.();
  }

  async function pause() {
    await speechController?.pause?.();
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

  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(localize, 0));
  globalThis.speechSynthesis?.addEventListener?.('voiceschanged', populateVoices);

  localize();
})();
