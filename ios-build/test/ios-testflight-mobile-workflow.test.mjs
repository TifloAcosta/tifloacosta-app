import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const yaml = await readFile(new URL('../../.github/workflows/ios-testflight.yml', import.meta.url),'utf8');
const gate = await readFile(new URL('../check-single-ui-release.mjs', import.meta.url),'utf8').catch(() => '');

test('TestFlight packages the dedicated mobile UI, not public web pages', () => {
  for (const marker of [
    'working-directory: mobile','npm ci','npm test','npm run build',
    'node ../ios-build/prepare-mobile-ui.mjs','npx cap add ios',
    'ios/App/App/public/tiflo-ios-ui-identity.json',
    'check-single-ui-release.mjs'
  ]) assert.ok(yaml.includes(marker), 'Missing signed mobile step '+marker);
  for (const legacy of ['npm run prepare:web','www/web-reading.js','tiflo-build-identity.json'])
    assert.ok(!yaml.includes(legacy), 'Legacy web packaging must not reach TestFlight: '+legacy);
});

test('TestFlight uses SPM-compatible Xcode project and preserves native sharing/signing', () => {
  for (const marker of [
    'xcodebuild -project ios/App/App.xcodeproj', 'ruby ../ios-build/install-share-extension.rb',
    'ruby ../ios-build/configure-ios-compliance.rb', 'Validar App Group en los dos perfiles Apple',
    'Exportar IPA firmada', 'Enviar compilación a App Store Connect para TestFlight'
  ]) assert.ok(yaml.includes(marker), 'Missing release step '+marker);
  assert.ok(!yaml.includes('xcodebuild -workspace ios/App/App.xcworkspace'));
});

test('Distribution cannot proceed without an independent parity gate', () => {
  assert.ok(yaml.includes('node ios-build/check-single-ui-release.mjs'));
  assert.ok(gate.includes('existingLibraryPreserved') || gate.includes('TIFLO_INTERNAL_BETA'),
    'Protect release from silent library migration');
});
