import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('TifloReadingTts bridge controls the native background reading service', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java');

  assert.match(plugin, /ReadingBackgroundTtsService/);
  assert.match(plugin, /BroadcastReceiver/);
  assert.match(plugin, /registerReceiver\s*\(/);
  assert.match(plugin, /unregisterReceiver\s*\(/);

  for (const method of ['playTts', 'pauseTts', 'seekTts', 'getTtsState', 'stopTts']) {
    assert.match(
      plugin,
      new RegExp(`public\\s+void\\s+${method}\\s*\\(PluginCall\\s+call\\)`),
      `Missing ${method}`
    );
  }

  for (const action of ['ACTION_PREPARE', 'ACTION_PLAY', 'ACTION_PAUSE', 'ACTION_SEEK', 'ACTION_STOP', 'ACTION_QUERY_STATE']) {
    assert.match(plugin, new RegExp(`ReadingBackgroundTtsService\\.${action}`), `Missing ${action} bridge`);
  }

  for (const action of ['ACTION_TTS_STATE', 'ACTION_TTS_POSITION', 'ACTION_TTS_INTERRUPTED', 'ACTION_TTS_ENDED', 'ACTION_TTS_ERROR']) {
    assert.match(plugin, new RegExp(`ReadingBackgroundTtsService\\.${action}`), `Missing ${action} receiver`);
  }

  for (const event of ['ttsState', 'ttsPosition', 'ttsInterrupted', 'ttsEnded', 'ttsError']) {
    assert.match(plugin, new RegExp(`"${event}"`), `Missing ${event} Capacitor event`);
  }
});

test('committing a TTS session prepares it without starting playback', async () => {
  const plugin = await read('android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java');
  const commit = plugin.match(/public\s+void\s+commitTtsSession\s*\(PluginCall\s+call\)\s*\{([\s\S]*?)\n\s*\}\n\n\s*@PluginMethod/)?.[1] ?? '';

  assert.notEqual(commit, '', 'Missing commitTtsSession implementation');
  assert.match(commit, /ACTION_PREPARE/);
  assert.doesNotMatch(commit, /ACTION_PLAY/, 'Committing a session must never autoplay');
});
