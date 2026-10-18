/**
 * Translate Capacitor's iOS AVSpeechSynthesizer response envelopes into the
 * boolean session contract required by the shared reading speech controller.
 * Keep the speech engine native: never start a second Web Speech session.
 */
export function createIosNativeTtsBridge(plugin = null) {
  const invoke = async (name, options, field) => {
    if (typeof plugin?.[name] !== 'function') return false;
    try {
      const result = await plugin[name](options);
      return result?.[field] === true;
    } catch {
      return false;
    }
  };

  return {
    listTtsVoices: async () => {
      try {
        const response = await plugin?.listTtsVoices?.();
        return { voices: Array.isArray(response?.voices) ? response.voices : [] };
      } catch { return { voices: [] }; }
    },
    openTtsVoiceInstaller: async () => ({ opened: false, destination: 'none' }),
    beginTtsSession: args => invoke('beginTtsSession', args, 'prepared'),
    appendTtsUnits: async args => {
      if (!Array.isArray(args?.units) || !args.units.length ||
          typeof plugin?.appendTtsUnits !== 'function') return false;
      try {
        const result = await plugin.appendTtsUnits(args);
        return Number(result?.appended) === args.units.length;
      } catch { return false; }
    },
    commitTtsSession: args => invoke('commitTtsSession', args, 'prepared'),
    playTts: () => invoke('playTts', undefined, 'accepted'),
    pauseTts: () => invoke('pauseTts', undefined, 'paused'),
    seekTts: args => invoke('seekTts', args, 'accepted'),
    getTtsState: async () => {
      try { return await plugin?.getTtsState?.() ?? null; }
      catch { return null; }
    },
    stopTts: () => invoke('stopTts', undefined, 'stopped'),
    addListener: async (event, listener) => {
      if (typeof listener !== 'function' || typeof plugin?.addListener !== 'function')
        return { remove: async () => {} };
      try { return await plugin.addListener(event, listener); }
      catch { return { remove: async () => {} }; }
    }
  };
}
