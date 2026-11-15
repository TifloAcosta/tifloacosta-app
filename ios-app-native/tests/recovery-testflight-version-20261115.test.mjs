import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('recovered iOS beta uses the open 1.4 TestFlight train rather than public 1.3', () => {
  const workflow = file('.github/workflows/ios-native-testflight-upload.yml');
  const prep = file('ios-app-native/scripts/prepare-testflight-project.mjs');
  assert.match(workflow, /TIFLO_IOS_MARKETING_VERSION: "1\.4"/);
  assert.match(prep, /TIFLO_IOS_MARKETING_VERSION \|\| '1\.4'/);
});
