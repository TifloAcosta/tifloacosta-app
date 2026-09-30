import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Android release workflow only publishes from an explicit matching release marker or manual publish input', async () => {
  const workflow = await read('.github/workflows/release-mobile-android.yml');

  assert.match(workflow, /Resolve Android release mode/);
  assert.match(workflow, /mobile\/release\/prepare\.once/);
  assert.match(workflow, /request\.versionName/);
  assert.match(workflow, /request\.track/);
  assert.match(workflow, /publish \$\{request\.versionName\} \$\{request\.track\}/);
  assert.match(workflow, /TIFLO_RELEASE_MODE=publish/);
  assert.match(workflow, /TIFLO_RELEASE_MODE=prepare/);
  assert.match(workflow, /env\.TIFLO_RELEASE_MODE == 'publish'/);
  assert.match(workflow, /env\.TIFLO_RELEASE_MODE != 'publish'/);
});

test('ordinary prepare markers cannot silently publish', async () => {
  const workflow = await read('.github/workflows/release-mobile-android.yml');
  assert.match(workflow, /marker\.startsWith\('prepare '\)/);
  assert.match(workflow, /mode = 'prepare'/);
  assert.match(workflow, /Release marker does not match the requested version and track/);
});
