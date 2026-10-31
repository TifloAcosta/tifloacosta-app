import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('iPhone Safari keeps document accessible to VoiceOver while TTS is playing', async () => {
  const source = await readFile(new URL('../web-reading.js', import.meta.url), 'utf8');
  assert.match(source, /const iphoneSafari = \/iPhone\|iPod\/i\.test/);
  assert.match(source, /if \(iphoneSafari && !playbackAccessibilityState\)/);
  assert.match(source, /els\.reader\.removeAttribute\('aria-busy'\)/);
  assert.match(source, /if \(iphoneSafari && !playbackAccessibilityState\) \{[\s\S]*?return;\s*\}\s*if \(active\)/);
});
