import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReadingSettings } from '../src/core/reading-settings.mjs';

test('reading settings use safe defaults and clamp speech rate', () => {
  const resolved = resolveReadingSettings({}, {});
  assert.equal(resolved.effective['speech.rate'], 1);
  assert.equal(resolved.effective['speech.voice'], '');
  assert.equal(resolved.effective['visual.theme'], 'system');
  assert.equal(resolved.inherited['speech.rate'], true);

  const fast = resolveReadingSettings({ 'speech.rate': '9' }, {});
  const slow = resolveReadingSettings({ 'speech.rate': '0.1' }, {});
  assert.equal(fast.effective['speech.rate'], 2);
  assert.equal(slow.effective['speech.rate'], 0.5);
});

test('book overrides win while reset restores global inheritance', () => {
  const global = { 'speech.rate': 1.1, 'speech.voice': 'global-voice', 'visual.theme': 'dark' };
  const book = { 'speech.rate': 1.4, 'speech.voice': 'book-voice' };
  const overridden = resolveReadingSettings(global, book);
  assert.equal(overridden.effective['speech.rate'], 1.4);
  assert.equal(overridden.effective['speech.voice'], 'book-voice');
  assert.equal(overridden.effective['visual.theme'], 'dark');
  assert.equal(overridden.inherited['speech.rate'], false);
  assert.equal(overridden.inherited['visual.theme'], true);

  const reset = resolveReadingSettings(global, {});
  assert.equal(reset.effective['speech.rate'], 1.1);
  assert.equal(reset.effective['speech.voice'], 'global-voice');
  assert.equal(reset.inherited['speech.rate'], true);
});

test('missing device voice falls back without destroying the stored preference', () => {
  const resolved = resolveReadingSettings(
    { 'speech.voice': 'removed-voice' },
    {},
    { availableVoices: [{ id: 'available', name: 'Disponible' }] }
  );
  assert.equal(resolved.stored['speech.voice'], 'removed-voice');
  assert.equal(resolved.effective['speech.voice'], '');
  assert.equal(resolved.voiceAvailable, false);
});

test('visual settings are bounded and unsupported values return to defaults', () => {
  const resolved = resolveReadingSettings({
    'visual.textSize': 99,
    'visual.lineSpacing': 0,
    'visual.paragraphSpacing': 9,
    'visual.readingWidth': 10,
    'visual.theme': 'neon',
    'visual.fontFamily': 'serif',
    'visual.fontWeight': 'bold',
    'visual.highContrast': true
  }, {});

  assert.equal(resolved.effective['visual.textSize'], 2);
  assert.equal(resolved.effective['visual.lineSpacing'], 1);
  assert.equal(resolved.effective['visual.paragraphSpacing'], 3);
  assert.equal(resolved.effective['visual.readingWidth'], 30);
  assert.equal(resolved.effective['visual.theme'], 'system');
  assert.equal(resolved.effective['visual.fontFamily'], 'serif');
  assert.equal(resolved.effective['visual.fontWeight'], 'bold');
  assert.equal(resolved.effective['visual.highContrast'], true);
});
