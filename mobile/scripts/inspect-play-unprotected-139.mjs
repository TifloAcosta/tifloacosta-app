import { createGoogleAccessToken } from './google-play-release.mjs';
const serviceAccount = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || 'null');
if (!serviceAccount) throw new Error('Google Play credentials missing');
const token = await createGoogleAccessToken(serviceAccount);
const url = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tifloacosta.app/generatedApks/21';
const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
if (!r.ok) throw new Error('Could not list Play APK types: HTTP '+r.status);
const data = await r.json();
const result = (data.generatedApks || []).map((x, i) => ({
  signingKeyIndex: i,
  signingCertificate: x.certificateSha256Hash,
  universal: Boolean(x.generatedUniversalApk?.downloadId),
  protectedStandalone: (x.generatedStandaloneApks || []).map(y=>({variantId:y.variantId})),
  unprotectedStandalone: (x.unprotectedGeneratedStandaloneApks || []).map(y=>({variantId:y.variantId})),
  protectedSplit: (x.generatedSplitApks || []).length,
  unprotectedSplit: (x.unprotectedGeneratedSplitApks || []).length,
  targetingInfo: x.targetingInfo || null
}));
console.log('PLAY 1.3.9 CODE 21 OUTPUTS: '+JSON.stringify(result));
if (!result.length) throw new Error('Play generated no APK files for code 21');

for (const key of data.generatedApks || []) {
  const groups = new Map();
  for (const entry of key.unprotectedGeneratedSplitApks || []) {
    const v = String(entry.variantId);
    if (!groups.has(v)) groups.set(v, []);
    groups.get(v).push(entry.splitId || entry.moduleName || 'base');
  }
  for (const [variant, names] of groups) {
    console.log('VARIANT '+variant+' COUNT '+names.length+' SPLITS '+names.join(','));
  }
}
