(() => {
  'use strict';
  // This bridge ships ONLY inside the iOS app. No browser voices or remote translation.
  const tts = () => window.Capacitor?.Plugins?.TifloReadingTts;
  const translator = () => window.Capacitor?.Plugins?.TifloReadingLanguage;
  let voices = [];
  let pending = null;
  const bool = (x, field) => x === true || x?.[field] === true;
  const safe = async (run, fallback) => { try { return await run(); } catch { return fallback; } };

  const reader = {
    get hasNativeSpeech() { return !!tts()?.beginTtsSession; },
    get hasNativeTranslation() { return !!translator()?.translateBatch; },
    listVoices() { return voices.slice(); },
    onVoicesChanged: null,
    async refreshVoices() {
      if (pending) return pending;
      pending = safe(async () => {
        const result = await tts()?.listTtsVoices?.();
        const list = Array.isArray(result?.voices) ? result.voices : [];
        voices = list.filter(v => v?.id).map(v => ({
          id: String(v.id), name: String(v.name || v.id), locale: String(v.locale || ''),
          language: String(v.locale || '').split('-')[0], networkRequired: false
        }));
        reader.onVoicesChanged?.();
        return voices;
      }, []).finally(() => { pending = null; });
      return pending;
    },
    createSpeechAdapter() {
      return {
        beginTtsSession: async options => bool(await safe(() => tts()?.beginTtsSession?.(options), null), 'prepared'),
        appendTtsUnits: async options => {
          const result = await safe(() => tts()?.appendTtsUnits?.(options), null);
          return result != null && Number(result.appended) >= 0;
        },
        commitTtsSession: async options => bool(await safe(() => tts()?.commitTtsSession?.(options), null), 'prepared'),
        playTts: async () => bool(await safe(() => tts()?.playTts?.(), null), 'accepted'),
        pauseTts: async () => bool(await safe(() => tts()?.pauseTts?.(), null), 'paused'),
        seekTts: async options => bool(await safe(() => tts()?.seekTts?.(options), null), 'accepted'),
        getTtsState: async () => safe(() => tts()?.getTtsState?.(), {}),
        stopTts: async () => bool(await safe(() => tts()?.stopTts?.(), null), 'stopped'),
        addListener: async (name, callback) => safe(
          () => tts()?.addListener?.(name, callback),
          { remove: async () => {} }
        )
      };
    },
    createTranslationAdapter() {
      return {
        identifyLanguage: options => safe(() => translator()?.identifyLanguage?.(options), { language: 'und' }),
        listTranslationLanguages: () => safe(() => translator()?.listTranslationLanguages?.(), { languages: [] }),
        prepareTranslationPair: options => safe(() => translator()?.prepareTranslationPair?.(options), { ready: false }),
        downloadTranslationModel: () => Promise.resolve({ downloaded: false }),
        translateBatch: options => safe(() => translator()?.translateBatch?.(options), { translations: [], status: 'error' })
      };
    }
  };
  window.TifloIOSReading = reader;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void reader.refreshVoices();
  });
})();
