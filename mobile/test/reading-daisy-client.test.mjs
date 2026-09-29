import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';

test('reading client preserves synchronized DAISY capabilities and loads its stored audio tracks', async () => {
  const calls = [];
  const client = createReadingLibraryClient({
    async openBook(id) {
      return {
        book: { id, title: 'DAISY de prueba', format: 'DAISY3' },
        content: JSON.stringify({
          blocks: [{ id: 'p1', type: 'paragraph', text: 'Texto.' }],
          mediaSyncReferences: [{
            textHref: 'chapter.xml#p1',
            audioHref: 'audio/track01.mp3',
            clipBeginMs: 1200,
            clipEndMs: 3400
          }]
        }),
        daisyHasText: true,
        daisyHasAudio: true,
        daisySynchronized: true
      };
    },
    async listAudioTracks({ bookId }) {
      calls.push(bookId);
      return {
        tracks: [{
          bookId,
          trackIndex: 0,
          relativePath: `items/${bookId}/track-0000.mp3`,
          originalName: 'track01.mp3',
          title: 'Pista 1',
          durationMs: 60000,
          sizeBytes: 1024
        }]
      };
    }
  });

  const opened = await client.openBook('daisy-sync');

  assert.equal(opened.book.format, 'daisy3');
  assert.equal(opened.daisyHasText, true);
  assert.equal(opened.daisyHasAudio, true);
  assert.equal(opened.daisySynchronized, true);
  assert.equal(opened.audioTracks.length, 1);
  assert.equal(opened.audioTracks[0].originalName, 'track01.mp3');
  assert.deepEqual(calls, ['daisy-sync']);
});

test('reading client does not query audio tracks for text-only DAISY', async () => {
  let trackQueries = 0;
  const client = createReadingLibraryClient({
    async openBook(id) {
      return {
        book: { id, title: 'DAISY texto', format: 'daisy2.02' },
        content: JSON.stringify({ blocks: [{ id: 'p1', type: 'paragraph', text: 'Texto.' }] }),
        daisyHasText: true,
        daisyHasAudio: false,
        daisySynchronized: false
      };
    },
    async listAudioTracks() {
      trackQueries += 1;
      return [];
    }
  });

  const opened = await client.openBook('daisy-text');

  assert.equal(opened.daisyHasText, true);
  assert.equal(opened.daisyHasAudio, false);
  assert.equal(opened.daisySynchronized, false);
  assert.deepEqual(opened.audioTracks, []);
  assert.equal(trackQueries, 0);
});
