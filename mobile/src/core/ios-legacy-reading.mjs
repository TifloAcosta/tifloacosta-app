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
import { createIosLocalAudio } from './ios-local-audio.mjs';
import { createIosDaisyAudio } from './ios-daisy-audio.mjs';
import { decodeIosArchive, decodeIosPdf } from './ios-document-decoders.mjs';

const TEXT_EXTENSIONS = new Set(['txt', 'html', 'htm', 'md', 'markdown', 'rtf', 'fb2']);
const MAX_IMPORT_BYTES = 256 * 1024 * 1024;
const BINARY_EXTENSIONS = new Set(['epub', 'pdf', 'zip', 'daisy']);
const MAX_PDF_BYTES = 32 * 1024 * 1024;

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
  readFile = globalThis.fetch,
  audioPlayback = null,
  decodeArchive = decodeIosArchive,
  decodePdf = decodeIosPdf
} = {}) {
  // Local audio is lazy; construction never opens or alters the old database.
  const mp3Player = audioPlayback || createIosLocalAudio({ library });
  const daisyPlayer = createIosDaisyAudio({ library });
  let player = mp3Player;
  async function backendForBook(bookId) {
    const opened = await library.openBook(String(bookId || ''));
    return ['daisy2.02', 'daisy3'].includes(opened?.book?.format) ? daisyPlayer : mp3Player;
  }
  async function listAudioTracks({ bookId } = {}) {
    const backend = await backendForBook(bookId);
    return backend.listAudioTracks({ bookId });
  }
  // Changing between MP3 and DAISY must never leave two audio engines active.
  async function prepareAudio(options = {}) {
    const selected = await backendForBook(options.bookId);
    if (selected !== player) await player.stopAudio();
    player = selected;
    return player.prepareAudio(options);
  }

  // A file is confirmed only when reopening the ORIGINAL IndexedDB key and
  // comparing every byte against the supplied document. No destructive reset.
  async function equalBlobs(a, b) {
    if (!(a instanceof Blob) || !(b instanceof Blob) || a.size !== b.size) return false;
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < a.size; offset += chunkSize) {
      const [first, second] = await Promise.all([
        a.slice(offset, offset + chunkSize).arrayBuffer(),
        b.slice(offset, offset + chunkSize).arrayBuffer()
      ]);
      const x = new Uint8Array(first), y = new Uint8Array(second);
      if (x.length !== y.length || x.some((byte, i) => byte !== y[i])) return false;
    }
    return true;
  }
  async function verifySaved(imported, format, sourceBlob, textContent = '') {
    if (!imported?.id) return false;
    const opened = await library.openBook(imported.id);
    if (opened?.book?.id !== imported.id) return false;
    if (format === 'audio' || format === 'pdf' || format === 'epub' ||
        format === 'daisy2.02' || format === 'daisy3') {
      const binary = format === 'audio' ? await library.openAudioFile?.(imported.id)
        : format.startsWith('daisy') ? await library.openDaisyArchive?.(imported.id)
        : await library.openBinaryDocument?.(imported.id);
      return binary?.book?.id === imported.id && await equalBlobs(sourceBlob, binary.blob);
    }
    return opened.content === textContent;
  }

  async function importBlob({ name, blob }) {
    const filename = String(name || '').trim();
    const ext = extension(filename);
    if (!filename || !(blob instanceof Blob) || !blob.size ||
        blob.size > MAX_IMPORT_BYTES) return { saved: false, reason: 'unsupported-or-empty' };
    if (!TEXT_EXTENSIONS.has(ext) && ext !== 'mp3' && !BINARY_EXTENSIONS.has(ext)) {
      return { saved: false, reason: 'unsupported-format' };
    }
    const title = filename.replace(/\.[^.]+$/, '');
    try {
      let imported, format = ext, textContent = '';
      if (ext === 'mp3') {
        format = 'audio';
        imported = await library.importAudioFile({ file: blob.slice(0, blob.size, 'audio/mpeg'), title });
      } else if (ext === 'pdf') {
        if (blob.size > MAX_PDF_BYTES) return { saved: false, reason: 'pdf-too-large' };
        // Parsing before persistence avoids "success" for a damaged PDF.
        await decodePdf(blob);
        imported = await library.importBinaryDocument?.({
          file: blob.slice(0, blob.size, 'application/pdf'), title, format: 'pdf'
        });
      } else if (ext === 'epub' || ext === 'zip' || ext === 'daisy') {
        const decoded = await decodeArchive(blob, { kind: ext === 'epub' ? 'epub' : 'daisy', title });
        format = decoded.format;
        if (format === 'epub') {
          imported = await library.importBinaryDocument?.({
            file: blob.slice(0, blob.size, 'application/epub+zip'),
            title: decoded.title || title, author: decoded.author, language: decoded.language,
            format, content: decoded.content
          });
        } else {
          imported = await library.importDaisyArchive?.({
            file: blob.slice(0, blob.size, 'application/zip'),
            title: decoded.title || title, language: decoded.language, format
          });
        }
      } else {
        textContent = await blob.text();
        imported = await library.importDocument({
          title, format, content: textContent, sizeBytes: blob.size
        });
      }
      if (!await verifySaved(imported, format, blob, textContent)) {
        return { saved: false, reason: 'readback-integrity-failed' };
      }
      return { saved: true, id: imported.id, title: imported.title, imported };
    } catch (error) {
      return { saved: false, reason: error?.code || 'import-or-readback-failed' };
    }
  }

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
    if (!TEXT_EXTENSIONS.has(ext) && ext !== 'mp3' && !BINARY_EXTENSIONS.has(ext)) {
      return resultError(name, 'Este formato aún no está integrado en el nuevo lector para iOS.');
    }
    try {
      const localUrl = capacitor.convertFileSrc(uri);
      if (!localUrl || typeof readFile !== 'function') throw Error('file-url-unavailable');
      const response = await readFile(localUrl);
      if (!response?.ok) throw Error('file-read-failed');
      const blob = await response.blob();
      const result = await importBlob({ name, blob });
      if (!result.saved) return resultError(name, 'La importación no se ha completado: ' + result.reason);
      return { ...emptyBatch(), selectedNames: [name], imported: [result.imported] };
    } catch {
      return resultError(name, 'La lectura o el guardado ha fallado; el original no se ha eliminado.');
    }
  }

  async function importReceivedBlob({ name = '', blob = null } = {}) {
    const { saved, id, title, reason } = await importBlob({ name, blob });
    return saved ? { saved, id, title } : { saved: false, reason };
  }

  async function recognizePdfPage({ bookId = '', pageIndex = 0, password = '', script = 'latin' } = {}) {
    if (typeof accessibility?.recognizePdfPage !== 'function' ||
        typeof library.openBinaryDocument !== 'function' ||
        !Number.isInteger(pageIndex) || pageIndex < 0) {
      return { status: 'model-unavailable', text: '', blocks: [] };
    }
    try {
      const stored = await library.openBinaryDocument(String(bookId));
      if (!stored?.blob || stored.book?.id !== String(bookId) ||
          stored.blob.size > 12 * 1024 * 1024) {
        return { status: 'model-unavailable', text: '', blocks: [] };
      }
      const bytes = new Uint8Array(await stored.blob.arrayBuffer());
      const chunks = [];
      for (let index = 0; index < bytes.length; index += 32768) {
        chunks.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
      }
      // Capacitor sends these bytes only across the local JS/Swift boundary.
      const recognized = await accessibility.recognizePdfPage({
        pdfBase64: btoa(chunks.join('')), pageIndex, password, script
      });
      return ['ok', 'empty'].includes(recognized?.status)
        ? { status: recognized.status, text: String(recognized.text || ''),
          blocks: Array.isArray(recognized.blocks) ? recognized.blocks : [] }
        : { status: recognized?.status || 'error', text: '', blocks: [] };
    } catch {
      return { status: 'error', text: '', blocks: [] };
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
    if (String(eventName).startsWith('audio')) {
      const [mp3Handle, daisyHandle] = await Promise.all([
        mp3Player.addListener(eventName, listener),
        daisyPlayer.addListener(eventName, listener)
      ]);
      return { remove: async () => {
        await mp3Handle?.remove?.();
        await daisyHandle?.remove?.();
      } };
    }
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
  const result = { pickDocuments, importReceivedBlob, recognizePdfPage, listTtsVoices, openTtsVoiceInstaller,
    addListener, consumeInitialSharedDocuments: async () => emptyBatch(),
    listAudioTracks, prepareAudio,
    playAudio: (...args) => player.playAudio(...args),
    pauseAudio: (...args) => player.pauseAudio(...args),
    seekAudio: (...args) => player.seekAudio(...args),
    skipAudio: (...args) => player.skipAudio(...args),
    previousAudioTrack: (...args) => player.previousAudioTrack?.(...args) || player.getAudioState(),
    nextAudioTrack: (...args) => player.nextAudioTrack?.(...args) || player.getAudioState(),
    setAudioSpeed: (...args) => player.setAudioSpeed(...args),
    getAudioState: (...args) => player.getAudioState(...args),
    stopAudio: (...args) => player.stopAudio(...args) };
  for (const name of passthrough) {
    result[name] = (...args) => library[name](...args);
  }
  // Previous versions stored already-extracted PDF text in the original books
  // store. The mobile reading client expects a PDF page payload, not a plain
  // `content` string. Adapt that legacy record only at read time: never rewrite
  // its ID, text, page progress, marks, or IndexedDB schema on app startup.
  result.openBook = async (id, options = {}) => {
    const opened = await library.openBook(id);
    if (!opened?.book) return opened;
    const kind = opened.book.format;
    // New PDFs hold the exact original file in media. Old text-only PDFs keep
    // their original content and legacy paragraph/page positions untouched.
    if (kind === 'pdf') {
      const binary = await library.openBinaryDocument?.(id);
      if (binary?.blob) {
        try {
          return { ...opened, ...await decodePdf(binary.blob, { password: options?.password || '' }) };
        } catch {
          return { ...opened, pdfUnavailable: true, pdfNoText: true, pageCount: 0 };
        }
      }
      if (opened.pdf || opened.pdfNoText || opened.passwordRequired) return opened;
      const content = String(opened.content ?? '');
      if (!content.trim()) return { ...opened, pdfNoText: true, pageCount: 0 };
      const pages = content.split(String.fromCharCode(12)).map((text, index) => ({ number: index + 1, text }));
      return { ...opened, pdf: { title: opened.book.title || '',
        author: opened.book.author || '', language: opened.book.language || '',
        pageCount: pages.length, orderReliable: false, pages } };
    }
    if (kind === 'daisy2.02' || kind === 'daisy3') {
      const archive = await library.openDaisyArchive?.(id);
      if (archive?.blob) {
        const decoded = await decodeArchive(archive.blob, { kind: 'daisy', title: opened.book.title });
        const model = JSON.parse(decoded.content);
        const hasAudio = Boolean(model.containsAudio && model.audioClips?.length);
        const hasText = Boolean(model.blocks?.some(block =>
          !String(block?.id || '').startsWith('daisy-audio-')));
        return { ...opened, content: decoded.content, daisyHasAudio: hasAudio,
          daisyHasText: hasText, daisySynchronized: hasAudio && hasText };
      }
    }
    if (kind === 'epub' && opened.content &&
        !String(opened.content).trimStart().startsWith('{')) {
      // Compatibility read-only adapter for older EPUB content saved as text.
      return { ...opened, content: JSON.stringify({
        title: opened.book.title, blocks: [{ id: 'legacy-epub-text',
          type: 'paragraph', text: String(opened.content) }]
      }) };
    }
    return opened;
  };
  // The staged reader can show, search and continue existing documents using
  // their ORIGINAL IDs. Unsupported native operations remain explicitly absent
  // rather than being presented as successfully migrated.
  result.deleteBook = id => library.deleteBook(id);
  return result;
}
