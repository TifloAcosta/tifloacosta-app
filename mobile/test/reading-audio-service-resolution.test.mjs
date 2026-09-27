import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingAudioController } from '../src/core/reading-audio.mjs';

test('audio coordinator lets the native service resolve a private source by book id when relativePath is absent', async () => {
  const calls = [];
  const client = {
    async addListener() { return { remove: async () => {} }; },
    async prepareAudio(options) {
      calls.push({ method: 'prepareAudio', options: { ...options } });
      return {
        bookId: options.bookId,
        trackIndex: options.trackIndex,
        positionMs: options.positionMs,
        durationMs: 10000,
        playing: false,
        speed: 1,
        prepared: true
      };
    },
    async setAudioSpeed({ speed }) {
      return { bookId: 'audio-1', trackIndex: 0, positionMs: 2500, durationMs: 10000, playing: false, speed, prepared: true };
    },
    async saveProgress() { return true; }
  };

  const controller = createReadingAudioController({
    client,
    book: { id: 'audio-1', format: 'audio', mediaTrackIndex: 0, mediaPositionMs: 2500 },
    initialPosition: { trackIndex: 0, positionMs: 2500 },
    settings: { 'audio.speed': 1, 'audio.skipSeconds': 30 }
  });

  const prepared = await controller.prepare();

  assert.ok(prepared);
  assert.deepEqual(calls[0], {
    method: 'prepareAudio',
    options: { bookId: 'audio-1', relativePath: '', trackIndex: 0, positionMs: 2500 }
  });
});
