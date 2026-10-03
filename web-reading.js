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
    ocr: $('#reading-ocr'),
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
    externalVoicesHeading: $('#reading-external-voices-heading'),
    externalVoicesIntro: $('#reading-external-voices-intro'),
    externalVoicesList: $('#reading-external-voices-list'),
    externalVoicesStatus: $('#reading-external-voices-status'),
    rateLabel: $('#reading-rate-label'),
    rate: $('#reading-rate'),
    rateValue: $('#reading-rate-value'),
    settingsToggle: $('#reading-settings-toggle'),
    settingsPanel: $('#reading-settings-web'),
    settingsHeading: $('#reading-settings-heading'),
    settingsStatus: $('#reading-settings-status'),
    libraryToggle: $('#reading-library-toggle'),
    queueMenuToggle: $('#reading-queue-menu-toggle'),
    marksMenuToggle: $('#reading-marks-menu-toggle'),
    audioSpeed: $('#reading-audio-speed'),
    textSize: $('#reading-text-size'),
    fontFamily: $('#reading-font-family'),
    fontWeight: $('#reading-font-weight'),
    lineSpacing: $('#reading-line-spacing'),
    paragraphSpacing: $('#reading-paragraph-spacing'),
    readingWidth: $('#reading-width'),
    readingTheme: $('#reading-theme'),
    highContrast: $('#reading-high-contrast'),
    searchForm: $('#reading-search-form'),
    searchLabel: $('#reading-search-label'),
    search: $('#reading-search'),
    searchButton: $('#reading-search-button'),
    searchStatus: $('#reading-search-status'),
    searchResults: $('#reading-search-results'),
    translationHeading: $('#reading-translation-heading'),
    translationIntro: $('#reading-translation-intro'),
    translationSourceLabel: $('#reading-translation-source-label'),
    translationSource: $('#reading-translation-source'),
    translationTargetLabel: $('#reading-translation-target-label'),
    translationTarget: $('#reading-translation-target'),
    translationPrepare: $('#reading-translation-prepare'),
    translationStart: $('#reading-translation-start'),
    translationStop: $('#reading-translation-stop'),
    translationOriginal: $('#reading-translation-original'),
    translationTranslated: $('#reading-translation-translated'),
    translationStatus: $('#reading-translation-status'),
    save: $('#reading-save'),
    libraryHeading: $('#reading-library-heading'),
    libraryIntro: $('#reading-library-intro'),
    libraryRefresh: $('#reading-library-refresh'),
    libraryStatus: $('#reading-library-status'),
    libraryList: $('#reading-library-list'),
    pdfPasswordWrap: $('#reading-pdf-password-wrap'),
    pdfPasswordLabel: $('#reading-pdf-password-label'),
    pdfPassword: $('#reading-pdf-password'),
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
      heading: 'TifloLector',
      intro: 'Abre TXT, HTML, PDF, DOCX, PPTX, XLSX, EPUB, ODT, RTF, Markdown, FB2 o una imagen, o pega un texto, para leerlo con navegación accesible y las voces disponibles en tu navegador.',
      file: 'Abrir documento o imagen',
      paste: 'O pega aquí el texto',
      prepare: 'Preparar lectura',
      empty: 'Selecciona un archivo o pega algún texto antes de preparar la lectura.',
      unsupported: 'Este archivo todavía no puede abrirse en la versión web de TifloLector.',
      legacyDoc: 'El formato DOC antiguo no se puede leer directamente. Ábrelo en Word o LibreOffice y guárdalo como DOCX.',
      zipLoading: 'Preparando el documento…',
      imageNeedsOcr: 'Esta imagen necesita reconocimiento OCR para convertirse en texto.',
      pdfPassword: 'Contraseña del PDF, si tiene',
      pdfPasswordRequired: 'Este PDF necesita contraseña. Escríbela y vuelve a preparar la lectura.',
      pdfPasswordIncorrect: 'La contraseña del PDF no es correcta.',
      pdfLoading: 'Leyendo PDF…',
      pdfProgress: (page,total) => `Leyendo página ${page} de ${total}…`,
      pdfNoText: 'Este PDF no contiene texto extraíble. Puedes iniciar el reconocimiento OCR.',
      ocr: 'Reconocer con OCR',
      ocrLoading: 'Preparando reconocimiento OCR…',
      ocrPage: (page,total) => `Reconociendo página ${page} de ${total}…`,
      ocrProgress: percent => `Reconocimiento OCR: ${Math.round(percent)}%.`,
      ocrFailed: 'No se pudo completar el reconocimiento OCR.',
      ocrPrivacy: 'El OCR se procesa en este navegador. Los componentes del motor se descargan sólo al activar esta función.',
      failed: 'No se pudo preparar este documento.',
      ready: 'Lectura preparada.',
      document: 'Documento',
      previous: 'Anterior',
      next: 'Siguiente',
      play: 'Reproducir',
      pause: 'Pausa',
      voice: 'Voz',
      defaultVoice: 'Voz predeterminada del navegador',
      externalVoicesHeading: 'Conseguir más voces',
      externalVoicesIntro: 'Consulta proveedores externos para probar, comprar o crear voces distintas de las que ya ofrece el navegador. La compatibilidad depende de cada servicio y plataforma.',
      externalVoicesOpen: name => `Visitar ${name}`,
      externalVoicesNote: 'Se abrirá un servicio externo. La compra, prueba, instalación o cuenta se gestiona directamente con el proveedor.',
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
      markDeleted: 'Marcador eliminado.',
      translationHeading: 'Traducción',
      translationIntro: 'Traduce el documento con el motor disponible en tu navegador. El original se conserva.',
      translationSource: 'Idioma original',
      translationTarget: 'Traducir a',
      translationPrepare: 'Preparar idiomas',
      translationStart: 'Traducir',
      translationStop: 'Detener después de este lote',
      translationOriginal: 'Original',
      translationTranslated: 'Traducción',
      translationUnsupported: 'Este navegador no ofrece traducción integrada para TifloLector.',
      translationChoose: 'Selecciona dos idiomas distintos.',
      translationPreparing: 'Preparando idiomas…',
      translationReady: 'Idiomas preparados. Ya puedes traducir.',
      translationPrepareFailed: 'Este par de idiomas no está disponible en el navegador.',
      translationWorking: (done,total) => `Traduciendo: ${done} de ${total} bloques.`,
      translationComplete: (done,total) => `Traducción completa: ${done} de ${total} bloques.`,
      translationStopped: 'Traducción detenida. Puedes continuar más tarde.',
      translationError: 'No se pudo continuar la traducción.',
      translationShowing: 'Mostrando la traducción.',
      translationShowingOriginal: 'Mostrando el original.'
    },
    en: {
      heading: 'TifloReader',
      intro: 'Open TXT, HTML, PDF, DOCX, PPTX, XLSX, EPUB, ODT, RTF, Markdown, FB2 or an image, or paste text, to read it with accessible navigation and the voices available in your browser.',
      file: 'Open document or image',
      paste: 'Or paste text here',
      prepare: 'Prepare reading',
      empty: 'Select a file or paste some text before preparing the reading.',
      unsupported: 'This file cannot yet be opened in the web version of TifloReader.',
      legacyDoc: 'The old DOC format cannot be read directly. Open it in Word or LibreOffice and save it as DOCX.',
      zipLoading: 'Preparing the document…',
      imageNeedsOcr: 'This image needs OCR recognition before it can be read as text.',
      pdfPassword: 'PDF password, if required',
      pdfPasswordRequired: 'This PDF requires a password. Enter it and prepare the reading again.',
      pdfPasswordIncorrect: 'The PDF password is incorrect.',
      pdfLoading: 'Reading PDF…',
      pdfProgress: (page,total) => `Reading page ${page} of ${total}…`,
      pdfNoText: 'This PDF has no extractable text. You can start OCR recognition.',
      ocr: 'Recognize with OCR',
      ocrLoading: 'Preparing OCR recognition…',
      ocrPage: (page,total) => `Recognizing page ${page} of ${total}…`,
      ocrProgress: percent => `OCR recognition: ${Math.round(percent)}%.`,
      ocrFailed: 'OCR recognition could not be completed.',
      ocrPrivacy: 'OCR is processed in this browser. Recognition components are downloaded only when you activate this feature.',
      failed: 'This document could not be prepared.',
      ready: 'Reading prepared.',
      document: 'Document',
      previous: 'Previous',
      next: 'Next',
      play: 'Play',
      pause: 'Pause',
      voice: 'Voice',
      defaultVoice: 'Browser default voice',
      externalVoicesHeading: 'Get more voices',
      externalVoicesIntro: 'Browse external providers to try, buy or create voices beyond those already exposed by your browser. Compatibility depends on each service and platform.',
      externalVoicesOpen: name => `Visit ${name}`,
      externalVoicesNote: 'An external service will open. Trials, purchases, installation and accounts are handled directly by the provider.',
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
      markDeleted: 'Bookmark deleted.',
      translationHeading: 'Translation',
      translationIntro: 'Translate the document with the engine available in your browser. The original is preserved.',
      translationSource: 'Source language',
      translationTarget: 'Translate to',
      translationPrepare: 'Prepare languages',
      translationStart: 'Translate',
      translationStop: 'Stop after this batch',
      translationOriginal: 'Original',
      translationTranslated: 'Translation',
      translationUnsupported: 'This browser does not provide built-in translation for TifloReader.',
      translationChoose: 'Select two different languages.',
      translationPreparing: 'Preparing languages…',
      translationReady: 'Languages are ready. You can translate now.',
      translationPrepareFailed: 'This language pair is not available in the browser.',
      translationWorking: (done,total) => `Translating: ${done} of ${total} blocks.`,
      translationComplete: (done,total) => `Translation complete: ${done} of ${total} blocks.`,
      translationStopped: 'Translation stopped. You can resume later.',
      translationError: 'Translation could not continue.',
      translationShowing: 'Showing translation.',
      translationShowingOriginal: 'Showing original.'
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
  let pendingPdfFile = null;
  let pendingImageFile = null;
  let ocrBundlePromise = null;
  let zipBundlePromise = null;
  let originalDocumentModel = null;
  let translationDocument = null;
  let translationJob = null;
  let translationPrepared = false;
  let translationRunning = false;
  let translationStopRequested = false;
  let showingTranslation = false;
  let documentVoiceOverride = '';
  let documentRateOverride = null;
  let navigationUnit = 'block';
  let sentenceCursor = 0;
  let sentenceUnits = [];
  let currentUnitIndex = 0;
  const translationMemory = new Map();

  const speechAdapter = typeof shared.createWebReadingSpeechAdapter === 'function'
    ? shared.createWebReadingSpeechAdapter()
    : null;
  const libraryAdapter = typeof shared.createWebReadingLibraryAdapter === 'function'
    ? shared.createWebReadingLibraryAdapter()
    : null;
  const libraryClient = libraryAdapter && typeof shared.createReadingLibraryClient === 'function'
    ? shared.createReadingLibraryClient(libraryAdapter)
    : null;
  const translationAdapter = typeof shared.createWebReadingTranslationAdapter === 'function'
    ? shared.createWebReadingTranslationAdapter()
    : null;
  const translationClient = translationAdapter && typeof shared.createReadingTranslationClient === 'function'
    ? shared.createReadingTranslationClient(translationAdapter)
    : null;

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  function ensureSentenceMetadata() {
    if (!Array.isArray(documentModel?.blocks)) return;
    const segmenter = typeof Intl?.Segmenter === 'function'
      ? new Intl.Segmenter(language(), { granularity:'sentence' })
      : null;
    documentModel.blocks = documentModel.blocks.map(block => {
      if (Array.isArray(block?.sentences) && block.sentences.length) return block;
      const text = String(block?.text || '').trim();
      if (!text) return block;
      const sentences = segmenter
        ? [...segmenter.segment(text)].map(item => String(item.segment || '').trim()).filter(Boolean)
        : text.split(/(?<=[.!?…])\s+/u).map(value => value.trim()).filter(Boolean);
      return { ...block, sentences: sentences.length ? sentences : [text] };
    });
  }

  function buildSentenceUnits() {
    sentenceUnits = [];
    const blocks = Array.isArray(documentModel?.blocks) ? documentModel.blocks : [];
    const segmenter = typeof Intl?.Segmenter === 'function'
      ? new Intl.Segmenter(language(), { granularity:'sentence' })
      : null;
    blocks.forEach((block, blockIndex) => {
      const text = String(block?.text || '').trim();
      if (!text) return;
      const sentences = Array.isArray(block?.sentences) && block.sentences.length ? block.sentences : [text];
      sentences.forEach((sentence, sentenceIndex) => sentenceUnits.push({ blockIndex, sentenceIndex, text:String(sentence || '').trim() }));
    });
    const currentBlock = Number(readingSession?.snapshot?.().blockIndex || 0);
    const found = sentenceUnits.findIndex(item => item.blockIndex >= currentBlock);
    sentenceCursor = found >= 0 ? found : 0;
  }

  function ensureReadingSettingsStructure() {
    if (!els.settingsPanel || els.settingsPanel.dataset.organized === 'true') return;
    els.settingsPanel.dataset.organized = 'true';

    const fieldsets = [...els.settingsPanel.querySelectorAll(':scope > fieldset')];
    const audioFieldset = fieldsets[0] || null;
    const visualFieldset = fieldsets[1] || null;
    const external = els.settingsPanel.querySelector('#reading-external-voices');

    function wrapDetails(node, label, id) {
      if (!node) return null;
      const details = document.createElement('details');
      details.id = id;
      const summary = document.createElement('summary');
      summary.textContent = label;
      node.before(details);
      details.append(summary, node);
      return details;
    }

    const audioDetails = wrapDetails(audioFieldset, language() === 'en' ? 'Audio and voice' : 'Audio y voz', 'reading-audio-settings');
    wrapDetails(visualFieldset, language() === 'en' ? 'Visual presentation' : 'Presentación visual', 'reading-visual-settings');
    wrapDetails(external, language() === 'en' ? 'Find more voices' : 'Buscar más voces', 'reading-more-voices-settings');

    if (audioFieldset) {
      const modeWrap = document.createElement('div');
      const mode = document.createElement('input');
      mode.type = 'checkbox';
      mode.id = 'reading-screen-reader-mode';
      mode.checked = true;
      const modeLabel = document.createElement('label');
      modeLabel.htmlFor = mode.id;
      modeLabel.textContent = language() === 'en'
        ? 'Screen reader mode: do not start speech automatically when a document opens'
        : 'Modo lector de pantalla: no iniciar la lectura automáticamente al abrir un documento';

      const autoWrap = document.createElement('div');
      const auto = document.createElement('input');
      auto.type = 'checkbox';
      auto.id = 'reading-auto-play';
      const autoLabel = document.createElement('label');
      autoLabel.htmlFor = auto.id;
      autoLabel.textContent = language() === 'en'
        ? 'Start TTS automatically when a document opens'
        : 'Iniciar automáticamente la lectura TTS al abrir un documento';

      modeWrap.append(mode, modeLabel);
      autoWrap.append(auto, autoLabel);
      const legend = audioFieldset.querySelector('legend');
      if (legend) legend.after(modeWrap, autoWrap);
      else audioFieldset.prepend(modeWrap, autoWrap);

      els.screenReaderMode = mode;
      els.autoPlay = auto;
      const stored = readWebSettings();
      mode.checked = stored.screenReaderMode !== false;
      auto.checked = stored.autoPlay === true;
      mode.addEventListener('change', () => {
        if (mode.checked) auto.checked = false;
        else if (!Object.prototype.hasOwnProperty.call(readWebSettings(), 'autoPlay')) auto.checked = true;
        saveWebSettings();
      });
      auto.addEventListener('change', () => {
        if (auto.checked) mode.checked = false;
        saveWebSettings();
      });
    }

    if (audioDetails) audioDetails.open = false;
  }

  function ensureDocumentControls() {
    if (!els.reader || document.getElementById('reading-document-controls')) return;
    const actions = els.reader.querySelector('.resource-actions[aria-label="Controles de lectura"]');
    if (!actions) return;

    const section = document.createElement('section');
    section.id = 'reading-document-controls';
    const heading = document.createElement('h4');
    heading.textContent = language() === 'en' ? 'Controls for this document' : 'Controles de este documento';

    const unitLabel = document.createElement('label');
    unitLabel.htmlFor = 'reading-navigation-unit';
    unitLabel.textContent = language() === 'en' ? 'Move forward and back by' : 'Avanzar y retroceder por';
    const unit = document.createElement('select');
    unit.id = 'reading-navigation-unit';
    [['block','Bloque'],['paragraph','Párrafo'],['sentence','Frase']].forEach(([value,label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = language() === 'en'
        ? ({block:'Block',paragraph:'Paragraph',sentence:'Sentence'}[value])
        : label;
      unit.append(option);
    });

    const voiceLabel = document.createElement('label');
    voiceLabel.htmlFor = 'reading-document-voice';
    voiceLabel.textContent = language() === 'en' ? 'Voice for this document' : 'Voz para este documento';
    const voice = document.createElement('select');
    voice.id = 'reading-document-voice';

    const rateLabel = document.createElement('label');
    rateLabel.htmlFor = 'reading-document-rate';
    rateLabel.textContent = language() === 'en' ? 'Speed for this document' : 'Velocidad para este documento';
    const rate = document.createElement('input');
    rate.id = 'reading-document-rate';
    rate.type = 'range';
    rate.min = '0.5'; rate.max = '2'; rate.step = '0.1'; rate.value = String(Number(els.rate?.value || 1));
    const rateValue = document.createElement('output');
    rateValue.id = 'reading-document-rate-value';
    rateValue.htmlFor = rate.id;
    rateValue.value = rate.value;
    rateValue.textContent = rate.value;

    const buttons = document.createElement('div');
    buttons.className = 'resource-actions';
    const bookmark = document.createElement('button');
    bookmark.type = 'button';
    bookmark.id = 'reading-bookmark-inline';
    bookmark.textContent = language() === 'en' ? 'Add bookmark' : 'Añadir marca';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.id = 'reading-reset-document-settings';
    reset.textContent = language() === 'en' ? 'Use general settings' : 'Usar ajustes generales';
    buttons.append(bookmark, reset);

    section.append(heading, unitLabel, unit, voiceLabel, voice, rateLabel, rate, rateValue, buttons);
    actions.after(section);

    els.navigationUnit = unit;
    els.documentVoice = voice;
    els.documentRate = rate;
    els.documentRateValue = rateValue;
    els.documentBookmark = bookmark;
    els.resetDocumentSettings = reset;

    unit.addEventListener('change', () => {
      navigationUnit = unit.value || 'block';
      if (navigationUnit === 'sentence') buildSentenceUnits();
    });
    voice.addEventListener('change', () => {
      documentVoiceOverride = voice.value;
      void rebuildSpeech();
    });
    rate.addEventListener('input', () => {
      rateValue.value = rate.value;
      rateValue.textContent = rate.value;
    });
    rate.addEventListener('change', () => {
      documentRateOverride = Number(rate.value) || null;
      void rebuildSpeech();
    });
    bookmark.addEventListener('click', () => { void addBookmark(); });
    reset.addEventListener('click', () => {
      documentVoiceOverride = '';
      documentRateOverride = null;
      voice.value = '';
      rate.value = String(Number(els.rate?.value || 1));
      rateValue.value = rate.value;
      rateValue.textContent = rate.value;
      void rebuildSpeech();
    });
  }

  function populateDocumentVoices() {
    if (!els.documentVoice) return;
    const selected = documentVoiceOverride;
    els.documentVoice.replaceChildren();
    const inherit = document.createElement('option');
    inherit.value = '';
    inherit.textContent = language() === 'en' ? 'Use general voice' : 'Usar voz general';
    els.documentVoice.append(inherit);
    const voices = typeof shared.listWebTtsVoices === 'function' ? shared.listWebTtsVoices() : [];
    for (const item of voices) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.locale ? `${item.name} — ${item.locale}` : item.name;
      els.documentVoice.append(option);
    }
    if ([...els.documentVoice.options].some(option => option.value === selected)) els.documentVoice.value = selected;
  }

  function t() {
    return copy[language()];
  }

  function organizeGeneralSettingsMenus() {
    if (!els.settingsPanel || els.settingsPanel.dataset.organized === 'true') return;
    els.settingsPanel.dataset.organized = 'true';
    const fieldsets = [...els.settingsPanel.querySelectorAll(':scope > fieldset')];
    const audio = fieldsets[0];
    const visual = fieldsets[1];
    const voices = els.settingsPanel.querySelector('#reading-external-voices');

    function collapse(node, label, id) {
      if (!node) return;
      const details = document.createElement('details');
      details.id = id;
      const summary = document.createElement('summary');
      summary.textContent = label;
      node.before(details);
      details.append(summary, node);
    }

    collapse(audio, language() === 'en' ? 'Audio and voice' : 'Audio y voz', 'reading-audio-settings');
    collapse(visual, language() === 'en' ? 'Visual presentation' : 'Presentación visual', 'reading-visual-settings');
    collapse(voices, language() === 'en' ? 'Find more voices' : 'Buscar más voces', 'reading-more-voices-settings');

    if (audio) {
      const mode = document.createElement('input');
      mode.type = 'checkbox';
      mode.id = 'reading-screen-reader-mode';
      mode.checked = true;
      const modeLabel = document.createElement('label');
      modeLabel.htmlFor = mode.id;
      modeLabel.textContent = language() === 'en'
        ? 'Screen reader mode: do not start speech automatically when a document opens'
        : 'Modo lector de pantalla: no iniciar la lectura automáticamente al abrir un documento';

      const auto = document.createElement('input');
      auto.type = 'checkbox';
      auto.id = 'reading-auto-play';
      const autoLabel = document.createElement('label');
      autoLabel.htmlFor = auto.id;
      autoLabel.textContent = language() === 'en'
        ? 'Start TTS automatically when a document opens'
        : 'Iniciar automáticamente la lectura TTS al abrir un documento';

      const modeRow = document.createElement('div');
      const autoRow = document.createElement('div');
      modeRow.append(mode, modeLabel);
      autoRow.append(auto, autoLabel);
      const legend = audio.querySelector('legend');
      if (legend) legend.after(modeRow, autoRow);
      else audio.prepend(modeRow, autoRow);

      els.screenReaderMode = mode;
      els.autoPlay = auto;
      const stored = readWebSettings();
      mode.checked = stored.screenReaderMode !== false;
      auto.checked = stored.autoPlay === true;
      mode.addEventListener('change', () => {
        if (mode.checked) auto.checked = false;
        saveWebSettings();
      });
      auto.addEventListener('change', () => {
        if (auto.checked) mode.checked = false;
        saveWebSettings();
      });
    }
  }

  function ensurePerDocumentControls() {
    if (!els.reader || document.getElementById('reading-document-controls')) return;
    const mainControls = els.reader.querySelector('.resource-actions[aria-label="Controles de lectura"]');
    if (!mainControls) return;

    const section = document.createElement('section');
    section.id = 'reading-document-controls';
    const heading = document.createElement('h4');
    heading.textContent = language() === 'en' ? 'Controls for this document' : 'Controles de este documento';

    const unitLabel = document.createElement('label');
    unitLabel.htmlFor = 'reading-navigation-unit';
    unitLabel.textContent = language() === 'en' ? 'Move forward and back by' : 'Avanzar y retroceder por';
    const unit = document.createElement('select');
    unit.id = 'reading-navigation-unit';
    for (const [value, es, en] of [
      ['block','Bloque','Block'],
      ['paragraph','Párrafo','Paragraph'],
      ['sentence','Frase','Sentence']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = language() === 'en' ? en : es;
      unit.append(option);
    }

    const voiceLabel = document.createElement('label');
    voiceLabel.htmlFor = 'reading-document-voice';
    voiceLabel.textContent = language() === 'en' ? 'Voice for this document' : 'Voz para este documento';
    const voice = document.createElement('select');
    voice.id = 'reading-document-voice';

    const rateLabel = document.createElement('label');
    rateLabel.htmlFor = 'reading-document-rate';
    rateLabel.textContent = language() === 'en' ? 'Speed for this document' : 'Velocidad para este documento';
    const rate = document.createElement('input');
    rate.type = 'range';
    rate.id = 'reading-document-rate';
    rate.min = '0.5';
    rate.max = '2';
    rate.step = '0.1';
    rate.value = String(Number(els.rate?.value || 1));
    const rateOut = document.createElement('output');
    rateOut.id = 'reading-document-rate-value';
    rateOut.value = rate.value;
    rateOut.textContent = rate.value;

    const actions = document.createElement('div');
    actions.className = 'resource-actions';
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.textContent = language() === 'en' ? 'Add bookmark' : 'Añadir marca';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = language() === 'en' ? 'Use general settings' : 'Usar ajustes generales';
    actions.append(mark, reset);

    section.append(heading, unitLabel, unit, voiceLabel, voice, rateLabel, rate, rateOut, actions);
    mainControls.after(section);

    els.navigationUnit = unit;
    els.documentVoice = voice;
    els.documentRate = rate;
    els.documentRateValue = rateOut;

    unit.addEventListener('change', () => {
      navigationUnit = unit.value || 'block';
      buildSentenceUnits();
    });
    voice.addEventListener('change', () => {
      documentVoiceOverride = voice.value;
      void rebuildSpeech({ blockIndex: readingSession?.snapshot?.().blockIndex || 0, unitIndex: currentUnitIndex });
    });
    rate.addEventListener('input', () => {
      rateOut.value = rate.value;
      rateOut.textContent = rate.value;
    });
    rate.addEventListener('change', () => {
      documentRateOverride = Number(rate.value) || null;
      void rebuildSpeech({ blockIndex: readingSession?.snapshot?.().blockIndex || 0, unitIndex: currentUnitIndex });
    });
    mark.addEventListener('click', () => { void addBookmark(); });
    reset.addEventListener('click', () => {
      documentVoiceOverride = '';
      documentRateOverride = null;
      voice.value = '';
      rate.value = String(Number(els.rate?.value || 1));
      rateOut.value = rate.value;
      rateOut.textContent = rate.value;
      void rebuildSpeech({ blockIndex: readingSession?.snapshot?.().blockIndex || 0, unitIndex: currentUnitIndex });
    });
  }

  function populatePerDocumentVoices() {
    if (!els.documentVoice) return;
    const selected = documentVoiceOverride;
    els.documentVoice.replaceChildren();
    const inherit = document.createElement('option');
    inherit.value = '';
    inherit.textContent = language() === 'en' ? 'Use general voice' : 'Usar voz general';
    els.documentVoice.append(inherit);
    const voices = typeof shared.listWebTtsVoices === 'function' ? shared.listWebTtsVoices() : [];
    for (const item of voices) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.locale ? `${item.name} — ${item.locale}` : item.name;
      els.documentVoice.append(option);
    }
    if ([...els.documentVoice.options].some(option => option.value === selected)) els.documentVoice.value = selected;
  }

  const WEB_READING_SETTINGS_KEY = 'tifloWebReadingSettingsV1';

  function readWebSettings() {
    try {
      const raw = localStorage.getItem(WEB_READING_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function saveWebSettings() {
    const value = {
      voice: els.voice?.value || '',
      rate: Number(els.rate?.value || 1),
      audioSpeed: Number(els.audioSpeed?.value || 1),
      textSize: Number(els.textSize?.value || 1),
      fontFamily: els.fontFamily?.value || 'system',
      fontWeight: els.fontWeight?.value || 'normal',
      lineSpacing: Number(els.lineSpacing?.value || 1.5),
      paragraphSpacing: Number(els.paragraphSpacing?.value || 1),
      readingWidth: Number(els.readingWidth?.value || 72),
      theme: els.readingTheme?.value || 'system',
      highContrast: Boolean(els.highContrast?.checked),
      screenReaderMode: els.screenReaderMode ? Boolean(els.screenReaderMode.checked) : readWebSettings().screenReaderMode !== false,
      autoPlay: els.autoPlay ? Boolean(els.autoPlay.checked) : readWebSettings().autoPlay === true
    };
    try { localStorage.setItem(WEB_READING_SETTINGS_KEY, JSON.stringify(value)); } catch {}
    applyWebSettings(value);
    if (els.settingsStatus) {
      els.settingsStatus.textContent = language() === 'en' ? 'Reading settings saved.' : 'Ajustes de lectura guardados.';
    }
  }

  function applyWebSettings(value = readWebSettings()) {
    if (!els.reader) return;
    const size = Math.max(.75, Math.min(2, Number(value.textSize || 1)));
    const line = Math.max(1, Math.min(2.5, Number(value.lineSpacing || 1.5)));
    const paragraph = Math.max(0, Math.min(3, Number(value.paragraphSpacing || 1)));
    const width = Math.max(30, Math.min(100, Number(value.readingWidth || 72)));
    const familyMap = {
      system: 'inherit',
      'sans-serif': 'Arial, sans-serif',
      serif: 'Georgia, serif',
      monospace: 'ui-monospace, SFMono-Regular, Consolas, monospace'
    };
    els.reader.style.setProperty('--reading-text-size', String(size));
    els.reader.style.setProperty('--reading-line-spacing', String(line));
    els.reader.style.setProperty('--reading-paragraph-spacing', String(paragraph));
    els.reader.style.setProperty('--reading-width', width + 'ch');
    els.reader.style.setProperty('--reading-font-family', familyMap[value.fontFamily] || 'inherit');
    els.reader.style.setProperty('--reading-font-weight', value.fontWeight === 'bold' ? '700' : value.fontWeight === 'medium' ? '600' : '400');
    els.reader.dataset.readingTheme = value.theme || 'system';
    els.reader.dataset.highContrast = value.highContrast ? 'true' : 'false';
  }

  function restoreWebSettings() {
    const value = readWebSettings();
    if (els.rate && value.rate) els.rate.value = String(value.rate);
    if (els.rateValue) {
      els.rateValue.value = els.rate.value;
      els.rateValue.textContent = els.rate.value;
    }
    if (els.audioSpeed && value.audioSpeed) els.audioSpeed.value = String(value.audioSpeed);
    if (els.textSize && value.textSize) els.textSize.value = String(value.textSize);
    if (els.fontFamily && value.fontFamily) els.fontFamily.value = value.fontFamily;
    if (els.fontWeight && value.fontWeight) els.fontWeight.value = value.fontWeight;
    if (els.lineSpacing && value.lineSpacing) els.lineSpacing.value = String(value.lineSpacing);
    if (els.paragraphSpacing && value.paragraphSpacing !== undefined) els.paragraphSpacing.value = String(value.paragraphSpacing);
    if (els.readingWidth && value.readingWidth) els.readingWidth.value = String(value.readingWidth);
    if (els.readingTheme && value.theme) els.readingTheme.value = value.theme;
    if (els.highContrast) els.highContrast.checked = Boolean(value.highContrast);
    applyWebSettings(value);
    return value;
  }

  function togglePanel(button, panel, heading) {
    if (!button || !panel) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    if (opening) queueMicrotask(() => heading?.focus?.());
  }

  function localize() {
    const c = t();
    els.heading.textContent = c.heading;
    els.intro.textContent = c.intro;
    els.fileLabel.textContent = c.file;
    els.pasteLabel.textContent = c.paste;
    els.prepare.textContent = c.prepare;
    els.ocr.textContent = c.ocr;
    els.pdfPasswordLabel.textContent = c.pdfPassword;
    els.previous.textContent = c.previous;
    els.next.textContent = c.next;
    els.play.textContent = c.play;
    els.pause.textContent = c.pause;
    els.voiceLabel.textContent = c.voice;
    els.externalVoicesHeading.textContent = c.externalVoicesHeading;
    els.externalVoicesIntro.textContent = c.externalVoicesIntro;
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
    els.translationHeading.textContent = c.translationHeading;
    els.translationIntro.textContent = c.translationIntro;
    els.translationSourceLabel.textContent = c.translationSource;
    els.translationTargetLabel.textContent = c.translationTarget;
    els.translationPrepare.textContent = c.translationPrepare;
    els.translationStart.textContent = c.translationStart;
    els.translationStop.textContent = c.translationStop;
    els.translationOriginal.textContent = c.translationOriginal;
    els.translationTranslated.textContent = c.translationTranslated;
    if (!documentModel) els.title.textContent = c.document;
    populateVoices();
    renderExternalVoices();
    renderPosition();
    void Promise.all([renderLibrary(), renderQueue(), renderMarks()]);
  }

  function populateVoices() {
    const stored = readWebSettings();
    const selected = els.voice.value || stored.voice || '';
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
    populatePerDocumentVoices();
  }


  function renderExternalVoices() {
    els.externalVoicesList.replaceChildren();
    const providers = Array.isArray(shared.WEB_EXTERNAL_VOICE_PROVIDERS)
      ? shared.WEB_EXTERNAL_VOICE_PROVIDERS
      : [];
    if (!providers.length) return;
    for (const provider of providers) {
      const card = document.createElement('section');
      card.className = 'resource-card';
      const heading = document.createElement('h4');
      heading.textContent = provider.name;
      const note = document.createElement('p');
      note.className = 'resource-meta';
      note.textContent = t().externalVoicesNote;
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = t().externalVoicesOpen(provider.name);
      open.addEventListener('click', () => {
        const allowed = typeof shared.confirmExternalProvider === 'function'
          ? shared.confirmExternalProvider(provider, language())
          : globalThis.confirm?.(t().externalVoicesNote);
        if (!allowed) return;
        els.externalVoicesStatus.textContent = t().externalVoicesNote;
        globalThis.open(provider.url, '_blank', 'noopener,noreferrer');
      });
      card.append(heading, note, open);
      els.externalVoicesList.append(card);
    }
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
    if (navigationUnit === 'sentence') {
      const block = documentModel.blocks[snapshot.blockIndex];
      const count = Array.isArray(block?.sentences) ? block.sentences.length : 1;
      els.position.textContent = language() === 'en'
        ? `Block ${Math.min(total, snapshot.blockIndex + 1)} of ${total}. Sentence ${Math.min(count, currentUnitIndex + 1)} of ${count}.`
        : `Bloque ${Math.min(total, snapshot.blockIndex + 1)} de ${total}. Frase ${Math.min(count, currentUnitIndex + 1)} de ${count}.`;
    } else {
      els.position.textContent = t().position(Math.min(total, snapshot.blockIndex + 1), total);
    }
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
        'speech.voice': documentVoiceOverride || els.voice.value,
        'speech.rate': documentRateOverride || Number(els.rate.value) || 1
      },
      onPositionChange(value) {
        const blockIndex = Number(value?.blockIndex);
        if (!Number.isFinite(blockIndex) || !documentModel?.blocks?.length) return;
        currentUnitIndex = Number(value?.unitIndex) || 0;
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
    ensureSentenceMetadata();
    originalDocumentModel = documentModel;
    translationDocument = null;
    translationJob = null;
    translationPrepared = false;
    translationRunning = false;
    translationStopRequested = false;
    showingTranslation = false;
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
    ensureDocumentControls();
    populateDocumentVoices();
    navigationUnit = els.navigationUnit?.value || 'block';
    buildSentenceUnits();
    currentUnitIndex = 0;
    ensurePerDocumentControls();
    populatePerDocumentVoices();
    buildSentenceUnits();
    renderBlock();
    await rebuildSpeech({ blockIndex: Number(initialIndex) || 0, unitIndex: 0 });
    const playbackPrefs = readWebSettings();
    if (playbackPrefs.autoPlay === true && playbackPrefs.screenReaderMode === false) await play();
    await refreshCurrentQueueState();
    await renderMarks();
    await prepareTranslationUi();
    const playbackPrefs = readWebSettings();
    if (playbackPrefs.autoPlay === true && playbackPrefs.screenReaderMode === false) await play();
    queueMicrotask(() => els.title.focus());
  }

  let pdfBundlePromise = null;

  function isPdfFile(file) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return name.endsWith('.pdf') || type === 'application/pdf';
  }

  function updatePdfPasswordVisibility() {
    els.pdfPasswordWrap.hidden = !isPdfFile(els.file.files?.[0]);
  }

  function isImageFile(file) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return /\.(png|jpe?g|webp)$/i.test(name) || ['image/png','image/jpeg','image/webp'].includes(type);
  }

  function loadZipBundle() {
    if (globalThis.JSZip?.loadAsync) return Promise.resolve(globalThis.JSZip);
    if (zipBundlePromise) return zipBundlePromise;
    zipBundlePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => globalThis.JSZip?.loadAsync
        ? resolve(globalThis.JSZip)
        : reject(new Error('zip-engine-unavailable'));
      script.onerror = () => reject(new Error('zip-engine-unavailable'));
      document.head.append(script);
    });
    return zipBundlePromise;
  }

  async function structuredFromArchive(file, kind) {
    els.status.textContent = t().zipLoading;
    const JSZip = await loadZipBundle();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    let raw;
    if (kind === 'docx') raw = await shared.parseDocxArchive(zip, { title:file.name, language:language() });
    else if (kind === 'pptx') raw = await shared.parsePptxArchive(zip, { title:file.name, language:language() });
    else if (kind === 'xlsx') raw = await shared.parseXlsxArchive(zip, { title:file.name, language:language() });
    else if (kind === 'epub') raw = await shared.parseEpubArchive(zip, { title:file.name, language:language() });
    else raw = await shared.parseOdtArchive(zip, { title:file.name, language:language() });
    return shared.parseStructuredDocument(raw, { title:file.name, language:raw.language || language() });
  }

  function loadOcrBundle() {
    if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
    if (ocrBundlePromise) return ocrBundlePromise;
    ocrBundlePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => globalThis.Tesseract?.createWorker
        ? resolve(globalThis.Tesseract)
        : reject(new Error('ocr-engine-unavailable'));
      script.onerror = () => reject(new Error('ocr-engine-unavailable'));
      document.head.append(script);
    });
    return ocrBundlePromise;
  }

  function loadPdfBundle() {
    if (globalThis.TIFLO_PDF?.extractPdfText) return Promise.resolve(globalThis.TIFLO_PDF);
    if (pdfBundlePromise) return pdfBundlePromise;
    pdfBundlePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'web-pdf.js?v=1.0';
      script.async = true;
      script.onload = () => globalThis.TIFLO_PDF?.extractPdfText
        ? resolve(globalThis.TIFLO_PDF)
        : reject(new Error('pdf-engine-unavailable'));
      script.onerror = () => reject(new Error('pdf-engine-unavailable'));
      document.head.append(script);
    });
    return pdfBundlePromise;
  }

  async function documentFromFile(file) {
    const name = String(file?.name || '');
    const lower = name.toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    if (lower.endsWith('.pdf') || type === 'application/pdf') {
      els.status.textContent = t().pdfLoading;
      const pdf = await loadPdfBundle();
      const payload = await pdf.extractPdfText(file, {
        password: els.pdfPassword.value,
        onProgress({ page, pageCount }) {
          els.status.textContent = t().pdfProgress(page, pageCount);
        }
      });
      if (payload.noText) {
        pendingPdfFile = file;
        throw Object.assign(new Error('pdf-no-text'), { code: 'pdf-no-text', payload });
      }
      pendingPdfFile = null;
      return {
        source: JSON.stringify(payload),
        format: 'pdf',
        model: shared.parsePdfDocument(payload)
      };
    }
    if (lower.endsWith('.doc')) {
      throw Object.assign(new Error('legacy-doc'), { code:'legacy-doc' });
    }
    if (isImageFile(file)) {
      pendingImageFile = file;
      throw Object.assign(new Error('image-needs-ocr'), { code:'image-needs-ocr' });
    }
    if (lower.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return { source:await file.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)).join(',')), format:'docx', model:await structuredFromArchive(file,'docx') };
    }
    if (lower.endsWith('.pptx') || type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return { source:await file.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)).join(',')), format:'pptx', model:await structuredFromArchive(file,'pptx') };
    }
    if (lower.endsWith('.xlsx') || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return { source:await file.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)).join(',')), format:'xlsx', model:await structuredFromArchive(file,'xlsx') };
    }
    if (lower.endsWith('.epub') || type === 'application/epub+zip') {
      return { source:await file.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)).join(',')), format:'epub', model:await structuredFromArchive(file,'epub') };
    }
    if (lower.endsWith('.odt') || type === 'application/vnd.oasis.opendocument.text') {
      return { source:await file.arrayBuffer().then(buffer => Array.from(new Uint8Array(buffer)).join(',')), format:'odt', model:await structuredFromArchive(file,'odt') };
    }
    const source = await file.text();
    if (lower.endsWith('.rtf') || type === 'application/rtf' || type === 'text/rtf') {
      return { source, format:'rtf', model:shared.parseStructuredDocument(shared.parseRtfDocument(source,{title:name,language:language()})) };
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || type === 'text/markdown') {
      return { source, format:'md', model:shared.parseStructuredDocument(shared.parseMarkdownDocument(source,{title:name,language:language()})) };
    }
    if (lower.endsWith('.fb2')) {
      return { source, format:'fb2', model:shared.parseStructuredDocument(shared.parseFb2Document(source,{title:name,language:language()})) };
    }
    if (!(lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.htm') || type === 'text/plain' || type === 'text/html')) {
      throw Object.assign(new Error('unsupported'), { code: 'unsupported' });
    }
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
      els.ocr.hidden = true;
      if (error?.code === 'unsupported') els.status.textContent = t().unsupported;
      else if (error?.code === 'legacy-doc') els.status.textContent = t().legacyDoc;
      else if (error?.code === 'image-needs-ocr') {
        els.status.textContent = `${t().imageNeedsOcr} ${t().ocrPrivacy}`;
        els.ocr.hidden = false;
      }
      else if (error?.code === 'password-required') els.status.textContent = t().pdfPasswordRequired;
      else if (error?.code === 'incorrect-password') els.status.textContent = t().pdfPasswordIncorrect;
      else if (error?.code === 'pdf-no-text') {
        els.status.textContent = `${t().pdfNoText} ${t().ocrPrivacy}`;
        els.ocr.hidden = false;
      } else els.status.textContent = t().failed;
    }
  }

  async function runPdfOcr() {
    if (!pendingPdfFile && !pendingImageFile) return;
    els.ocr.hidden = true;
    els.status.textContent = t().ocrLoading;

    let worker = null;
    try {
      const Tesseract = await loadOcrBundle();
      const pdf = pendingPdfFile ? await loadPdfBundle() : null;
      const languageCode = language() === 'es' ? 'spa' : 'eng';
      worker = await Tesseract.createWorker(languageCode, 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        logger(message) {
          const progress = Number(message?.progress);
          if (Number.isFinite(progress) && progress >= 0) {
            els.status.textContent = t().ocrProgress(progress * 100);
          }
        }
      });

      if (pendingImageFile) {
        const file = pendingImageFile;
        els.status.textContent = t().ocrLoading;
        const result = await worker.recognize(file);
        const text = String(result?.data?.text || '').trim();
        if (!text) throw new Error('ocr-empty');
        pendingImageFile = null;
        await useDocument(
          shared.parseTextDocument(text, { title:file.name, language:language() }),
          file.name,
          { source:text, format:(file.name.split('.').pop() || 'image').toLowerCase() }
        );
        return;
      }

      const file = pendingPdfFile;
      const payload = await pdf.extractPdfText(file, {
        password: els.pdfPassword.value,
        onProgress({ page, pageCount, source }) {
          if (source === 'ocr') els.status.textContent = t().ocrPage(page, pageCount);
        },
        async recognizePage(canvas, { page, pageCount }) {
          els.status.textContent = t().ocrPage(page, pageCount);
          const result = await worker.recognize(canvas);
          return String(result?.data?.text || '').trim();
        }
      });

      if (payload.noText) throw new Error('ocr-empty');
      pendingPdfFile = null;
      await useDocument(
        shared.parsePdfDocument(payload),
        file.name,
        { source: JSON.stringify(payload), format: 'pdf' }
      );
    } catch {
      els.status.textContent = t().ocrFailed;
      els.ocr.hidden = false;
    } finally {
      try { await worker?.terminate?.(); } catch {}
    }
  }


  function languageLabel(code) {
    const value = String(code || '').trim().toLowerCase();
    if (!value) return '';
    try {
      return new Intl.DisplayNames([language()], { type: 'language' }).of(value) || value;
    } catch {
      return value;
    }
  }

  async function documentFingerprint(model) {
    const source = JSON.stringify({
      language: model?.language || '',
      blocks: (Array.isArray(model?.blocks) ? model.blocks : []).map(block => ({
        type: block?.type || '',
        text: block?.text || '',
        page: block?.page || block?.pageNumber || null
      }))
    });
    try {
      if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      }
    } catch {}
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fallback-${(hash >>> 0).toString(16)}-${source.length}`;
  }

  function translationStoreKey(options = {}) {
    return `${options.bookId || 'session'}:${options.kind || ''}:${options.variantKey || ''}`;
  }

  function translationPersistenceClient() {
    return {
      async getDerivedContent(options) {
        if (currentBookId && libraryClient?.getDerivedContent) {
          return libraryClient.getDerivedContent(options);
        }
        return translationMemory.get(translationStoreKey(options)) || null;
      },
      async saveDerivedContent(options) {
        if (currentBookId && libraryClient?.saveDerivedContent) {
          return libraryClient.saveDerivedContent(options);
        }
        translationMemory.set(translationStoreKey(options), {
          ...options,
          sourceSha256: options?.metadata?.sourceSha256 || options?.content?.sourceSha256 || '',
          sourceLanguage: options?.metadata?.sourceLanguage || options?.content?.sourceLanguage || '',
          targetLanguage: options?.metadata?.targetLanguage || options?.content?.targetLanguage || ''
        });
        return true;
      },
      translateBatch: options => translationClient?.translateBatch?.(options)
    };
  }

  function renderTranslationViewButtons() {
    const available = Boolean(translationDocument?.blocks?.length);
    els.translationOriginal.hidden = !available;
    els.translationTranslated.hidden = !available;
    els.translationOriginal.setAttribute('aria-pressed', showingTranslation ? 'false' : 'true');
    els.translationTranslated.setAttribute('aria-pressed', showingTranslation ? 'true' : 'false');
  }

  async function fillTranslationLanguages() {
    els.translationSource.replaceChildren();
    els.translationTarget.replaceChildren();
    const languages = await translationClient?.listTranslationLanguages?.() || [];
    const values = [...new Set(languages.map(value => String(value || '').toLowerCase()).filter(Boolean))].sort();
    for (const code of values) {
      const sourceOption = document.createElement('option');
      sourceOption.value = code;
      sourceOption.textContent = `${languageLabel(code)} (${code})`;
      els.translationSource.append(sourceOption);
      const targetOption = document.createElement('option');
      targetOption.value = code;
      targetOption.textContent = `${languageLabel(code)} (${code})`;
      els.translationTarget.append(targetOption);
    }
    const documentLanguage = String(originalDocumentModel?.language || language()).toLowerCase().split(/[-_]/u)[0];
    if (values.includes(documentLanguage)) els.translationSource.value = documentLanguage;
    const source = els.translationSource.value;
    const preferredTarget = (source === 'es' && values.includes('en') ? 'en' : '')
      || (source === 'en' && values.includes('es') ? 'es' : '')
      || (values.includes(language()) && language() !== source ? language() : '')
      || values.find(code => code !== source)
      || '';
    if (preferredTarget) els.translationTarget.value = preferredTarget;
  }

  async function prepareTranslationUi() {
    translationPrepared = false;
    translationJob = null;
    translationDocument = null;
    showingTranslation = false;
    renderTranslationViewButtons();
    els.translationStart.disabled = true;
    els.translationStop.hidden = true;
    els.translationStatus.textContent = '';
    if (!translationClient || typeof globalThis.Translator?.create !== 'function') {
      els.translationPrepare.disabled = true;
      els.translationStatus.textContent = t().translationUnsupported;
      return;
    }
    els.translationPrepare.disabled = false;
    await fillTranslationLanguages();
  }

  async function prepareTranslationPair() {
    const source = els.translationSource.value;
    const target = els.translationTarget.value;
    translationPrepared = false;
    els.translationStart.disabled = true;
    if (!source || !target || source === target) {
      els.translationStatus.textContent = t().translationChoose;
      return false;
    }
    els.translationStatus.textContent = t().translationPreparing;
    const ready = await translationClient?.prepareTranslationPair?.(source, target, progress => {
      if (Number.isFinite(progress)) {
        els.translationStatus.textContent = `${t().translationPreparing} ${Math.round(progress * 100)}%`;
      }
    });
    translationPrepared = Boolean(ready);
    els.translationStart.disabled = !translationPrepared;
    els.translationStatus.textContent = translationPrepared ? t().translationReady : t().translationPrepareFailed;
    translationJob = null;
    return translationPrepared;
  }

  async function ensureTranslationJob() {
    if (translationJob || !originalDocumentModel) return translationJob;
    const sourceSha256 = await documentFingerprint(originalDocumentModel);
    translationJob = shared.createReadingTranslationJob({
      client: translationPersistenceClient(),
      bookId: currentBookId || 'web-session-document',
      document: originalDocumentModel,
      sourceLanguage: els.translationSource.value,
      targetLanguage: els.translationTarget.value,
      sourceSha256,
      engine: 'browser-translator',
      engineVersion: '1',
      batchSize: 20,
      onProgress(state) {
        if (!state) return;
        const done = Number(state.completedUnits) || 0;
        const total = Number(state.totalUnits) || 0;
        if (state.status === 'complete') {
          els.translationStatus.textContent = t().translationComplete(done, total);
          translationDocument = state.document;
          renderTranslationViewButtons();
        } else if (state.status === 'error' || state.status === 'model-unavailable') {
          els.translationStatus.textContent = t().translationError;
        } else {
          els.translationStatus.textContent = t().translationWorking(done, total);
          if (done > 0) translationDocument = state.document;
        }
      }
    });
    await translationJob.load();
    const state = translationJob.getState();
    if (state.completedUnits > 0) {
      translationDocument = state.document;
      renderTranslationViewButtons();
    }
    return translationJob;
  }

  async function runTranslation() {
    if (translationRunning) return;
    if (!translationPrepared && !(await prepareTranslationPair())) return;
    const job = await ensureTranslationJob();
    if (!job) return;
    translationRunning = true;
    translationStopRequested = false;
    els.translationStop.hidden = false;
    els.translationStop.disabled = false;
    els.translationPrepare.disabled = true;
    els.translationStart.disabled = true;
    try {
      let state = job.getState();
      while (!translationStopRequested && state.status !== 'complete') {
        state = await job.resumeNext();
        if (state.status === 'error' || state.status === 'model-unavailable') break;
      }
      if (translationStopRequested && state.status !== 'complete') {
        els.translationStatus.textContent = `${t().translationWorking(state.completedUnits, state.totalUnits)} ${t().translationStopped}`;
      }
      if (state.completedUnits > 0) {
        translationDocument = state.document;
        renderTranslationViewButtons();
      }
    } finally {
      translationRunning = false;
      els.translationStop.hidden = true;
      els.translationStop.disabled = false;
      els.translationPrepare.disabled = false;
      els.translationStart.disabled = false;
    }
  }

  async function switchTranslationView(useTranslation) {
    const nextDocument = useTranslation ? translationDocument : originalDocumentModel;
    if (!nextDocument?.blocks?.length || !readingSession) return;
    const snapshot = readingSession.snapshot();
    documentModel = nextDocument;
    showingTranslation = Boolean(useTranslation);
    readingSession = shared.createReadingSession({
      blocks: documentModel.blocks,
      initialIndex: snapshot.blockIndex
    });
    searchIndex = shared.createReadingSearchIndex(documentModel);
    await searchIndex.build();
    renderBlock();
    await rebuildSpeech({ blockIndex: snapshot.blockIndex, unitIndex: snapshot.unitIndex || 0 });
    renderTranslationViewButtons();
    els.translationStatus.textContent = useTranslation ? t().translationShowing : t().translationShowingOriginal;
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
    const format = String(opened.book.format || 'txt').toLowerCase();
    let model;
    if (format === 'html') model = shared.parseHtmlDocument(source, { title:opened.book.title, language:opened.book.language || language() });
    else if (format === 'pdf') model = shared.parsePdfDocument(JSON.parse(source));
    else if (format === 'rtf') model = shared.parseStructuredDocument(shared.parseRtfDocument(source,{title:opened.book.title,language:opened.book.language || language()}));
    else if (format === 'md' || format === 'markdown') model = shared.parseStructuredDocument(shared.parseMarkdownDocument(source,{title:opened.book.title,language:opened.book.language || language()}));
    else if (format === 'fb2') model = shared.parseStructuredDocument(shared.parseFb2Document(source,{title:opened.book.title,language:opened.book.language || language()}));
    else if (['docx','epub','odt'].includes(format)) {
      const JSZip = await loadZipBundle();
      const bytes = Uint8Array.from(source.split(',').filter(Boolean).map(Number));
      const zip = await JSZip.loadAsync(bytes);
      const raw = format === 'docx'
        ? await shared.parseDocxArchive(zip,{title:opened.book.title,language:opened.book.language || language()})
        : format === 'epub'
          ? await shared.parseEpubArchive(zip,{title:opened.book.title,language:opened.book.language || language()})
          : await shared.parseOdtArchive(zip,{title:opened.book.title,language:opened.book.language || language()});
      model = shared.parseStructuredDocument(raw);
    } else model = shared.parseTextDocument(source, { title:opened.book.title, language:opened.book.language || language() });
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
    if (!readingSession || !documentModel?.blocks?.length) return;
    if (navigationUnit === 'sentence') {
      buildSentenceUnits();
      const currentBlock = Number(readingSession.snapshot().blockIndex) || 0;
      let current = sentenceUnits.findIndex(item => item.blockIndex === currentBlock && item.sentenceIndex === currentUnitIndex);
      if (current < 0) current = sentenceUnits.findIndex(item => item.blockIndex >= currentBlock);
      if (current < 0) current = 0;
      sentenceCursor = Math.max(0, Math.min(sentenceUnits.length - 1, current + (direction < 0 ? -1 : 1)));
      const target = sentenceUnits[sentenceCursor];
      if (!target) return;
      currentUnitIndex = target.sentenceIndex;
      readingSession = shared.createReadingSession({ blocks: documentModel.blocks, initialIndex: target.blockIndex });
      renderBlock();
      void persistProgress({ unitIndex: currentUnitIndex });
      void speechController?.moveTo?.({ blockIndex: target.blockIndex, unitIndex: currentUnitIndex });
      queueMicrotask(() => els.block.focus());
      return;
    }

    currentUnitIndex = 0;
    if (navigationUnit === 'paragraph') {
      let index = Number(readingSession.snapshot().blockIndex) || 0;
      const step = direction < 0 ? -1 : 1;
      for (index += step; index >= 0 && index < documentModel.blocks.length; index += step) {
        const type = String(documentModel.blocks[index]?.type || '');
        if (type === 'paragraph' || type === 'table-cell' || type === 'list-item') {
          readingSession = shared.createReadingSession({ blocks:documentModel.blocks, initialIndex:index });
          break;
        }
      }
    } else if (direction < 0) readingSession.previous();
    else readingSession.next();

    renderBlock();
    const target = readingSession.snapshot().blockIndex;
    void persistProgress({ unitIndex: 0 });
    void speechController?.moveTo?.({ blockIndex: target, unitIndex: 0 });
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
  els.ocr.addEventListener('click', () => { void runPdfOcr(); });
  els.file.addEventListener('change', () => {
    pendingPdfFile = null;
    pendingImageFile = null;
    els.ocr.hidden = true;
    updatePdfPasswordVisibility();
  });
  els.previous.addEventListener('click', () => move(-1));
  els.next.addEventListener('click', () => move(1));
  els.play.addEventListener('click', () => { void play(); });
  els.pause.addEventListener('click', () => { void pause(); });
  els.voice.addEventListener('change', () => { saveWebSettings(); void rebuildSpeech(); });
  els.rate.addEventListener('input', () => {
    els.rateValue.value = els.rate.value;
    els.rateValue.textContent = els.rate.value;
  });
  els.rate.addEventListener('change', () => { saveWebSettings(); void rebuildSpeech(); });
  els.settingsToggle?.addEventListener('click', () => togglePanel(els.settingsToggle, els.settingsPanel, els.settingsHeading));
  els.libraryToggle?.addEventListener('click', () => togglePanel(els.libraryToggle, document.getElementById('reading-library-web'), els.libraryHeading));
  els.queueMenuToggle?.addEventListener('click', () => togglePanel(els.queueMenuToggle, document.getElementById('reading-queue-web'), els.queueHeading));
  els.marksMenuToggle?.addEventListener('click', () => togglePanel(els.marksMenuToggle, document.getElementById('reading-marks-web'), els.marksHeading));
  for (const control of [els.audioSpeed, els.textSize, els.fontFamily, els.fontWeight, els.lineSpacing, els.paragraphSpacing, els.readingWidth, els.readingTheme, els.highContrast]) {
    control?.addEventListener('change', saveWebSettings);
  }
  els.searchForm.addEventListener('submit', runSearch);
  els.translationPrepare.addEventListener('click', () => { void prepareTranslationPair(); });
  els.translationStart.addEventListener('click', () => { void runTranslation(); });
  els.translationStop.addEventListener('click', () => {
    translationStopRequested = true;
    els.translationStop.disabled = true;
  });
  els.translationOriginal.addEventListener('click', () => { void switchTranslationView(false); });
  els.translationTranslated.addEventListener('click', () => { void switchTranslationView(true); });
  function resetTranslationSelection() {
    translationPrepared = false;
    translationJob = null;
    translationDocument = null;
    showingTranslation = false;
    els.translationStart.disabled = true;
    els.translationStatus.textContent = '';
    renderTranslationViewButtons();
    if (documentModel !== originalDocumentModel && originalDocumentModel?.blocks?.length && readingSession) {
      const snapshot = readingSession.snapshot();
      documentModel = originalDocumentModel;
      readingSession = shared.createReadingSession({
        blocks: documentModel.blocks,
        initialIndex: snapshot.blockIndex
      });
      searchIndex = shared.createReadingSearchIndex(documentModel);
      void searchIndex.build();
      renderBlock();
      void rebuildSpeech({ blockIndex: snapshot.blockIndex, unitIndex: snapshot.unitIndex || 0 });
    }
  }

  els.translationSource.addEventListener('change', resetTranslationSelection);
  els.translationTarget.addEventListener('change', resetTranslationSelection);
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
  organizeGeneralSettingsMenus();
  organizeGeneralSettingsMenus();
  restoreWebSettings();
  localize();
})();
