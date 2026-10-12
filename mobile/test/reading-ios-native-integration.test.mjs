import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveReadingSettings } from '../src/core/reading-settings.mjs';

const file = async path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const repoFile = async path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('reading preferences are collapsed and expose audio, visual and inherited navigation mode', async () => {
  const reader = await file('src/screens/reading-book.mjs');
  assert.match(reader, /readingSettings = document.createElement\('details'\)/);
  assert.match(reader, /readingSettingsSummary = document.createElement\('summary'\)/);
  assert.match(reader, /readingSettings\.append\(readingSettingsSummary, voiceButton, visualButton, defaultModeLabel/);
  assert.match(reader, /readingSettings,\s*moreActionsButton/);
  assert.match(reader, /scope: 'global', key: 'reading.navigationMode'/);
  assert.match(reader, /scope: 'book', bookId: activeBook.id/);
  assert.match(reader, /getReadingSettings\(activeBook.id\)/);

  const fallback = resolveReadingSettings({}, {});
  assert.equal(fallback.effective['reading.navigationMode'], 'sentence');
  const custom = resolveReadingSettings({ 'reading.navigationMode': 'paragraph' }, {});
  assert.equal(custom.effective['reading.navigationMode'], 'paragraph');
  assert.equal(custom.inherited['reading.navigationMode'], true);
  const override = resolveReadingSettings({ 'reading.navigationMode': 'paragraph' }, { 'reading.navigationMode': 'heading' });
  assert.equal(override.effective['reading.navigationMode'], 'heading');
  assert.equal(override.inherited['reading.navigationMode'], false);
  assert.equal(resolveReadingSettings({ 'reading.navigationMode': 'invalid' }, {}).effective['reading.navigationMode'], 'sentence');
});

test('voice/rate can change during playback while preserving the reader position', async () => {
  const settings = await file('src/screens/reading-settings.mjs');
  assert.match(settings, /saveSpeechSettingDuringPlayback/);
  assert.match(settings, /wasPlaying = speech\?\.snapshot\?\.\(\)\.playing === true/);
  assert.match(settings, /await speech\.pause\(\)/);
  assert.match(settings, /await speech\.play\(\)/);
  assert.match(settings, /saveSpeechSettingDuringPlayback\('speech.voice'/);
  assert.match(settings, /saveSpeechSettingDuringPlayback\('speech.rate'/);
});

test('iOS lists installed system voices via AVSpeechSynthesizer and not WKWebView', async () => {
  const plugin = await file('ios-native/ios/Sources/TifloReadingIos/TifloReadingTtsPlugin.swift');
  const packageJson = JSON.parse(await file('package.json'));
  assert.match(plugin, /AVSpeechSynthesisVoice\.speechVoices\(\)/);
  assert.match(plugin, /AVSpeechSynthesisVoice\(identifier: voiceId\)/);
  assert.match(plugin, /notifyListeners/);
  assert.match(plugin, /CAPPluginMethod\(name: "listTtsVoices"/);
  assert.equal(packageJson.dependencies['@tifloacosta/ios-native'], 'file:./ios-native');
  assert.doesNotMatch(plugin, /\.speechSynthesis\./);
});

test('native iOS translation uses the Apple Translation framework', async () => {
  const plugin = await file('ios-native/ios/Sources/TifloReadingIos/TifloReadingLanguagePlugin.swift');
  const panel = await file('src/screens/reading-translation-panel.mjs');
  assert.match(plugin, /import Translation/);
  assert.match(plugin, /TranslationSession\(installedSource:/);
  assert.match(plugin, /\.translationTask\(source:/);
  assert.match(plugin, /prepareTranslationPair/);
  assert.match(panel, /prepareTranslationPair/);
  assert.match(plugin, /identifyLanguage/);
});

test('Android persists the same inherited navigation setting as the shared model', async () => {
  const native = await file('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java');
  const shared = await repoFile('shared/reading-settings.mjs');
  assert.match(native, /"reading.navigationMode"/);
  assert.match(native, /"speech.voiceLanguage"/);
  assert.match(shared, /'reading.navigationMode': 'sentence'/);
});
