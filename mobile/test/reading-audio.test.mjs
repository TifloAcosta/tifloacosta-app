import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingAudioController, READING_AUDIO_SLEEP_MINUTES } from '../src/core/reading-audio.mjs';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';
import { resolveReadingSettings } from '../src/core/reading-settings.mjs';
import { createReadingLibraryPlugin } from '../src/native/reading-library-plugin.mjs';

function createHarness({
  initialPosition = { trackIndex: 2, positionMs: 5000000000 },
  settings = { 'audio.speed': 1.25, 'audio.skipSeconds': 30 }
} = {}) {
  const calls = [];
  const listeners = new Map();
  const positionSnapshots = [];
  let nowMs = 1000;
  let timerId = 0;
  let pendingTimer = null;

  const client = {
    async prepareAudio(options) {
      calls.push({ method: 'prepareAudio', options: { ...options } });
      return {
        bookId: options.bookId,
        trackIndex: options.trackIndex,
        positionMs: options.positionMs,
        durationMs: 20000,
        playing: false,
        speed: 1
      };
    },
    async playAudio() {
      calls.push({ method: 'playAudio' });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: 5000, durationMs: 20000, playing: true, speed: 1.25 };
    },
    async pauseAudio() {
      calls.push({ method: 'pauseAudio' });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: 6000, durationMs: 20000, playing: false, speed: 1.25 };
    },
    async seekAudio(options) {
      calls.push({ method: 'seekAudio', options: { ...options } });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: options.positionMs, durationMs: 20000, playing: false, speed: 1.25 };
    },
    async skipAudio(options) {
      calls.push({ method: 'skipAudio', options: { ...options } });
      const current = controller?.getState?.().positionMs ?? 0;
      return {
        bookId: 'audio-1',
        trackIndex: 2,
        positionMs: Math.max(0, Math.min(20000, current + options.deltaMs)),
        durationMs: 20000,
        playing: false,
        speed: 1.25
      };
    },
    async setAudioSpeed(options) {
      calls.push({ method: 'setAudioSpeed', options: { ...options } });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: 5000, durationMs: 20000, playing: false, speed: options.speed };
    },
    async getAudioState() {
      calls.push({ method: 'getAudioState' });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: 5000, durationMs: 20000, playing: false, speed: 1.25 };
    },
    async stopAudio() {
      calls.push({ method: 'stopAudio' });
      return { bookId: 'audio-1', trackIndex: 2, positionMs: 5000, durationMs: 20000, playing: false, speed: 1.25 };
    },
    async saveProgress(progress) {
      calls.push({ method: 'saveProgress', progress: { ...progress } });
      return true;
    },
    async addListener(name, listener) {
      listeners.set(name, listener);
      return {
        remove: async () => {
          if (listeners.get(name) === listener) listeners.delete(name);
        }
      };
    }
  };

  const timers = {
    setTimeout(callback, delayMs) {
      timerId += 1;
      pendingTimer = { id: timerId, callback, delayMs };
      return timerId;
    },
    clearTimeout(id) {
      if (pendingTimer?.id === id) pendingTimer = null;
    }
  };

  let controller;
  controller = createReadingAudioController({
    client,
    book: {
      id: 'audio-1',
      format: 'audio',
      relativePath: 'items/audio-1/source.m4b',
      mediaTrackIndex: initialPosition.trackIndex,
      mediaPositionMs: initialPosition.positionMs
    },
    initialPosition,
    settings,
    onPosition: snapshot => positionSnapshots.push({ ...snapshot }),
    now: () => nowMs,
    timers
  });

  return {
    controller,
    calls,
    listeners,
    positionSnapshots,
    setNow(value) { nowMs = value; },
    async fireTimer() {
      const timer = pendingTimer;
      pendingTimer = null;
      if (timer) await timer.callback();
    },
    getPendingTimer() { return pendingTimer; }
  };
}

test('audio coordinator prepares exact long position without autoplay and applies inherited speed', async () => {
  const { controller, calls } = createHarness();

  await controller.prepare();

  assert.deepEqual(calls[0], {
    method: 'prepareAudio',
    options: {
      bookId: 'audio-1',
      relativePath: 'items/audio-1/source.m4b',
      trackIndex: 2,
      positionMs: 5000000000
    }
  });
  assert.equal(calls.some(call => call.method === 'playAudio'), false);
  assert.deepEqual(calls.find(call => call.method === 'setAudioSpeed'), {
    method: 'setAudioSpeed',
    options: { speed: 1.25 }
  });

  await controller.play();
  assert.equal(calls.filter(call => call.method === 'playAudio').length, 1);
});

test('audio coordinator clamps configured skip at start and end', async () => {
  const { controller, calls, listeners } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 5000 } });
  await controller.prepare();
  await listeners.get('audioState')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 5000, durationMs: 20000, playing: false, speed: 1.25
  });

  await controller.skip(-1);
  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: -5000 } });

  await listeners.get('audioPosition')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 5000, durationMs: 20000, playing: false, speed: 1.25
  });
  await controller.skip(1);
  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: 15000 } });
});

test('position persistence is throttled but pause always forces an exact save', async () => {
  const { controller, calls, listeners, setNow } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 1000 } });
  await controller.prepare();

  setNow(1000);
  await listeners.get('audioPosition')({ bookId: 'audio-1', trackIndex: 0, positionMs: 2000, durationMs: 10000, playing: true, speed: 1.25 });
  setNow(2000);
  await listeners.get('audioPosition')({ bookId: 'audio-1', trackIndex: 0, positionMs: 3000, durationMs: 10000, playing: true, speed: 1.25 });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);

  setNow(7000);
  await listeners.get('audioPosition')({ bookId: 'audio-1', trackIndex: 0, positionMs: 7000, durationMs: 10000, playing: true, speed: 1.25 });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 2);

  await controller.pause();
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 3);
  assert.equal(calls.at(-1).progress.mediaPositionMs, 6000);
});

