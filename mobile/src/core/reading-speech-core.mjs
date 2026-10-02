import { createReadingSpeechController as createSharedReadingSpeechController } from '../../../shared/reading-speech-core.mjs';
import { TifloBackgroundTts } from '../native/reading-background-tts-plugin.mjs';
import { TifloReading } from '../native/reading-library-plugin.mjs';

export function createReadingSpeechController(options = {}) {
  return createSharedReadingSpeechController({
    ...options,
    fallbackTts: options.fallbackTts || TifloBackgroundTts,
    fallbackReading: options.fallbackReading || TifloReading
  });
}
