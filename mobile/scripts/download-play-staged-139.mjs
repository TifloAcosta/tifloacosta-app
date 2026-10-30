import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createGoogleAccessToken, createPlayReleaseClient } from './google-play-release.mjs';

const packageName = 'com.tifloacosta.app';
const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + packageName;
const mobileDir = fileURLToPath(new URL('../', import.meta.url));
const req = JSON.parse(await readFile(mobileDir + 'release/request.json', 'utf8'));
if (req.versionName !== '1.3.9' || req.track !== 'production' ||
    req.status !== 'draft' || req.confirmProduction !== false) {
  throw new Error('Refusing to download: only 1.3.9 production draft is allowed');
}
const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || 'null');
if (!credentials) throw new Error('Missing Google Play credentials');
const token = await createGoogleAccessToken(credentials);
const play = createPlayReleaseClient({ packageName, accessToken: token });
const edit = await play.createEdit();
const tracks = await play.listTracks(edit.id);
const releases = tracks.tracks?.find(t => t.track === 'production')?.releases || [];
const drafts = releases.filter(r => r.status === 'draft' && r.name === '1.3.9');
if (drafts.length !== 1 || drafts[0].versionCodes?.length !== 1) {
  throw new Error('Expected exactly one 1.3.9 production draft');
}
if (!releases.some(r => r.status === 'completed' || r.status === 'inProgress')) {
  throw new Error('Production active release is missing');
}
const versionCode = Number(drafts[0].versionCodes[0]);
if (!Number.isInteger(versionCode) || versionCode <= 20) {
  throw new Error('Invalid versionCode of the staged draft');
}
const url = base + '/generatedApks/' + versionCode;
const request = async (address, accept = 'application/json') => {
  const response = await fetch(address, {
    headers: { Authorization: 'Bearer ' + token, Accept: accept }
  });
  if (!response.ok) throw new Error('Google Play media request failed: ' + response.status);
  return response;
};
const list = await (await request(url)).json();
const candidates = (list.generatedApks || []).filter(x => x.generatedUniversalApk?.downloadId);
if (candidates.length !== 1) throw new Error('No unique Play-signed universal APK found');
const entry = candidates[0];
const download = url + '/downloads/' +
  encodeURIComponent(entry.generatedUniversalApk.downloadId) + ':download?alt=media';
const response = await request(download, 'application/octet-stream');
const apk = Buffer.from(await response.arrayBuffer());
if (apk.length < 1024 || apk.toString('ascii', 0, 2) !== 'PK') {
  throw new Error('Google did not return raw APK bytes');
}
const out = mobileDir + 'release/out/';
await mkdir(out, { recursive: true });
const fileName = 'TifloAcosta-Android-1.3.9-code' + versionCode + '-GooglePlay.apk';
await writeFile(out + fileName, apk);
const hash = createHash('sha256').update(apk).digest('hex');
const provenance = {
  versionName: '1.3.9', versionCode, packageName,
  status: 'draft', published: false,
  stagedSourceCommit: '41905966ea4fc53e9dcaf51e36a4c712a2a5d545',
  googlePlaySigningCertificateSha256: entry.certificateSha256Hash,
  apkSha256: hash, apkFileName: fileName
};
await writeFile(out + 'Google-Play-draft-info.json', JSON.stringify(provenance,null,2)+'\n');
console.log('Google Play APK downloaded: ' + fileName + ' SHA-256 ' + hash);
console.log('Production remains in draft and previous production version is still active.');
