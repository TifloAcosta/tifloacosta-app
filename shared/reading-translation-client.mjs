const cleanLanguage = value => String(value ?? '').trim().toLowerCase();

export function createReadingTranslationClient(plugin = {}) {
  async function identifyLanguage(text) {
    if (!plugin?.identifyLanguage) return 'und';
    try {
      const result = await plugin.identifyLanguage({ text: String(text ?? '') });
      return cleanLanguage(result?.language) || 'und';
    } catch {
      return 'und';
    }
  }

  async function listTranslationLanguages() {
    if (!plugin?.listTranslationLanguages) return [];
    try {
      const result = await plugin.listTranslationLanguages();
      const values = Array.isArray(result) ? result : Array.isArray(result?.languages) ? result.languages : [];
      return [...new Set(values.map(cleanLanguage).filter(Boolean))].sort();
    } catch {
      return [];
    }
  }

  async function downloadTranslationModel(language) {
    const clean = cleanLanguage(language);
    if (!clean || !plugin?.downloadTranslationModel) return false;
    try {
      const result = await plugin.downloadTranslationModel({ language: clean });
      return result === true || result?.downloaded === true;
    } catch {
      return false;
    }
  }

  async function prepareTranslationPair(sourceLanguage, targetLanguage, onProgress) {
    const source = cleanLanguage(sourceLanguage);
    const target = cleanLanguage(targetLanguage);
    if (!source || !target || source === target || !plugin?.prepareTranslationPair) return false;
    try {
      const result = await plugin.prepareTranslationPair({
        sourceLanguage: source,
        targetLanguage: target,
        monitor: typeof onProgress === 'function' ? onProgress : undefined
      });
      return result === true || result?.ready === true;
    } catch {
      return false;
    }
  }

  async function translateBatch(options = {}) {
    const sourceLanguage = cleanLanguage(options?.sourceLanguage);
    const targetLanguage = cleanLanguage(options?.targetLanguage);
    const texts = (Array.isArray(options?.texts) ? options.texts : []).map(value => String(value ?? ''));
    if (!sourceLanguage || !targetLanguage || texts.length === 0 || texts.length > 50 || !plugin?.translateBatch) {
      return { translations: [], status: 'error' };
    }
    try {
      const result = await plugin.translateBatch({ sourceLanguage, targetLanguage, texts });
      const translations = Array.isArray(result?.translations)
        ? result.translations.map(value => String(value ?? ''))
        : [];
      const status = translations.length === texts.length
        ? 'ok'
        : ['model-unavailable', 'unsupported-language', 'error'].includes(result?.status)
          ? result.status
          : 'error';
      return { translations, status };
    } catch {
      return { translations: [], status: 'error' };
    }
  }

  return {
    identifyLanguage,
    listTranslationLanguages,
    downloadTranslationModel,
    prepareTranslationPair,
    translateBatch
  };
}
