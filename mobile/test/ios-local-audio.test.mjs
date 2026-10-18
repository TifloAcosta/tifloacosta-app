import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosLocalAudio } from '../src/core/ios-local-audio.mjs';
import { createReadingLibraryClient } from '../../shared/reading-library-client.mjs';

class FakeAudio {
  constructor() {
    this.events = new Map();
    this.paused = true;
    this.ended = false;
    this.duration = 100;
    this.currentTime = 0;
    this.readyState = 0;
  }
  addEventListener(name, fn) {
    const handlers = this.events.get(name) || [];
    handlers.push(fn);
    this.events.set(name, handlers);
  }
  removeEventListener(name, fn) {
    this.events.set(name, (this.events.get(name) || []).filter(value => value !== fn));
  }
  emit(name) { for (const fn of this.events.get(name) || []) fn(); }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() {
    if (this.src) {
      this.readyState = 1;
      this.emit('loadedmetadata');
    }
  }
  async play() { this.paused = false; this.emit('play'); }
  pause() { this.paused = true; this.emit('pause'); }
}

test('MP3 bridge can reopen previously stored bytes, play, seek and preserve book identity', async () => {
  const events = [];
  const urls = { createObjectURL: blob => {
    assert.equal(blob.size, 4);
    return 'blob:local-only';
  }, revokeObjectURL: url => events.push('revoke:' + url) };
  const library = {
    openAudioFile: async id => {
      assert.equal(id, 'existing-web-audio');
      return { book: { id, title: 'Grabación antigua' },
        blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mpeg' }) };
    }
  };
  const backend = createIosLocalAudio({ library, urls, createAudio: () => new FakeAudio() });
  const client = createReadingLibraryClient(backend);
  const tracks = await client.listAudioTracks('existing-web-audio');
  assert.equal(tracks[0].bookId, 'existing-web-audio');
  assert.equal(tracks[0].relativePath, 'local-mp3');
  const prepared = await client.prepareAudio({ bookId: 'existing-web-audio', positionMs: 10000 });
  assert.equal(prepared.positionMs, 10000);
  assert.equal(prepared.durationMs, 100000);
  assert.equal((await client.playAudio()).playing, true);
  assert.equal((await client.skipAudio({ deltaMs: 30000 })).positionMs, 40000);
  assert.equal((await client.pauseAudio()).playing, false);
  assert.equal((await client.setAudioSpeed({ speed: 1.5 })).speed, 1.5);
  await client.stopAudio();
  assert.deepEqual(events, ['revoke:blob:local-only']);
});

test('MP3 bridge cannot claim ready if media is missing or corrupted', async () => {
  const backend = createIosLocalAudio({ library: { openAudioFile: async () => null },
    createAudio: () => { throw Error('audio should not be opened'); } });
  assert.deepEqual(await backend.listAudioTracks({ bookId: 'bad-id' }), { tracks: [] });
  assert.equal(await backend.prepareAudio({ bookId: 'bad-id' }), null);
  assert.equal(await backend.playAudio(), null);
});

test('last MP3 selection wins when an older IndexedDB read finishes later', async () => {
  let resolveFirst;
  const library = {
    openAudioFile: id => id === 'old'
      ? new Promise(resolve => { resolveFirst = resolve; })
      : Promise.resolve({ book: { id }, blob: new Blob([new Uint8Array([2])]) })
  };
  const urls = { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} };
  const backend = createIosLocalAudio({ library, urls, createAudio: () => new FakeAudio() });
  const first = backend.prepareAudio({ bookId: 'old' });
  const second = await backend.prepareAudio({ bookId: 'new', positionMs: 4000 });
  resolveFirst({ book: { id: 'old' }, blob: new Blob([new Uint8Array([1])]) });
  assert.equal(await first, null);
  assert.equal(second.bookId, 'new');
  assert.equal((await backend.getAudioState()).bookId, 'new');
  assert.equal((await backend.getAudioState()).positionMs, 4000);
  await backend.stopAudio();
});

test('late MP3 metadata error cannot interrupt a newly prepared track', async () => {
  const oldElement = new FakeAudio();
  oldElement.load = () => {}; // Wait for an explicit late metadata/error event.
  let count = 0;
  const backend = createIosLocalAudio({
    library: { openAudioFile: async id => ({
      book: { id }, blob: new Blob([new Uint8Array([1, 2])])
    }) },
    urls: { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} },
    createAudio: () => ++count === 1 ? oldElement : new FakeAudio()
  });
  const oldPreparation = backend.prepareAudio({ bookId: 'old' });
  await Promise.resolve();
  const latest = await backend.prepareAudio({ bookId: 'new' });
  oldElement.emit('error');
  assert.equal(await oldPreparation, null);
  assert.equal(latest.bookId, 'new');
  assert.equal((await backend.getAudioState()).prepared, true);
  assert.equal((await backend.getAudioState()).bookId, 'new');
  await backend.stopAudio();
});

test('stop during MP3 preparation prevents a later metadata callback from restarting audio', async () => {
  const delayed = new FakeAudio();
  delayed.load = () => {};
  const backend = createIosLocalAudio({
    library: { openAudioFile: async id => ({ book: { id }, blob: new Blob(['audio']) }) },
    urls: { createObjectURL: () => 'blob:local', revokeObjectURL: () => {} },
    createAudio: () => delayed
  });
  const inFlight = backend.prepareAudio({ bookId: 'track' });
  await Promise.resolve();
  await backend.stopAudio();
  delayed.emit('loadedmetadata');
  assert.equal(await inFlight, null);
  assert.equal((await backend.getAudioState()).prepared, false);
  assert.equal((await backend.getAudioState()).bookId, '');
});
