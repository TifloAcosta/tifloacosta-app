import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function textFromItems(items = []) {
  const lines = [];
  let current = '';
  let lastY = null;

  for (const item of items) {
    const text = clean(item?.str);
    if (!text) continue;
    const y = Number(item?.transform?.[5]);
    if (lastY !== null && Number.isFinite(y) && Math.abs(y - lastY) > 3 && current) {
      lines.push(current.trim());
      current = '';
    }
    current += (current ? ' ' : '') + text;
    if (Number.isFinite(y)) lastY = y;
    if (item?.hasEOL === true && current) {
      lines.push(current.trim());
      current = '';
      lastY = null;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n').trim();
}

export async function extractPdfText(file, {
  password = '',
  onProgress = () => {},
  recognizePage = null
} = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw Object.assign(new Error('invalid-pdf'), { code: 'invalid-pdf' });
  }

  const data = new Uint8Array(await file.arrayBuffer());
  let loadingTask;
  try {
    loadingTask = pdfjsLib.getDocument({
      data,
      password: String(password || ''),
      useWorkerFetch: true,
      isEvalSupported: false
    });
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata().catch(() => null);
    const info = metadata?.info || {};
    const pages = [];
    let textPages = 0;

    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const textContent = await page.getTextContent();
      let text = textFromItems(textContent?.items || []);
      let source = text ? 'embedded' : 'empty';

      if (!text && typeof recognizePage === 'function') {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: context, viewport }).promise;
          text = clean(await recognizePage(canvas, {
            page: index,
            pageCount: pdf.numPages
          }));
          source = text ? 'ocr' : 'empty';
        }
      }

      if (text) textPages += 1;
      pages.push({ number: index, text, source });
      onProgress({ page: index, pageCount: pdf.numPages, hasText: Boolean(text), source });
      page.cleanup?.();
    }

    await pdf.destroy?.();

    return {
      title: clean(info.Title) || clean(file.name),
      author: clean(info.Author),
      language: '',
      pageCount: pages.length,
      orderReliable: true,
      textPages,
      noText: textPages === 0,
      pages
    };
  } catch (error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    if (/PasswordException/i.test(name) || /password/i.test(message)) {
      const reason = Number(error?.code) === 2 ? 'incorrect-password' : 'password-required';
      throw Object.assign(new Error(reason), { code: reason });
    }
    throw Object.assign(new Error('pdf-read-failed'), { code: 'pdf-read-failed', cause: error });
  } finally {
    try { await loadingTask?.destroy?.(); } catch {}
  }
}
