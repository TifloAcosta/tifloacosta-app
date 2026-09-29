import assert from 'node:assert/strict';
import test from 'node:test';

import { createBackgroundTtsBridge } from '../src/native/reading-background-tts-plugin.mjs';

function fakePlugin() {
  const calls = [];
  const listeners = [];
  return {
    calls,
    listeners,
    async beginTtsSession(options) { calls.push(['beginTtsSession', options]); return { prepared: false }; },
    async appendTtsUnits(options) { calls.push(['appendTtsUnits', options]); return { appended: options.units.length }; },
    async commitTtsSession(options) { calls.push(['commitTtsSession', options]); return { prepared: true }; },
    async playTts() { calls.push(['playTts']); return { accepted: true }; },
    async pauseTts() { calls.push(['pauseTts']); return { paused: true }; },
    async seekTts(options) { calls.push(['seekTts', options]); return { accepted: true }; },
    async getTtsState() { calls.push(['getTtsState']); return { prepared: true, playing: false, blockIndex: 2, unitIndex: 1 }; },
    async stopTts() { calls.push(['stopTts']); return { stopped: true }; },
    async addListener(name, listener) { listeners.push([name, listener]); return { remove: async () => {} }; }
  };
}

test('background TTS JavaScript bridge normalizes native control results', async () => {
  const plugin = fakePlugin();
  const bridge = createBackgroundTtsBridge(plugin);

  assert.equal(await bridge.beginTtsSession({ sessionId: 's', bookId: 'b' }), true);
  assert.equal(await bridge.appendTtsUnits({ sessionId: 's', units: [{ blockIndex: 0, unitIndex: 0, text: 'Hola' }] }), true);
  assert.equal(await bridge.commitTtsSession({ sessionId: 's' }), true);
  assert.equal(await bridge.playTts(), true);
  assert.equal(await bridge.pauseTts(), true);
  assert.equal(await bridge.seekTts({ blockIndex: 2, unitIndex: 1 }), true);
  assert.deepEqual(await bridge.getTtsState(), {
    sessionId: '', bookId: '', blockIndex: 2, unitIndex: 1,
    prepared: true, playing: false, ended: false
  });
  assert.equal(await bridge.stopTts(), true);
});

test('background TTS JavaScript bridge forwards native events', async () => {
  const plugin = fakePlugin();
  const bridge = createBackgroundTtsBridge(plugin);
  const received = [];
  await bridge.addListener('ttsPosition', value => received.push(value));
  plugin.listeners.find(([name]) => name === 'ttsPosition')[1]({
    sessionId: 's', bookId: 'b', blockIndex: 1, unitIndex: 0, playing: true, prepared: true
  });
  assert.deepEqual(received[0], {
    sessionId: 's', bookId: 'b', blockIndex: 1, unitIndex: 0,
    prepared: true, playing: true, ended: false
  });
});
