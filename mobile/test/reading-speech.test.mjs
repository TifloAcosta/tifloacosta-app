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
    starts: [],
    stops: 0,
    async startTts(options) {
      this.starts.push({ ...options });
      return true;
    },
    async stopTts() {
      this.stops++;
      return true;
    },
    async addListener(name, listener) {
      listeners.set(name, listener);
      return { remove: async () => listeners.delete(name) };
    },
    emit(name, payload) {
      listeners.get(name)?.(payload);
    }
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

test('speech advances sentence by sentence and reports one shared semantic position', async () => {
  const client = fakeClient();
  const changes = [];
  const speech = createReadingSpeechController({
    client,
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 0 },
    settings: { 'speech.voice': 'voz-a', 'speech.rate': 1.25 },
    onPositionChange: position => changes.push(position)
  });

  await speech.play();
  assert.equal(client.starts[0].text, 'Uno.');
  assert.equal(client.starts[0].voiceId, 'voz-a');
  assert.equal(client.starts[0].rate, 1.25);

  const first = client.starts[0];
  client.emit('ttsDone', { sessionId: first.sessionId, utteranceId: first.utteranceId });
  await flush();
  assert.equal(client.starts[1].text, 'Dos.');
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });

  const second = client.starts[1];
  client.emit('ttsDone', { sessionId: second.sessionId, utteranceId: second.utteranceId });
  await flush();
  assert.equal(client.starts[2].text, 'Tres.');
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });
  assert.equal(changes.at(-1).state, 'in-reading');
  await speech.destroy();
});

test('pause and resume continue from the same semantic unit', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 1 },
    settings: {}
  });

  await speech.play();
  assert.equal(client.starts[0].text, 'Dos.');
  await speech.pause();
  assert.equal(client.stops, 1);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  assert.equal(speech.snapshot().playing, false);

  await speech.play();
  assert.equal(client.starts[1].text, 'Dos.');
  await speech.destroy();
});

test('stale callbacks from older sessions are ignored', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({ client, document: documentFixture(), settings: {} });

  await speech.play();
  const old = client.starts[0];
  await speech.moveTo({ blockIndex: 1, unitIndex: 0 });
  await speech.play();
  const current = client.starts[1];

  client.emit('ttsDone', { sessionId: old.sessionId, utteranceId: old.utteranceId });
  await flush();
  assert.equal(client.starts.length, 2);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 1, unitIndex: 0 });

  client.emit('ttsDone', { sessionId: current.sessionId, utteranceId: current.utteranceId });
  await flush();
  assert.equal(speech.snapshot().playing, false);
  assert.equal(speech.snapshot().ended, true);
  await speech.destroy();
});

test('voice and rate changes keep position and use bounded values on the next utterance', async () => {
  const client = fakeClient();
  const speech = createReadingSpeechController({
    client,
    document: documentFixture(),
    initialPosition: { blockIndex: 0, unitIndex: 1 },
    settings: {}
  });

  speech.setVoice('voz-nueva');
  speech.setRate(8);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 1 });
  await speech.play();
  assert.equal(client.starts[0].voiceId, 'voz-nueva');
  assert.equal(client.starts[0].rate, 2);
  await speech.destroy();
});

test('native interruption pauses at the same unit and never auto-resumes', async () => {
  const client = fakeClient();
  const changes = [];
  const speech = createReadingSpeechController({
    client,
    document: documentFixture(),
    settings: {},
    onPositionChange: value => changes.push(value)
  });

  await speech.play();
  const current = client.starts[0];
  client.emit('ttsInterrupted', { sessionId: current.sessionId, utteranceId: current.utteranceId });
  await flush();

  assert.equal(speech.snapshot().playing, false);
  assert.equal(client.starts.length, 1);
  assert.deepEqual(speech.snapshot().position, { blockIndex: 0, unitIndex: 0 });
  assert.equal(changes.at(-1).interrupted, true);
  await speech.destroy();
});

test('empty documents and end of document finish safely without speaking', async () => {
  const client = fakeClient();
  const empty = createReadingSpeechController({ client, document: { blocks: [] }, settings: {} });
  assert.equal(await empty.play(), false);
  assert.equal(client.starts.length, 0);
  assert.equal(empty.snapshot().ended, true);
  await empty.destroy();

  const lastClient = fakeClient();
  const last = createReadingSpeechController({
    client: lastClient,
    document: documentFixture(),
    initialPosition: { blockIndex: 1, unitIndex: 0 },
    settings: {}
  });
  await last.play();
  const utterance = lastClient.starts[0];
  lastClient.emit('ttsDone', { sessionId: utterance.sessionId, utteranceId: utterance.utteranceId });
  await flush();
  assert.equal(last.snapshot().ended, true);
  assert.equal(last.snapshot().playing, false);
  assert.equal(lastClient.starts.length, 1);
  await last.destroy();
});
