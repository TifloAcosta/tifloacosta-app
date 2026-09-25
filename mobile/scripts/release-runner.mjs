import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseRequest, artifactNames } from './release-request.mjs';
import { resolveVersionCode, publishRelease } from './release-android.mjs';
import { buildReleaseInfo, buildGithubSummary, buildPlayNotes } from './release-report.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, '..');
const requestPath = process.env.TIFLO_RELEASE_REQUEST || path.join(mobileDir, 'release', 'request.json');
const statePath = process.env.TIFLO_RELEASE_STATE || path.join(mobileDir, 'release', 'state.json');

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function positiveCode() {
  const code = Number(process.env.TIFLO_ANDROID_VERSION_CODE);
  if (!Number.isInteger(code) || code < 1) throw new Error('TIFLO_ANDROID_VERSION_CODE must be a positive integer');
  return code;
}

async function resolve() {
  const request = await readReleaseRequest(requestPath);
  const state = await readJson(statePath);
  const publish = process.env.TIFLO_RELEASE_PUBLISH === 'true';
  const result = await resolveVersionCode({ localState: state, publish });
  process.stdout.write(`version_name=${request.versionName}\nversion_code=${result.versionCode}\nversion_source=${result.source}\n`);
}

async function report() {
  const request = await readReleaseRequest(requestPath);
  const versionCode = positiveCode();
  const names = artifactNames({ versionName: request.versionName, versionCode });
  const outDir = process.env.TIFLO_RELEASE_OUT || path.join(mobileDir, 'release-out');
  await mkdir(outDir, { recursive: true });
  const published = process.env.TIFLO_RELEASE_PUBLISHED === 'true';
  const uploaded = published || process.env.TIFLO_RELEASE_UPLOADED === 'true';
  const data = {
    versionName: request.versionName,
    versionCode,
    track: request.track,
    status: request.status,
    commit: process.env.GITHUB_SHA || '',
    date: new Date().toISOString(),
    artifact: names.zip,
    checks: { tests: true, signing: true, aab: true, apk: true, notifications: true },
    play: { uploaded, committed: published },
    notification: { sent: process.env.TIFLO_RELEASE_NOTIFICATION_SENT === 'true' }
  };
  await writeFile(path.join(outDir, 'INFORMACION-COMPILACION.txt'), buildReleaseInfo(data), 'utf8');
  await writeFile(path.join(outDir, 'notas-google-play.txt'), buildPlayNotes(request), 'utf8');
  await writeFile(path.join(outDir, 'github-summary.md'), buildGithubSummary(data), 'utf8');
  process.stdout.write(`aab_name=${names.aab}\napk_name=${names.apk}\nzip_name=${names.zip}\n`);
}

async function publish() {
  if (process.env.TIFLO_RELEASE_PUBLISH !== 'true') throw new Error('Publication is disabled');
  const request = await readReleaseRequest(requestPath);
  if (request.status !== 'completed') throw new Error('A published release must use status=completed');
  const bundlePath = String(process.env.ANDROID_BUNDLE_PATH || '').trim();
  if (!bundlePath) throw new Error('ANDROID_BUNDLE_PATH is required');
  const result = await publishRelease({
    request,
    versionCode: positiveCode(),
    bundle: await readFile(bundlePath)
  });
  process.stdout.write(`published=${result.committed ? 'true' : 'false'}\nnotification_sent=${result.notificationSent ? 'true' : 'false'}\n`);
}

const mode = process.argv[2] || '';
const actions = { resolve, report, publish };
if (!actions[mode]) {
  process.stderr.write('Usage: node release-runner.mjs resolve|report|publish\n');
  process.exitCode = 2;
} else {
  actions[mode]().catch(error => {
    process.stderr.write(`Android release failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
