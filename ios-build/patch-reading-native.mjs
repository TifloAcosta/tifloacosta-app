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
await writeFile(path, source);
