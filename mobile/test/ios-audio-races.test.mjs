import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosDaisyAudio } from '../src/core/ios-daisy-audio.mjs';
import { createIosLegacyReadingBridge } from '../src/core/ios-legacy-reading.mjs';

class AudioStub {
  constructor({ delayed = false } = {}) {
    this.delayed = delayed;
    this.handlers = new Map();
    this.currentTime = 0;
    this.duration = 30;
    this.readyState = 0;
    this.paused = true;
    this.ended = false;
    this.playCount = 0;
  }
  addEventListener(name, callback) {
    const callbacks = this.handlers.get(name) || new Set();
    callbacks.add(callback);
    this.handlers.set(name, callbacks);
  }
  removeEventListener(name, callback) { this.handlers.get(name)?.delete(callback); }
  emit(name) { for (const callback of this.handlers.get(name) || []) callback(); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() {
    if (!this.src || this.delayed) return;
    this.readyState = 1;
    this.emit('loadedmetadata');
  }
  async play() {
    this.playCount += 1;
    this.paused = false;
    this.emit('play');
  }
  pause() { this.paused = true; this.emit('pause'); }
}

function daisyFixture({ audios = [], archiveForBook = null } = {}) {
  const clips = [
    { audioHref: 'chapter-1.mp3', clipBeginMs: 0, clipEndMs: 10000 },
    { audioHref: 'chapter-2.mp3', clipBeginMs: 1000, clipEndMs: 15000 }
  ];
  let created = 0;
  const player = createIosDaisyAudio({
    library: { openDaisyArchive: async id => ({
      book: { id }, blob: new Blob([id])
    }) },
    openArchive: async blob => ({
      zip: { file: () => ({ async: async () => Uint8Array.from([1, 2, 3]) }) },
      model: { audioClips: archiveForBook
        ? archiveForBook(await blob.text()) : clips }
    }),
    createAudio: () => audios[created++] || new AudioStub(),
    urls: { createObjectURL: () => 'blob:sample-' + created, revokeObjectURL() {} }
  });
  return { player, clips };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test('DAISY: seeking to the end while paused does not jump or automatically play another clip', async () => {
  const first = new AudioStub();
  const { player } = daisyFixture({ audios: [first] });
  await player.prepareAudio({ bookId: 'book-one' });
  first.currentTime = 9.98;
  first.emit('timeupdate');
  await flush();
  const state = await player.getAudioState();
  assert.equal(state.trackIndex, 0);
  assert.equal(state.playing, false);
  assert.equal(first.playCount, 0);
  await player.stopAudio();
});

test('DAISY: pause during the next clip metadata load cancels implicit autoplay', async () => {
  const first = new AudioStub(), second = new AudioStub({ delayed: true });
  const { player } = daisyFixture({ audios: [first, second] });
  await player.prepareAudio({ bookId: 'book-one' });
  await player.playAudio();
  first.currentTime = 9.96;
  first.emit('timeupdate');
  await flush();
  assert.equal((await player.getAudioState()).trackIndex, 1);
  // The new audio is still loading, but Pause must remain authoritative.
  await player.pauseAudio();
  second.emit('loadedmetadata');
  await flush();
  const state = await player.getAudioState();
  assert.equal(state.trackIndex, 1);
  assert.equal(state.prepared, true);
  assert.equal(state.playing, false);
  assert.equal(second.playCount, 0);
  await player.stopAudio();
});

test('DAISY: listing another book cannot change duration or clip count of active audio', async () => {
  const first = new AudioStub();
  const { player } = daisyFixture({
    audios: [first],
    archiveForBook: id => id === 'other'
      ? [{ audioHref: 'other.mp3', clipBeginMs: 0, clipEndMs: 1000 }]
      : [{ audioHref: 'one.mp3', clipBeginMs: 2000, clipEndMs: 12000 },
        { audioHref: 'two.mp3', clipBeginMs: 0, clipEndMs: 9000 }]
  });
  const initial = await player.prepareAudio({ bookId: 'original', trackIndex: 0 });
  assert.equal(initial.durationMs, 10000);
  assert.equal(initial.trackCount, 2);
  const others = await player.listAudioTracks({ bookId: 'other' });
  assert.equal(others.tracks.length, 1);
  const unchanged = await player.getAudioState();
  assert.equal(unchanged.bookId, 'original');
  assert.equal(unchanged.durationMs, 10000);
  assert.equal(unchanged.trackCount, 2);
  await player.stopAudio();
});

test('iOS reader: slow old book lookup cannot replace a newer audio selection', async () => {
  let resolveOld;
  const starts = [];
  const bridge = createIosLegacyReadingBridge({
    library: { openBook: id => id === 'old'
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ book: { id, format: 'audio' } }) },
    audioPlayback: {
      prepareAudio: async options => {
        starts.push(options.bookId);
        return { bookId: options.bookId, prepared: true };
      },
      stopAudio: async () => ({ prepared: false })
    }
  });
  const pendingOld = bridge.prepareAudio({ bookId: 'old' });
  const selectedNew = await bridge.prepareAudio({ bookId: 'new' });
  resolveOld({ book: { id: 'old', format: 'audio' } });
  assert.equal(await pendingOld, null);
  assert.equal(selectedNew.bookId, 'new');
  assert.deepEqual(starts, ['new']);
});

test('iOS reader: Stop invalidates an unresolved request before it can play', async () => {
  let resolveLookup;
  let started = 0;
  const bridge = createIosLegacyReadingBridge({
    library: { openBook: id => new Promise(resolve => { resolveLookup = resolve; }) },
    audioPlayback: {
      prepareAudio: async () => { started += 1; return { prepared: true }; },
      stopAudio: async () => ({ prepared: false })
    }
  });
  const pending = bridge.prepareAudio({ bookId: 'old' });
  await bridge.stopAudio();
  resolveLookup({ book: { id: 'old', format: 'audio' } });
  assert.equal(await pending, null);
  assert.equal(started, 0);
});
