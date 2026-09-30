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

function fakeClient(initialState = null) {
  const listeners = new Map();
  return {
    begins: [],
    appends: [],
    commits: [],
    plays: 0,
    pauses: 0,
    seeks: [],
    stops: 0,
    state: initialState,
    async beginTtsSession(options) { this.begins.push(structuredClone(options)); return true; },
    async appendTtsUnits(options) { this.appends.push(structuredClone(options)); return true; },
    async commitTtsSession(options) { this.commits.push(structuredClone(options)); return true; },
    async playTts() { this.plays++; return true; },
    async pauseTts() { this.pauses++; return true; },
    async seekTts(options) { this.seeks.push(structuredClone(options)); return true; },
    async getTtsState() { return this.state; },
    async stopTts() { this.stops++; return true; },
    async addListener(name, listener) {
      listeners.set(name, listener);
      return { remove: async () => listeners.delete(name) };
    },
    emit(name, payload) { listeners.get(name)?.(payload); }
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('speech prepares the complete semantic queue natively and play does not chain utterances in JavaScript', async () => {
  const client = fakeClient();
  const changes = [];
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 0 },
    settings: { 'speech.voice': 'voz-a', 'speech.rate': 1.25 },
    onPositionChange: value => changes.push(value)
  });

  assert.equal(await speech.play(), true);
  assert.equal(client.begins.length, 1);
  assert.equal(client.begins[0].bookId, 'book-1');
  assert.equal(client.begins[0].voiceId, 'voz-a');
  assert.equal(client.begins[0].rate, 1.25);
  assert.deepEqual(
    client.appends.flatMap(item => item.units),
    [
      { blockIndex: 0, unitIndex: 0, text: 'Uno.' },
      { blockIndex: 0, unitIndex: 1, text: 'Dos.' },
      { blockIndex: 1, unitIndex: 0, text: 'Tres.' }
    ]
  );
  assert.equal(client.commits.length, 1);
  assert.equal(client.plays, 1);

  const sessionId = client.begins[0].sessionId;
  client.emit('ttsPosition', { sessionId, bookId: 'book-1', blockIndex: 0, unitIndex: 1 });
  await flush();
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  assert.equal(changes.at(-1).state, 'in-reading');
  assert.equal(client.plays, 1, 'position events must never trigger another JavaScript play call');

  client.emit('ttsPosition', { sessionId, bookId: 'book-1', blockIndex: 1, unitIndex: 0 });
  await flush();
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });
  assert.equal(client.plays, 1);
  await speech.destroy();
});

test('pause, seek and resume are delegated to the native session', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 0 }
  });

  await speech.play();
  await speech.pause();
  assert.equal(client.pauses, 1);
  assert.equal(speech.snapshot().playing, false);

  await speech.moveTo({ blockIndex: 1, unitIndex: 0 });
  assert.deepEqual(client.seeks.at(-1), { blockIndex: 1, unitIndex: 0 });
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });

  await speech.play();
  assert.equal(client.plays, 2);
  await speech.destroy();
});

test('native interruption pauses at the same position and never auto-resumes', async () => {
  const client = fakeClient();
  const changes = [];
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    onPositionChange: value => changes.push(value)
  });

  await speech.play();
  const sessionId = client.begins[0].sessionId;
  client.emit('ttsPosition', { sessionId, bookId: 'book-1', blockIndex: 0, unitIndex: 1 });
  client.emit('ttsInterrupted', { sessionId, bookId: 'book-1', blockIndex: 0, unitIndex: 1 });
  await flush();

  assert.equal(speech.snapshot().playing, false);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  assert.equal(client.plays, 1);
  assert.equal(changes.at(-1).interrupted, true);
  await speech.destroy();
});

test('controller automatically adopts a matching native session that survived the WebView', async () => {
  const client = fakeClient({
    sessionId: 'native-existing',
    bookId: 'book-1',
    blockIndex: 1,
    unitIndex: 0,
    prepared: true,
    playing: true,
    ended: false
  });
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 0 }
  });

  await flush();
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });
  assert.equal(speech.snapshot().playing, true);
  assert.equal(client.begins.length, 0, 'a surviving matching session must not be replaced');
  await speech.destroy({ preserveNative: true });
});

test('loading voice and rate while an adopted native session is playing does not fake a pause', async () => {
  const client = fakeClient({
    sessionId: 'native-existing',
    bookId: 'book-1',
    blockIndex: 0,
    unitIndex: 1,
    prepared: true,
    playing: true,
    ended: false
  });
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture()
  });

  await flush();
  assert.equal(speech.snapshot().playing, true);
  speech.setVoice('voz-guardada');
  speech.setRate(1.3);
  assert.equal(speech.snapshot().playing, true);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  await speech.destroy({ preserveNative: true });
});

test('ending is driven by the native service and reports the book as read', async () => {
  const client = fakeClient();
  const changes = [];
  const speech = createReadingSpeechController({
    client,
    book: { id: 'book-1', title: 'Prueba' },
    document: documentFixture(),
    onPositionChange: value => changes.push(value)
  });

  await speech.play();
  const sessionId = client.begins[0].sessionId;
  client.emit('ttsEnded', { sessionId, bookId: 'book-1', blockIndex: 1, unitIndex: 0, ended: true, playing: false });
  await flush();

  assert.equal(speech.snapshot().ended, true);
  assert.equal(speech.snapshot().playing, false);
  assert.equal(changes.at(-1).state, 'read');
  await speech.destroy();
});
