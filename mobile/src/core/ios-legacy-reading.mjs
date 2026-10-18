/**
 * iOS staging bridge: reuse the existing, on-device TifloLector IndexedDB
 * (tifloacosta-reading-web, version 2). No export/delete/copy/migration runs
 * on startup. The original five stores retain their IDs, marks and blobs.
 *
 * This is NOT a release-complete iOS reading engine: PDF/EPUB/DAISY import,
 * audio playback, native rotor controls and receipt transfer require separate
 * acceptance before the TestFlight gate can be opened.
 */
import { createWebReadingLibraryAdapter } from '../../../shared/web-reading-library-adapter.mjs';

const TEXT_EXTENSIONS = new Set(['txt', 'html', 'htm', 'md', 'markdown', 'rtf', 'fb2']);
const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

function emptyBatch(cancelled = false) {
  return { cancelled, audioChoiceRequired: false, selectionId: '',
    selectedNames: [], imported: [], duplicates: [], rejected: [] };
}

function extension(name) {
  const value = String(name || '').trim().toLowerCase();
  return value.includes('.') ? value.split('.').at(-1) : '';
}

function resultError(name, reason) {
  return { ...emptyBatch(), rejected: [{ name: String(name || 'Archivo'), reason }] };
}

/**
 * Dependencies are injectable so regression tests cannot access a real device.
 * Constructing this bridge does not open or modify IndexedDB.
 */
