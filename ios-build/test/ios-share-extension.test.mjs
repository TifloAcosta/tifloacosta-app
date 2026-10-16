import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
const read = file => readFileSync(resolve(import.meta.dirname, '..', file), 'utf8');

test('iOS Share Extension is generated as a real second Xcode target', () => {
  const install = read('install-native-video.mjs');
  const configure = read('configure-share-extension.rb');
  const plist = read('share-extension/Info.plist');
  assert.match(install, /configure-share-extension\.rb/);
  assert.match(configure, /new_target\(:app_extension, 'TifloAcostaShare'/);
  assert.match(configure, /app\.add_dependency\(extension_target\)/);
  assert.match(configure, /dst_subfolder_spec = '13'/);
  assert.match(plist, /com\.apple\.share-services/);
  assert.match(plist, /NSExtensionPrincipalClass/);
});

test('Share Extension uses the same App Group as main iPhone app', () => {
  for (const file of ['share-extension/App.entitlements', 'share-extension/Share.entitlements',
                      'share-extension/ShareViewController.swift', 'native/TifloReadingAccessibilityPlugin.swift']) {
    assert.match(read(file), /group\.com\.tifloacosta\.app/, file);
  }
  const native = read('native/TifloReadingAccessibilityPlugin.swift');
  assert.match(native, /listSharedItems/);
  assert.match(native, /acknowledgeSharedItem/);
  const queue = read('ios-share-inbox.js');
  assert.match(queue, /dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  assert.match(queue, /acknowledgeSharedItem/);
  assert.match(queue, /if \(!globalThis\.confirm/);
  assert.doesNotMatch(queue, /acknowledgeSharedItem\?\.\(\{ id: item\.id \}\);\s*input\.dispatchEvent/);
});

test('Release is blocked if either Apple profile lacks App Groups', () => {
  const release = read('../.github/workflows/ios-testflight.yml');
  assert.match(release, /IOS_SHARE_PROFILE_NAME/);
  assert.match(release, /ShareExtension\.appex\/Info\.plist/);
  assert.match(release, /security cms -D/);
  assert.match(release, /com\.apple\.security\.application-groups/);
  assert.match(release, /SHARE_PROFILE_REPLACEME/);
  assert.match(release, /com\.tifloacosta\.app\.ShareExtension/);
});
