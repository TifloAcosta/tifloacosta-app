import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGoogleAccessToken } from './google-play-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const request = JSON.parse(await readFile(root + 'release/request.json', 'utf8'));
if (request.versionName !== '1.3.9' || request.track !== 'production' ||
    request.status !== 'draft' || request.confirmProduction !== false) {
  throw new Error('Refusing to operate on anything other than the existing non-published 1.3.9 draft');
}
const account = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || 'null');
if (!account) throw new Error('Google Play service account missing');
const token = await createGoogleAccessToken(account);
const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tifloacosta.app/generatedApks/21';
const get = async (url, mime = 'application/json') => {
  const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: mime } });
  if (!response.ok) throw new Error('Google Play download request failed HTTP ' + response.status);
  return response;
};
const data = await (await get(base)).json();
const options = (data.generatedApks || []).filter(x => Array.isArray(x.unprotectedGeneratedSplitApks) && x.unprotectedGeneratedSplitApks.length);
if (options.length !== 1) throw new Error('Expected exactly one Google Play signing certificate with unprotected splits');
const option = options[0];
const variant = (option.targetingInfo?.variant || []).find(x => Number(x.variantNumber) === 3);
if (!variant) throw new Error('Expected Pixel 10 variant 3 is not in the Google Play targeting info');
const sdkValues = variant.targeting?.sdkVersionTargeting?.value || [];
if (!sdkValues.some(x => Number(x.min) >= 29 && Number(x.min) <= 36)) {
  throw new Error('Variant 3 has unexpected Android SDK targeting');
}
const names = ['', 'config.arm64_v8a', 'config.xxhdpi', 'config.es', 'config.en'];
const wanted = names.map(name => {
  const matches = option.unprotectedGeneratedSplitApks.filter(x => Number(x.variantId) === 3 &&
      String(x.moduleName) === 'base' && String(x.splitId || '') === name);
  if (matches.length !== 1) throw new Error('Missing unique unprotected Play-signed split: ' + (name || 'base'));
  return { name: name || 'base', ...matches[0] };
});
const folder = root + 'release/out/pixel10-139/';
await mkdir(folder, { recursive: true });
const manifest = [];
for (const item of wanted) {
  const url = base + '/downloads/' + encodeURIComponent(item.downloadId) + ':download?alt=media';
  const bytes = Buffer.from(await (await get(url, 'application/octet-stream')).arrayBuffer());
  if (bytes.length < 1000 || bytes.toString('ascii', 0, 2) !== 'PK') {
    throw new Error('Invalid APK content returned from Google for split ' + item.name);
  }
  const filename = (item.name === 'base' ? 'base' : item.name.replace(/[^a-z0-9._]/gi, '_')) + '.apk';
  await writeFile(folder + filename, bytes);
  manifest.push({ split: item.name, filename, sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log('Downloaded unprotected signed APK split '+filename+' '+bytes.length+' bytes');
}
const zipName = 'TifloAcosta 1.3.9 Pixel10 sin protección.apks';
const zipPath = root + 'release/out/' + zipName;
const py = spawnSync('python3', [
  '-m', 'zipfile', '-c', zipPath, ...manifest.map(x => folder + x.filename)
], { stdio: 'inherit' });
if (py.status !== 0) throw new Error('Failed to package signed split APKs');
const hash = createHash('sha256').update(await readFile(zipPath)).digest('hex');
await writeFile(root + 'release/out/pixel10-provenance.json', JSON.stringify({
  packageName:'com.tifloacosta.app',versionName:'1.3.9',versionCode:21,
  sourceCodeCommit:'41905966ea4fc53e9dcaf51e36a4c712a2a5d545',
  signedByGooglePlay:true,
  originalAppProtectionEnabled:true,
  unprotectedSplits:true,
  stage:'production draft', published:false,
  targetDevice:'Google Pixel 10 - arm64, Android API 36, xxhdpi, es/en',
  certificateSha256:option.certificateSha256Hash,
  archiveFileName:zipName,archiveSha256:hash,
  files:manifest
},null,2)+'\n');
console.log('UNPROTECTED_GOOGLE_PLAY_SPLITS_PACKAGE_READY '+zipName+' SHA256='+hash);
