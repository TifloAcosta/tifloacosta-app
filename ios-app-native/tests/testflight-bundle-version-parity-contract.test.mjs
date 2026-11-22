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
