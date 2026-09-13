import assert from 'node:assert/strict';
import test from 'node:test';
import { saveRemoteFile } from '../src/native/save-file.mjs';

function response({ ok = true, bytes = [72, 105], mime = 'text/plain', status = 200 } = {}) {
  return {
    ok,
    status,
    headers: { get(name) { return name.toLowerCase() === 'content-type' ? mime : null; } },
    async arrayBuffer() { return Uint8Array.from(bytes).buffer; }
  };
}

test('fetches a remote file and passes base64 data to the native system saver', async () => {
  const calls = [];
  const result = await saveRemoteFile({
    url: 'https://tifloacosta.com/guide.txt',
    suggestedName: 'guide.txt',
    fetchFn: async () => response(),
    nativeSave: { async save(payload) { calls.push(payload); return { saved: true }; } }
  });
  assert.equal(result.saved, true);
  assert.equal(calls[0].fileName, 'guide.txt');
  assert.equal(calls[0].mimeType, 'text/plain');
  assert.equal(calls[0].base64Data, 'SGk=');
});

test('HTTP failure never opens the native saver', async () => {
  let saves = 0;
  await assert.rejects(
    saveRemoteFile({
      url: 'https://tifloacosta.com/missing.pdf',
      suggestedName: 'missing.pdf',
      fetchFn: async () => response({ ok: false, status: 404 }),
      nativeSave: { async save() { saves += 1; return { saved: true }; } }
    }),
    /404/
  );
  assert.equal(saves, 0);
});

test('native cancellation is returned quietly', async () => {
  const result = await saveRemoteFile({
    url: 'https://tifloacosta.com/file.pdf',
    suggestedName: 'file.pdf',
    fetchFn: async () => response({ mime: 'application/pdf' }),
    nativeSave: { async save() { return { saved: false }; } }
  });
  assert.deepEqual(result, { saved: false });
});