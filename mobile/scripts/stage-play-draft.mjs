import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGoogleAccessToken, createPlayReleaseClient, chooseNextVersionCode, collectVersionCodes } from './google-play-release.mjs';

const packageName = 'com.tifloacosta.app';
const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + packageName;
const mobileDir = fileURLToPath(new URL('../', import.meta.url));
const releaseDir = mobileDir + 'release/';
const androidDir = mobileDir + 'android/';
const outDir = releaseDir + 'out/';
const request = JSON.parse(await readFile(releaseDir + 'request.json', 'utf8'));
if (request.versionName !== '1.3.9' || request.track !== 'production' ||
    request.status !== 'draft' || request.confirmProduction !== false ||
    request.notifyUpdate !== false) {
  throw new Error('Refusing to stage: this workflow permits only a non-published 1.3.9 production draft');
}
const serviceAccount = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || 'null');
if (!serviceAccount) throw new Error('Google Play credentials missing');
const token = await createGoogleAccessToken(serviceAccount);
const play = createPlayReleaseClient({ packageName, accessToken: token });
const edit = await play.createEdit();
const editId = String(edit.id || '');
if (!editId) throw new Error('No Google Play edit id');
const [trackData, bundleData] = await Promise.all([play.listTracks(editId), play.listBundles(editId)]);
const tracks = trackData.tracks || [];
const production = tracks.find(x => x.track === 'production');
if (!production) throw new Error('Production track not found: will not replace existing track');
const active = production.releases || [];
if (!active.length || !active.some(x => x.status === 'completed' || x.status === 'inProgress')) {
  throw new Error('No active production release; refusing to replace release state');
}
if (active.some(x => !['completed', 'inProgress', 'halted'].includes(x.status))) {
  throw new Error('Unexpected production release state; manual review required before drafting');
}
const state = JSON.parse(await readFile(releaseDir + 'state.json', 'utf8'));
const versionCode = chooseNextVersionCode({
  playCodes: collectVersionCodes({ tracks, bundles: bundleData.bundles || [] }),
  localCode: Math.max(20, Number(state.lastSuccessfulVersionCode || 0))
});
const env = {
  ...process.env,
  TIFLO_ANDROID_VERSION_NAME: request.versionName,
  TIFLO_ANDROID_VERSION_CODE: String(versionCode)
};
const run = (cmd, args, cwd = androidDir) => {
  const result = spawnSync(cmd, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(cmd + ' exited with code ' + result.status);
};
run('./gradlew', ['--no-daemon', 'bundleRelease', '--stacktrace']);
const aab = androidDir + 'app/build/outputs/bundle/release/app-release.aab';
run('jarsigner', ['-verify', aab], mobileDir);
const bytes = await readFile(aab);
const aabHash = createHash('sha256').update(bytes).digest('hex');
console.log('AAB SHA-256: ' + aabHash);
const uploaded = await play.uploadBundle(editId, aab);
if (Number(uploaded.versionCode) !== versionCode) {
  throw new Error('Google Play upload versionCode does not match signed AAB');
}
const draft = {
  name: request.versionName,
  status: 'draft',
  versionCodes: [String(versionCode)],
  inAppUpdatePriority: Number(request.priority || 0),
  releaseNotes: [
    { language: 'es-ES', text: request.notes.es },
    { language: 'en-US', text: request.notes.en }
  ]
};
// Keep all currently serving releases. The new draft must NOT replace the public 1.3.8.
await play.updateTrackReleases(editId, 'production', [...active, draft]);
await play.validateEdit(editId);
await play.commitEdit(editId);
console.log('Google Play production DRAFT committed. NO publication was requested.');
const requestJson = async url => {
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!response.ok) throw new Error('Play generated APK lookup failed: HTTP ' + response.status);
  return response.json();
};
const listUrl = base + '/generatedApks/' + versionCode;
let generated;
for (let attempt = 0; attempt < 7; attempt++) {
  try {
    generated = await requestJson(listUrl);
    if (generated.generatedApks?.some(x => x.generatedUniversalApk?.downloadId)) break;
  } catch (error) {
    if (attempt === 6) throw error;
  }
  await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1)));
}
const universals = (generated?.generatedApks || [])
  .filter(x => x.generatedUniversalApk?.downloadId);
if (universals.length !== 1) {
  throw new Error('Google did not return exactly one Play-signed universal APK; manual selection required');
}
const universal = universals[0];
const downloadId = encodeURIComponent(universal.generatedUniversalApk.downloadId);
const downloadUrl = listUrl + '/downloads/' + downloadId + ':download';
const apkResponse = await fetch(downloadUrl, {
  headers: { Authorization: 'Bearer ' + token }
});
if (!apkResponse.ok) throw new Error('Could not retrieve Google signed APK: HTTP ' + apkResponse.status);
const apk = Buffer.from(await apkResponse.arrayBuffer());
if (apk.length < 1024 || apk.subarray(0, 2).toString('ascii') !== 'PK') {
  throw new Error('Downloaded file is not a valid Android ZIP/APK payload');
}
await mkdir(outDir, { recursive: true });
const name = 'TifloAcosta-Android-' + request.versionName + '-code' + versionCode + '-GooglePlay.apk';
await writeFile(outDir + name, apk);
const apkHash = createHash('sha256').update(apk).digest('hex');
const report = {
  packageName,
  versionName: request.versionName,
  versionCode,
  track: 'production',
  status: 'draft',
  published: false,
  sourceCommit: process.env.GITHUB_SHA || '',
  aabSha256: aabHash,
  playSignedApkSha256: apkHash,
  playSigningCertificateSha256: universal.certificateSha256Hash,
  apkFile: name
};
await writeFile(outDir + 'Google-Play-draft-info.json', JSON.stringify(report, null, 2) + '\n');
console.log('Play-signed APK downloaded as ' + name + '. SHA-256: ' + apkHash);
console.log('The public production release is unchanged; draft must be reviewed manually.');
