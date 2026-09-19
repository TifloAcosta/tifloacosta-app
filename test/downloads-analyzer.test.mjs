import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('analyzer uses the main-domain Worker endpoint', async () => {
  const [source, config] = await Promise.all([read('downloads.js'), read('download-config.js')]);
  assert.match(config, /endpoint:\s*'https:\/\/tifloacosta\.com\/api\/download\/analyze'/);
  assert.doesNotMatch(config, /endpoint:\s*''/);
  assert.match(source, /method:\s*'POST'/);
  assert.match(source, /body:\s*JSON\.stringify\(\{ url \}\)/);
  assert.doesNotMatch(source, /endpoint\s*\+\s*['"`]\?/);
});

test('analyzer parses structured error responses before treating HTTP status as service failure', async () => {
  const source = await read('downloads.js');
  const payloadIndex = source.indexOf('const payload = await response.json()');
  const statusIndex = source.indexOf('if (!response.ok');
  assert.ok(payloadIndex >= 0, 'response JSON must be parsed');
  assert.ok(statusIndex >= 0, 'HTTP error status must still be checked');
  assert.ok(payloadIndex < statusIndex, 'structured error JSON must be parsed before the HTTP status fallback');
});

test('analyzer failure keeps local providers usable and distinguishes generic web pages', async () => {
  const source = await read('downloads.js');
  assert.match(source, /if \(local\.provider !== 'web'\)/);
  assert.match(source, /renderExternalNotice\(local\.provider/);
  assert.match(source, /genericNeedsAnalyzer/);
});

test('download Worker deploys from main when analyzer code changes', async () => {
  const workflow = await read('.github/workflows/deploy-download-worker.yml');
  assert.match(workflow, /branches:\s*\n\s*- ['"]?main['"]?/);
  assert.match(workflow, /- ['"]?download-worker\/\*\*['"]?/);
  assert.match(workflow, /- ['"]?\.github\/workflows\/deploy-download-worker\.yml['"]?/);
});

test('deployment smoke-tests the main-domain download API before the client switches to it', async () => {
  const workflow = await read('.github/workflows/deploy-download-worker.yml');
  assert.match(workflow, /https:\/\/tifloacosta\.com\/api\/download\/health/);
  assert.match(workflow, /https:\/\/tifloacosta\.com\/api\/download\/analyze/);
  assert.match(workflow, /"code":"no_files"/);
});
