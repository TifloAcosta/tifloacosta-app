import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingSpeechController } from '../src/core/reading-speech.mjs';

function documentFixture() {
  return {
    title: 'Prueba',
    language: 'es',
    blocks: [
      { id: 'p-1', type: 'paragraph', text: 'Uno. Dos.', sentences: ['Uno.', 'Dos.'] },
      { id: 'p-2', type: 'paragraph', text: 'Tres.', sentences: ['Tres.'] }
    ]
  };
}

function fakeClient() {
  const listeners = new Map();
  return {
    begins: [],
    appends: [],
    commits: 0,
    plays: 0,
    pauses: 0,
    seeks: [],
    stops: 0,
    async beginTtsSession(options) { this.begins.push({ ...options }); return true; },
    async appendTtsUnits(options) { this.appends.push(structuredClone(options)); return true; },
    async commitTtsSession() { this.commits++; return true; },
    async playTts() { this.plays++; return true; },
    async pauseTts() { this.pauses++; return true; },
    async seekTts(options) { this.seeks.push({ ...options }); return true; },
    async getTtsState() { return { prepared: false, playing: false, ended: false, sessionId: '', bookId: '' }; },
    async stopTts() { this.stops++; return true; },
    async addListener(name, listener) {
      listeners.set(name, listener);
      return { remove: async () => listeners.delete(name) };
    }
  };
}

test('voice and rate changes keep semantic position and are bounded in the next native session', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 1 }
  });

  speech.setVoice('voz-nueva');
  speech.setRate(8);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  await speech.play();
  assert.equal(client.begins[0].voiceId, 'voz-nueva');
  assert.equal(client.begins[0].rate, 2);
  assert.equal(client.begins[0].blockIndex, 0);
  assert.equal(client.begins[0].unitIndex, 1);
  await speech.destroy();
});

test('empty documents finish safely without preparing or speaking', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-empty', title: 'Vacío' },
    document: { blocks: [] }
  });

  assert.equal(await speech.play(), false);
  assert.equal(client.begins.length, 0);
  assert.equal(client.plays, 0);
  assert.equal(speech.snapshot().ended, true);
  await speech.destroy();
});

test('moving before first playback changes the start position without autoplay', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture()
  });

  await speech.moveTo({ blockIndex: 1, unitIndex: 0 });
  assert.equal(client.plays, 0);
  assert.equal(client.begins.length, 0);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });
  await speech.play();
  assert.equal(client.begins[0].blockIndex, 1);
  assert.equal(client.begins[0].unitIndex, 0);
  assert.equal(client.plays, 1);
  await speech.destroy();
});
