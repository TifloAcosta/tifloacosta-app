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

test('audio coordinator updates the configured skip interval without recreating playback', async () => {
  const { controller, calls, listeners } = createHarness({ initialPosition: { trackIndex: 0, positionMs: 10000 } });
  await controller.prepare();
  await listeners.get('audioState')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 10000, durationMs: 120000, playing: false, speed: 1.25
  });
  assert.equal(controller.setSkipSeconds(60), 60);
  await controller.skip(1);
  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: 60000 } });
  await listeners.get('audioPosition')({
    bookId: 'audio-1', trackIndex: 0, positionMs: 70000, durationMs: 120000, playing: false, speed: 1.25
  });
  assert.equal(controller.setSkipSeconds(45), 30);
  await controller.skip(-1);
  assert.deepEqual(calls.at(-1), { method: 'skipAudio', options: { deltaMs: -30000 } });
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
  assert.equal(calls.some(call => call.method === 'pauseAudio'), true);
  assert.equal(calls.some(call => call.method === 'saveProgress'), true);
  assert.equal(calls.filter(call => call.method === 'playAudio').length, 0);
});

test('interruption persists once, never resumes, and stale callbacks are ignored', async () => {
  const { controller, calls, listeners } = createHarness();
  await controller.prepare();
  await listeners.get('audioInterrupted')({
    bookId: 'other-book', trackIndex: 0, positionMs: 9999, durationMs: 10000, playing: false, reason: 'audio-focus'
  });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 0);
  await listeners.get('audioInterrupted')({
    bookId: 'audio-1', trackIndex: 2, positionMs: 7000, durationMs: 20000, playing: false, reason: 'audio-focus'
  });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);
  assert.equal(calls.filter(call => call.method === 'playAudio').length, 0);
});

test('end and destroy force persistence and listener cleanup', async () => {
  const { controller, calls, listeners } = createHarness();
  await controller.prepare();
  await listeners.get('audioEnded')({
    bookId: 'audio-1', trackIndex: 2, positionMs: 20000, durationMs: 20000, playing: false
  });
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 1);
  assert.equal(calls.at(-1).progress.state, 'read');
  await controller.destroy();
  assert.equal(listeners.size, 0);
  assert.equal(calls.filter(call => call.method === 'saveProgress').length, 2);
});

test('audio settings inherit per book, clamp speed and allow only 10, 30 or 60 second skips', () => {
  assert.deepEqual(READING_AUDIO_SLEEP_MINUTES, [15, 30, 45, 60]);
  const resolved = resolveReadingSettings(
    { 'audio.speed': '1.25', 'audio.skipSeconds': '60' },
    { 'audio.speed': '4', 'audio.skipSeconds': '45' }
  );
  assert.equal(resolved.effective['audio.speed'], 3);
  assert.equal(resolved.effective['audio.skipSeconds'], 30);
});

test('native wrapper and library client expose the audio bridge and route audio events', async () => {
  const nativeCalls = [];
  const nativeListeners = new Map();
  const audioPlugin = {
    async prepareAudio(options) { nativeCalls.push(['prepareAudio', options]); return { bookId: options.bookId }; },
    async playAudio() { nativeCalls.push(['playAudio']); return { playing: true }; },
    async pauseAudio() { nativeCalls.push(['pauseAudio']); return { playing: false }; },
    async seekAudio(options) { nativeCalls.push(['seekAudio', options]); return options; },
    async skipAudio(options) { nativeCalls.push(['skipAudio', options]); return options; },
    async previousAudioTrack() { nativeCalls.push(['previousAudioTrack']); return { trackIndex: 0 }; },
    async nextAudioTrack() { nativeCalls.push(['nextAudioTrack']); return { trackIndex: 1 }; },
    async setAudioSpeed(options) { nativeCalls.push(['setAudioSpeed', options]); return options; },
    async getAudioState() { nativeCalls.push(['getAudioState']); return { playing: false }; },
    async stopAudio() { nativeCalls.push(['stopAudio']); return { playing: false }; },
    async setAudioSleepTimer(options) { nativeCalls.push(['setAudioSleepTimer', options]); return { scheduled: true }; },
    async cancelAudioSleepTimer() { nativeCalls.push(['cancelAudioSleepTimer']); return { cancelled: true }; },
    async addListener(name, listener) {
      nativeListeners.set(name, listener);
      return { remove: async () => nativeListeners.delete(name) };
    }
  };
  const plugin = createReadingLibraryPlugin(undefined, undefined, audioPlugin);
  const client = createReadingLibraryClient(plugin);
  await client.prepareAudio({ bookId: 'book-1', relativePath: 'items/book-1/source.m4b', trackIndex: 1, positionMs: 1234 });
  await client.playAudio();
  await client.pauseAudio();
  await client.seekAudio({ positionMs: 9000 });
  await client.skipAudio({ deltaMs: -30000 });
  await client.previousAudioTrack();
  await client.nextAudioTrack();
  await client.setAudioSpeed({ speed: 1.5 });
  await client.getAudioState();
  await client.stopAudio();
  await client.setAudioSleepTimer({ minutes: 15, atTrackEnd: false });
  await client.cancelAudioSleepTimer();
  const handle = await client.addListener('audioPosition', () => {});
  await handle.remove();
  assert.deepEqual(nativeCalls.map(([name]) => name), [
    'prepareAudio', 'playAudio', 'pauseAudio', 'seekAudio', 'skipAudio', 'previousAudioTrack', 'nextAudioTrack',
    'setAudioSpeed', 'getAudioState', 'stopAudio', 'setAudioSleepTimer', 'cancelAudioSleepTimer'
  ]);
  assert.equal(nativeListeners.size, 0);
});
