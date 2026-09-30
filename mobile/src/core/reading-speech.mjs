import { createReadingSpeechController as createCoreReadingSpeechController } from './reading-speech-core.mjs';

let activeReadingSpeechController = null;

export function getActiveReadingSpeechController() {
  return activeReadingSpeechController;
}

export function createReadingSpeechController(options = {}) {
  let documentModel = options.document || { blocks: [] };
  let core = createCoreReadingSpeechController({ ...options, document: documentModel });
  let destroyed = false;

  const facade = {
    play: (...args) => core.play(...args),
    pause: (...args) => core.pause(...args),
    moveTo: (...args) => core.moveTo(...args),
    setVoice: (...args) => core.setVoice(...args),
    setRate: (...args) => core.setRate(...args),
    snapshot: (...args) => core.snapshot(...args),
    syncNativeState: (...args) => core.syncNativeState(...args),
    getDocument() {
      return documentModel;
    },
    async setDocument(nextDocument) {
      if (destroyed || !nextDocument?.blocks) return false;
      const snapshot = core.snapshot();
      await core.destroy();
      documentModel = nextDocument;
      core = createCoreReadingSpeechController({
        ...options,
        document: documentModel,
        initialPosition: snapshot.position,
        settings: {
          ...(options.settings || {}),
          'speech.voice': snapshot.voiceId,
          'speech.rate': snapshot.rate
        }
      });
      return true;
    },
    async destroy(options = {}) {
      if (destroyed) return;
      destroyed = true;
      if (activeReadingSpeechController === facade) activeReadingSpeechController = null;
      await core.destroy(options);
    }
  };

  activeReadingSpeechController = facade;
  return facade;
}
