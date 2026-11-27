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


test('signature diagnosis cannot upload, assign beta groups, or issue new certificates', () => {
  assert.match(workflow, /default: none/);
  assert.ok(workflow.includes("inputs.verify_build == '' && (inputs.mode == 'sign-only' || inputs.mode == 'upload')"));
  for (const step of ['Impedir beta incompleta según registro de actualización', 'Subir compilación nativa a Apple TestFlight', 'Confirmar beta disponible para probadores internos con Apple']) {
    assert.ok(workflow.includes(step + "\n        if: ${{ inputs.mode == 'upload' }}"));
  }
  assert.ok(workflow.includes("inputs.mode == 'upload' && env.NEW_P12 == 'true'"));
  assert.ok(workflow.includes("inputs.mode == 'sign-only' && '1' || '0'"));
  assert.equal((workflow.match(/if \[ "\$TIFLO_SIGNING_PREFLIGHT" != "1" \]; then/g) || []).length, 2);
  const signing = readFileSync(new URL('../scripts/ensure-signing.mjs', import.meta.url), 'utf8');
  const profiles = readFileSync(new URL('../scripts/create-appstore-profiles.mjs', import.meta.url), 'utf8');
  assert.ok(signing.indexOf("process.env.TIFLO_SIGNING_PREFLIGHT === '1'") < signing.indexOf("const keyPath="));
  assert.ok(profiles.includes("Diagnóstico sin cambios de capacidades"));
  assert.ok(workflow.includes('no se ha enviado ni se publicará como artefacto'));
});
