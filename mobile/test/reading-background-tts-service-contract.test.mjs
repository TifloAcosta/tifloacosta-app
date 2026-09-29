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

test('background TTS service owns continuous native reading without WebView callbacks', async () => {
  const [service, manifest] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java'),
    read('android/app/src/main/AndroidManifest.xml')
  ]);

  assert.match(service, /class\s+ReadingBackgroundTtsService\s+extends\s+Service/);
  assert.match(service, /ReadingTtsSessionStore/);
  assert.match(service, /ReadingTtsPlaybackState/);
  assert.match(service, /ReadingTtsController/);
  assert.match(service, /startForeground\s*\(/);
  assert.match(service, /START_NOT_STICKY/);

  for (const action of ['PREPARE', 'PLAY', 'PAUSE', 'SEEK', 'STOP', 'QUERY_STATE']) {
    assert.match(service, new RegExp(`ACTION_${action}`), `Missing ${action} service action`);
  }

  for (const event of ['TTS_STATE', 'TTS_POSITION', 'TTS_INTERRUPTED', 'TTS_ENDED', 'TTS_ERROR']) {
    assert.match(service, new RegExp(`ACTION_${event}`), `Missing ${event} service event`);
  }

  assert.match(manifest, /android:name="\.reading\.ReadingBackgroundTtsService"/);
  assert.match(manifest, /ReadingBackgroundTtsService[\s\S]{0,200}android:foregroundServiceType="mediaPlayback"/);
  assert.match(manifest, /ReadingBackgroundTtsService[\s\S]{0,200}android:exported="false"/);
});

test('preparing a background TTS session never autoplays it', async () => {
  const service = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java');
  const prepare = service.match(/private\s+void\s+prepareSession\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';

  assert.notEqual(prepare, '', 'Missing prepareSession implementation');
  assert.doesNotMatch(prepare, /\.play\s*\(/, 'Preparing or restoring a session must never autoplay');
});
