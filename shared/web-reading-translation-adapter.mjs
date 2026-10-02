const cleanLanguage = value => String(value ?? '').trim().toLowerCase().split(/[-_]/u)[0];

export const WEB_TRANSLATION_LANGUAGES = Object.freeze([
  'ar','bg','ca','cs','da','de','el','en','es','et','fi','fr','hr','hu','id','it',
  'ja','ko','lt','lv','nl','no','pl','pt','ro','ru','sk','sl','sv','th','tr','uk','vi','zh'
]);

export function createWebReadingTranslationAdapter({
  TranslatorClass = globalThis.Translator,
  LanguageDetectorClass = globalThis.LanguageDetector
} = {}) {
  const translators = new Map();

  function pairKey(sourceLanguage, targetLanguage) {
    return `${cleanLanguage(sourceLanguage)}:${cleanLanguage(targetLanguage)}`;
  }

  async function identifyLanguage({ text } = {}) {
    const value = String(text ?? '').trim();
    if (!value || !LanguageDetectorClass?.create) return { language: 'und' };
    try {
      const availability = typeof LanguageDetectorClass.availability === 'function'
        ? await LanguageDetectorClass.availability({ expectedInputLanguages: WEB_TRANSLATION_LANGUAGES })
        : 'available';
      if (availability === 'unavailable') return { language: 'und' };
      const detector = await LanguageDetectorClass.create({
        expectedInputLanguages: WEB_TRANSLATION_LANGUAGES
      });
      const result = await detector.detect(value);
      detector.destroy?.();
      const language = cleanLanguage(result?.[0]?.detectedLanguage || result?.[0]?.language);
      return { language: language || 'und' };
    } catch {
      return { language: 'und' };
    }
  }

  async function listTranslationLanguages() {
    return { languages: [...WEB_TRANSLATION_LANGUAGES] };
  }

  async function downloadTranslationModel() {
    return { downloaded: Boolean(TranslatorClass?.create) };
  }

  async function prepareTranslationPair({ sourceLanguage, targetLanguage, monitor } = {}) {
    const source = cleanLanguage(sourceLanguage);
    const target = cleanLanguage(targetLanguage);
    if (!source || !target || source === target || !TranslatorClass?.create) {
      return { ready: false, status: 'unsupported-language' };
    }
    const key = pairKey(source, target);
    if (translators.has(key)) return { ready: true, status: 'available' };

    try {
      const availability = typeof TranslatorClass.availability === 'function'
        ? await TranslatorClass.availability({ sourceLanguage: source, targetLanguage: target })
        : 'available';
      if (availability === 'unavailable' || availability == null) {
        return { ready: false, status: 'unsupported-language' };
      }
      const translator = await TranslatorClass.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor(downloadMonitor) {
          if (typeof monitor !== 'function' || !downloadMonitor?.addEventListener) return;
          downloadMonitor.addEventListener('downloadprogress', event => {
            monitor(Number(event?.loaded) || 0);
          });
        }
      });
      translators.set(key, translator);
      return { ready: true, status: availability };
    } catch {
      return { ready: false, status: 'error' };
    }
  }

  async function translateBatch({ sourceLanguage, targetLanguage, texts } = {}) {
    const source = cleanLanguage(sourceLanguage);
    const target = cleanLanguage(targetLanguage);
    const values = (Array.isArray(texts) ? texts : []).map(value => String(value ?? ''));
    if (!source || !target || !values.length || values.length > 50) {
      return { translations: [], status: 'error' };
    }
    const key = pairKey(source, target);
    let translator = translators.get(key);
    if (!translator) {
      const prepared = await prepareTranslationPair({ sourceLanguage: source, targetLanguage: target });
      if (!prepared.ready) {
        return {
          translations: [],
          status: prepared.status === 'unsupported-language' ? 'unsupported-language' : 'model-unavailable'
        };
      }
      translator = translators.get(key);
    }
    try {
      const translations = [];
      for (const text of values) translations.push(String(await translator.translate(text) ?? ''));
      return { translations, status: 'ok' };
    } catch {
      return { translations: [], status: 'error' };
    }
  }

  function destroy() {
    for (const translator of translators.values()) {
      try { translator?.destroy?.(); } catch {}
    }
    translators.clear();
  }

  return {
    identifyLanguage,
    listTranslationLanguages,
    downloadTranslationModel,
    prepareTranslationPair,
    translateBatch,
    destroy
  };
}
