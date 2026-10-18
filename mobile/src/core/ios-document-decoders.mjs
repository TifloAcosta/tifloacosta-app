/**
 * Local iOS EPUB/PDF/DAISY decoding. Never uploads or rewrites a user's file.
 * Decoding is separate from persistence so malformed files are rejected before
 * they are inserted into the existing IndexedDB library.
 */
import { parseEpubArchive } from '../../../shared/web-reading-format-adapters.mjs';
import { parseDaisyArchive } from '../../../shared/web-reading-daisy-adapter.mjs';
import { openIosZip } from './ios-zip-reader.mjs';

const MAX_PDF_PAGES = 2000;
const MAX_TEXT_CHARS = 16_000_000;

function failure(code) {
  throw Object.assign(new Error(code), { code });
}
function safeStructured(value) {
  if (!Array.isArray(value?.blocks) || !value.blocks.length) failure('document-without-readable-content');
  const content = JSON.stringify(value);
  if (content.length > MAX_TEXT_CHARS) failure('document-too-large');
  return content;
}

export async function decodeIosArchive(blob, { kind, title = '', zipLoader = openIosZip } = {}) {
  const zip = await zipLoader(blob);
  if (kind === 'epub') {
    const result = await parseEpubArchive(zip, { title });
    return { format: 'epub', title: result.title || title,
      author: result.author || '', language: result.language || '',
      content: safeStructured(result) };
  }
  if (kind === 'daisy') {
    const result = await parseDaisyArchive(zip, { title });
    return { format: result.format, title: result.title || title,
      language: result.language || '', author: '',
      content: safeStructured(result), hasAudio: Boolean(result.containsAudio) };
  }
  failure('unsupported-archive-kind');
}

/**
 * Use bundled PDF.js and its local worker. For a scan without searchable text,
 * report the actual page count so the OCR screen can offer individual pages.
 */
export async function decodeIosPdf(blob, {
  password = '',
  pdfEngine = null,
  workerUrl = '',
  onTask = null
} = {}) {
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const header = new TextDecoder('latin1').decode(head);
  if (!header.includes('%PDF-')) failure('invalid-pdf');
  const engine = pdfEngine || await import('pdfjs-dist/build/pdf.mjs');
  if (!pdfEngine) {
    engine.GlobalWorkerOptions.workerSrc = workerUrl ||
      new URL('./pdf.worker.min.mjs', globalThis.location?.href || 'http://localhost/').href;
  }
  const loading = engine.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    ...(password ? { password } : {}),
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true
  });
  onTask?.(loading);
  let pdf;
  try {
    pdf = await loading.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_PDF_PAGES) failure('pdf-page-limit');
    const pages = [];
    let hasText = false, totalChars = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const extracted = content.items.map(item => {
        const part = String(item?.str || '');
        return part + (item?.hasEOL ? '\n' : ' ');
      }).join('').trim();
      totalChars += extracted.length;
      if (totalChars > MAX_TEXT_CHARS) failure('pdf-text-limit');
      if (extracted) hasText = true;
      pages.push({ number: pageNumber, text: extracted });
      page.cleanup();
    }
    return {
      format: 'pdf',
      pdf: {
        title: String(await pdf.getMetadata().then(v => v?.info?.Title || '').catch(() => '')),
        pageCount: pdf.numPages,
        orderReliable: false,
        pages
      },
      pdfNoText: !hasText,
      pageCount: pdf.numPages,
      content: ''
    };
  } catch (error) {
    if (error?.name === 'PasswordException' || error?.code === 1 || error?.code === 2) {
      return { format: 'pdf', passwordRequired: true, passwordRejected: Boolean(password), content: '', pageCount: 0 };
    }
    throw error;
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
    else await loading.destroy?.().catch(() => {});
  }
}
