import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../../.github/workflows/release-android.yml', import.meta.url), 'utf8').catch(() => '');

test('release workflow is manual-only and publication defaults off', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /publish:/);
  assert.match(workflow, /default:\s*false/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
});

test('release workflow uses reproducible dependency and Gradle caches', () => {
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /cache:\s*npm/);
  assert.match(workflow, /cache:\s*gradle/);
});

test('release workflow resolves identity before Gradle and verifies signing before publication', () => {
  const resolveIndex = workflow.indexOf('release-runner.mjs resolve');
  const gradleIndex = workflow.indexOf('bundleRelease');
  const verifyIndex = workflow.indexOf('jarsigner -verify');
  const publishIndex = workflow.indexOf('release-runner.mjs publish');
  assert.ok(resolveIndex >= 0 && resolveIndex < gradleIndex);
  assert.ok(gradleIndex < verifyIndex);
  assert.ok(verifyIndex < publishIndex);
  assert.match(workflow, /TIFLO_ANDROID_VERSION_NAME/);
  assert.match(workflow, /TIFLO_ANDROID_VERSION_CODE/);
});

test('release workflow prepares accessible reports and one named zip artifact', () => {
  assert.match(workflow, /INFORMACION-COMPILACION\.txt/);
  assert.match(workflow, /github-summary\.md/);
  assert.match(workflow, /notas-google-play\.txt/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /zip_name/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
