import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosReceivedInbox, youtubeIdFromReceivedText } from '../src/core/ios-received-inbox.mjs';
import { createIosLegacyReadingBridge } from '../src/core/ios-legacy-reading.mjs';

const ID = 'f499d05d-9e01-4fcd-9de8-333333333333';
const FILE = { id: ID, kind: 'file', name: 'Memorias.mp3', contentType: 'audio/mpeg' };
const bytes = Uint8Array.from([0, 255, 13, 244, 64, 0]);
const chunk = Buffer.from(bytes).toString('base64');

test('iOS App Group Received only lists, never deletes on loading', async () => {
  let calls = 0;
  const inbox = createIosReceivedInbox({
    native: { pending: async () => {
      calls += 1;
      return { items: [FILE, { id: 'invalid/../file', kind: 'file' }] };
    }, acknowledge: async () => { throw Error('do not delete'); } }
  });
  const result = await inbox.pending();
  assert.equal(calls, 1);
  assert.equal(result.available, true);
  assert.deepEqual(result.items, [FILE]);
});

test('a verified binary import acknowledges only the original identified receipt', async () => {
  const events = [];
  const native = {
    readItemChunk: async ({ id, offset, length }) => {
      events.push('chunk');
      assert.equal(id, ID);
      assert.equal(offset, 0);
      assert.equal(length, 524288);
      return { data: chunk, nextOffset: bytes.length, size: bytes.length, done: true, contentType: 'audio/mpeg' };
    },
    acknowledge: async ({ id }) => {
      events.push('acknowledge');
      assert.equal(id, ID);
      return { acknowledged: true };
    }
  };
  const bridge = createIosLegacyReadingBridge({
    library: {
      importAudioFile: async ({ file }) => {
        events.push('import');
        assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
        return { id: 'web-audio-001', title: 'Memorias' };
      },
      openBook: async id => { events.push('reopen'); return { book: { id }, content: '' }; },
      openAudioFile: async id => {
        events.push('verify-media');
        return { book: { id }, blob: new Blob([bytes], { type: 'audio/mpeg' }) };
      }
    }
  });
  const inbox = createIosReceivedInbox({ native, library: bridge });
  const result = await inbox.saveFile(FILE);
  assert.deepEqual(result, { saved: true, id: 'web-audio-001', acknowledged: true });
  assert.deepEqual(events, ['chunk', 'import', 'reopen', 'verify-media', 'acknowledge']);
});

test('when library readback fails the App Group original remains untouched', async () => {
  let acknowledged = false;
  const native = {
    readItemChunk: async () => ({
      data: chunk, nextOffset: bytes.length, size: bytes.length, done: true
    }),
    acknowledge: async () => { acknowledged = true; return { acknowledged: true }; }
  };
  const bridge = createIosLegacyReadingBridge({
    library: {
      importAudioFile: async () => ({ id: 'web-audio-incomplete' }),
      openBook: async () => null
    }
  });
  const result = await createIosReceivedInbox({ native, library: bridge }).saveFile(FILE);
  assert.equal(result.saved, false);
  assert.equal(acknowledged, false);
});

test('corrupted native chunk cannot trigger an import or delete', async () => {
  let imported = false;
  let acknowledged = false;
  const native = {
    readItemChunk: async () => ({
      data: chunk, size: bytes.length + 1, nextOffset: bytes.length, done: true
    }),
    acknowledge: async () => { acknowledged = true; return { acknowledged: true }; }
  };
  const inbox = createIosReceivedInbox({
    native,
    library: { importReceivedBlob: async () => { imported = true; return { saved: true, id: 'x' }; } }
  });
  const result = await inbox.saveFile(FILE);
  assert.equal(result.saved, false);
  assert.equal(imported, false);
  assert.equal(acknowledged, false);
});

test('opening a valid received link never acknowledges the receipt', async () => {
  let acknowledgements = 0;
  let opened = '';
  const native = {
    openItem: async () => ({ id: ID, kind: 'url', value: 'https://www.youtube.com/watch?v=abcdefghijk' }),
    openURL: async ({ url }) => { opened = url; return { opened: true }; },
    acknowledge: async () => { acknowledgements++; }
  };
  const result = await createIosReceivedInbox({ native }).openLink({ id: ID, kind: 'url' });
  assert.equal(result.opened, true);
  assert.match(opened, /youtube\.com/);
  assert.equal(acknowledgements, 0);
});

test('an explicit deletion requires the caller to supply a valid original item ID', async () => {
  let deletions = 0;
  const native = { acknowledge: async () => { deletions++; return { acknowledged: true }; } };
  const inbox = createIosReceivedInbox({ native });
  assert.equal(await inbox.deleteConfirmed({ id: '../../escapes' }), false);
  assert.equal(deletions, 0);
  assert.equal(await inbox.deleteConfirmed({ id: ID }), true);
  assert.equal(deletions, 1);
});

test('YouTube title is resolved for a real received link without deleting or guessing', async () => {
  const videoId = youtubeIdFromReceivedText('Ver https://youtu.be/abcdefghijk');
  assert.equal(videoId, 'abcdefghijk');
  assert.equal(youtubeIdFromReceivedText('https://example.com/watch?v=abcdefghijk'), '');
  let resolved = '';
  const inbox = createIosReceivedInbox({
    native: {
      resolveYouTubeTitle: async ({ videoId: requested }) => {
        resolved = requested;
        return { title: 'Título público del vídeo' };
      },
      acknowledge: async () => { throw Error('must not delete'); }
    }
  });
  const title = await inbox.resolveYouTubeTitle({
    id: ID, kind: 'url', preview: 'https://www.youtube.com/watch?v=abcdefghijk'
  });
  assert.equal(resolved, 'abcdefghijk');
  assert.equal(title, 'Título público del vídeo');
});

test('shared explanatory text opens only its verified HTTPS link and retains the receipt', async () => {
  let url = '';
  let acknowledged = false;
  const native = {
    openItem: async () => ({ id: ID, kind: 'text', value: 'Mira este recurso: https://example.org/guia?lang=es' }),
    openURL: async options => { url = options.url; return { opened: true }; },
    acknowledge: async () => { acknowledged = true; }
  };
  const response = await createIosReceivedInbox({ native }).openLink({ id: ID, kind: 'text' });
  assert.equal(response.opened, true);
  assert.equal(url, 'https://example.org/guia?lang=es');
  assert.equal(acknowledged, false);
});