test('sleep timer pauses and persists without resuming audio', async () => {
  const { controller, calls, getPendingTimer, fireTimer } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 5000 } });
  await controller.prepare();
  await controller.setSleepTimer(15);

  assert.equal(getPendingTimer().delayMs, 15 * 60 * 1000);
  await fireTimer();

  assert.equal(calls.filter(call => call.method === 'pauseAudio').length, 1);
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);
  assert.equal(calls.filter(call => call.method === 'playAudio').length, 0);
});

test('interruption persists once, never resumes, and stale callbacks are ignored', async () => {
  const { controller, calls, listeners } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 1000 } });
  await controller.prepare();

  await listeners.get('audioInterrupted')({
    bookId: 'other-book', trackIndex: 0, positionMs: 9000, durationMs: 10000, playing: false, speed: 1
  });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 0);

  await listeners.get('audioInterrupted')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 4500, durationMs: 10000, playing: false, speed: 1.25,
    reason: 'audio-focus-loss'
  });

  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);
  assert.equal(calls.find(call => call.method === 'saveProgress').progress.mediaPositionMs, 4500);
  assert.equal(calls.filter(call => call.method === 'playAudio').length, 0);
  assert.equal(controller.getState().playing, false);
});

test('end and destroy force persistence and listener cleanup', async () => {
  const { controller, calls, listeners } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 1000 } });
  await controller.prepare();

  await listeners.get('audioEnded')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 20000, durationMs: 20000, playing: false, speed: 1.25
  });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);
  assert.equal(calls.find(call => call.method === 'saveProgress').progress.state, 'read');

  await controller.destroy();
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 2);
  assert.equal(listeners.size, 0);
});

test('audio settings inherit per book, clamp speed and allow only 10, 30 or 60 second skips', () => {
  const inherited = resolveReadingSettings({ 'audio.speed': 1.2, 'audio.skipSeconds': 60 }, {});
  assert.equal(inherited.effective['audio.speed'], 1.2);
  assert.equal(inherited.effective['audio.skipSeconds'], 60);
  assert.equal(inherited.inherited['audio.speed'], true);

  const overridden = resolveReadingSettings(
    { 'audio.speed': 1.2, 'audio.skipSeconds': 60 },
    { 'audio.speed': 1.7, 'audio.skipSeconds': 10 }
  );
  assert.equal(overridden.effective['audio.speed'], 1.7);
  assert.equal(overridden.effective['audio.skipSeconds'], 10);
  assert.equal(overridden.inherited['audio.speed'], false);

  const bounded = resolveReadingSettings({ 'audio.speed': 99, 'audio.skipSeconds': 45 }, {});
  assert.equal(bounded.effective['audio.speed'], 3);
  assert.equal(bounded.effective['audio.skipSeconds'], 30);
  assert.deepEqual(READING_AUDIO_SLEEP_MINUTES, [15, 30, 45, 60]);
});

test('native wrapper and library client expose the audio bridge and route audio events', async () => {
  const calls = [];
  let audioStateListener = null;
  const nativeAudio = {
    async prepareAudio(options) { calls.push(['prepareAudio', options]); return { bookId: options.bookId, positionMs: options.positionMs, playing: false }; },
    async playAudio() { calls.push(['playAudio']); return { bookId: 'audio-1', playing: true, positionMs: 10 }; },
    async pauseAudio() { calls.push(['pauseAudio']); return { bookId: 'audio-1', playing: false, positionMs: 11 }; },
    async seekAudio(options) { calls.push(['seekAudio', options]); return { bookId: 'audio-1', playing: false, positionMs: options.positionMs }; },
    async skipAudio(options) { calls.push(['skipAudio', options]); return { bookId: 'audio-1', playing: false, positionMs: 20 }; },
    async setAudioSpeed(options) { calls.push(['setAudioSpeed', options]); return { bookId: 'audio-1', playing: false, speed: options.speed }; },
    async getAudioState() { return { bookId: 'audio-1', trackIndex: '2', positionMs: '5000000000', durationMs: '6000000000', playing: 1, speed: '1.5' }; },
    async stopAudio() { calls.push(['stopAudio']); return { bookId: 'audio-1', playing: false }; },
    async addListener(name, listener) {
      if (name === 'audioState') audioStateListener = listener;
      return { remove: async () => {} };
    }
  };

  const wrapper = createReadingLibraryPlugin({}, {}, nativeAudio);
  const client = createReadingLibraryClient(wrapper);

  const prepared = await client.prepareAudio({ bookId: 'audio-1', relativePath: 'items/audio-1/source.mp3', trackIndex: 2, positionMs: 5000000000 });
  assert.equal(prepared.bookId, 'audio-1');
  assert.equal(prepared.positionMs, 5000000000);

  const state = await client.getAudioState();
  assert.deepEqual(state, {
    bookId: 'audio-1', trackIndex: 2, trackCount: 0, positionMs: 5000000000, durationMs: 6000000000, playing: true, speed: 1.5, prepared: false
  });

  let event = null;
  await client.addListener('audioState', value => { event = value; });
  await audioStateListener({ bookId: 'audio-1', trackIndex: 1, positionMs: 1234, durationMs: 9999, playing: false, speed: 1.25 });
  assert.equal(event.positionMs, 1234);
  assert.equal(calls[0][0], 'prepareAudio');
});
