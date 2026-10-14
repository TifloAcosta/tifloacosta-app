import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, 'www/web-reading.js');
let source = await readFile(path, 'utf8');
function replaceOnce(original, replacement) {
  if (source.split(original).length !== 2) {
    throw new Error('No se encuentra el anclaje TifloLector de iOS: ' + original.slice(0, 80));
  }
  source = source.replace(original, replacement);
}

// A packaged iOS reader must never depend on a remote CDN to open local archives.
replaceOnce(
  "script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js';",
  "script.src = 'ios-jszip.min.js';"
);

replaceOnce(
  "const speechAdapter = typeof shared.createWebReadingSpeechAdapter === 'function'\n    ? shared.createWebReadingSpeechAdapter()\n    : null;",
  "const iosReader = globalThis.TifloIOSReading || null;\n  const speechAdapter = iosReader?.createSpeechAdapter?.() || (typeof shared.createWebReadingSpeechAdapter === 'function'\n    ? shared.createWebReadingSpeechAdapter() : null);"
);
replaceOnce(
  "const translationAdapter = typeof shared.createWebReadingTranslationAdapter === 'function'\n    ? shared.createWebReadingTranslationAdapter()\n    : null;",
  "const translationAdapter = iosReader?.createTranslationAdapter?.() || (typeof shared.createWebReadingTranslationAdapter === 'function'\n    ? shared.createWebReadingTranslationAdapter() : null);"
);
const oldVoices = "const voices = typeof shared.listWebTtsVoices === 'function' ? shared.listWebTtsVoices() : [];";
const newVoices = "const voices = iosReader ? iosReader.listVoices() : (typeof shared.listWebTtsVoices === 'function' ? shared.listWebTtsVoices() : []);";
if (source.split(oldVoices).length !== 4) throw new Error('iOS expected three voice chooser locations');
source = source.split(oldVoices).join(newVoices);
replaceOnce(
  "els.voiceStatus.textContent = language() === 'en' ? 'Waiting for browser voices…' : 'Esperando las voces del navegador…';",
  "els.voiceStatus.textContent = iosReader ? (language() === 'en' ? 'Waiting for iOS voices. Check the native reader.' : 'Esperando las voces del iPhone. Comprueba el lector nativo.') : (language() === 'en' ? 'Waiting for browser voices…' : 'Esperando las voces del navegador…');"
);
replaceOnce(
  "if (!translationClient || typeof globalThis.Translator?.create !== 'function') {",
  "if (!translationClient || (!iosReader?.hasNativeTranslation && typeof globalThis.Translator?.create !== 'function')) {"
);
replaceOnce(
  "engine: 'browser-translator',\n      engineVersion: '1',",
  "engine: iosReader ? 'ios-translation' : 'browser-translator',\n      engineVersion: '1',"
);
replaceOnce(
  "function setAccessiblePlaybackMode(active) {\n    if (!els.reader) return;",
  "function setAccessiblePlaybackMode(active) {\n    if (!els.reader) return;\n    if (iosReader) {\n      // Native playback must NOT hide the text, navigation or settings from VoiceOver.\n      if (active) els.reader.dataset.ttsPlaying = 'true';\n      else delete els.reader.dataset.ttsPlaying;\n      els.reader.removeAttribute('aria-busy');\n      return;\n    }"
);
replaceOnce(
  "els.voice.addEventListener('change', () => { saveWebSettings(); void rebuildSpeech(); });",
  "async function updateSpeechWithoutLosingPosition() {\n    const snapshot = speechController?.snapshot?.();\n    const wasPlaying = snapshot?.playing === true;\n    if (wasPlaying) await speechController?.pause?.();\n    await rebuildSpeech(snapshot?.position || null);\n    if (wasPlaying) await speechController?.play?.();\n  }\n  els.voice.addEventListener('change', () => { saveWebSettings(); void updateSpeechWithoutLosingPosition(); });"
);
replaceOnce(
  "els.rate.addEventListener('change', () => { saveWebSettings(); void rebuildSpeech(); });",
  "els.rate.addEventListener('change', () => { saveWebSettings(); void updateSpeechWithoutLosingPosition(); });"
);
replaceOnce(
  "globalThis.speechSynthesis?.addEventListener?.('voiceschanged', populateVoices);",
  "if (iosReader) {\n    iosReader.onVoicesChanged = populateVoices;\n    void iosReader.refreshVoices();\n  } else globalThis.speechSynthesis?.addEventListener?.('voiceschanged', populateVoices);"
);

// Cambios exclusivamente en el lector EMPAQUETADO para iOS, no en la web pública.
replaceOnce(
  "        card.className = 'resource-card reading-library-title-card';",
  "        card.className = 'resource-card reading-library-title-card';\n        card.dataset.iosBookId = String(book.id);"
);
replaceOnce(
  "      const isRecentView = libraryView === 'recent';",
  "      const isRecentView = libraryView === 'recent';\n      const librarySort = document.getElementById('ios-reading-library-sort')?.value || (isRecentView ? 'imported' : 'lastRead');"
);
replaceOnce(
  "            sort: isRecentView ? 'imported' : 'lastRead'",
  "            sort: librarySort"
);
replaceOnce(
  "  els.libraryFilter?.addEventListener('change', () => { libraryPage = 1; void renderLibrary(); });",
  "  els.libraryFilter?.addEventListener('change', () => { libraryPage = 1; void renderLibrary(); });\n  document.addEventListener('change', event => { if (event.target?.id === 'ios-reading-library-sort') { libraryPage = 1; void renderLibrary(); } });"
);
replaceOnce(
  "  setupPronunciationDictionary();\n  localize();",
  "  window.TifloIOSBookActions = {\n    hasSavedBook: () => Boolean(currentBookId),\n    exportCurrent: format => currentBookId ? exportSavedBook(currentBookId, format) : Promise.resolve(false),
    exportBook: (id, format='original') => id ? exportSavedBook(id, format) : Promise.resolve(false),
    async deleteBook(id) {
      if (!id || !libraryClient) return false;
      await deleteSavedBook(id);
      return !(await libraryClient.openBook(id))?.book;
    },\n    async renameCurrent(value) {\n      const name = String(value || '').trim();\n      if (!name || !currentBookId || !libraryClient) return false;\n      try {\n        const opened = await libraryClient.openBook(currentBookId);\n        if (!opened?.book) return false;\n        const saved = await libraryClient.updateBookMetadata({ ...opened.book, title: name });\n        if (!saved) return false;\n        els.title.textContent = name;\n        await renderLibrary();\n        return true;\n      } catch { return false; }\n    },\n    async deleteCurrent() {\n      if (!currentBookId || !libraryClient) return false;\n      const id = currentBookId;\n      await deleteSavedBook(id);\n      return !(await libraryClient.openBook(id))?.book;\n    }\n  };\n  setupPronunciationDictionary();\n  localize();"
);
await writeFile(path, source);
const adapterPath = resolve(import.meta.dirname, 'www/shared/web-reading-library-adapter.mjs');
let adapter = await readFile(adapterPath, 'utf8');
const sortAnchor = "      if (sort === 'author') return a.author.localeCompare(b.author);";
if (adapter.split(sortAnchor).length !== 2) throw new Error('Falta clasificación por autor en adaptador iOS');
adapter = adapter.replace(sortAnchor, sortAnchor + "\n      if (sort === 'format') return a.format.localeCompare(b.format) || a.title.localeCompare(b.title);");
await writeFile(adapterPath, adapter);

