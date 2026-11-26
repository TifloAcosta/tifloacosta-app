import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/ios-native-testflight-upload.yml', import.meta.url), 'utf8');
const verifier = readFileSync(new URL('../scripts/verify-testflight-ipa.py', import.meta.url), 'utf8');

test('the signed archive sets one build number across app and share extension', () => {
  assert.match(workflow, /CURRENT_PROJECT_VERSION="\$IOS_BUILD_VERSION" archive/);
  assert.match(workflow, /TIFLO_IOS_MARKETING_VERSION: "1\.7"/);
  assert.match(workflow, /Confirmar rama única de la beta interna/);
  assert.ok(workflow.includes('refs/heads/development/next-public-1.6-500200-20261121'));
  assert.match(workflow, /MARKETING_VERSION="\$TIFLO_IOS_MARKETING_VERSION"/);
});

test('IPA verification names the actual mismatched bundle when versions disagree', () => {
  assert.match(verifier, /CFBundleVersion/);
  assert.match(verifier, /identifier.*actual_version/s);
});


test('1.7 injects and verifies AcoustID without logging its value', () => {
  assert.ok(workflow.includes('vars.TIFLO_ACOUSTID_CLIENT'));
  assert.ok(workflow.includes('TIFLO_ACOUSTID_CLIENT="$TIFLO_ACOUSTID_CLIENT"'));
  assert.ok(verifier.includes("app_info.get('TifloAcoustIDClient'"));
  assert.ok(verifier.includes('actual_client != expected_client'));
  assert.ok(verifier.includes("app_info.get('TifloCinemaPublicDriveAPIKey'"));
});