export function createIosLegacyReadingBridge({
  library = createWebReadingLibraryAdapter(),
  accessibility = null,
  capacitor = null,
  nativeTts = null,
  readFile = globalThis.fetch
} = {}) {
  async function pickDocuments() {
    if (typeof accessibility?.pickDocument !== 'function' ||
        typeof capacitor?.convertFileSrc !== 'function') {
      return resultError('Archivos', 'El selector nativo de iOS no está disponible.');
    }
    let picked;
    try { picked = await accessibility.pickDocument(); }
    catch { return resultError('Archivos', 'No se pudo abrir el selector de archivos.'); }
    if (picked?.cancelled) return emptyBatch(true);
    const name = String(picked?.name || '').trim();
    const uri = String(picked?.uri || '').trim();
    if (!name || !uri || !uri.startsWith('file://')) {
      return resultError(name, 'El documento elegido no tiene una dirección local válida.');
    }
    const ext = extension(name);
    if (!TEXT_EXTENSIONS.has(ext) && ext !== 'mp3') {
      // Do NOT pretend to have imported EPUB/PDF/DAISY or silently overwrite them.
      return resultError(name, 'Este formato aún no está integrado en el nuevo lector para iOS.');
    }
    try {
      const localUrl = capacitor.convertFileSrc(uri);
      if (!localUrl || typeof readFile !== 'function') throw Error('file-url-unavailable');
      const response = await readFile(localUrl);
      if (!response?.ok) throw Error('file-read-failed');
      const blob = await response.blob();
      if (!blob?.size || blob.size > MAX_IMPORT_BYTES) {
        return resultError(name, 'Archivo vacío o superior al límite de 32 MB.');
      }
      let imported;
      if (ext === 'mp3') {
        const audio = blob.slice(0, blob.size, 'audio/mpeg');
        imported = await library.importAudioFile({
          file: audio, title: name.replace(/\.mp3$/i, '')
        });
      } else {
        imported = await library.importDocument({
          title: name.replace(/\.[^.]+$/, ''),
          format: ext,
          content: await blob.text(),
          sizeBytes: blob.size
        });
      }
      return imported ? { ...emptyBatch(), selectedNames: [name], imported: [imported] }
        : resultError(name, 'No se han podido guardar los datos del archivo.');
    } catch {
      return resultError(name, 'La lectura o el guardado ha fallado; el original no se ha eliminado.');
    }
  }

  // Shared file receipts are acknowledged ONLY after the original IndexedDB
  // record and, where relevant, its actual binary media have been read back.
  async function importReceivedBlob({ name = '', blob = null } = {}) {
    const filename = String(name || '').trim();
    const ext = extension(filename);
    if (!filename || !blob || !blob.size || blob.size > MAX_IMPORT_BYTES ||
        (!TEXT_EXTENSIONS.has(ext) && ext !== 'mp3')) {
      return { saved: false, reason: 'unsupported-or-empty' };
    }
    try {
      const title = filename.replace(/\.[^.]+$/, '');
      const textContent = ext === 'mp3' ? '' : await blob.text();
      const incoming = ext === 'mp3'
        ? await library.importAudioFile({ file: blob.slice(0, blob.size, 'audio/mpeg'), title })
        : await library.importDocument({ title, format: ext, content: textContent, sizeBytes: blob.size });
      if (!incoming?.id) return { saved: false, reason: 'import-failed' };
      const reopened = await library.openBook(incoming.id);
      if (reopened?.book?.id !== incoming.id) {
        return { saved: false, reason: 'readback-failed' };
      }
      if (ext === 'mp3') {
        const media = await library.openAudioFile(incoming.id);
        if (media?.blob?.size !== blob.size) return { saved: false, reason: 'media-readback-failed' };
      } else if (reopened.content !== textContent) {
        return { saved: false, reason: 'text-readback-failed' };
      }
      return { saved: true, id: incoming.id, title: incoming.title };
    } catch {
      return { saved: false, reason: 'import-or-readback-failed' };
    }
  }

  async function listTtsVoices() {
    if (typeof nativeTts?.listTtsVoices !== 'function') return { voices: [] };
    try { return await nativeTts.listTtsVoices(); }
    catch { return { voices: [] }; }
  }

  async function openTtsVoiceInstaller() {
    return { opened: false, destination: 'none' };
  }

  async function addListener(eventName, listener) {
    if (String(eventName).startsWith('tts') && typeof nativeTts?.addListener === 'function' &&
        typeof listener === 'function') {
      try { return await nativeTts.addListener(eventName, listener); }
      catch { /* optional */ }
    }
    return { remove: async () => {} };
  }

  const passthrough = [
    'listBooks', 'saveProgress', 'getLatestInProgress',
    'listQueue', 'addToQueue', 'removeFromQueue', 'moveQueueItem',
    'updateBookMetadata', 'listMarks', 'addMark', 'deleteMark',
    'getReadingSettings', 'setReadingSetting', 'resetBookReadingSettings',
    'saveDerivedContent', 'getDerivedContent', 'listDerivedContent',
    'deleteDerivedContent', 'getActiveBookId'
  ];
  const result = { pickDocuments, importReceivedBlob, listTtsVoices, openTtsVoiceInstaller,
    addListener, consumeInitialSharedDocuments: async () => emptyBatch() };
  for (const name of passthrough) {
    result[name] = (...args) => library[name](...args);
  }
  // Previous versions stored already-extracted PDF text in the original books
  // store. The mobile reading client expects a PDF page payload, not a plain
  // `content` string. Adapt that legacy record only at read time: never rewrite
  // its ID, text, page progress, marks, or IndexedDB schema on app startup.
  result.openBook = async id => {
    const opened = await library.openBook(id);
    if (opened?.book?.format !== 'pdf' || opened.pdf || opened.pdfNoText ||
        opened.passwordRequired) return opened;
    const content = String(opened.content ?? '');
    if (!content.trim()) return { ...opened, pdfNoText: true, pageCount: 0 };
    const pages = content.split('\\f').map((text, index) => ({ number: index + 1, text }));
    return {
      ...opened,
      pdf: {
        title: String(opened.book.title || ''),
        author: String(opened.book.author || ''),
        language: String(opened.book.language || ''),
        pageCount: pages.length,
        orderReliable: false,
        pages
      }
    };
  };
  // The staged reader can show, search and continue existing documents using
  // their ORIGINAL IDs. Unsupported native operations remain explicitly absent
  // rather than being presented as successfully migrated.
  result.deleteBook = id => library.deleteBook(id);
  return result;
}
