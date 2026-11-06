import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const project = read('ios-app-native/project.yml');
const info = read('ios-app-native/Sources/Info.plist');
const appGroup = read('ios-app-native/Sources/App.entitlements');
const shareGroup = read('ios-app-native/ShareExtension/ShareExtension.entitlements');
const reviewWorkflow = read('.github/workflows/ios-native-swiftui-build.yml');
const uploadWorkflow = read('.github/workflows/ios-native-testflight-upload.yml');

test('candidate retains public bundle identifier and shared container', () => {
  assert.match(project, /^\s*PRODUCT_BUNDLE_IDENTIFIER: com\.tifloacosta\.app$/m);
  assert.match(project, /^\s*PRODUCT_BUNDLE_IDENTIFIER: com\.tifloacosta\.app\.ShareExtension$/m);
  assert.match(project, /sources:\s*\n\s*- Sources/);
  assert.match(info, /CFBundleIdentifier/);
  assert.match(appGroup, /group\.com\.tifloacosta\.app/);
  assert.match(shareGroup, /group\.com\.tifloacosta\.app/);
  assert.match(info, /UIBackgroundModes/);
});

test('candidate CI compiles without a TestFlight upload', () => {
  assert.match(reviewWorkflow, /release\/ios-candidate-phases1-6-20261106/);
  assert.match(reviewWorkflow, /CODE_SIGNING_ALLOWED=NO build/);
  assert.match(uploadWorkflow, /branches: \[main\]/);
  assert.doesNotMatch(reviewWorkflow, /altool --upload-app/);
});

test('candidate includes reader and podcast state without resetting identity', () => {
  const reader = read('ios-app-native/Sources/NativeTifloLector.swift');
  const podcasts = read('ios-app-native/Sources/NativePodcastLibrary.swift');
  const podcastScreen = read('ios-app-native/Sources/NativePodcasts.swift');
  assert.match(reader, /addBookmark/);
  assert.match(reader, /addAudioBookmark/);
  assert.match(podcasts, /UserDefaults\.standard/);
  assert.match(podcasts, /savedEpisodes/);
  assert.match(podcastScreen, /Importar suscripciones OPML/);
  assert.match(podcastScreen, /Reproducir favorito/);
});

test('signed release still requires separate explicit authorization', () => {
  const prep = read('ios-app-native/scripts/prepare-testflight-project.mjs');
  assert.match(prep, /IOS_PROFILE_APP_NAME/);
  assert.match(prep, /IOS_PROFILE_EXTENSION_NAME/);
  assert.match(prep, /GITHUB_RUN_NUMBER/);
  assert.match(prep, /com\.tifloacosta\.app/);
});
