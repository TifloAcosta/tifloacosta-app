import test from 'node:test';
import assert from 'node:assert/strict';
import { createIosNativeTtsBridge } from '../src/core/ios-native-tts.mjs';
import { createReadingSpeechController } from '../src/core/reading-speech-core.mjs';

test('iOS native voice bridge translates Capacitor result objects and keeps the exact reading book ID', async () => {
  const calls = [];
  const raw = {
    listTtsVoices: async () => ({ voices: [{ id: 'es-ES', name: 'Spanish', locale: 'es-ES' }] }),
    addListener: async (_name, _handler) => ({ remove() {} }),
    beginTtsSession: async args => { calls.push(['begin', args]); return { prepared: true }; },
    appendTtsUnits: async args => { calls.push(['append', args]); return { appended: args.units.length }; },
    commitTtsSession: async args => { calls.push(['commit', args]); return { prepared: true }; },
    playTts: async () => ({ accepted: true }),
    pauseTts: async () => ({ paused: true }),
    stopTts: async () => ({ stopped: true })
  };
  const tts = createIosNativeTtsBridge(raw);
  assert.equal((await tts.listTtsVoices()).voices[0].id, 'es-ES');
  const controller = createReadingSpeechController({
    client: { getActiveBookId: () => 'book-preserved' },
    fallbackTts: tts,
    book: { id: 'book-preserved', title: 'Libro anterior' },
    document: { blocks: [{ id: 'first', text: 'Este texto debe escucharse.' }] }
  });
  assert.equal(await controller.play(), true);
  assert.equal(calls[0][1].bookId, 'book-preserved');
  assert.equal(calls[1][1].units[0].text, 'Este texto debe escucharse.');
  assert.equal(await controller.pause(), true);
  await controller.destroy();
});

test('iOS speech bridge rejects partial appends and never claims success for unavailable native speech', async () => {
  const unavailable = createIosNativeTtsBridge(null);
  assert.equal(await unavailable.beginTtsSession({}), false);
  assert.equal(await unavailable.playTts(), false);
  assert.equal(await unavailable.commitTtsSession({}), false);
  const partial = createIosNativeTtsBridge({
    appendTtsUnits: async () => ({ appended: 1 })
  });
  assert.equal(await partial.appendTtsUnits({ units: [{ text: 'uno' }, { text: 'dos' }] }), false);
});
