import { createReadingOcrFlow } from '../core/reading-ocr-flow.mjs';

function text(t, key, es, en) {
  const translated = typeof t === 'function' ? t(key) : '';
  if (translated && translated !== key) return translated;
  return document.documentElement.lang === 'en' ? en : es;
}

function format(template, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    String(template ?? '')
  );
}

export function createReadingOcrPanel({
  root,
  client,
  book,
  pageCount,
  password = '',
  t,
  onOpenRecognized
}) {
  const section = document.createElement('section');
  section.className = 'reading-panel reading-ocr-panel';
  section.setAttribute('aria-labelledby', 'reading-ocr-heading');

  const heading = document.createElement('h2');
  heading.id = 'reading-ocr-heading';
  heading.textContent = text(t, 'readingBook.ocrHeading', 'Reconocer texto del PDF', 'Recognize PDF text');

  const explanation = document.createElement('p');
  explanation.textContent = text(
    t,
    'readingBook.ocrExplanation',
    'Este PDF no contiene texto accesible. Puedes reconocer una página cada vez y continuar después sin perder lo ya procesado.',
    'This PDF has no accessible text. You can recognize one page at a time and continue later without losing completed pages.'
  );

  const scriptLabel = document.createElement('label');
  scriptLabel.textContent = text(t, 'readingBook.ocrScript', 'Alfabeto del documento', 'Document script');
  const scriptSelect = document.createElement('select');
  scriptSelect.id = 'reading-ocr-script';
  scriptLabel.htmlFor = scriptSelect.id;
  const scriptOptions = [
    ['latin', 'Latino', 'Latin'],
    ['chinese', 'Chino', 'Chinese'],
    ['devanagari', 'Devanagari', 'Devanagari'],
    ['japanese', 'Japonés', 'Japanese'],
    ['korean', 'Coreano', 'Korean']
  ];
  for (const [value, es, en] of scriptOptions) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = document.documentElement.lang === 'en' ? en : es;
    scriptSelect.append(option);
  }

  const pageLabel = document.createElement('label');
  pageLabel.textContent = text(t, 'readingBook.ocrPage', 'Página que quieres reconocer', 'Page to recognize');
  const pageInput = document.createElement('input');
  pageInput.type = 'number';
  pageInput.id = 'reading-ocr-page';
  pageInput.min = '1';
  pageInput.max = String(Math.max(1, Number(pageCount) || 1));
  pageInput.step = '1';
  pageInput.value = '1';
  pageLabel.htmlFor = pageInput.id;

  const recognizeButton = document.createElement('button');
  recognizeButton.type = 'button';
  recognizeButton.textContent = text(t, 'readingBook.ocrRecognizePage', 'Reconocer esta página', 'Recognize this page');

  const resumeButton = document.createElement('button');
  resumeButton.type = 'button';
  resumeButton.textContent = text(t, 'readingBook.ocrResume', 'Continuar por la primera página pendiente', 'Continue with first pending page');

  const openRecognizedButton = document.createElement('button');
  openRecognizedButton.type = 'button';
  openRecognizedButton.textContent = text(t, 'readingBook.ocrOpenText', 'Leer el texto ya reconocido', 'Read recognized text');
  openRecognizedButton.disabled = true;

  const progress = document.createElement('p');
  progress.className = 'reading-ocr-progress';
  progress.setAttribute('role', 'status');
  progress.setAttribute('aria-live', 'polite');
  progress.setAttribute('aria-atomic', 'true');

  const pageResult = document.createElement('div');
  pageResult.className = 'reading-ocr-page-result';
  const pageResultHeading = document.createElement('h3');
  pageResultHeading.textContent = text(t, 'readingBook.ocrResult', 'Resultado de la página', 'Page result');
  const pageResultText = document.createElement('p');
  pageResult.append(pageResultHeading, pageResultText);

  section.append(
    heading,
    explanation,
    scriptLabel,
    scriptSelect,
    pageLabel,
    pageInput,
    recognizeButton,
    resumeButton,
    openRecognizedButton,
    progress,
    pageResult
  );
  root.append(section);

  let destroyed = false;
  let flow = null;

  function stateText(state) {
    const completed = Number(state?.completedUnits) || 0;
    const total = Number(state?.pageCount) || Number(pageCount) || 0;
    if (state?.status === 'model-unavailable') {
      return text(
        t,
        'readingBook.ocrModelUnavailable',
        'El modelo de reconocimiento todavía no está disponible. Comprueba la conexión y vuelve a intentarlo.',
        'The recognition model is not available yet. Check the connection and try again.'
      );
    }
    if (state?.status === 'error') {
      return text(t, 'readingBook.ocrError', 'No se pudo reconocer la página.', 'The page could not be recognized.');
    }
    if (state?.status === 'recognizing') {
      return text(t, 'readingBook.ocrRecognizing', 'Reconociendo la página…', 'Recognizing page…');
    }
    if (state?.status === 'complete') {
      return format(
        text(t, 'readingBook.ocrComplete', 'OCR completo: {completed} de {total} páginas.', 'OCR complete: {completed} of {total} pages.'),
        { completed, total }
      );
    }
    return format(
      text(t, 'readingBook.ocrProgress', 'OCR: {completed} de {total} páginas reconocidas.', 'OCR: {completed} of {total} pages recognized.'),
      { completed, total }
    );
  }

  function renderState({ focusPage = false } = {}) {
    const state = flow?.getState?.() || { pages: [], completedUnits: 0, pageCount };
    progress.textContent = stateText(state);
    openRecognizedButton.disabled = !state.pages?.length;
    resumeButton.disabled = state.nextMissingPage == null;
    if (state.nextMissingPage != null && !focusPage) pageInput.value = String(state.nextMissingPage + 1);
    return state;
  }

  function createFlow(script) {
    return createReadingOcrFlow({
      client,
      bookId: book?.id,
      pageCount,
      password,
      script
    });
  }

  async function load() {
    flow = createFlow(scriptSelect.value || 'latin');
    await flow.load();
    if (destroyed) return;
    renderState();
  }

  async function recognize(pageIndex) {
    if (!flow) await load();
    recognizeButton.disabled = true;
    resumeButton.disabled = true;
    progress.textContent = text(t, 'readingBook.ocrRecognizing', 'Reconociendo la página…', 'Recognizing page…');
    const result = await flow.recognizePage(pageIndex);
    if (destroyed) return result;
    recognizeButton.disabled = false;
    const state = renderState({ focusPage: true });
    if (result.status === 'ok') {
      pageResultText.textContent = result.text;
      pageResultHeading.textContent = format(
        text(t, 'readingBook.ocrResultPage', 'Resultado de la página {page}', 'Result for page {page}'),
        { page: pageIndex + 1 }
      );
    } else if (result.status === 'empty') {
      pageResultText.textContent = text(
        t,
        'readingBook.ocrEmpty',
        'No se ha encontrado texto reconocible en esta página.',
        'No recognizable text was found on this page.'
      );
    } else {
      pageResultText.textContent = stateText({ ...state, status: result.status });
      progress.textContent = pageResultText.textContent;
    }
    return result;
  }

  recognizeButton.addEventListener('click', () => {
    const page = Number.parseInt(pageInput.value, 10);
    const total = Math.max(0, Number(pageCount) || 0);
    if (!Number.isInteger(page) || page < 1 || page > total) {
      progress.textContent = format(
        text(t, 'readingBook.ocrInvalidPage', 'Indica una página entre 1 y {total}.', 'Enter a page between 1 and {total}.'),
        { total }
      );
      pageInput.focus();
      return;
    }
    void recognize(page - 1);
  });

  resumeButton.addEventListener('click', () => {
    void (async () => {
      if (!flow) await load();
      const next = flow.getState().nextMissingPage;
      if (next == null) return;
      pageInput.value = String(next + 1);
      await recognize(next);
    })();
  });

  scriptSelect.addEventListener('change', () => {
    void load();
  });

  openRecognizedButton.addEventListener('click', () => {
    const state = renderState({ focusPage: true });
    const pages = (state.pages || []).map(page => ({
      number: page.pageIndex + 1,
      text: page.text
    }));
    if (pages.length) onOpenRecognized?.(pages, state.script);
  });

  function destroy() {
    destroyed = true;
    section.remove();
  }

  return { load, destroy, focus: () => heading.focus?.() };
}
