import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';
import { createReadingLibraryPlugin } from '../src/native/reading-library-plugin.mjs';

test('reading client preserves precise position and anchor when normalizing books and saving progress', async () => {
  let saved;
  const client = createReadingLibraryClient({
    async listBooks() {
      return {
        items: [{ id: 'a', title: 'Libro', format: 'txt', blockIndex: '4', unitIndex: '2', anchorText: ' frase cercana ' }],
        total: 1, page: 1, pageSize: 10, pages: 1
      };
    },
    async saveProgress(value) {
      saved = value;
      return { saved: true };
    }
  });

  const listed = await client.listBooks();
  assert.equal(listed.items[0].unitIndex, 2);
  assert.equal(listed.items[0].anchorText, 'frase cercana');
  assert.equal(listed.items[0].mediaTrackIndex, 0);
  assert.equal(listed.items[0].mediaPositionMs, 0);

  assert.equal(await client.saveProgress({
    id: 'a', blockIndex: 4, unitIndex: 2, anchorText: 'frase cercana', percent: 42, state: 'in-reading'
  }), true);
  assert.deepEqual(saved, {
    id: 'a', blockIndex: 4, unitIndex: 2, anchorText: 'frase cercana',
    mediaTrackIndex: 0, mediaPositionMs: 0, percent: 42, state: 'in-reading'
  });
});

test('native wrapper combines library bridge and isolated tts bridge as one API', async () => {
  const calls = [];
  const libraryPlugin = {
    async listMarks(options) { calls.push(['listMarks', options]); return { items: [] }; },
    async addMark(options) { calls.push(['addMark', options]); return { added: true, mark: options }; },
    async deleteMark(options) { calls.push(['deleteMark', options]); return { deleted: true }; },
    async getReadingSettings(options) { calls.push(['getReadingSettings', options]); return { global: {}, book: {} }; },
    async setReadingSetting(options) { calls.push(['setReadingSetting', options]); return { saved: true }; },
    async resetBookReadingSettings(options) { calls.push(['resetBookReadingSettings', options]); return { reset: true }; }
  };
  const listeners = [];
  const ttsPlugin = {
    async listTtsVoices() { return { voices: [{ id: 'v1', name: 'Voz', language: 'es', locale: 'es-ES', networkRequired: false }] }; },
    async startTts(options) { calls.push(['startTts', options]); return { accepted: true }; },
    async stopTts() { calls.push(['stopTts']); return { stopped: true }; },
    async addListener(name, listener) { listeners.push(name); return { remove: async () => {} }; }
  };
  const wrapper = createReadingLibraryPlugin(libraryPlugin, ttsPlugin);

  assert.equal((await wrapper.listTtsVoices()).voices[0].id, 'v1');
  assert.equal((await wrapper.startTts({ sessionId: 's', utteranceId: 'u', text: 'hola' })).accepted, true);
  assert.equal((await wrapper.stopTts()).stopped, true);
  await wrapper.addListener('ttsDone', () => {});
  assert.deepEqual(listeners, ['ttsDone']);

  await wrapper.listMarks({ bookId: 'a' });
  await wrapper.addMark({ bookId: 'a', type: 'bookmark' });
  await wrapper.deleteMark({ id: 'm' });
  await wrapper.getReadingSettings({ bookId: 'a' });
  await wrapper.setReadingSetting({ scope: 'book', bookId: 'a', key: 'speech.rate', value: '1.2' });
  await wrapper.resetBookReadingSettings({ bookId: 'a' });
  assert.deepEqual(calls.map(item => item[0]), [
    'startTts', 'stopTts', 'listMarks', 'addMark', 'deleteMark',
    'getReadingSettings', 'setReadingSetting', 'resetBookReadingSettings'
  ]);
});

test('reading client normalizes voices, marks and settings and degrades safely', async () => {
  const client = createReadingLibraryClient({
    async listTtsVoices() {
      return { voices: [{ id: 7, name: ' Voz ', language: 'ES', locale: 'es-ES', networkRequired: 0 }] };
    },
    async startTts(options) {
      assert.equal(options.rate, 2);
      return { accepted: true };
    },
    async stopTts() { return { stopped: true }; },
    async listMarks() {
      return { items: [{ id: 'm1', bookId: 'a', type: 'quote', blockIndex: '3', unitIndex: '2', excerpt: ' texto ', reference: ' ref ', createdAt: '99' }] };
    },
    async addMark(mark) { return { added: true, mark: { ...mark, id: 'm2', createdAt: 100 } }; },
    async deleteMark() { return { deleted: true }; },
    async getReadingSettings() { return { global: { 'speech.rate': '1.1' }, book: { 'speech.voice': 'v1' } }; },
    async setReadingSetting() { return { saved: true }; },
    async resetBookReadingSettings() { return { reset: true }; }
  });

  assert.deepEqual(await client.listTtsVoices(), [{
    id: '7', name: 'Voz', language: 'es', locale: 'es-ES', networkRequired: false
  }]);
  assert.equal(await client.startTts({ sessionId: 's', utteranceId: 'u', text: 'hola', rate: 20 }), true);
  assert.equal(await client.stopTts(), true);
  assert.deepEqual((await client.listMarks('a'))[0], {
    id: 'm1', bookId: 'a', type: 'quote', blockIndex: 3, unitIndex: 2,
    mediaTrackIndex: 0, mediaPositionMs: 0,
    excerpt: 'texto', reference: 'ref', createdAt: 99
  });
  assert.equal((await client.addMark({ bookId: 'a', type: 'bookmark', blockIndex: 0, unitIndex: 0 })).id, 'm2');
  assert.equal(await client.deleteMark('m1'), true);
  assert.deepEqual(await client.getReadingSettings('a'), {
    global: { 'speech.rate': '1.1' }, book: { 'speech.voice': 'v1' }
  });
  assert.equal(await client.setReadingSetting({ scope: 'book', bookId: 'a', key: 'speech.rate', value: '1.2' }), true);
  assert.equal(await client.resetBookReadingSettings('a'), true);

  const empty = createReadingLibraryClient({});
  assert.deepEqual(await empty.listTtsVoices(), []);
  assert.equal(await empty.startTts({ text: 'x' }), false);
  assert.equal(await empty.stopTts(), false);
  assert.deepEqual(await empty.listMarks('a'), []);
  assert.equal(await empty.addMark({}), null);
  assert.equal(await empty.deleteMark('m'), false);
  assert.deepEqual(await empty.getReadingSettings('a'), { global: {}, book: {} });
  assert.equal(await empty.setReadingSetting({}), false);
  assert.equal(await empty.resetBookReadingSettings('a'), false);
});
