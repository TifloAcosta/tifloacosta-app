import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { profileAllowsCloudDocuments } from '../scripts/icloud-profile-services.mjs';

const cases = [
  ['*', true, false], [['*'], true, false],
  [['CloudDocuments'], true, true], [['CloudDocuments', 'CloudKit'], true, true],
  [['CloudDocuments', '*'], true, false],
  [null, false, false], [[], false, false], [['CloudKit'], false, false],
  ['CloudDocuments', false, false], ['Cloud*', false, false], [['Cloud*'], false, false],
  [['CloudDocuments', 1], false, false], [{service: '*'}, false, false]
];
test('iCloud profile allowlist and signed entitlement are distinct', () => {
  for (const [value, allowed] of cases) assert.equal(profileAllowsCloudDocuments(value), allowed);
  const scriptDir = fileURLToPath(new URL('../scripts/', import.meta.url));
  const result = execFileSync('python3', ['-c', 'import json,sys; sys.path.insert(0,sys.argv[1]); from icloud_profile_services import profile_allows_cloud_documents,signed_claims_cloud_documents; cases=json.load(sys.stdin); print(json.dumps([[profile_allows_cloud_documents(x[0]),signed_claims_cloud_documents(x[0])] for x in cases]))', scriptDir], { input: JSON.stringify(cases), encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), cases.map(x => x.slice(1)));
});
test('iCloud IPA checks allowlist and exact signed claim independently', () => {
  const script = readFileSync(new URL('../scripts/verify-testflight-ipa.py', import.meta.url), 'utf8');
  assert.match(script, /profile_allows_cloud_documents\(profile\.get/);
  assert.match(script, /signed_claims_cloud_documents\(entitlements\.get/);
  const profile = readFileSync(new URL('../scripts/create-appstore-profiles.mjs', import.meta.url), 'utf8');
  assert.match(profile, /profileAllowsCloudDocuments\(entitlements\[/);
  assert.match(profile, /inspected\.certificates\.includes\(signingSHA\)/);
});
