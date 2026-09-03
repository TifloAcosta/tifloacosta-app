import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const core = require('../app-core.js');

test('detectInstallPlatform distinguishes iOS including iPadOS desktop user agents', () => {
  assert.equal(core.detectInstallPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }), 'ios');
  assert.equal(core.detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(core.detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9)', platform: 'Linux armv8l', maxTouchPoints: 5 }), 'android');
  assert.equal(core.detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 }), 'windows');
  assert.equal(core.detectInstallPlatform({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)', platform: 'MacIntel', maxTouchPoints: 0 }), 'macos');
});

test('first standalone opening emits one install event plus an installed-app open event', () => {
  assert.deepEqual(core.getInstallAnalyticsEvents({ standalone: true, installedNow: false, alreadyTracked: false, platform: 'ios' }), [
    { path: 'pwa-install-ios', title: 'PWA install · iOS' },
    { path: 'pwa-open-ios', title: 'PWA open · iOS' }
  ]);
});

test('later standalone openings do not duplicate the install event', () => {
  assert.deepEqual(core.getInstallAnalyticsEvents({ standalone: true, installedNow: false, alreadyTracked: true, platform: 'android' }), [
    { path: 'pwa-open-android', title: 'PWA open · Android' }
  ]);
});

test('browser install event records installation without counting a browser visit as an installed-app open', () => {
  assert.deepEqual(core.getInstallAnalyticsEvents({ standalone: false, installedNow: true, alreadyTracked: false, platform: 'windows' }), [
    { path: 'pwa-install-windows', title: 'PWA install · Windows' }
  ]);
  assert.deepEqual(core.getInstallAnalyticsEvents({ standalone: false, installedNow: false, alreadyTracked: false, platform: 'windows' }), []);
});
