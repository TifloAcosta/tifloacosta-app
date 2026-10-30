import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('Google Play staging stays draft-only even when the separately authorized production release is completed', async () => {
  const [requestRaw, staging, workflow] = await Promise.all([
    read('mobile/release/request.json'),
    read('mobile/scripts/stage-play-draft.mjs'),
    read('.github/workflows/stage-android-139-play-apk.yml')
  ]);
  const request = JSON.parse(requestRaw);
  assert.equal(request.track, 'production');
  assert.equal(request.status, 'completed');
  assert.equal(request.confirmProduction, true);
  assert.equal(request.notifyUpdate, false);
  assert.match(staging, /status:\s*'draft'/);
  assert.match(staging, /updateTrackReleases\(editId,\s*'production',\s*\[\.\.\.active,\s*draft\]\)/);
  assert.match(staging, /await play\.validateEdit\(editId\)/);
  assert.match(staging, /await play\.commitEdit\(editId\)/);
  assert.doesNotMatch(staging, /status:\s*'completed'|status:\s*'inProgress'/);
  assert.doesNotMatch(workflow, /stage-(?:internal|beta|alpha)|--publish/);
});

test('final APK must be obtained from Google signed output of the staged AAB', async () => {
  const [staging, workflow] = await Promise.all([
    read('mobile/scripts/stage-play-draft.mjs'),
    read('.github/workflows/stage-android-139-play-apk.yml')
  ]);
  assert.match(staging, /\/generatedApks\//);
  assert.match(staging, /generatedUniversalApk\.downloadId/);
  assert.match(staging, /sha256/);
  assert.match(staging, /GooglePlay\.apk/);
  assert.match(workflow, /apksigner.*verify/);
  assert.doesNotMatch(workflow, /app-debug\.apk/);
});
