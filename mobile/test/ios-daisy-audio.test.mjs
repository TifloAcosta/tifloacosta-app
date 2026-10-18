import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosDaisyAudio } from '../src/core/ios-daisy-audio.mjs';

class AudioStub {
  constructor() {
    this.handlers = new Map();
    this.currentTime = 0;
    this.duration = 30;
    this.readyState = 0;
    this.paused = true;
    this.ended = false;
  }
  addEventListener(name, handler) {
    const group = this.handlers.get(name) || new Set();
    group.add(handler);
    this.handlers.set(name, group);
  }
  removeEventListener(name, handler) { this.handlers.get(name)?.delete(handler); }
  emit(name) { for (const handler of this.handlers.get(name) || []) handler(); }
  load() {
    if (!this.src) return;
    this.readyState = 1;
    this.emit('loadedmetadata');
  }
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  async play() { this.paused = false; this.emit('play'); }
  pause() { this.paused = true; this.emit('pause'); }
}

function fixture() {
  const created = [];
  const revocations = [];
  const clips = [
    { audioHref: '01.mp3', clipBeginMs: 2000, clipEndMs: 11000 },
    { audioHref: '02.m4a', clipBeginMs: 5000, clipEndMs: 19000 }
  ];
  const player = createIosDaisyAudio({
    library: { openDaisyArchive: async id => ({
      book: { id }, blob: new Blob(['archive bytes'])
    }) },
    openArchive: async () => ({
      zip: {
        file(name) {
          if (!clips.some(clip => clip.audioHref === name)) return null;
          return { async: async () => new Uint8Array([1, 2, 3]) };
        }
      },
      model: { audioClips: clips }
    }),
    createAudio: () => {
      const audio = new AudioStub();
      created.push(audio);
      return audio;
    },
    urls: {
      createObjectURL(blob) {
        assert.ok(['audio/mpeg', 'audio/mp4'].includes(blob.type));
        return 'blob:local-' + created.length;
      },
      revokeObjectURL(url) { revocations.push(url); }
    }
  });
  return { player, created, revocations };
}

test('DAISY audio opens original ZIP and navigates SMIL clips using clip-relative positions', async () => {
  const { player, created, revocations } = fixture();
  const tracks = await player.listAudioTracks({ bookId: 'web-daisy-old' });
  assert.equal(tracks.tracks.length, 2);
  assert.equal(tracks.tracks[0].durationMs, 9000);
  const first = await player.prepareAudio({
    bookId: 'web-daisy-old', trackIndex: 0, positionMs: 3000
  });
  assert.equal(first.bookId, 'web-daisy-old');
  assert.equal(first.trackIndex, 0);
  assert.equal(first.positionMs, 3000);
  assert.equal(created[0].currentTime, 5);
  assert.equal((await player.playAudio()).playing, true);
  const next = await player.nextAudioTrack();
  assert.equal(next.trackIndex, 1);
  assert.equal(next.positionMs, 0);
  assert.equal(next.playing, true);
  assert.equal(created[1].currentTime, 5);
  assert.equal((await player.seekAudio({ positionMs: 4500 })).positionMs, 4500);
  assert.equal((await player.pauseAudio()).playing, false);
  await player.stopAudio();
  assert.deepEqual(revocations, ['blob:local-1', 'blob:local-2']);
  assert.equal((await player.getAudioState()).bookId, '');
});

test('stopping a DAISY preparation prevents a late metadata response from reopening it', async () => {
  const { player, created } = fixture();
  class DelayedAudio extends AudioStub {
    load() {}
  }
  const original = created.push.bind(created);
  // This additional fixture injects one audio element whose metadata never loads.
  const delayed = new DelayedAudio();
  const slow = createIosDaisyAudio({
    library: { openDaisyArchive: async id => ({ book: { id }, blob: new Blob(['zip']) }) },
    openArchive: async () => ({
      zip: { file: () => ({ async: async () => new Uint8Array([2]) }) },
      model: { audioClips: [{ audioHref: 'track.mp3', clipBeginMs: 0, clipEndMs: 5000 }] }
    }),
    createAudio: () => delayed,
    urls: { createObjectURL: () => 'blob:local', revokeObjectURL() {} }
  });
  const pending = slow.prepareAudio({ bookId: 'old' });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await slow.stopAudio();
  delayed.emit('loadedmetadata');
  assert.equal(await pending, null);
  assert.equal((await slow.getAudioState()).prepared, false);
});

test('different DAISY chapters are not mistaken for the same audio track', async () => {
  const { player } = fixture();
  await player.prepareAudio({ bookId: 'book-1' });
  assert.equal((await player.nextAudioTrack()).trackIndex, 1);
  assert.equal((await player.previousAudioTrack()).trackIndex, 0);
});
